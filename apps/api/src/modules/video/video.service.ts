import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "@doctium/database";

/** Reports a published clip needs before it is auto-pulled for re-review. */
const AUTO_FLAG_THRESHOLD = 3;

const REPORT_REASONS = [
  "MISINFORMATION",
  "HARMFUL_ADVICE",
  "SPAM",
  "SEXUAL_CONTENT",
  "HARASSMENT",
  "COPYRIGHT",
  "OTHER",
] as const;
type ReportReason = (typeof REPORT_REASONS)[number];

/** Pull the 11-char video id out of any common YouTube URL shape. */
function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return m ? m[1]! : null;
}

@Injectable()
export class VideoService {
  async findAll(
    query: { search?: string; mine?: string },
    userId?: string,
    role?: string,
  ) {
    const search = query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" as const } },
            {
              description: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {};
    // Doctors viewing their own library (?mine=true) see every status of their
    // own clips; the patient MediGram feed sees everyone's APPROVED clips only.
    const isOwnLibrary = query.mine === "true" && role === "doctor" && userId;
    const scope = isOwnLibrary
      ? { doctorId: userId }
      : { status: "APPROVED" as const };

    const videos = await prisma.video.findMany({
      where: { ...search, ...scope },
      include: {
        doctor: {
          select: { id: true, name: true, image: true, designation: true },
        },
        _count: { select: { likes: true, comments: true } },
        ...(userId
          ? { likes: { where: { userId }, select: { id: true }, take: 1 } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    // Flatten the per-user like probe into a boolean so the client never sees
    // other users' like rows.
    return videos.map(({ likes, ...v }) => ({
      ...v,
      likedByMe: Array.isArray(likes) && likes.length > 0,
    }));
  }

  async findOne(id: string, userId?: string) {
    const video = await prisma.video.findUnique({
      where: { id },
      include: {
        doctor: {
          select: { id: true, name: true, image: true, designation: true },
        },
        comments: {
          include: { user: { select: { name: true, image: true } } },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        _count: { select: { likes: true, comments: true } },
      },
    });
    if (!video) throw new NotFoundException("Video not found");

    if (userId) {
      await prisma.watchHistory.upsert({
        where: { videoId_userId: { videoId: id, userId } },
        create: { videoId: id, userId },
        update: {},
      });
    }
    const likedByMe = userId
      ? (await prisma.likeHistory.findUnique({
          where: { videoId_userId: { videoId: id, userId } },
        })) !== null
      : false;
    return { ...video, likedByMe };
  }

  async createVideo(doctorId: string, dto: Record<string, unknown>) {
    const source = dto.source === "YOUTUBE" ? "YOUTUBE" : "UPLOAD";
    let videoUrl = String(dto.videoUrl ?? "").trim();
    let videoImage = String(dto.videoImage ?? "").trim();

    if (source === "YOUTUBE") {
      const id = youtubeId(videoUrl);
      if (!id) {
        throw new BadRequestException(
          "Please paste a valid YouTube video link.",
        );
      }
      // Store a canonical watch URL and a free thumbnail.
      videoUrl = `https://www.youtube.com/watch?v=${id}`;
      if (!videoImage)
        videoImage = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    } else if (!videoUrl) {
      throw new BadRequestException("A video URL is required.");
    }

    // New clips always enter the moderation queue (schema default PENDING).
    return prisma.video.create({
      data: {
        doctorId,
        source,
        videoUrl,
        videoImage,
        title: String(dto.title ?? "").trim(),
        description: String(dto.description ?? "").trim(),
        isCommentAllowed: dto.isCommentAllowed !== false,
      },
    });
  }

  async report(videoId: string, userId: string, reason: string, note?: string) {
    if (!REPORT_REASONS.includes(reason as ReportReason)) {
      throw new BadRequestException("Invalid report reason.");
    }
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, status: true },
    });
    if (!video) throw new NotFoundException("Video not found");

    // One report per user per clip; re-reporting just updates the reason.
    await prisma.videoReport.upsert({
      where: { videoId_userId: { videoId, userId } },
      create: {
        videoId,
        userId,
        reason: reason as ReportReason,
        note: note?.slice(0, 500),
      },
      update: {
        reason: reason as ReportReason,
        note: note?.slice(0, 500),
        status: "OPEN",
      },
    });

    const reportCount = await prisma.videoReport.count({ where: { videoId } });
    // Auto-pull a live clip back into review once enough distinct users flag it.
    const autoFlagged =
      video.status === "APPROVED" && reportCount >= AUTO_FLAG_THRESHOLD;
    await prisma.video.update({
      where: { id: videoId },
      data: { reportCount, ...(autoFlagged ? { status: "FLAGGED" } : {}) },
    });

    return { reported: true, autoFlagged };
  }

  async updateVideo(
    id: string,
    doctorId: string,
    dto: Record<string, unknown>,
  ) {
    return prisma.video.updateMany({ where: { id, doctorId }, data: dto });
  }

  async deleteVideo(id: string, doctorId: string) {
    return prisma.video.deleteMany({ where: { id, doctorId } });
  }

  async toggleLike(videoId: string, userId: string) {
    const existing = await prisma.likeHistory.findUnique({
      where: { videoId_userId: { videoId, userId } },
    });
    if (existing) {
      await prisma.likeHistory.delete({
        where: { videoId_userId: { videoId, userId } },
      });
      return { liked: false };
    }
    await prisma.likeHistory.create({ data: { videoId, userId } });
    return { liked: true };
  }

  async share(videoId: string) {
    const video = await prisma.video.update({
      where: { id: videoId },
      data: { shareCount: { increment: 1 } },
      select: { shareCount: true },
    });
    return { shareCount: video.shareCount };
  }

  async addComment(videoId: string, userId: string, comment: string) {
    const allowed = await prisma.video.findUnique({
      where: { id: videoId },
      select: { isCommentAllowed: true },
    });
    if (!allowed) throw new NotFoundException("Video not found");
    if (!allowed.isCommentAllowed) {
      throw new ForbiddenException("Comments are disabled for this clip");
    }
    return prisma.videoComment.create({
      data: { videoId, userId, comment },
      include: { user: { select: { name: true, image: true } } },
    });
  }
}
