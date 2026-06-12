import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "@doctium/database";
import { EntitlementsService } from "../subscriptions/entitlements.service";
import { CloudinaryService } from "../prescriptions/cloudinary.service";
import { resolveImageUrl } from "../../common/image.util";

@Injectable()
export class UsersService {
  constructor(
    private readonly entitlements: EntitlementsService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  private async setting(key: string, fallback: string): Promise<string> {
    const row = await prisma.setting.findUnique({ where: { key } });
    return row?.value || fallback;
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        image: true,
        gender: true,
        dob: true,
        bio: true,
        country: true,
        preferredLanguage: true,
        isOnline: true,
        wallet: { select: { balance: true } },
        subPatients: true,
        referralCode: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException("User not found");

    // Lazy-generate codes for accounts that predate the referral program
    // (also covered by scripts/backfill-referral-codes.cjs).
    let referralCode = user.referralCode;
    if (!referralCode) {
      const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
      for (let attempt = 0; attempt < 5 && !referralCode; attempt++) {
        const candidate = Array.from(
          { length: 10 },
          () => CHARS[Math.floor(Math.random() * CHARS.length)],
        ).join("");
        const taken = await prisma.user.findUnique({
          where: { referralCode: candidate },
          select: { id: true },
        });
        if (!taken) {
          await prisma.user.update({
            where: { id: userId },
            data: { referralCode: candidate },
          });
          referralCode = candidate;
        }
      }
    }

    // Referral program context for the "Invite friends" screen.
    const [referred, rewarded, bonusSetting] = await Promise.all([
      prisma.user.count({ where: { referredById: userId, isDelete: false } }),
      prisma.user.count({
        where: { referredById: userId, referralRewardedAt: { not: null } },
      }),
      prisma.setting.findUnique({ where: { key: "referral_bonus_amount" } }),
    ]);
    const referralBonusKobo = Math.max(
      0,
      Math.round((parseFloat(bonusSetting?.value || "0") || 0) * 100),
    );

    return {
      ...user,
      referralCode,
      referral: { referred, rewarded, bonusKobo: referralBonusKobo },
    };
  }

  async updateProfile(userId: string, dto: Record<string, unknown>) {
    return prisma.user.update({ where: { id: userId }, data: dto });
  }

  /** Update only the profile photo (Cloudinary if configured, else stores the data-URL). */
  async updateAvatar(userId: string, dataUrl: string) {
    if (!dataUrl) throw new BadRequestException("No image provided");
    const image = await resolveImageUrl(
      this.cloudinary,
      dataUrl,
      `users/${userId}/avatar`,
    );
    const user = await prisma.user.update({
      where: { id: userId },
      data: { image },
      select: { id: true, image: true },
    });
    return user;
  }

  // ── Favorite doctors ───────────────────────────────────────
  async toggleFavorite(userId: string, doctorId: string) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { id: true },
    });
    if (!doctor) throw new NotFoundException("Doctor not found");
    const existing = await prisma.favoriteDoctor.findUnique({
      where: { userId_doctorId: { userId, doctorId } },
    });
    if (existing) {
      await prisma.favoriteDoctor.delete({ where: { id: existing.id } });
      return { favorite: false };
    }
    await prisma.favoriteDoctor.create({ data: { userId, doctorId } });
    return { favorite: true };
  }

  async getFavoriteIds(userId: string) {
    const rows = await prisma.favoriteDoctor.findMany({
      where: { userId },
      select: { doctorId: true },
    });
    return rows.map((r) => r.doctorId);
  }

  async getFavorites(userId: string) {
    const rows = await prisma.favoriteDoctor.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        doctor: {
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
            isOnline: true,
            isVerified: true,
            isFeatured: true,
            expertise: true,
            discountActive: true,
            discountPercent: true,
          },
        },
      },
    });
    return rows.map((r) => r.doctor);
  }

  async getSubPatients(userId: string) {
    return prisma.subPatient.findMany({ where: { userId } });
  }

  async createSubPatient(userId: string, dto: Record<string, unknown>) {
    // Family-members cap — driven by the patient's DoctiumPlus plan (free accounts get a base cap).
    const ent = await this.entitlements.resolveUserEntitlements(userId);
    const freeCap =
      parseInt(await this.setting("free_family_cap", "1"), 10) || 1;
    const cap = ent.active ? ent.familyCap : freeCap;
    const count = await prisma.subPatient.count({ where: { userId } });
    if (count >= cap) {
      throw new BadRequestException(
        ent.active
          ? `Your plan allows up to ${cap} family member${cap === 1 ? "" : "s"}. Upgrade your DoctiumPlus plan to add more.`
          : `Free accounts can add up to ${cap} family member${cap === 1 ? "" : "s"}. Subscribe to DoctiumPlus to add more.`,
      );
    }
    return prisma.subPatient.create({ data: { userId, ...dto } as never });
  }

  async updateSubPatient(
    id: string,
    userId: string,
    dto: Record<string, unknown>,
  ) {
    return prisma.subPatient.updateMany({ where: { id, userId }, data: dto });
  }

  async deleteSubPatient(id: string, userId: string) {
    return prisma.subPatient.deleteMany({ where: { id, userId } });
  }

  async updateFcmToken(userId: string, fcmToken: string) {
    return prisma.user.update({ where: { id: userId }, data: { fcmToken } });
  }
}
