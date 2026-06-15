import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma, Prisma } from "@doctium/database";
import { CloudinaryService } from "../prescriptions/cloudinary.service";
import { resolveImageUrl } from "../../common/image.util";
import { CreateBannerDto, UpdateBannerDto } from "./dto/banner.dto";

@Injectable()
export class BannersService {
  constructor(private readonly cloudinary: CloudinaryService) {}

  /** Admin: every banner, in display order. */
  listAll() {
    return prisma.banner.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }

  /** App: only active banners currently within their schedule window. */
  listActive() {
    const now = new Date();
    return prisma.banner.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: { id: true, title: true, image: true, type: true, target: true },
    });
  }

  async create(dto: CreateBannerDto) {
    const image = await resolveImageUrl(
      this.cloudinary,
      dto.image,
      `banners/${Date.now()}`,
    );
    return prisma.banner.create({
      data: {
        title: dto.title,
        type: dto.type,
        target: dto.target ?? "",
        image,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
    });
  }

  async update(id: string, dto: UpdateBannerDto) {
    const existing = await prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Banner not found");
    const data: Prisma.BannerUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.target !== undefined) data.target = dto.target;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.startsAt !== undefined)
      data.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.endsAt !== undefined)
      data.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (dto.image)
      data.image = await resolveImageUrl(
        this.cloudinary,
        dto.image,
        `banners/${id}`,
      );
    return prisma.banner.update({ where: { id }, data });
  }

  async remove(id: string) {
    await prisma.banner.delete({ where: { id } });
    return { deleted: true };
  }

  /** Fire-and-forget tap analytics; never blocks the redirect. */
  async recordClick(id: string) {
    await prisma.banner
      .update({ where: { id }, data: { clickCount: { increment: 1 } } })
      .catch(() => undefined);
    return { ok: true };
  }

  /** Persist a new order: sortOrder follows the given id sequence. */
  async reorder(ids: string[]) {
    await prisma.$transaction(
      ids.map((id, i) =>
        prisma.banner.update({ where: { id }, data: { sortOrder: i } }),
      ),
    );
    return { ok: true };
  }
}
