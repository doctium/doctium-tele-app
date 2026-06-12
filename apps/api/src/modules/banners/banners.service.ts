import { Injectable } from '@nestjs/common';
import { prisma } from '@doctium/database';

@Injectable()
export class BannersService {
  findActive() {
    return prisma.banner.findMany({
      where: { isActive: true },
      include: { service: { select: { id: true, name: true } } },
    });
  }
}
