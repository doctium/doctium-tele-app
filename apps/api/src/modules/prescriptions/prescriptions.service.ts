import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@doctium/database';
import { JwtPayload } from '@doctium/types';
import { CryptoSignService } from './crypto-sign.service';
import { PdfService, RxPdfData } from './pdf.service';
import { PharmacyService } from './pharmacy.service';
import { CloudinaryService } from './cloudinary.service';

interface ItemInput {
  drugName: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  refills?: number;
  instructions?: string;
}
interface CreateInput {
  appointmentId?: string;
  userId?: string;
  subPatientId?: string;
  diagnosis?: string;
  notes?: string;
  items: ItemInput[];
}

const fullInclude = {
  doctor: { select: { id: true, name: true, designation: true, mobile: true, clinicName: true, image: true, signatureImage: true } },
  user: { select: { id: true, name: true, image: true } },
  subPatient: { select: { name: true } },
  items: true,
} as const;

@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly signer: CryptoSignService,
    private readonly pdf: PdfService,
    private readonly pharmacy: PharmacyService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  private verifyUrl(code: string): string {
    // QR resolves to the hosted public web verify page (admin-panel /verify/:code).
    const base = process.env.PUBLIC_WEB_URL ?? `http://localhost:${process.env.ADMIN_PORT ?? 3000}`;
    return `${base}/verify/${code}`;
  }

  // ── Issue ───────────────────────────────────────────────────
  async create(doctorId: string, dto: CreateInput) {
    if (!dto.items?.length) throw new BadRequestException('At least one medication is required');

    let userId = dto.userId;
    let subPatientId = dto.subPatientId;
    let appointmentId = dto.appointmentId;

    if (appointmentId) {
      const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
      if (!appt) throw new NotFoundException('Appointment not found');
      if (appt.doctorId !== doctorId) throw new ForbiddenException('Not your appointment');
      userId = appt.userId;
      subPatientId = appt.subPatientId ?? undefined;
      const existing = await prisma.prescription.findUnique({ where: { appointmentId } });
      if (existing) throw new BadRequestException('A prescription already exists for this appointment');
    }
    if (!userId) throw new BadRequestException('A patient (userId or appointmentId) is required');

    // Create first so the auto-generated `code` exists, then sign and persist the signature.
    const created = await prisma.prescription.create({
      data: {
        appointmentId,
        doctorId,
        userId,
        subPatientId,
        diagnosis: dto.diagnosis ?? '',
        notes: dto.notes ?? '',
        signature: '',
        items: {
          create: dto.items.map((i) => ({
            drugName: i.drugName,
            dosage: i.dosage ?? '',
            frequency: i.frequency ?? '',
            duration: i.duration ?? '',
            refills: Number(i.refills) || 0,
            instructions: i.instructions ?? '',
          })),
        },
      },
      include: fullInclude,
    });

    const payload = this.signer.canonical({
      code: created.code,
      doctorId: created.doctorId,
      userId: created.userId,
      items: created.items.map((i) => ({ drugName: i.drugName, dosage: i.dosage, frequency: i.frequency, duration: i.duration, refills: i.refills })),
    });
    const signature = await this.signer.sign(payload);
    const signed = await prisma.prescription.update({ where: { id: created.id }, data: { signature }, include: fullInclude });

    // Fire the pharmacy hook (non-blocking).
    void this.pharmacy.onPrescriptionIssued({
      code: signed.code,
      signature,
      doctorName: signed.doctor.name,
      patientName: signed.subPatient?.name || signed.user.name,
      issuedAt: signed.signedAt.toISOString(),
      verifyUrl: this.verifyUrl(signed.code),
      items: signed.items.map((i) => ({ drugName: i.drugName, dosage: i.dosage, frequency: i.frequency, duration: i.duration, refills: i.refills, instructions: i.instructions })),
    });

    // Archive the issued PDF to Cloudinary (best-effort, non-blocking).
    void this.archive(signed.id);

    return signed;
  }

  /**
   * Re-signs a prescription from its current items. MUST be called after any
   * change to a signed field (e.g. decrementing `refills` on refill approval),
   * otherwise verifyByCode/QR verification would report the Rx as tampered.
   */
  async resign(prescriptionId: string) {
    const rx = await prisma.prescription.findUnique({ where: { id: prescriptionId }, include: { items: true } });
    if (!rx) throw new NotFoundException('Prescription not found');
    const payload = this.signer.canonical({
      code: rx.code,
      doctorId: rx.doctorId,
      userId: rx.userId,
      items: rx.items.map((i) => ({ drugName: i.drugName, dosage: i.dosage, frequency: i.frequency, duration: i.duration, refills: i.refills })),
    });
    const signature = await this.signer.sign(payload);
    const updated = await prisma.prescription.update({ where: { id: prescriptionId }, data: { signature } });
    // The PDF (refill counts + signature) changed — refresh the archived copy.
    void this.archive(prescriptionId);
    return updated;
  }

  /** Renders the current PDF and archives it to Cloudinary, storing the URL. Best-effort. */
  async archive(prescriptionId: string): Promise<void> {
    if (!this.cloudinary.isConfigured()) return;
    try {
      const rx = await prisma.prescription.findUnique({ where: { id: prescriptionId }, include: fullInclude });
      if (!rx) return;
      const buffer = await this.renderPdf(rx);
      const url = await this.cloudinary.uploadPdf(buffer, `doctium/prescriptions/${rx.code}`);
      if (url) await prisma.prescription.update({ where: { id: prescriptionId }, data: { pdfUrl: url } });
    } catch {
      /* archival is best-effort — on-demand generation remains the fallback */
    }
  }

  // ── Lists ───────────────────────────────────────────────────
  getDoctorMine(doctorId: string) {
    return prisma.prescription.findMany({
      where: { doctorId },
      include: { user: { select: { name: true, image: true } }, subPatient: { select: { name: true } }, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  getUserMine(userId: string) {
    return prisma.prescription.findMany({
      where: { userId },
      include: { doctor: { select: { name: true, image: true, designation: true } }, subPatient: { select: { name: true } }, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Detail (authorized) ─────────────────────────────────────
  async getById(id: string, requester: JwtPayload) {
    const rx = await prisma.prescription.findUnique({ where: { id }, include: fullInclude });
    if (!rx) throw new NotFoundException('Prescription not found');
    const allowed = requester.role === 'admin' || requester.sub === rx.doctorId || requester.sub === rx.userId;
    if (!allowed) throw new ForbiddenException('Not allowed to view this prescription');
    return rx;
  }

  // ── PDF ─────────────────────────────────────────────────────
  // Serves the archived copy from Cloudinary when present (proxied through this
  // authed endpoint so access control is unchanged), else generates on-demand.
  async buildPdf(id: string, requester: JwtPayload): Promise<Buffer> {
    const rx = await this.getById(id, requester);
    if (rx.pdfUrl) {
      try {
        const res = await fetch(rx.pdfUrl);
        if (res.ok) return Buffer.from(await res.arrayBuffer());
      } catch {
        /* archived copy unreachable — fall through to regenerate */
      }
    }
    return this.renderPdf(rx);
  }

  private renderPdf(rx: Awaited<ReturnType<PrescriptionsService['getById']>>): Promise<Buffer> {
    const data: RxPdfData = {
      code: rx.code,
      issuedAt: rx.signedAt,
      diagnosis: rx.diagnosis,
      notes: rx.notes,
      doctor: {
        name: rx.doctor.name,
        designation: rx.doctor.designation,
        mobile: rx.doctor.mobile,
        clinicName: rx.doctor.clinicName,
        signatureImage: rx.doctor.signatureImage,
      },
      patient: { name: rx.user.name, forName: rx.subPatient?.name },
      items: rx.items.map((i) => ({ drugName: i.drugName, dosage: i.dosage, frequency: i.frequency, duration: i.duration, refills: i.refills, instructions: i.instructions })),
      verifyUrl: this.verifyUrl(rx.code),
    };
    return this.pdf.build(data);
  }

  // ── Public verification ─────────────────────────────────────
  async verifyByCode(code: string) {
    const rx = await prisma.prescription.findUnique({ where: { code }, include: fullInclude });
    if (!rx) return { valid: false as const, reason: 'not_found' as const };

    const payload = this.signer.canonical({
      code: rx.code,
      doctorId: rx.doctorId,
      userId: rx.userId,
      items: rx.items.map((i) => ({ drugName: i.drugName, dosage: i.dosage, frequency: i.frequency, duration: i.duration, refills: i.refills })),
    });
    const valid = await this.signer.verify(payload, rx.signature);
    return {
      valid,
      reason: valid ? ('ok' as const) : ('tampered' as const),
      prescription: {
        code: rx.code,
        doctorName: rx.doctor.name,
        doctorDesignation: rx.doctor.designation,
        patientName: rx.subPatient?.name || rx.user.name,
        issuedAt: rx.signedAt,
        status: rx.status,
        medicationCount: rx.items.length,
      },
    };
  }

  // ── Pharmacy partner ────────────────────────────────────────
  async getByCode(code: string) {
    const rx = await prisma.prescription.findUnique({ where: { code }, include: fullInclude });
    if (!rx) throw new NotFoundException('Prescription not found');
    return rx;
  }

  async dispense(code: string, dispensedBy?: string) {
    const rx = await prisma.prescription.findUnique({ where: { code } });
    if (!rx) throw new NotFoundException('Prescription not found');
    if (rx.status === 'CANCELLED') throw new BadRequestException('Prescription is cancelled');
    return prisma.prescription.update({
      where: { code },
      data: { status: 'DISPENSED', dispensedAt: new Date(), dispensedBy: dispensedBy ?? 'pharmacy-partner' },
    });
  }
}
