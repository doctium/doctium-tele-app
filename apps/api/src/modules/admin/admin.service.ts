import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { prisma } from "@doctium/database";
import { ALL_PERMISSIONS } from "@doctium/types";
import * as bcrypt from "bcrypt";
import { PaymentsService } from "../payments/payments.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CloudinaryService } from "../prescriptions/cloudinary.service";
import { resolveImageUrl } from "../../common/image.util";

@Injectable()
export class AdminService {
  constructor(
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly cloudinary: CloudinaryService,
  ) {}
  // ─── Dashboard ─────────────────────────────────────────────
  async getDashboardStats(startDate?: string, endDate?: string) {
    const dateFilter =
      startDate && endDate ? { date: { gte: startDate, lte: endDate } } : {};

    const [appointments, users, doctors] = await Promise.all([
      prisma.appointment.findMany({
        where: { status: "COMPLETED", ...dateFilter },
      }),
      prisma.user.count({ where: { isDelete: false } }),
      prisma.doctor.count({ where: { isDelete: false, isBlock: false } }),
    ]);

    const revenue = appointments.reduce((sum, a) => sum + a.amount, 0);
    const adminEarning = appointments.reduce(
      (sum, a) => sum + a.adminEarning,
      0,
    );

    return {
      appointments: appointments.length,
      revenue,
      adminEarning,
      users,
      doctors,
    };
  }

  async getTopDoctors(startDate?: string, endDate?: string) {
    const dateFilter =
      startDate && endDate ? { date: { gte: startDate, lte: endDate } } : {};

    const grouped = await prisma.appointment.groupBy({
      by: ["doctorId"],
      where: { status: "COMPLETED", ...dateFilter },
      _sum: { amount: true, adminEarning: true, doctorEarning: true },
      _count: { id: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 5,
    });

    // Attach doctor name/image so the dashboard table can render rows directly.
    const doctors = await prisma.doctor.findMany({
      where: { id: { in: grouped.map((g) => g.doctorId) } },
      select: { id: true, name: true, image: true },
    });
    const byId = new Map(doctors.map((d) => [d.id, d]));

    return grouped.map((g) => ({
      doctorId: g.doctorId,
      name: byId.get(g.doctorId)?.name ?? "",
      doctorImage: byId.get(g.doctorId)?.image ?? "",
      appointment: g._count.id,
      amount: g._sum.amount ?? 0,
      adminEarning: g._sum.adminEarning ?? 0,
      doctorEarning: g._sum.doctorEarning ?? 0,
    }));
  }

  /** Today's pending/confirmed appointments for the dashboard "upcoming" list. */
  getUpcomingAppointments() {
    const today = new Date().toISOString().slice(0, 10);
    return prisma.appointment.findMany({
      where: { date: today, status: { in: ["PENDING", "CONFIRMED"] } },
      include: {
        user: { select: { name: true, image: true } },
        doctor: { select: { name: true, image: true } },
      },
      orderBy: { time: "asc" },
      take: 20,
    });
  }

  /** Revenue + appointment count grouped by day, for the dashboard chart. */
  async getChart(startDate?: string, endDate?: string) {
    const dateFilter =
      startDate && endDate ? { date: { gte: startDate, lte: endDate } } : {};
    const grouped = await prisma.appointment.groupBy({
      by: ["date"],
      where: { status: "COMPLETED", ...dateFilter },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { date: "asc" },
    });
    return grouped.map((g) => ({
      date: g.date,
      revenue: g._sum.amount ?? 0,
      count: g._count.id,
    }));
  }

  // ─── Users & Doctors ───────────────────────────────────────
  getAllUsers(page = 1, limit = 20) {
    return prisma.user.findMany({
      where: { isDelete: false },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        image: true,
        isBlock: true,
        createdAt: true,
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    });
  }

  async getUserDetail(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        image: true,
        gender: true,
        dob: true,
        country: true,
        isBlock: true,
        createdAt: true,
        wallet: {
          select: {
            balance: true,
            history: {
              orderBy: { createdAt: "desc" },
              take: 50,
              select: {
                id: true,
                amount: true,
                type: true,
                description: true,
                createdAt: true,
              },
            },
          },
        },
        subPatients: {
          select: {
            id: true,
            name: true,
            relation: true,
            age: true,
            gender: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  /** Appointments for a specific user — admin-scoped (the public /appointments/mine is user-gated). */
  getUserAppointments(userId: string) {
    return prisma.appointment.findMany({
      where: { userId },
      include: { doctor: { select: { name: true, image: true } } },
      orderBy: [{ date: "desc" }, { time: "desc" }],
    });
  }

  getAllDoctors(page = 1, limit = 20) {
    return prisma.doctor.findMany({
      where: { isDelete: false },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        image: true,
        designation: true,
        rating: true,
        isBlock: true,
        createdAt: true,
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    });
  }

  /** Full doctor profile for the admin detail page — includes wallet, reviews and videos. */
  async getDoctorDetail(id: string) {
    const doctor = await prisma.doctor.findUnique({
      where: { id },
      include: {
        wallet: { select: { balance: true, total: true } },
        reviews: {
          include: { user: { select: { name: true, image: true } } },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        videos: {
          select: {
            id: true,
            description: true,
            videoUrl: true,
            videoImage: true,
            shareCount: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!doctor) throw new NotFoundException("Doctor not found");
    // Business Agreement context: the app-wide default this doctor falls back
    // to when no doctor-specific commission is set (doctor.commission = 0).
    const defaultSetting = await prisma.setting.findUnique({
      where: { key: "admin_commission_percent" },
    });
    const defaultCommissionPercent = defaultSetting?.value
      ? Math.min(Math.max(parseFloat(defaultSetting.value) || 0, 0), 100)
      : 0;
    return { ...doctor, defaultCommissionPercent };
  }

  /**
   * Business Agreement: doctor-specific commission override. 0 = no agreement,
   * the app-wide `admin_commission_percent` setting prevails (see PricingService).
   */
  async setDoctorCommission(id: string, commission: number) {
    if (!Number.isFinite(commission) || commission < 0 || commission > 100)
      throw new BadRequestException("Commission must be between 0 and 100");
    const doctor = await prisma.doctor.findUnique({
      where: { id },
      select: { id: true, commission: true },
    });
    if (!doctor) throw new NotFoundException("Doctor not found");
    const updated = await prisma.doctor.update({
      where: { id },
      data: { commission },
      select: { id: true, commission: true },
    });
    return { previous: doctor.commission, ...updated };
  }

  // ─── Add Funds (manual wallet credit) ────────────────────
  /** Patient lookup for the Add Funds page (finance-scoped, minimal fields). */
  searchUsersForFinance(q: string) {
    const needle = (q ?? "").trim();
    if (needle.length < 2) return [];
    return prisma.user.findMany({
      where: {
        isDelete: false,
        OR: [
          { name: { contains: needle, mode: "insensitive" } },
          { mobile: { contains: needle } },
          { email: { contains: needle, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        mobile: true,
        email: true,
        image: true,
        wallet: { select: { balance: true } },
      },
      take: 8,
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Credit a patient's wallet ("Add Funds"). Fully ledgered — wallet history
   * narration "Wallet Top-up from Doctium Admin" + a PaymentTransaction row so
   * the Transactions page shows it — and the patient is notified. Amount in kobo.
   */
  async creditUserWallet(userId: string, amount: number) {
    if (!Number.isInteger(amount) || amount <= 0)
      throw new BadRequestException("Enter a valid amount");
    if (amount > 100_000_000)
      throw new BadRequestException(
        "Amount exceeds the ₦1,000,000 per-operation limit",
      );
    const user = await prisma.user.findFirst({
      where: { id: userId, isDelete: false },
      select: { id: true, name: true },
    });
    if (!user) throw new NotFoundException("User not found");

    const reference = `admin_topup_${userId.slice(-6)}_${Date.now()}`;
    const wallet = await prisma.$transaction(async (tx) => {
      const w = await tx.userWallet.upsert({
        where: { userId },
        create: { userId, balance: amount },
        update: { balance: { increment: amount } },
      });
      await tx.userWalletHistory.create({
        data: {
          walletId: w.id,
          amount,
          type: "DEPOSIT",
          description: "Wallet Top-up from Doctium Admin",
        },
      });
      await tx.paymentTransaction.create({
        data: {
          reference,
          type: "WALLET_TOPUP",
          provider: "WALLET",
          status: "SUCCESS",
          userId,
          amount,
          channel: "admin",
        },
      });
      // upsert's `update` branch returns the pre-increment row on some drivers — refetch
      return tx.userWallet.findUnique({ where: { userId } });
    });

    const naira = (k: number) => `₦${(k / 100).toLocaleString("en-NG")}`;
    this.notifications
      .notifyUser(userId, {
        key: "wallet.topup",
        params: {
          amount: naira(amount),
          balance: naira(wallet?.balance ?? amount),
        },
        type: "wallet_topup",
      })
      .catch(() => {});

    return {
      userId,
      name: user.name,
      credited: amount,
      balance: wallet?.balance ?? amount,
      reference,
    };
  }

  /** Full appointment record for the admin order-details page. */
  async getAppointmentDetail(id: string) {
    const appt = await prisma.appointment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            mobile: true,
            email: true,
          },
        },
        doctor: {
          select: { id: true, name: true, image: true, designation: true },
        },
        service: { select: { name: true } },
        subPatient: { select: { name: true } },
      },
    });
    if (!appt) throw new NotFoundException("Appointment not found");
    return appt;
  }

  /** Admin can delete any doctor's content video (the public DELETE /videos/:id is doctor-owner-scoped). */
  deleteVideo(id: string) {
    return prisma.video.delete({ where: { id } });
  }

  // ─── MediGram moderation ─────────────────────────────────
  /** Moderation queue. Defaults to the work-list (PENDING + FLAGGED) when no status given. */
  async getVideos(status?: string, page = 1, limit = 20) {
    const where =
      status && status !== "ALL"
        ? { status: status as never }
        : { status: { in: ["PENDING", "FLAGGED"] as never } };
    const [items, total] = await Promise.all([
      prisma.video.findMany({
        where,
        include: {
          doctor: {
            select: { id: true, name: true, image: true, designation: true },
          },
          _count: { select: { likes: true, comments: true, reports: true } },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.video.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async getVideoDetail(id: string) {
    const video = await prisma.video.findUnique({
      where: { id },
      include: {
        doctor: {
          select: { id: true, name: true, image: true, designation: true },
        },
        _count: { select: { likes: true, comments: true, reports: true } },
        reports: {
          include: { user: { select: { id: true, name: true, image: true } } },
          orderBy: { createdAt: "desc" },
          take: 100,
        },
      },
    });
    if (!video) throw new NotFoundException("Video not found");
    // Tally reports by reason for an at-a-glance breakdown.
    const reasonCounts: Record<string, number> = {};
    for (const r of video.reports) {
      reasonCounts[r.reason] = (reasonCounts[r.reason] ?? 0) + 1;
    }
    return { ...video, reasonCounts };
  }

  async approveVideo(id: string, reviewerId?: string) {
    const video = await prisma.video.findUnique({ where: { id } });
    if (!video) throw new NotFoundException("Video not found");
    const updated = await prisma.video.update({
      where: { id },
      data: {
        status: "APPROVED",
        rejectionReason: null,
        reviewedAt: new Date(),
        reviewedById: reviewerId ?? null,
      },
    });
    // Mark any outstanding reports as handled.
    await prisma.videoReport.updateMany({
      where: { videoId: id, status: "OPEN" },
      data: { status: "REVIEWED" },
    });
    this.notifications
      .notifyDoctor(video.doctorId, {
        title: "Your MediGram clip is live",
        message: `"${video.title || "Your clip"}" passed review and is now visible to patients.`,
        type: "video_approved",
      })
      .catch(() => {});
    return updated;
  }

  async rejectVideo(id: string, reason: string, reviewerId?: string) {
    const video = await prisma.video.findUnique({ where: { id } });
    if (!video) throw new NotFoundException("Video not found");
    const updated = await prisma.video.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectionReason: reason || "Did not meet content guidelines.",
        reviewedAt: new Date(),
        reviewedById: reviewerId ?? null,
      },
    });
    await prisma.videoReport.updateMany({
      where: { videoId: id, status: "OPEN" },
      data: { status: "REVIEWED" },
    });
    this.notifications
      .notifyDoctor(video.doctorId, {
        title: "Your MediGram clip wasn't approved",
        message: `"${video.title || "Your clip"}" was not published. Reason: ${
          reason || "Did not meet content guidelines."
        }`,
        type: "video_rejected",
      })
      .catch(() => {});
    return updated;
  }

  async toggleBlockUser(id: string, isBlock: boolean) {
    const user = await prisma.user.update({ where: { id }, data: { isBlock } });
    if (isBlock) {
      // Notify the patient their account was turned off (in-app + push + email). Never fail the block on a notify error.
      await this.notifications
        .notifyUser(id, {
          key: "account.blocked",
          type: "account_blocked",
        })
        .catch(() => {});
    }
    return user;
  }

  async toggleBlockDoctor(id: string, isBlock: boolean) {
    const doctor = await prisma.doctor.update({
      where: { id },
      data: { isBlock },
    });
    if (isBlock) {
      await this.notifications
        .notifyDoctor(id, {
          title: "Account turned off",
          message:
            "Your account with Doctium has been temporarily turned off. Contact Doctium support for more information.",
          type: "account_blocked",
        })
        .catch(() => {});
    }
    return doctor;
  }

  // ─── Appointments ──────────────────────────────────────────
  getAppointments(opts: {
    page?: number;
    limit?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }) {
    const { page = 1, limit = 20, status, startDate, endDate, search } = opts;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (startDate && endDate) where.date = { gte: startDate, lte: endDate };

    // Search: a booking number (digits) or a patient / doctor / service name.
    const needle = (search ?? "").trim();
    if (needle) {
      const isNumber = /^\d+$/.test(needle);
      const or: Record<string, unknown>[] = [
        { user: { name: { contains: needle, mode: "insensitive" } } },
        { doctor: { name: { contains: needle, mode: "insensitive" } } },
        { service: { name: { contains: needle, mode: "insensitive" } } },
      ];
      if (isNumber) {
        or.unshift({ bookingNumber: Number(needle) });
        // A booking-number lookup shouldn't be limited by the date window.
        delete where.date;
      }
      where.OR = or;
    }

    return prisma.appointment.findMany({
      where,
      include: {
        user: { select: { name: true, image: true } },
        doctor: { select: { name: true, image: true } },
        service: { select: { name: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    });
  }

  // ─── Global search (navbar) ────────────────────────────────
  /** One query box for the whole console: booking IDs, patients, doctors, services. */
  async globalSearch(q: string) {
    const needle = (q ?? "").trim();
    if (needle.length < 2)
      return { bookings: [], patients: [], doctors: [], services: [] };

    const isNumber = /^\d+$/.test(needle);
    const bookingWhere: Record<string, unknown>[] = [
      { user: { name: { contains: needle, mode: "insensitive" } } },
      { doctor: { name: { contains: needle, mode: "insensitive" } } },
    ];
    if (isNumber) bookingWhere.unshift({ bookingNumber: Number(needle) });

    const [bookings, patients, doctors, services] = await Promise.all([
      prisma.appointment.findMany({
        where: { OR: bookingWhere },
        select: {
          id: true,
          bookingNumber: true,
          date: true,
          time: true,
          status: true,
          amount: true,
          user: { select: { name: true } },
          doctor: { select: { name: true } },
        },
        take: 6,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.findMany({
        where: {
          isDelete: false,
          OR: [
            { name: { contains: needle, mode: "insensitive" } },
            { mobile: { contains: needle } },
            { email: { contains: needle, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, mobile: true, image: true },
        take: 5,
      }),
      prisma.doctor.findMany({
        where: {
          isDelete: false,
          name: { contains: needle, mode: "insensitive" },
        },
        select: { id: true, name: true, designation: true, image: true },
        take: 5,
      }),
      prisma.service.findMany({
        where: { name: { contains: needle, mode: "insensitive" } },
        select: { id: true, name: true },
        take: 5,
      }),
    ]);

    return { bookings, patients, doctors, services };
  }

  // ─── Reviews ───────────────────────────────────────────────
  getReviews(page = 1, limit = 20) {
    return prisma.review.findMany({
      include: {
        user: { select: { name: true, image: true } },
        doctor: { select: { name: true, image: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    });
  }

  deleteReview(id: string) {
    return prisma.review.delete({ where: { id } });
  }

  // ─── Complaints ────────────────────────────────────────────
  getComplaints(role?: string) {
    return prisma.complain.findMany({
      where: role ? { role: role as never } : {},
      include: {
        user: { select: { name: true, image: true } },
        doctor: { select: { name: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  updateComplaint(id: string, status: string) {
    return prisma.complain.update({
      where: { id },
      data: { status: status as never },
    });
  }

  // ─── Settings ──────────────────────────────────────────────
  getSettings() {
    return prisma.setting.findMany({ orderBy: { key: "asc" } });
  }

  updateSetting(key: string, value: string) {
    return prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  // ─── Admin profile & password (the admin principal is an Employee) ─────────
  /** Current admin identity + live RBAC for the panel's auth context. */
  async getMe(adminId: string) {
    const emp = await prisma.employee.findUnique({
      where: { id: adminId },
      include: { role: { select: { name: true, permissions: true } } },
    });
    if (!emp) throw new NotFoundException("Account not found");
    const permissions = emp.isSuperAdmin
      ? ALL_PERMISSIONS
      : (emp.role?.permissions ?? []);
    return {
      id: emp.id,
      name: emp.name,
      email: emp.email,
      image: emp.image,
      roleName: emp.isSuperAdmin ? "Super Admin" : (emp.role?.name ?? null),
      isSuperAdmin: emp.isSuperAdmin,
      permissions,
    };
  }

  async getProfile(adminId: string) {
    const admin = await prisma.employee.findUnique({
      where: { id: adminId },
      select: { id: true, name: true, email: true, image: true },
    });
    if (!admin) throw new NotFoundException("Account not found");
    return admin;
  }

  async updateProfile(
    adminId: string,
    data: { name?: string; email?: string; image?: string },
  ) {
    // Data-URL avatars upload to Cloudinary when configured, store directly
    // otherwise (same pattern as patient/doctor avatars).
    const image =
      data.image !== undefined
        ? await resolveImageUrl(
            this.cloudinary,
            data.image,
            `admins/${adminId}/avatar`,
          )
        : undefined;
    return prisma.employee.update({
      where: { id: adminId },
      data: { name: data.name, email: data.email, image },
      select: { id: true, name: true, email: true, image: true },
    });
  }

  async changePassword(
    adminId: string,
    body: { oldPassword: string; newPassword: string; confirmPassword: string },
  ) {
    if (!body.newPassword || body.newPassword !== body.confirmPassword) {
      throw new BadRequestException("Passwords do not match");
    }
    const admin = await prisma.employee.findUnique({ where: { id: adminId } });
    if (!admin || !admin.password)
      throw new NotFoundException("Account not found");

    const valid = await bcrypt.compare(body.oldPassword, admin.password);
    if (!valid)
      throw new UnauthorizedException("Current password is incorrect");

    const password = await bcrypt.hash(body.newPassword, 12);
    await prisma.employee.update({
      where: { id: adminId },
      data: { password },
    });
    return { success: true };
  }

  // ─── Services & suggested services ─────────────────────────
  createService(data: { name: string; image?: string }) {
    return prisma.service.create({ data });
  }

  updateService(id: string, status: boolean) {
    return prisma.service.update({ where: { id }, data: { status } });
  }

  deleteService(id: string) {
    // Soft delete — appointments may still reference the service.
    return prisma.service.update({ where: { id }, data: { isDelete: true } });
  }

  getSuggestedServices() {
    return prisma.suggestedService.findMany({
      include: {
        doctor: { select: { name: true, image: true, designation: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  deleteSuggestedService(id: string) {
    return prisma.suggestedService.delete({ where: { id } });
  }

  // ─── Doctor holidays ───────────────────────────────────────
  getDoctorHolidays() {
    return prisma.doctorHoliday.findMany({
      include: {
        doctor: { select: { name: true, image: true, designation: true } },
      },
      orderBy: { date: "desc" },
    });
  }

  createDoctorHoliday(data: { doctorId: string; date: string }) {
    return prisma.doctorHoliday.create({ data });
  }

  deleteDoctorHoliday(id: string) {
    return prisma.doctorHoliday.delete({ where: { id } });
  }

  // ─── Attendance ────────────────────────────────────────────
  getAttendance(date?: string) {
    return prisma.doctorAttendance.findMany({
      where: date ? { date } : {},
      include: {
        doctor: { select: { name: true, image: true, designation: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // ─── Recharges (user wallet top-ups) ───────────────────────
  getRecharges(startDate?: string, endDate?: string) {
    const where: Record<string, unknown> = { type: "DEPOSIT" };
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(`${endDate}T23:59:59.999Z`),
      };
    }
    return prisma.userWalletHistory.findMany({
      where,
      include: {
        wallet: {
          select: {
            user: { select: { id: true, name: true, image: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // ─── Withdrawals ───────────────────────────────────────────
  getAllWithdrawRequests(status?: string) {
    return prisma.withdrawRequest.findMany({
      where: status ? { status: status as never } : {},
      include: { doctor: { select: { name: true, image: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  updateWithdrawRequest(
    id: string,
    data: { status: string; declineReason?: string; payDate?: string },
  ) {
    // Delegated so a decline restores the doctor's reserved balance and an approval
    // triggers the payout (auto Paystack transfer or manual) + ledger entry.
    return this.payments.decideWithdrawal(id, data);
  }

  // ─── Transactions ledger ─────────────────────────────────
  async getTransactions(page = 1, limit = 25, type?: string) {
    const where = type ? { type: type as never } : {};
    const [txns, total] = await Promise.all([
      prisma.paymentTransaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.paymentTransaction.count({ where }),
    ]);
    const userIds = [
      ...new Set(txns.map((t) => t.userId).filter(Boolean) as string[]),
    ];
    const doctorIds = [
      ...new Set(txns.map((t) => t.doctorId).filter(Boolean) as string[]),
    ];
    const [users, doctors] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      }),
      prisma.doctor.findMany({
        where: { id: { in: doctorIds } },
        select: { id: true, name: true },
      }),
    ]);
    const uMap = new Map(users.map((u) => [u.id, u.name]));
    const dMap = new Map(doctors.map((d) => [d.id, d.name]));
    const items = txns.map((t) => ({
      ...t,
      userName: t.userId ? (uMap.get(t.userId) ?? null) : null,
      doctorName: t.doctorId ? (dMap.get(t.doctorId) ?? null) : null,
    }));
    return { items, total };
  }

  // ─── Subscriptions (DoctiumPlus) ───────────────────────────
  async getSubscriptions(
    page = 1,
    limit = 25,
    status?: string,
    audience?: string,
  ) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status as never;
    if (audience) where.subscriberType = audience as never;
    const [subs, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          plan: { select: { name: true, code: true, audience: true } },
        },
      }),
      prisma.subscription.count({ where }),
    ]);
    const userIds = [
      ...new Set(subs.map((s) => s.userId).filter(Boolean) as string[]),
    ];
    const doctorIds = [
      ...new Set(subs.map((s) => s.doctorId).filter(Boolean) as string[]),
    ];
    const [users, doctors] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      }),
      prisma.doctor.findMany({
        where: { id: { in: doctorIds } },
        select: { id: true, name: true, email: true },
      }),
    ]);
    const uMap = new Map(users.map((u) => [u.id, u]));
    const dMap = new Map(doctors.map((d) => [d.id, d]));
    const items = subs.map((s) => {
      const who = s.userId
        ? uMap.get(s.userId)
        : s.doctorId
          ? dMap.get(s.doctorId)
          : undefined;
      return {
        ...s,
        subscriberName: who?.name ?? null,
        subscriberEmail: who?.email ?? null,
        planName: s.plan.name,
      };
    });
    return { items, total };
  }

  async getSubscriptionRevenue() {
    const subs = await prisma.subscription.findMany({
      where: { status: { in: ["ACTIVE", "PAST_DUE"] } },
      include: {
        plan: { select: { name: true, interval: true, audience: true } },
      },
    });
    const toMonthly = (price: number, interval: string) =>
      interval === "YEARLY"
        ? price / 12
        : interval === "QUARTERLY"
          ? price / 3
          : price;
    let mrr = 0;
    const byPlan = new Map<
      string,
      { planName: string; audience: string; count: number; mrr: number }
    >();
    for (const s of subs) {
      const m = toMonthly(s.priceAtSignup, s.plan.interval);
      mrr += m;
      const cur = byPlan.get(s.plan.name) ?? {
        planName: s.plan.name,
        audience: s.plan.audience,
        count: 0,
        mrr: 0,
      };
      cur.count += 1;
      cur.mrr += m;
      byPlan.set(s.plan.name, cur);
    }
    const [activeCount, pastDueCount, cancelledCount, collected] =
      await Promise.all([
        prisma.subscription.count({ where: { status: "ACTIVE" } }),
        prisma.subscription.count({ where: { status: "PAST_DUE" } }),
        prisma.subscription.count({
          where: { status: { in: ["CANCELLED", "EXPIRED"] } },
        }),
        prisma.subscriptionInvoice.aggregate({
          _sum: { amount: true },
          where: { status: "PAID" },
        }),
      ]);
    return {
      mrr: Math.round(mrr),
      arr: Math.round(mrr * 12),
      activeCount,
      pastDueCount,
      cancelledCount,
      totalCollected: collected._sum.amount ?? 0,
      byPlan: [...byPlan.values()].map((p) => ({
        ...p,
        mrr: Math.round(p.mrr),
      })),
    };
  }

  // ─── Coupons ───────────────────────────────────────────────
  getAllCoupons() {
    return prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  }

  createCoupon(data: Record<string, unknown>) {
    return prisma.coupon.create({ data: data as never });
  }

  toggleCoupon(id: string, isActive: boolean) {
    return prisma.coupon.update({ where: { id }, data: { isActive } });
  }

  deleteCoupon(id: string) {
    return prisma.coupon.delete({ where: { id } });
  }

  // Banners moved to their own module (BannersService → /admin/banners).

  // ─── Prescriptions (read-only oversight) ───────────────────
  getPrescriptions(page = 1, limit = 20) {
    return prisma.prescription.findMany({
      include: {
        doctor: { select: { name: true, image: true } },
        user: { select: { name: true, image: true } },
        subPatient: { select: { name: true } },
        _count: { select: { items: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    });
  }

  async getPrescriptionDetail(id: string) {
    const rx = await prisma.prescription.findUnique({
      where: { id },
      include: {
        doctor: { select: { name: true, image: true, designation: true } },
        user: { select: { name: true, image: true } },
        subPatient: { select: { name: true } },
        items: true,
        refillRequests: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            patientNote: true,
            doctorNote: true,
            createdAt: true,
            decidedAt: true,
          },
        },
      },
    });
    if (!rx) throw new NotFoundException("Prescription not found");
    return rx;
  }

  // ─── Admin notifications (bell) ──────────────────────────
  getNotifications(limit = 20) {
    return prisma.adminNotification.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 50),
    });
  }

  async getUnreadNotificationCount() {
    const count = await prisma.adminNotification.count({
      where: { read: false },
    });
    return { count };
  }

  markNotificationRead(id: string) {
    return prisma.adminNotification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllNotificationsRead() {
    await prisma.adminNotification.updateMany({
      where: { read: false },
      data: { read: true },
    });
    return { ok: true };
  }
}
