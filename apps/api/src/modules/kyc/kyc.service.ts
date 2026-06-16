import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import * as bcrypt from "bcrypt";
import { prisma } from "@doctium/database";
import { NotificationsService } from "../notifications/notifications.service";
import { CloudinaryService } from "../prescriptions/cloudinary.service";
import { resolveName } from "../../common/name.util";
import {
  CreateDoctorDto,
  ReviewDocDto,
  UploadKycDocDto,
  VerifyDoctorDto,
} from "./dto/kyc.dto";

const DEFAULT_REQUIRED = [
  "CV",
  "MEDICAL_LICENSE",
  "DEGREE_CERTIFICATE",
  "GOVERNMENT_ID",
];

@Injectable()
export class KycService {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  private async setting(key: string, fallback: string): Promise<string> {
    const row = await prisma.setting.findUnique({ where: { key } });
    return row?.value || fallback;
  }

  async requiredDocTypes(): Promise<string[]> {
    try {
      const parsed = JSON.parse(
        await this.setting(
          "kyc_required_docs",
          JSON.stringify(DEFAULT_REQUIRED),
        ),
      );
      return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_REQUIRED;
    } catch {
      return DEFAULT_REQUIRED;
    }
  }

  /** Latest uploaded document per type (re-uploads keep history; the newest wins). */
  private currentDocs(docs: { type: string; createdAt: Date }[]) {
    const byType = new Map<string, (typeof docs)[number]>();
    for (const d of docs) {
      const prev = byType.get(d.type);
      if (!prev || d.createdAt > prev.createdAt) byType.set(d.type, d);
    }
    return [...byType.values()];
  }

  // ── Doctor side ────────────────────────────────────────────
  async getMyVerification(doctorId: string) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: {
        verificationStatus: true,
        isVerified: true,
        rejectionReason: true,
        licenseExpiry: true,
        mdcnFolioNumber: true,
        licenseNumber: true,
        kycSubmittedAt: true,
        kycDocuments: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!doctor) throw new NotFoundException("Doctor not found");
    const required = await this.requiredDocTypes();
    const current = this.currentDocs(doctor.kycDocuments);
    const present = new Set(current.map((d) => d.type));
    return {
      status: doctor.verificationStatus,
      isVerified: doctor.isVerified,
      rejectionReason: doctor.rejectionReason,
      licenseExpiry: doctor.licenseExpiry,
      mdcnFolioNumber: doctor.mdcnFolioNumber,
      licenseNumber: doctor.licenseNumber,
      kycSubmittedAt: doctor.kycSubmittedAt,
      requiredDocs: required,
      missingDocs: required.filter((t) => !present.has(t)),
      documents: current,
    };
  }

  async uploadDocument(doctorId: string, dto: UploadKycDocDto) {
    if (!dto?.dataUrl || !dto?.type)
      throw new BadRequestException("Document type and file are required");
    if (!this.cloudinary.isConfigured()) {
      throw new BadRequestException(
        "Document storage is not configured. Please contact support.",
      );
    }
    const publicId = `kyc/${doctorId}/${dto.type}_${Date.now()}`;
    const url = await this.cloudinary.uploadDataUrl(dto.dataUrl, publicId);
    if (!url) throw new BadRequestException("Upload failed, please try again");

    const doc = await prisma.kycDocument.create({
      data: {
        doctorId,
        type: dto.type as never,
        fileUrl: url,
        fileName: dto.fileName ?? "",
        mimeType: dto.mimeType ?? "",
        expiresAt:
          dto.type === "MEDICAL_LICENSE" && dto.expiresAt
            ? new Date(dto.expiresAt)
            : null,
        status: "PENDING",
      },
    });

    // Re-uploading the licence during an EXPIRED state auto-resubmits for re-verification.
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { verificationStatus: true },
    });
    if (
      doctor?.verificationStatus === "EXPIRED" &&
      dto.type === "MEDICAL_LICENSE"
    ) {
      await prisma.doctor.update({
        where: { id: doctorId },
        data: {
          verificationStatus: "UNDER_REVIEW",
          kycSubmittedAt: new Date(),
        },
      });
    }
    return doc;
  }

  async submitForReview(doctorId: string) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: {
        verificationStatus: true,
        kycDocuments: { select: { type: true, createdAt: true } },
      },
    });
    if (!doctor) throw new NotFoundException("Doctor not found");
    // NEW doctors may upload + submit directly (self-service); admin reviews at UNDER_REVIEW.
    if (doctor.verificationStatus === "VERIFIED") {
      throw new BadRequestException("Your account is already verified.");
    }
    const required = await this.requiredDocTypes();
    const present = new Set(
      this.currentDocs(doctor.kycDocuments).map((d) => d.type),
    );
    const missing = required.filter((t) => !present.has(t));
    if (missing.length)
      throw new BadRequestException(
        `Please upload all required documents first: ${missing.join(", ")}`,
      );

    return prisma.doctor.update({
      where: { id: doctorId },
      data: {
        verificationStatus: "UNDER_REVIEW",
        kycSubmittedAt: new Date(),
        rejectionReason: "",
      },
      select: { verificationStatus: true, kycSubmittedAt: true },
    });
  }

  // ── Admin side ─────────────────────────────────────────────
  async listForAdmin(status?: string, page = 1, limit = 20) {
    const where = status
      ? { isDelete: false, verificationStatus: status as never }
      : { isDelete: false };
    const [items, total] = await Promise.all([
      prisma.doctor.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          mobile: true,
          image: true,
          designation: true,
          verificationStatus: true,
          isVerified: true,
          licenseExpiry: true,
          createdAt: true,
          kycSubmittedAt: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.doctor.count({ where }),
    ]);
    return { items, total };
  }

  async getDoctorKyc(doctorId: string) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        image: true,
        designation: true,
        verificationStatus: true,
        isVerified: true,
        mdcnFolioNumber: true,
        licenseNumber: true,
        licenseExpiry: true,
        verifiedAt: true,
        verifiedBy: true,
        verificationNotes: true,
        rejectionReason: true,
        kycSubmittedAt: true,
        kycDocuments: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!doctor) throw new NotFoundException("Doctor not found");
    return doctor;
  }

  async approveRegistration(doctorId: string) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { verificationStatus: true },
    });
    if (!doctor) throw new NotFoundException("Doctor not found");
    if (doctor.verificationStatus !== "NEW")
      throw new BadRequestException(
        "This registration has already been processed.",
      );
    const updated = await prisma.doctor.update({
      where: { id: doctorId },
      data: { verificationStatus: "PENDING_KYC" },
    });
    await this.notifications.notifyDoctor(doctorId, {
      title: "Registration approved",
      message:
        "Welcome to Doctium! Please complete your KYC verification — upload your documents to get verified.",
      type: "kyc",
    });
    return { verificationStatus: updated.verificationStatus };
  }

  async reviewDocument(docId: string, dto: ReviewDocDto, adminId: string) {
    return prisma.kycDocument.update({
      where: { id: docId },
      data: {
        status: dto.status as never,
        rejectionReason: dto.status === "REJECTED" ? (dto.reason ?? "") : "",
        reviewedAt: new Date(),
        reviewedBy: adminId,
      },
    });
  }

  async verifyDoctor(doctorId: string, dto: VerifyDoctorDto, adminId: string) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: {
        verificationStatus: true,
        kycDocuments: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!doctor) throw new NotFoundException("Doctor not found");

    const licenseExpiry = dto.licenseExpiry
      ? new Date(dto.licenseExpiry)
      : null;
    const latestLicense = doctor.kycDocuments.find(
      (d) => d.type === "MEDICAL_LICENSE",
    );

    await prisma.$transaction(async (tx) => {
      await tx.doctor.update({
        where: { id: doctorId },
        data: {
          verificationStatus: "VERIFIED",
          isVerified: true,
          verifiedAt: new Date(),
          verifiedBy: adminId,
          ...(licenseExpiry && { licenseExpiry }),
          ...(dto.mdcnFolioNumber !== undefined && {
            mdcnFolioNumber: dto.mdcnFolioNumber,
          }),
          ...(dto.licenseNumber !== undefined && {
            licenseNumber: dto.licenseNumber,
          }),
          ...(dto.notes !== undefined && { verificationNotes: dto.notes }),
          rejectionReason: "",
        },
      });
      // Mark any non-rejected docs APPROVED (admin's holistic decision); stamp licence expiry.
      await tx.kycDocument.updateMany({
        where: { doctorId, status: { not: "REJECTED" } },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
          reviewedBy: adminId,
        },
      });
      if (latestLicense && licenseExpiry) {
        await tx.kycDocument.update({
          where: { id: latestLicense.id },
          data: { expiresAt: licenseExpiry },
        });
      }
    });

    await this.notifications.notifyDoctor(
      doctorId,
      {
        title: "You’re verified ✅",
        message:
          "Your identity and licence have been verified. Your Verified badge is now live and patients can find and book you.",
        type: "kyc",
      },
      { sms: true },
    );
    return { verificationStatus: "VERIFIED" as const };
  }

  async rejectDoctor(doctorId: string, reason: string, _adminId: string) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { id: true },
    });
    if (!doctor) throw new NotFoundException("Doctor not found");
    await prisma.doctor.update({
      where: { id: doctorId },
      data: {
        verificationStatus: "REJECTED",
        isVerified: false,
        rejectionReason: reason || "Verification could not be completed.",
      },
    });
    await this.notifications.notifyDoctor(
      doctorId,
      {
        title: "Verification needs attention",
        message: `Your verification was not approved: ${reason || "please review and re-submit your documents."}`,
        type: "kyc",
      },
      { sms: true },
    );
    return { verificationStatus: "REJECTED" as const };
  }

  async createDoctorByAdmin(dto: CreateDoctorDto) {
    const existing = await prisma.doctor.findFirst({
      where: { OR: [{ email: dto.email }, { mobile: dto.mobile }] },
    });
    if (existing)
      throw new BadRequestException(
        "A doctor with that email or mobile already exists",
      );
    const tempPassword =
      dto.password || Math.random().toString(36).slice(2, 10) + "A1";
    const password = await bcrypt.hash(tempPassword, 12);
    const names = resolveName({
      name: dto.name,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
    // Mirror the doctor self-signup: designation derives from speciality.
    const designation =
      dto.speciality === "Consultant" && dto.consultantSpeciality?.trim()
        ? `Consultant — ${dto.consultantSpeciality.trim()}`
        : dto.speciality || dto.designation || "";
    const doctor = await prisma.doctor.create({
      data: {
        ...names,
        email: dto.email,
        mobile: dto.mobile,
        password,
        designation,
        language: dto.languages ?? [],
        ...(dto.type && { type: dto.type as never }),
        verificationStatus: dto.verify ? "VERIFIED" : "PENDING_KYC",
        isVerified: !!dto.verify,
        ...(dto.verify && { verifiedAt: new Date() }),
      },
    });
    await prisma.doctorWallet.create({ data: { doctorId: doctor.id } });
    // Return the temp password ONCE so the admin can share it; never stored in plaintext.
    return {
      id: doctor.id,
      email: doctor.email,
      tempPassword: dto.password ? undefined : tempPassword,
    };
  }

  // ── Licence-expiry sweep (daily) + manual trigger ──────────
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runLicenseCheck() {
    const now = new Date();

    // 1) Expire lapsed licences → pause verified status + notify (all channels).
    const expired = await prisma.doctor.findMany({
      where: {
        isVerified: true,
        verificationStatus: "VERIFIED",
        licenseExpiry: { lt: now },
      },
      select: { id: true },
    });
    for (const d of expired) {
      await prisma.doctor.update({
        where: { id: d.id },
        data: { verificationStatus: "EXPIRED", isVerified: false },
      });
      await this.notifications.notifyDoctor(
        d.id,
        {
          title: "Your licence has expired",
          message:
            "Your Verified status is paused. Upload your renewed MDCN practising licence to get re-verified and reappear to patients.",
          type: "kyc",
        },
        { sms: true },
      );
    }

    // 2) Advance reminders at the configured day offsets before expiry.
    const days = (await this.setting("kyc_license_reminder_days", "30,7,1"))
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => n > 0);
    for (const n of days) {
      const start = new Date(now);
      start.setDate(start.getDate() + n);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      const soon = await prisma.doctor.findMany({
        where: {
          isVerified: true,
          verificationStatus: "VERIFIED",
          licenseExpiry: { gte: start, lte: end },
        },
        select: { id: true },
      });
      for (const d of soon) {
        await this.notifications.notifyDoctor(
          d.id,
          {
            title: `Your licence expires in ${n} day${n === 1 ? "" : "s"}`,
            message:
              "Renew your MDCN practising licence and upload it in the app to keep your Verified badge.",
            type: "kyc",
          },
          { sms: n <= 7 },
        );
      }
    }
    return { expired: expired.length };
  }
}
