import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "@doctium/database";
import { CloudinaryService } from "../prescriptions/cloudinary.service";
import { resolveImageUrl } from "../../common/image.util";

@Injectable()
export class EmrService {
  constructor(private readonly cloudinary: CloudinaryService) {}

  // ─── Access control ──────────────────────────────────────
  /**
   * A doctor may read/append to a patient's record only if they share a
   * consultation. When the record is for a family member (subPatientId), the
   * appointment must be for that member — appointment-gated, minimum-necessary.
   */
  async assertDoctorCanAccess(
    doctorId: string,
    userId: string,
    subPatientId?: string | null,
  ) {
    const link = await prisma.appointment.findFirst({
      where: { doctorId, userId, ...(subPatientId ? { subPatientId } : {}) },
      select: { id: true },
    });
    if (!link) {
      throw new ForbiddenException(
        "You can only access records of patients you have a consultation with.",
      );
    }
  }

  /** A patient may only touch their own account's records (self or a family member they own). */
  async assertOwnsSubPatient(userId: string, subPatientId?: string | null) {
    if (!subPatientId) return; // null = the account holder themselves
    const sp = await prisma.subPatient.findFirst({
      where: { id: subPatientId, userId },
      select: { id: true },
    });
    if (!sp) throw new ForbiddenException("Not your family member.");
  }

  // ─── Full record (scoped to self or a family member) ─────
  private async buildRecord(userId: string, subPatientId?: string | null) {
    const sp = subPatientId ?? null;
    const scoped = {
      orderBy: { createdAt: "desc" as const },
      where: { subPatientId: sp },
    };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        gender: true,
        dob: true,
        age: true,
        image: true,
        medicalConditions: scoped,
        allergies: scoped,
        surgeries: scoped,
        immunizations: scoped,
        medicalFiles: scoped,
      },
    });
    if (!user) throw new NotFoundException("Patient not found");

    const [profile, member, notes, prescriptions] = await Promise.all([
      prisma.healthProfile.findFirst({ where: { userId, subPatientId: sp } }),
      sp ? prisma.subPatient.findUnique({ where: { id: sp } }) : null,
      prisma.clinicalNote.findMany({
        // A scribe draft creates a provenance-only row before the doctor saves;
        // only show notes with actual content in record timelines.
        where: {
          userId,
          subPatientId: sp,
          OR: [
            { subjective: { not: "" } },
            { objective: { not: "" } },
            { assessment: { not: "" } },
            { plan: { not: "" } },
            { bloodPressure: { not: "" } },
            { heartRate: { not: null } },
            { temperature: { not: null } },
            { oxygenSat: { not: null } },
          ],
        },
        include: {
          doctor: {
            select: { id: true, name: true, designation: true, image: true },
          },
          appointment: { select: { date: true, time: true, type: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.prescription.findMany({
        where: { userId, subPatientId: sp },
        include: {
          doctor: { select: { name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    // For a family member, surface their name/age/gender as the patient identity.
    const patient = member
      ? {
          ...user,
          name: member.name,
          gender: member.gender,
          age: member.age,
          image: member.image,
          subPatientId: sp,
          relation: member.relation,
        }
      : { ...user, subPatientId: null };

    return {
      patient: { ...patient, healthProfile: profile },
      clinicalNotes: notes,
      prescriptions,
    };
  }

  getMyRecord(userId: string, subPatientId?: string) {
    return this.buildRecord(userId, subPatientId ?? null);
  }

  async getPatientRecord(
    doctorId: string,
    userId: string,
    subPatientId?: string,
  ) {
    await this.assertDoctorCanAccess(doctorId, userId, subPatientId);
    return this.buildRecord(userId, subPatientId ?? null);
  }

  // ─── Admin oversight ─────────────────────────────────────
  async adminListPatients(search?: string, page = 1, limit = 20) {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { mobile: { contains: search } },
          ],
        }
      : {};
    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where: { ...where, isDelete: false },
        select: {
          id: true,
          name: true,
          email: true,
          mobile: true,
          image: true,
          healthProfiles: {
            where: { subPatientId: null },
            select: { bloodType: true },
            take: 1,
          },
          _count: {
            select: {
              medicalConditions: true,
              allergies: true,
              clinicalNotes: true,
              medicalFiles: true,
              prescriptions: true,
              subPatients: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where: { ...where, isDelete: false } }),
    ]);
    // Flatten the account-holder profile back to a singular field for the UI.
    const items = rows.map(({ healthProfiles, ...u }) => ({
      ...u,
      healthProfile: healthProfiles[0] ?? null,
    }));
    return { items, total, page, limit };
  }

  adminGetRecord(userId: string, subPatientId?: string) {
    return this.buildRecord(userId, subPatientId ?? null);
  }

  /** The patients an account holds clinical data for: self + family members. */
  async listAccountPatients(userId: string) {
    const subs = await prisma.subPatient.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        relation: true,
        age: true,
        gender: true,
        image: true,
      },
      orderBy: { createdAt: "asc" },
    });
    return subs;
  }

  // ─── Health profile (one per patient: self or member) ────
  async upsertProfile(
    userId: string,
    dto: Record<string, unknown>,
    subPatientId?: string,
  ) {
    await this.assertOwnsSubPatient(userId, subPatientId);
    const sp = subPatientId ?? null;
    const data = {
      bloodType: typeof dto.bloodType === "string" ? dto.bloodType : undefined,
      genotype: typeof dto.genotype === "string" ? dto.genotype : undefined,
      heightCm: dto.heightCm != null ? Number(dto.heightCm) : undefined,
      weightKg: dto.weightKg != null ? Number(dto.weightKg) : undefined,
      isOrganDonor:
        typeof dto.isOrganDonor === "boolean" ? dto.isOrganDonor : undefined,
      notes: typeof dto.notes === "string" ? dto.notes : undefined,
    };
    const existing = await prisma.healthProfile.findFirst({
      where: { userId, subPatientId: sp },
      select: { id: true },
    });
    if (existing) {
      return prisma.healthProfile.update({ where: { id: existing.id }, data });
    }
    return prisma.healthProfile.create({
      data: { userId, subPatientId: sp, ...data },
    });
  }

  // ─── Conditions / allergies / surgeries / immunizations ──
  async addCondition(
    userId: string,
    dto: Record<string, unknown>,
    opts: { doctorId?: string; subPatientId?: string } = {},
  ) {
    await this.assertOwnsSubPatientForOwner(userId, opts);
    return prisma.medicalCondition.create({
      data: {
        userId,
        subPatientId: opts.subPatientId ?? null,
        name: String(dto.name ?? "").trim(),
        status: (dto.status as never) ?? "ACTIVE",
        onsetDate: String(dto.onsetDate ?? ""),
        notes: String(dto.notes ?? ""),
        recordedByDoctorId: opts.doctorId ?? null,
      },
    });
  }

  async addAllergy(
    userId: string,
    dto: Record<string, unknown>,
    opts: { doctorId?: string; subPatientId?: string } = {},
  ) {
    await this.assertOwnsSubPatientForOwner(userId, opts);
    return prisma.allergy.create({
      data: {
        userId,
        subPatientId: opts.subPatientId ?? null,
        substance: String(dto.substance ?? "").trim(),
        reaction: String(dto.reaction ?? ""),
        severity: (dto.severity as never) ?? "UNKNOWN",
        recordedByDoctorId: opts.doctorId ?? null,
      },
    });
  }

  async addSurgery(
    userId: string,
    dto: Record<string, unknown>,
    subPatientId?: string,
  ) {
    await this.assertOwnsSubPatient(userId, subPatientId);
    return prisma.surgery.create({
      data: {
        userId,
        subPatientId: subPatientId ?? null,
        name: String(dto.name ?? "").trim(),
        performedDate: String(dto.performedDate ?? ""),
        hospital: String(dto.hospital ?? ""),
        notes: String(dto.notes ?? ""),
      },
    });
  }

  async addImmunization(
    userId: string,
    dto: Record<string, unknown>,
    subPatientId?: string,
  ) {
    await this.assertOwnsSubPatient(userId, subPatientId);
    return prisma.immunization.create({
      data: {
        userId,
        subPatientId: subPatientId ?? null,
        vaccine: String(dto.vaccine ?? "").trim(),
        doseLabel: String(dto.doseLabel ?? ""),
        dateGiven: String(dto.dateGiven ?? ""),
        notes: String(dto.notes ?? ""),
      },
    });
  }

  /** A doctor-added entry verifies the doctor's access; a patient-added one verifies ownership. */
  private async assertOwnsSubPatientForOwner(
    userId: string,
    opts: { doctorId?: string; subPatientId?: string },
  ) {
    if (opts.doctorId) {
      await this.assertDoctorCanAccess(
        opts.doctorId,
        userId,
        opts.subPatientId,
      );
    } else {
      await this.assertOwnsSubPatient(userId, opts.subPatientId);
    }
  }

  /** Owner-scoped delete across the entry models — the account holder owns these rows. */
  async deleteEntry(
    model: "condition" | "allergy" | "surgery" | "immunization",
    id: string,
    userId: string,
  ) {
    const table = {
      condition: prisma.medicalCondition,
      allergy: prisma.allergy,
      surgery: prisma.surgery,
      immunization: prisma.immunization,
    }[model] as { deleteMany: (a: unknown) => Promise<{ count: number }> };
    const res = await table.deleteMany({ where: { id, userId } });
    if (res.count === 0) throw new NotFoundException("Entry not found");
    return { deleted: true };
  }

  // ─── File vault ──────────────────────────────────────────
  async addFile(
    userId: string,
    dto: Record<string, unknown>,
    uploader: { by: "PATIENT" | "DOCTOR"; id: string; subPatientId?: string },
  ) {
    if (uploader.by === "DOCTOR") {
      await this.assertDoctorCanAccess(
        uploader.id,
        userId,
        uploader.subPatientId,
      );
    } else {
      await this.assertOwnsSubPatient(userId, uploader.subPatientId);
    }
    const url = await resolveImageUrl(
      this.cloudinary,
      String(dto.dataUrl ?? ""),
      `emr/${userId}/${Date.now()}`,
    );
    if (!url) throw new NotFoundException("No file provided");
    return prisma.medicalFile.create({
      data: {
        userId,
        subPatientId: uploader.subPatientId ?? null,
        category: (dto.category as never) ?? "OTHER",
        fileName: String(dto.fileName ?? "file"),
        fileUrl: url,
        mimeType: String(dto.mimeType ?? ""),
        sizeBytes: dto.sizeBytes != null ? Number(dto.sizeBytes) : null,
        description: String(dto.description ?? ""),
        appointmentId:
          typeof dto.appointmentId === "string" ? dto.appointmentId : null,
        uploadedBy: uploader.by,
        uploadedById: uploader.id,
      },
    });
  }

  async deleteFile(id: string, userId: string) {
    const res = await prisma.medicalFile.deleteMany({ where: { id, userId } });
    if (res.count === 0) throw new NotFoundException("File not found");
    return { deleted: true };
  }

  // ─── SOAP clinical notes (doctor, appointment-scoped) ────
  async upsertNote(doctorId: string, dto: Record<string, unknown>) {
    const appointmentId = String(dto.appointmentId ?? "");
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, doctorId: true, userId: true, subPatientId: true },
    });
    if (!appt) throw new NotFoundException("Appointment not found");
    if (appt.doctorId !== doctorId) {
      throw new ForbiddenException("Not your appointment");
    }

    // Only touch fields the caller actually sent, so a partial save (e.g. just
    // tweaking the assessment) never wipes previously-entered SOAP text or vitals.
    const provided: Record<string, unknown> = {};
    for (const k of [
      "subjective",
      "objective",
      "assessment",
      "plan",
      "bloodPressure",
    ]) {
      if (dto[k] !== undefined) provided[k] = String(dto[k]);
    }
    for (const k of [
      "heartRate",
      "temperature",
      "respiratoryRate",
      "oxygenSat",
      "weightKg",
      "heightCm",
    ]) {
      if (dto[k] !== undefined)
        provided[k] = dto[k] === null ? null : Number(dto[k]);
    }

    return prisma.clinicalNote.upsert({
      where: { appointmentId },
      create: {
        appointmentId,
        doctorId,
        userId: appt.userId,
        subPatientId: appt.subPatientId,
        ...provided,
      },
      update: provided,
    });
  }

  async getNoteForAppointment(
    appointmentId: string,
    requester: { sub: string; role: string },
  ) {
    const note = await prisma.clinicalNote.findUnique({
      where: { appointmentId },
      include: {
        doctor: { select: { id: true, name: true, designation: true } },
      },
    });
    if (!note) return null;
    const allowed =
      requester.role === "admin" ||
      requester.sub === note.doctorId ||
      requester.sub === note.userId;
    if (!allowed) throw new ForbiddenException("Not allowed to view this note");
    return note;
  }
}
