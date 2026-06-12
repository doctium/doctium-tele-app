import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "@doctium/database";
import { PERMISSION_GROUPS } from "@doctium/types";
import { RoleDto } from "./dto/hr.dto";

@Injectable()
export class RbacService {
  /** The permission catalog the role-matrix UI renders. */
  permissionCatalog() {
    return PERMISSION_GROUPS;
  }

  listRoles() {
    return prisma.role.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { employees: true } } },
    });
  }

  createRole(dto: RoleDto) {
    if (!dto.name?.trim())
      throw new BadRequestException("Role name is required");
    return prisma.role.create({
      data: {
        name: dto.name.trim(),
        description: dto.description ?? "",
        permissions: dto.permissions ?? [],
      },
    });
  }

  async updateRole(id: string, dto: Partial<RoleDto>) {
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException("Role not found");
    return prisma.role.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.permissions !== undefined && { permissions: dto.permissions }),
      },
    });
  }

  async deleteRole(id: string) {
    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    });
    if (!role) throw new NotFoundException("Role not found");
    if (role.isSystem)
      throw new BadRequestException("System roles cannot be deleted");
    if (role._count.employees > 0)
      throw new BadRequestException(
        "This role is assigned to employees — reassign them first",
      );
    await prisma.role.delete({ where: { id } });
    return { deleted: true };
  }
}
