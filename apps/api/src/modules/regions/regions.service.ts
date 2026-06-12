import { Injectable } from '@nestjs/common';
import { prisma } from '@doctium/database';

@Injectable()
export class RegionsService {
  /** All regions Doctium serves (for the region switcher). */
  list() {
    return prisma.region.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  /** Regions that currently have at least one bookable doctor. */
  async available() {
    const grouped = await prisma.doctor.groupBy({
      by: ['practiceCountry'],
      where: { isDelete: false, isBlock: false },
      _count: { id: true },
    });
    const codes = grouped.map((g) => g.practiceCountry).filter(Boolean);
    return prisma.region.findMany({ where: { code: { in: codes }, isActive: true }, orderBy: { name: 'asc' } });
  }
}
