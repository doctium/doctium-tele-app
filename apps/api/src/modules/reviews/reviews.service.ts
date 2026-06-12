import { BadRequestException, Injectable } from '@nestjs/common';
import { prisma } from '@doctium/database';

@Injectable()
export class ReviewsService {
  async createReview(userId: string, dto: { doctorId: string; appointmentId: string; review: string; rating: number }) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: dto.appointmentId, userId, status: 'COMPLETED', isReviewed: false },
    });
    if (!appointment) throw new BadRequestException('Appointment not eligible for review');

    const review = await prisma.review.create({
      data: { userId, ...dto },
    });

    await prisma.appointment.update({ where: { id: dto.appointmentId }, data: { isReviewed: true } });

    const stats = await prisma.review.aggregate({
      where: { doctorId: dto.doctorId },
      _avg: { rating: true },
      _count: { id: true },
    });

    await prisma.doctor.update({
      where: { id: dto.doctorId },
      data: { rating: stats._avg.rating ?? 0, reviewCount: stats._count.id },
    });

    return review;
  }

  getDoctorReviews(doctorId: string) {
    return prisma.review.findMany({
      where: { doctorId },
      include: { user: { select: { name: true, image: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
