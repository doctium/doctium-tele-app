import { Injectable } from '@nestjs/common';
import { prisma } from '@doctium/database';

@Injectable()
export class ServicesService {
  findAll() {
    return prisma.service.findMany({ where: { isDelete: false, status: true } });
  }

  findDoctorsByService(serviceId: string) {
    return prisma.doctor.findMany({
      where: { isDelete: false, isBlock: false, services: { some: { serviceId } } },
      select: { id: true, name: true, image: true, designation: true, rating: true, charge: true },
    });
  }
}
