import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "@doctium/database";
import { NotificationsService } from "../notifications/notifications.service";
import { PrescriptionsService } from "./prescriptions.service";

@Injectable()
export class RefillRequestsService {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly prescriptions: PrescriptionsService,
  ) {}

  // ── Patient creates a request ──────────────────────────────
  async create(userId: string, prescriptionId: string, patientNote = "") {
    if (!prescriptionId)
      throw new BadRequestException("prescriptionId is required");
    const rx = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        items: true,
        user: { select: { name: true } },
        subPatient: { select: { name: true } },
      },
    });
    if (!rx) throw new NotFoundException("Prescription not found");
    if (rx.userId !== userId)
      throw new ForbiddenException("Not your prescription");
    if (rx.status === "CANCELLED")
      throw new BadRequestException("This prescription is cancelled");
    if (rx.items.every((i) => i.refills <= 0))
      throw new BadRequestException(
        "No refills remaining on this prescription",
      );

    const created = await prisma.$transaction(async (tx) => {
      const pending = await tx.refillRequest.findFirst({
        where: { prescriptionId, status: "PENDING" },
      });
      if (pending)
        throw new BadRequestException("A refill request is already pending");
      return tx.refillRequest.create({
        data: {
          prescriptionId,
          doctorId: rx.doctorId,
          requestedByUserId: userId,
          patientNote: patientNote ?? "",
        },
      });
    });

    const patientName = rx.subPatient?.name || rx.user.name;
    void this.notifications.sendToDoctor(rx.doctorId, {
      title: "Refill requested",
      message: `${patientName} requested a prescription refill.`,
      type: "refill_request",
      stateType: 2,
    });
    return created;
  }

  // ── Patient: requests for one prescription ─────────────────
  async getForPrescription(prescriptionId: string, userId: string) {
    const rx = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      select: { userId: true },
    });
    if (!rx) throw new NotFoundException("Prescription not found");
    if (rx.userId !== userId)
      throw new ForbiddenException("Not your prescription");
    return prisma.refillRequest.findMany({
      where: { prescriptionId },
      orderBy: { createdAt: "desc" },
    });
  }

  // ── Doctor inbox ───────────────────────────────────────────
  getDoctorPending(doctorId: string) {
    return prisma.refillRequest.findMany({
      where: { doctorId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: {
        prescription: {
          select: {
            id: true,
            code: true,
            diagnosis: true,
            user: { select: { name: true, image: true } },
            subPatient: { select: { name: true } },
            items: { select: { drugName: true, refills: true } },
          },
        },
      },
    });
  }

  getDoctorCount(doctorId: string) {
    return prisma.refillRequest
      .count({ where: { doctorId, status: "PENDING" } })
      .then((pending) => ({ pending }));
  }

  // ── Doctor approves / declines ─────────────────────────────
  async decide(
    requestId: string,
    doctorId: string,
    decision: "APPROVED" | "DECLINED",
    doctorNote = "",
  ) {
    if (decision !== "APPROVED" && decision !== "DECLINED")
      throw new BadRequestException("Invalid decision");
    const req = await prisma.refillRequest.findUnique({
      where: { id: requestId },
      include: { prescription: { include: { items: true } } },
    });
    if (!req) throw new NotFoundException("Refill request not found");
    if (req.doctorId !== doctorId)
      throw new ForbiddenException("Not your patient");
    if (req.status !== "PENDING")
      throw new BadRequestException("This request has already been decided");
    if (req.prescription.status === "CANCELLED")
      throw new BadRequestException("This prescription is cancelled");

    const updated = await prisma.$transaction(async (tx) => {
      if (decision === "APPROVED") {
        for (const it of req.prescription.items) {
          if (it.refills > 0)
            await tx.prescriptionItem.update({
              where: { id: it.id },
              data: { refills: { decrement: 1 } },
            });
        }
      }
      return tx.refillRequest.update({
        where: { id: requestId },
        data: {
          status: decision,
          doctorNote: doctorNote ?? "",
          decidedAt: new Date(),
        },
      });
    });

    // Re-sign AFTER the decrement commits so verifyByCode / QR stay valid.
    if (decision === "APPROVED")
      await this.prescriptions.resign(req.prescriptionId);

    const approved = decision === "APPROVED";
    void this.notifications.sendToUser(req.requestedByUserId, {
      key: approved ? "refill.approved" : "refill.declined",
      params: { note: !approved && doctorNote ? ` Note: ${doctorNote}` : "" },
      type: approved ? "refill_approved" : "refill_declined",
      stateType: approved ? 3 : 4,
    });
    return updated;
  }
}
