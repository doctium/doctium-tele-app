import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "@doctium/database";
import { CloudinaryService } from "../prescriptions/cloudinary.service";
import { resolveImageUrl } from "../../common/image.util";

@Injectable()
export class DoctorsService {
  constructor(private readonly cloudinary: CloudinaryService) {}

  async findAll(query: {
    search?: string;
    serviceId?: string;
    type?: string;
    country?: string;
    nationality?: string;
    language?: string;
  }) {
    return prisma.doctor.findMany({
      where: {
        isDelete: false,
        isBlock: false,
        isVerified: true, // KYC gate: only verified doctors are discoverable
        ...(query.search && {
          name: { contains: query.search, mode: "insensitive" },
        }),
        ...(query.type && { type: query.type as never }),
        ...(query.country && { practiceCountry: query.country }),
        ...(query.nationality && { nationality: query.nationality }),
        // Patients can filter to doctors who speak their language (array overlap).
        ...(query.language && { language: { hasSome: [query.language] } }),
        ...(query.serviceId && {
          services: { some: { serviceId: query.serviceId } },
        }),
      },
      select: {
        id: true,
        name: true,
        image: true,
        designation: true,
        experience: true,
        rating: true,
        reviewCount: true,
        charge: true,
        type: true,
        expertise: true,
        language: true,
        isOnline: true,
        practiceCountry: true,
        nationality: true,
        currency: true,
        scheduledFee: true,
        instantDayFee: true,
        instantNightFee: true,
        isFeatured: true, // DoctiumPlus: subscribed (Featured) doctors rank first + get a badge
        isVerified: true, // KYC verified badge
        discountActive: true,
        discountPercent: true,
        discountLabel: true,
        discountEndsAt: true,
      },
      // Featured doctors surface first, then by rating.
      orderBy: [{ isFeatured: "desc" }, { rating: "desc" }],
    });
  }

  async updateRegion(
    doctorId: string,
    dto: { nationality?: string; practiceCountry?: string },
  ) {
    let currency: string | undefined;
    if (dto.practiceCountry) {
      const region = await prisma.region.findUnique({
        where: { code: dto.practiceCountry },
      });
      currency = region?.currencyCode;
    }
    return prisma.doctor.update({
      where: { id: doctorId },
      data: {
        ...(dto.nationality !== undefined && { nationality: dto.nationality }),
        ...(dto.practiceCountry && { practiceCountry: dto.practiceCountry }),
        ...(currency && { currency }),
      },
      select: { nationality: true, practiceCountry: true, currency: true },
    });
  }

  async findOne(id: string) {
    const doctor = await prisma.doctor.findUnique({
      where: { id, isDelete: false },
      include: {
        services: { include: { service: true } },
        schedule: true,
        reviews: {
          include: { user: { select: { name: true, image: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });
    if (!doctor) throw new NotFoundException("Doctor not found");
    return doctor;
  }

  async getProfile(doctorId: string) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        wallet: { select: { balance: true, total: true } },
        services: { include: { service: true } },
        schedule: true,
      },
    });
    if (!doctor) throw new NotFoundException("Doctor not found");
    return doctor;
  }

  async updateProfile(doctorId: string, dto: Record<string, unknown>) {
    return prisma.doctor.update({ where: { id: doctorId }, data: dto });
  }

  /** Update only the profile photo (Cloudinary if configured, else stores the data-URL). */
  async updateAvatar(doctorId: string, dataUrl: string) {
    if (!dataUrl) throw new BadRequestException("No image provided");
    const image = await resolveImageUrl(
      this.cloudinary,
      dataUrl,
      `doctors/${doctorId}/avatar`,
    );
    return prisma.doctor.update({
      where: { id: doctorId },
      data: { image },
      select: { id: true, image: true },
    });
  }

  /** Update only the 1:3 profile banner (Cloudinary if configured, else stores the data-URL). */
  async updateBanner(doctorId: string, dataUrl: string) {
    if (!dataUrl) throw new BadRequestException("No image provided");
    const bannerImage = await resolveImageUrl(
      this.cloudinary,
      dataUrl,
      `doctors/${doctorId}/banner`,
    );
    return prisma.doctor.update({
      where: { id: doctorId },
      data: { bannerImage },
      select: { id: true, bannerImage: true },
    });
  }

  async upsertSchedule(doctorId: string, schedules: Record<string, unknown>[]) {
    await prisma.doctorSchedule.deleteMany({ where: { doctorId } });
    return prisma.doctorSchedule.createMany({
      data: schedules.map((s) => ({ ...s, doctorId })) as never,
    });
  }

  async getAvailableSlots(doctorId: string, date: string) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: { schedule: true, busySlots: { where: { date } } },
    });
    if (!doctor) throw new NotFoundException("Doctor not found");

    const dayName = new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
    });
    const daySchedule = doctor.schedule.find((s) => s.day === dayName);
    if (!daySchedule) return { slots: [] };

    const busyTimes = doctor.busySlots.map((b) => b.time);
    const slots: string[] = [];
    let current = daySchedule.startTime;

    while (current < daySchedule.endTime) {
      if (!busyTimes.includes(current)) slots.push(current);
      const [h, m] = current.split(":").map(Number);
      const next = new Date(0, 0, 0, h, (m ?? 0) + doctor.timeSlot);
      current = `${String(next.getHours()).padStart(2, "0")}:${String(next.getMinutes()).padStart(2, "0")}`;
    }

    return { slots };
  }

  async updateFcmToken(doctorId: string, fcmToken: string) {
    return prisma.doctor.update({
      where: { id: doctorId },
      data: { fcmToken },
    });
  }

  async updateSignature(doctorId: string, signatureImage: string) {
    await prisma.doctor.update({
      where: { id: doctorId },
      data: { signatureImage },
    });
    return { success: true };
  }

  updatePricing(
    doctorId: string,
    dto: {
      scheduledFee?: number;
      instantDayFee?: number;
      instantNightFee?: number;
      discountActive?: boolean;
      discountPercent?: number;
      discountLabel?: string;
      discountEndsAt?: string | null;
    },
  ) {
    return prisma.doctor.update({
      where: { id: doctorId },
      data: {
        ...(dto.scheduledFee !== undefined && {
          scheduledFee: Number(dto.scheduledFee) || 0,
        }),
        ...(dto.instantDayFee !== undefined && {
          instantDayFee: Number(dto.instantDayFee) || 0,
        }),
        ...(dto.instantNightFee !== undefined && {
          instantNightFee: Number(dto.instantNightFee) || 0,
        }),
        ...(dto.discountActive !== undefined && {
          discountActive: !!dto.discountActive,
        }),
        ...(dto.discountPercent !== undefined && {
          discountPercent: Math.min(
            Math.max(Number(dto.discountPercent) || 0, 0),
            100,
          ),
        }),
        ...(dto.discountLabel !== undefined && {
          discountLabel: dto.discountLabel,
        }),
        ...(dto.discountEndsAt !== undefined && {
          discountEndsAt: dto.discountEndsAt
            ? new Date(dto.discountEndsAt)
            : null,
        }),
      },
      select: {
        id: true,
        scheduledFee: true,
        instantDayFee: true,
        instantNightFee: true,
        currency: true,
        discountActive: true,
        discountPercent: true,
        discountLabel: true,
        discountEndsAt: true,
      },
    });
  }
}
