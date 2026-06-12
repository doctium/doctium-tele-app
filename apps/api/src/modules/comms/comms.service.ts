import { BadRequestException, Injectable } from "@nestjs/common";
import { prisma } from "@doctium/database";
import { NotificationsService } from "../notifications/notifications.service";
import { CloudinaryService } from "../prescriptions/cloudinary.service";
import { SendPushDto, SendEmailDto, SendSmsDto } from "./dto/comms.dto";

type Audience = "PATIENTS" | "DOCTORS" | "ALL";
type Recipient = { name: string; email: string | null; mobile: string | null };

@Injectable()
export class CommsService {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async sendPush(dto: SendPushDto, admin: { sub: string }) {
    let image: string | null = dto.imageUrl ?? null;
    if (dto.imageDataUrl) {
      const url = await this.cloudinary.uploadDataUrl(
        dto.imageDataUrl,
        `broadcasts/push-${Date.now()}`,
      );
      if (!url) {
        throw new BadRequestException(
          "Image storage is not configured. Send without an image, or configure Cloudinary.",
        );
      }
      image = url;
    }

    const res = await this.notifications.broadcast({
      audience: dto.audience as Audience,
      title: dto.title,
      message: dto.body,
      type: "broadcast",
      image,
    });

    const senderName =
      (
        await prisma.employee.findUnique({
          where: { id: admin.sub },
          select: { name: true },
        })
      )?.name ?? "Admin";

    const row = await prisma.broadcast.create({
      data: {
        channel: "PUSH",
        audience: dto.audience as Audience,
        title: dto.title,
        body: dto.body,
        image,
        userCount: res.userCount,
        doctorCount: res.doctorCount,
        sentCount: res.sent,
        sentById: admin.sub,
        sentByName: senderName,
      },
    });

    return { ...res, broadcastId: row.id };
  }

  listBroadcasts(limit = 30, channel?: string) {
    return prisma.broadcast.findMany({
      where: channel ? { channel: channel as never } : {},
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  audienceCounts() {
    return this.notifications.audienceCounts();
  }

  /** Search patients or doctors for the individual-recipient picker. */
  async searchRecipients(type: string, search = "") {
    const where = search
      ? {
          isBlock: false,
          isDelete: false,
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { mobile: { contains: search } },
          ],
        }
      : { isBlock: false, isDelete: false };
    const select = {
      id: true,
      name: true,
      email: true,
      mobile: true,
      image: true,
    };
    const items =
      type === "DOCTOR"
        ? await prisma.doctor.findMany({
            where,
            select,
            take: 20,
            orderBy: { name: "asc" },
          })
        : await prisma.user.findMany({
            where,
            select,
            take: 20,
            orderBy: { name: "asc" },
          });
    return items;
  }

  /** Resolve a send target list from either an audience or explicit recipient ids. */
  private async resolveRecipients(dto: {
    mode: string;
    audience?: string;
    recipientType?: string;
    recipientIds?: string[];
  }): Promise<{
    targets: Recipient[];
    userCount: number;
    doctorCount: number;
    audience: Audience;
  }> {
    const sel = { name: true, email: true, mobile: true };
    let users: Recipient[] = [];
    let doctors: Recipient[] = [];
    let audience: Audience = "ALL";

    if (dto.mode === "RECIPIENTS") {
      const ids = dto.recipientIds ?? [];
      if (dto.recipientType === "DOCTOR") {
        doctors = ids.length
          ? await prisma.doctor.findMany({
              where: { id: { in: ids } },
              select: sel,
            })
          : [];
        audience = "DOCTORS";
      } else {
        users = ids.length
          ? await prisma.user.findMany({
              where: { id: { in: ids } },
              select: sel,
            })
          : [];
        audience = "PATIENTS";
      }
    } else {
      audience = (dto.audience as Audience) ?? "ALL";
      if (audience === "PATIENTS" || audience === "ALL") {
        users = await prisma.user.findMany({
          where: { isBlock: false, isDelete: false },
          select: sel,
        });
      }
      if (audience === "DOCTORS" || audience === "ALL") {
        doctors = await prisma.doctor.findMany({
          where: { isBlock: false, isDelete: false },
          select: sel,
        });
      }
    }
    return {
      targets: [...users, ...doctors],
      userCount: users.length,
      doctorCount: doctors.length,
      audience,
    };
  }

  private async senderName(adminSub: string) {
    return (
      (
        await prisma.employee.findUnique({
          where: { id: adminSub },
          select: { name: true },
        })
      )?.name ?? "Admin"
    );
  }

  async sendEmail(dto: SendEmailDto, admin: { sub: string }) {
    const { targets, userCount, doctorCount, audience } =
      await this.resolveRecipients(dto);
    if (targets.length === 0)
      throw new BadRequestException("No recipients matched.");
    const res = await this.notifications.broadcastEmail(
      targets,
      dto.subject,
      dto.body,
    );
    const row = await prisma.broadcast.create({
      data: {
        channel: "EMAIL",
        audience,
        title: dto.subject,
        body: dto.body,
        userCount,
        doctorCount,
        sentCount: res.sent,
        sentById: admin.sub,
        sentByName: await this.senderName(admin.sub),
      },
    });
    return { ...res, userCount, doctorCount, broadcastId: row.id };
  }

  async sendSms(dto: SendSmsDto, admin: { sub: string }) {
    const { targets, userCount, doctorCount, audience } =
      await this.resolveRecipients(dto);
    if (targets.length === 0)
      throw new BadRequestException("No recipients matched.");
    const res = await this.notifications.broadcastSms(targets, dto.message);
    const row = await prisma.broadcast.create({
      data: {
        channel: "SMS",
        audience,
        title: dto.message.slice(0, 60),
        body: dto.message,
        userCount,
        doctorCount,
        sentCount: res.sent,
        sentById: admin.sub,
        sentByName: await this.senderName(admin.sub),
      },
    });
    return { ...res, userCount, doctorCount, broadcastId: row.id };
  }
}
