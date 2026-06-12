import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "@doctium/database";
import { CloudinaryService } from "../prescriptions/cloudinary.service";
import { SupportGateway } from "./support.gateway";
import { SendSupportMessageDto } from "./dto/support.dto";

@Injectable()
export class SupportService {
  constructor(
    private readonly cloudinary: CloudinaryService,
    private readonly gateway: SupportGateway,
  ) {}

  private preview(type: string, body?: string): string {
    if (type === "IMAGE") return "📷 Photo";
    if (type === "AUDIO") return "🎤 Voice note";
    return (body ?? "").slice(0, 120);
  }

  private async getOrCreateThread(userId: string) {
    return prisma.supportThread.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  /** Patient: fetch (or open) my thread, marking admin replies as read. */
  async getMyThread(userId: string) {
    const thread = await this.getOrCreateThread(userId);
    await prisma.supportMessage.updateMany({
      where: { threadId: thread.id, sender: "ADMIN", read: false },
      data: { read: true },
    });
    if (thread.unreadUser !== 0) {
      await prisma.supportThread.update({
        where: { id: thread.id },
        data: { unreadUser: 0 },
      });
    }
    const messages = await prisma.supportMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: "asc" },
    });
    return { thread: { ...thread, unreadUser: 0 }, messages };
  }

  /** Patient: clear unread without loading messages. */
  async markUserRead(userId: string) {
    const thread = await this.getOrCreateThread(userId);
    await prisma.supportMessage.updateMany({
      where: { threadId: thread.id, sender: "ADMIN", read: false },
      data: { read: true },
    });
    await prisma.supportThread.update({
      where: { id: thread.id },
      data: { unreadUser: 0 },
    });
    this.gateway.broadcastRead(userId, "USER");
    return { ok: true };
  }

  private async resolveMedia(
    type: string,
    dto: SendSupportMessageDto,
    threadId: string,
  ) {
    if (type !== "IMAGE" && type !== "AUDIO") return "";
    if (!dto.dataUrl)
      throw new BadRequestException(
        "An attachment is required for this message type",
      );
    const publicId = `support/${threadId}/${type.toLowerCase()}-${Date.now()}`;
    const url = await this.cloudinary.uploadDataUrl(dto.dataUrl, publicId);
    if (!url)
      throw new BadRequestException(
        "Attachment storage is not configured. Please contact support.",
      );
    return url;
  }

  /** Patient sends a message → bumps the admin unread counter + broadcasts. */
  async sendUserMessage(userId: string, dto: SendSupportMessageDto) {
    const thread = await this.getOrCreateThread(userId);
    const type = dto.type ?? "TEXT";
    if (type === "TEXT" && !dto.body?.trim())
      throw new BadRequestException("Message cannot be empty");
    const mediaUrl = await this.resolveMedia(type, dto, thread.id);

    const message = await prisma.supportMessage.create({
      data: {
        threadId: thread.id,
        sender: "USER",
        senderName: "",
        type: type as never,
        body: dto.body?.trim() ?? "",
        mediaUrl,
        durationSec: dto.durationSec ?? null,
      },
    });
    await prisma.supportThread.update({
      where: { id: thread.id },
      data: {
        lastMessage: this.preview(type, dto.body),
        lastMessageAt: message.createdAt,
        unreadAdmin: { increment: 1 },
        status: "OPEN",
      },
    });
    this.gateway.broadcastMessage(message, userId);
    return message;
  }

  // ── Admin side ─────────────────────────────────────────────
  async listThreads(search = "", page = 1, limit = 20) {
    const userWhere = search
      ? {
          user: {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { mobile: { contains: search } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          },
        }
      : {};
    const [items, total] = await Promise.all([
      prisma.supportThread.findMany({
        where: userWhere,
        include: {
          user: { select: { id: true, name: true, image: true, mobile: true } },
        },
        orderBy: { lastMessageAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.supportThread.count({ where: userWhere }),
    ]);
    return { items, total };
  }

  async getThreadMessages(threadId: string) {
    const thread = await prisma.supportThread.findUnique({
      where: { id: threadId },
      include: {
        user: { select: { id: true, name: true, image: true, mobile: true } },
      },
    });
    if (!thread) throw new NotFoundException("Conversation not found");
    await prisma.supportMessage.updateMany({
      where: { threadId, sender: "USER", read: false },
      data: { read: true },
    });
    if (thread.unreadAdmin !== 0) {
      await prisma.supportThread.update({
        where: { id: threadId },
        data: { unreadAdmin: 0 },
      });
    }
    const messages = await prisma.supportMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
    });
    this.gateway.broadcastRead(thread.userId, "ADMIN");
    return { thread: { ...thread, unreadAdmin: 0 }, messages };
  }

  async markAdminRead(threadId: string) {
    const thread = await prisma.supportThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) throw new NotFoundException("Conversation not found");
    await prisma.supportMessage.updateMany({
      where: { threadId, sender: "USER", read: false },
      data: { read: true },
    });
    await prisma.supportThread.update({
      where: { id: threadId },
      data: { unreadAdmin: 0 },
    });
    this.gateway.broadcastRead(thread.userId, "ADMIN");
    return { ok: true };
  }

  async sendAdminMessage(
    threadId: string,
    admin: { sub: string; name?: string },
    dto: SendSupportMessageDto,
  ) {
    const thread = await prisma.supportThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) throw new NotFoundException("Conversation not found");
    const type = dto.type ?? "TEXT";
    if (type === "TEXT" && !dto.body?.trim())
      throw new BadRequestException("Message cannot be empty");
    const mediaUrl = await this.resolveMedia(type, dto, threadId);

    const senderName =
      admin.name ??
      (await prisma.employee
        .findUnique({ where: { id: admin.sub }, select: { name: true } })
        .then((e) => e?.name)) ??
      "Doctium Support";

    const message = await prisma.supportMessage.create({
      data: {
        threadId,
        sender: "ADMIN",
        senderEmployeeId: admin.sub,
        senderName,
        type: type as never,
        body: dto.body?.trim() ?? "",
        mediaUrl,
        durationSec: dto.durationSec ?? null,
      },
    });
    await prisma.supportThread.update({
      where: { id: threadId },
      data: {
        lastMessage: this.preview(type, dto.body),
        lastMessageAt: message.createdAt,
        unreadUser: { increment: 1 },
        status: "OPEN",
      },
    });
    this.gateway.broadcastMessage(message, thread.userId);
    return message;
  }

  async adminUnreadTotal() {
    const agg = await prisma.supportThread.aggregate({
      _sum: { unreadAdmin: true },
    });
    return { count: agg._sum.unreadAdmin ?? 0 };
  }
}
