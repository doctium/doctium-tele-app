import { Injectable } from "@nestjs/common";
import { prisma } from "@doctium/database";

/** Records sensitive admin-panel actions for accountability. */
@Injectable()
export class AuditService {
  async log(
    actorId: string | null | undefined,
    action: string,
    entityType = "",
    entityId = "",
    meta?: Record<string, unknown>,
  ) {
    let actorName = "";
    if (actorId) {
      const e = await prisma.employee.findUnique({
        where: { id: actorId },
        select: { name: true },
      });
      actorName = e?.name ?? "";
    }
    return prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        actorName,
        action,
        entityType,
        entityId,
        meta: (meta ?? undefined) as never,
      },
    });
  }

  async list(filters: {
    actorId?: string;
    action?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const where: Record<string, unknown> = {};
    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.action) where.action = { contains: filters.action };
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  }
}
