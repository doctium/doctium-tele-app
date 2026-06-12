import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import * as crypto from "crypto";
import { prisma } from "@doctium/database";
import { EntitlementsService } from "../subscriptions/entitlements.service";

type ConsentMeta = { ip?: string; userAgent?: string };
type RecordingSessionRequester = { sub: string; role: string };
type RecordingAssetInput = {
  files?: Record<string, unknown>[];
  taskId?: string;
  provider?: string;
  storageVendor?: string;
};
type RecordingRetention = {
  retentionPolicy: string;
  retentionDays: number;
  retainUntil: Date;
};
type RecordingRequestInput = {
  type?: unknown;
  assetId?: unknown;
  reason?: unknown;
};

@Injectable()
export class RecordingService {
  constructor(private readonly entitlements: EntitlementsService) {}

  private async setting(key: string, fallback: string): Promise<string> {
    const row = await prisma.setting.findUnique({ where: { key } });
    return row?.value || fallback;
  }

  async getRecordingConsent(
    appointmentId: string,
    requester: { sub: string; role: string },
  ) {
    const appt = await this.getParticipantAppointment(appointmentId, requester);
    const consent = await prisma.appointmentRecordingConsent.findUnique({
      where: { appointmentId: appt.id },
    });
    return this.serializeRecordingConsent(appt.id, consent);
  }

  async requestRecordingConsent(
    appointmentId: string,
    requester: { sub: string; role: string },
    meta: ConsentMeta,
  ) {
    const appt = await this.getParticipantAppointment(appointmentId, requester);
    this.assertOnlineAppointment(appt.type);
    const role = this.recordingActorRole(requester.role);
    if (role === "ADMIN") {
      throw new ForbiddenException(
        "Only the patient or doctor can request recording consent",
      );
    }

    const existing = await prisma.appointmentRecordingConsent.findUnique({
      where: { appointmentId: appt.id },
    });
    if (existing?.status === "DECLINED") {
      throw new BadRequestException(
        "Recording was declined for this consultation",
      );
    }
    if (existing?.status === "REVOKED") {
      throw new BadRequestException(
        "Recording consent was revoked for this consultation",
      );
    }

    const partyData = this.recordingPartyData(role, true, meta);
    const consent = existing
      ? await prisma.appointmentRecordingConsent.update({
          where: { appointmentId: appt.id },
          data: {
            ...partyData,
            status: this.nextRecordingStatus({
              patientConsentedAt:
                partyData.patientConsentedAt ?? existing.patientConsentedAt,
              doctorConsentedAt:
                partyData.doctorConsentedAt ?? existing.doctorConsentedAt,
              declined: false,
            }),
          },
        })
      : await prisma.appointmentRecordingConsent.create({
          data: {
            appointmentId: appt.id,
            requestedByRole: role,
            requestedById: requester.sub,
            ...partyData,
            status: this.nextRecordingStatus({
              patientConsentedAt: partyData.patientConsentedAt,
              doctorConsentedAt: partyData.doctorConsentedAt,
              declined: false,
            }),
          },
        });

    return this.serializeRecordingConsent(appt.id, consent);
  }

  async respondRecordingConsent(
    appointmentId: string,
    requester: { sub: string; role: string },
    consented: boolean,
    meta: ConsentMeta,
  ) {
    const appt = await this.getParticipantAppointment(appointmentId, requester);
    this.assertOnlineAppointment(appt.type);
    const role = this.recordingActorRole(requester.role);
    if (role === "ADMIN") {
      throw new ForbiddenException(
        "Only the patient or doctor can consent to recording",
      );
    }

    const existing = await prisma.appointmentRecordingConsent.findUnique({
      where: { appointmentId: appt.id },
    });
    if (!existing) {
      throw new BadRequestException("Recording consent has not been requested");
    }
    if (existing.status === "DECLINED") {
      throw new BadRequestException(
        "Recording was declined for this consultation",
      );
    }
    if (existing.status === "REVOKED") {
      throw new BadRequestException(
        "Recording consent was revoked for this consultation",
      );
    }

    const partyData = this.recordingPartyData(role, consented, meta);
    const updated = await prisma.appointmentRecordingConsent.update({
      where: { appointmentId: appt.id },
      data: {
        ...partyData,
        status: this.nextRecordingStatus({
          patientConsentedAt:
            partyData.patientConsentedAt ?? existing.patientConsentedAt,
          doctorConsentedAt:
            partyData.doctorConsentedAt ?? existing.doctorConsentedAt,
          declined: !consented,
        }),
      },
    });
    return this.serializeRecordingConsent(appt.id, updated);
  }

  async getRecordingSession(
    appointmentId: string,
    requester: RecordingSessionRequester,
  ) {
    const appt = await this.getParticipantAppointment(appointmentId, requester);
    const session = await prisma.appointmentRecordingSession.findUnique({
      where: { appointmentId: appt.id },
    });
    return this.serializeRecordingSession(appt.id, session);
  }

  async startRecordingSession(
    appointmentId: string,
    requester: RecordingSessionRequester,
  ) {
    const appt = await this.getParticipantAppointment(appointmentId, requester);
    this.assertOnlineAppointment(appt.type);
    const role = this.recordingActorRole(requester.role);
    if (role === "ADMIN") {
      throw new ForbiddenException(
        "Only the patient or doctor can start recording",
      );
    }

    await this.assertRecordingConsentReady(appt.id);

    const existing = await prisma.appointmentRecordingSession.findUnique({
      where: { appointmentId: appt.id },
    });
    if (
      existing &&
      ["STARTING", "ACTIVE", "STOPPING", "STOPPED"].includes(existing.status)
    ) {
      return this.serializeRecordingSession(appt.id, existing);
    }

    const roomId = this.recordingRoomId(appt.id);
    const clientTaskId = `rec_${appt.id}_${Date.now()}`;
    const outputPrefix = `consultations/${appt.id}`;
    const storage = this.zegoStorageConfig();
    const created = await prisma.appointmentRecordingSession.upsert({
      where: { appointmentId: appt.id },
      update: {
        status: "STARTING",
        roomId,
        clientTaskId,
        outputPrefix,
        storageVendor: storage.vendor,
        startedByRole: role,
        startedById: requester.sub,
        startedAt: null,
        stoppedByRole: null,
        stoppedById: null,
        stoppedAt: null,
        lastError: null,
      },
      create: {
        appointmentId: appt.id,
        roomId,
        clientTaskId,
        outputPrefix,
        storageVendor: storage.vendor,
        startedByRole: role,
        startedById: requester.sub,
      },
    });

    try {
      const zego = await this.zegoStartRecording({
        roomId,
        outputPrefix,
        storageParams: storage.params,
      });
      const updated = await prisma.appointmentRecordingSession.update({
        where: { id: created.id },
        data: {
          status: "ACTIVE",
          taskId: zego.taskId,
          startedAt: new Date(),
          lastError: null,
        },
      });
      return this.serializeRecordingSession(appt.id, updated);
    } catch (error) {
      const updated = await prisma.appointmentRecordingSession.update({
        where: { id: created.id },
        data: {
          status: "FAILED",
          lastError:
            error instanceof Error ? error.message : "Recording start failed",
        },
      });
      return this.serializeRecordingSession(appt.id, updated);
    }
  }

  async stopRecordingSession(
    appointmentId: string,
    requester: RecordingSessionRequester,
  ) {
    const appt = await this.getParticipantAppointment(appointmentId, requester);
    const role = this.recordingActorRole(requester.role);
    if (role === "ADMIN") {
      throw new ForbiddenException(
        "Only the patient or doctor can stop recording",
      );
    }

    const existing = await prisma.appointmentRecordingSession.findUnique({
      where: { appointmentId: appt.id },
    });
    if (!existing) return this.serializeRecordingSession(appt.id, null);
    if (existing.status === "STOPPED" || existing.status === "FAILED") {
      return this.serializeRecordingSession(appt.id, existing);
    }
    if (!existing.taskId) {
      const updated = await prisma.appointmentRecordingSession.update({
        where: { id: existing.id },
        data: {
          status: "FAILED",
          lastError:
            "Cannot stop recording because provider task id is missing",
        },
      });
      return this.serializeRecordingSession(appt.id, updated);
    }

    await prisma.appointmentRecordingSession.update({
      where: { id: existing.id },
      data: { status: "STOPPING" },
    });

    try {
      await this.zegoStopRecording(existing.taskId);
      const updated = await prisma.appointmentRecordingSession.update({
        where: { id: existing.id },
        data: {
          status: "STOPPED",
          stoppedByRole: role,
          stoppedById: requester.sub,
          stoppedAt: new Date(),
          lastError: null,
        },
      });
      return this.serializeRecordingSession(appt.id, updated);
    } catch (error) {
      const updated = await prisma.appointmentRecordingSession.update({
        where: { id: existing.id },
        data: {
          status: "FAILED",
          lastError:
            error instanceof Error ? error.message : "Recording stop failed",
        },
      });
      return this.serializeRecordingSession(appt.id, updated);
    }
  }

  async listRecordingAssets(
    appointmentId: string,
    requester: RecordingSessionRequester,
  ) {
    const appt = await this.getParticipantAppointment(appointmentId, requester);
    const assets = await prisma.appointmentRecordingAsset.findMany({
      where: { appointmentId: appt.id, status: "AVAILABLE" },
      orderBy: { createdAt: "desc" },
    });
    return assets.map((asset) => this.serializeRecordingAsset(asset));
  }

  async registerRecordingAssets(
    appointmentId: string,
    input: RecordingAssetInput,
    actor?: RecordingSessionRequester,
  ) {
    if (actor) {
      const role = this.recordingActorRole(actor.role);
      if (role !== "ADMIN")
        throw new ForbiddenException(
          "Only admins can register recording assets",
        );
    }
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appt) throw new NotFoundException("Appointment not found");

    const session = await prisma.appointmentRecordingSession.findUnique({
      where: { appointmentId: appt.id },
    });
    const files = Array.isArray(input.files) ? input.files : [];
    if (files.length === 0)
      throw new BadRequestException("No recording files provided");

    const saved = [];
    for (const file of files) {
      const objectKey = String(
        file.objectKey ??
          file.ObjectKey ??
          file.key ??
          file.Key ??
          file.url ??
          file.FileUrl ??
          "",
      );
      if (!objectKey) continue;
      const bucket = this.optionalString(file.bucket ?? file.Bucket);
      const region = this.optionalString(file.region ?? file.Region);
      const vendor = this.optionalString(
        file.storageVendor ?? input.storageVendor ?? session?.storageVendor,
      );
      const retention = await this.recordingRetentionForAppointment(
        appt.id,
        file,
      );
      const asset = await prisma.appointmentRecordingAsset.upsert({
        where: {
          appointmentId_objectKey: { appointmentId: appt.id, objectKey },
        },
        update: {
          sessionId: session?.id ?? null,
          provider:
            this.optionalString(file.provider ?? input.provider) || "ZEGO",
          storageVendor: vendor,
          bucket,
          region,
          fileName: this.optionalString(file.fileName ?? file.FileName),
          mimeType:
            this.optionalString(file.mimeType ?? file.MimeType) || "video/mp4",
          sizeBytes: this.optionalBigInt(file.sizeBytes ?? file.Size),
          durationSeconds: this.optionalNumber(
            file.durationSeconds ?? file.Duration,
          ),
          checksum: this.optionalString(file.checksum ?? file.Checksum),
          encrypted: file.encrypted === false ? false : true,
          encryptionMethod:
            this.optionalString(file.encryptionMethod) || "provider-managed",
          providerTaskId: this.optionalString(
            file.providerTaskId ?? input.taskId ?? session?.taskId,
          ),
          providerFileId: this.optionalString(
            file.providerFileId ?? file.FileId,
          ),
          providerUrl: this.optionalString(
            file.providerUrl ?? file.FileUrl ?? file.url,
          ),
          retentionPolicy: retention.retentionPolicy,
          retentionDays: retention.retentionDays,
          retainUntil: retention.retainUntil,
          archivedAt: null,
          deletedAt: null,
          status: "AVAILABLE",
        },
        create: {
          appointmentId: appt.id,
          sessionId: session?.id ?? null,
          provider:
            this.optionalString(file.provider ?? input.provider) || "ZEGO",
          storageVendor: vendor,
          bucket,
          region,
          objectKey,
          fileName: this.optionalString(file.fileName ?? file.FileName),
          mimeType:
            this.optionalString(file.mimeType ?? file.MimeType) || "video/mp4",
          sizeBytes: this.optionalBigInt(file.sizeBytes ?? file.Size),
          durationSeconds: this.optionalNumber(
            file.durationSeconds ?? file.Duration,
          ),
          checksum: this.optionalString(file.checksum ?? file.Checksum),
          encrypted: file.encrypted === false ? false : true,
          encryptionMethod:
            this.optionalString(file.encryptionMethod) || "provider-managed",
          providerTaskId: this.optionalString(
            file.providerTaskId ?? input.taskId ?? session?.taskId,
          ),
          providerFileId: this.optionalString(
            file.providerFileId ?? file.FileId,
          ),
          providerUrl: this.optionalString(
            file.providerUrl ?? file.FileUrl ?? file.url,
          ),
          retentionPolicy: retention.retentionPolicy,
          retentionDays: retention.retentionDays,
          retainUntil: retention.retainUntil,
        },
      });
      saved.push(this.serializeRecordingAsset(asset));
    }
    return { appointmentId: appt.id, assets: saved };
  }

  async getRecordingAssetAccess(
    appointmentId: string,
    assetId: string,
    requester: RecordingSessionRequester,
    meta: ConsentMeta,
  ) {
    const appt = await this.getParticipantAppointment(appointmentId, requester);
    const asset = await prisma.appointmentRecordingAsset.findFirst({
      where: { id: assetId, appointmentId: appt.id, status: "AVAILABLE" },
    });
    if (!asset) throw new NotFoundException("Recording asset not found");
    await this.assertRecordingPlaybackEntitlement(requester);

    await prisma.appointmentRecordingAccessLog.create({
      data: {
        appointmentId: appt.id,
        assetId: asset.id,
        actorRole: this.recordingActorRole(requester.role),
        actorId: requester.sub,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    const expiresInSeconds = Number(
      process.env.RECORDING_ACCESS_URL_TTL_SECONDS ?? 300,
    );
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    return {
      asset: this.serializeRecordingAsset(asset),
      accessUrl: this.signedRecordingUrl(asset, expiresInSeconds),
      expiresAt,
    };
  }

  async listRecordingRequests(
    appointmentId: string,
    requester: RecordingSessionRequester,
  ) {
    const appt = await this.getParticipantAppointment(appointmentId, requester);
    const rows = await prisma.appointmentRecordingRequest.findMany({
      where: { appointmentId: appt.id },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.serializeRecordingRequest(row));
  }

  async createRecordingRequest(
    appointmentId: string,
    requester: RecordingSessionRequester,
    input: RecordingRequestInput,
  ) {
    const appt = await this.getParticipantAppointment(appointmentId, requester);
    const type = this.optionalString(input.type)?.toUpperCase();
    if (type !== "EXPORT" && type !== "DELETE") {
      throw new BadRequestException("Request type must be EXPORT or DELETE");
    }
    const role = this.recordingActorRole(requester.role);
    if (type === "DELETE" && role !== "USER" && role !== "ADMIN") {
      throw new ForbiddenException(
        "Only the patient or an admin can request recording deletion",
      );
    }
    const assetId = this.optionalString(input.assetId);
    if (assetId) {
      const asset = await prisma.appointmentRecordingAsset.findFirst({
        where: { id: assetId, appointmentId: appt.id },
        select: { id: true },
      });
      if (!asset) throw new NotFoundException("Recording asset not found");
    }
    const request = await prisma.appointmentRecordingRequest.create({
      data: {
        appointmentId: appt.id,
        assetId,
        type: type as never,
        requestedByRole: role,
        requestedById: requester.sub,
        reason: this.optionalString(input.reason) ?? "",
      },
    });
    await prisma.appointmentRecordingAccessLog.create({
      data: {
        appointmentId: appt.id,
        assetId,
        actorRole: role,
        actorId: requester.sub,
        action: `${type}_REQUEST_CREATED`,
      },
    });
    return this.serializeRecordingRequest(request);
  }

  async adminListRecordings(query: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    retention?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const status =
      query.status && query.status !== "ALL" ? query.status : undefined;
    const now = new Date();
    const assetWhere = {
      ...(status ? { status: status as never } : {}),
      ...(query.retention === "EXPIRED" ? { retainUntil: { lte: now } } : {}),
      ...(query.retention === "ACTIVE"
        ? { OR: [{ retainUntil: null }, { retainUntil: { gt: now } }] }
        : {}),
    };
    const search = query.search?.trim();
    const where = {
      recordingAssets: { some: assetWhere },
      ...(search
        ? {
            OR: [
              {
                appointmentId: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                user: {
                  name: { contains: search, mode: "insensitive" as const },
                },
              },
              {
                doctor: {
                  name: { contains: search, mode: "insensitive" as const },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              mobile: true,
              country: true,
            },
          },
          doctor: { select: { name: true, image: true } },
          recordingConsent: true,
          recordingSession: true,
          recordingAssets: {
            where: assetWhere,
            orderBy: { createdAt: "desc" },
          },
          _count: { select: { recordingAccessLogs: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.appointment.count({ where }),
    ]);

    return {
      items: items.map((appt) => ({
        id: appt.id,
        appointmentId: appt.appointmentId,
        date: appt.date,
        time: appt.time,
        type: appt.type,
        status: appt.status,
        user: appt.user,
        doctor: appt.doctor,
        consentStatus: appt.recordingConsent?.status ?? "NOT_REQUESTED",
        sessionStatus: appt.recordingSession?.status ?? "NOT_STARTED",
        accessLogCount: appt._count.recordingAccessLogs,
        assets: appt.recordingAssets.map((asset) =>
          this.serializeRecordingAsset(asset),
        ),
      })),
      total,
      page,
      limit,
    };
  }

  async adminGetRecording(appointmentId: string) {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            mobile: true,
            country: true,
          },
        },
        doctor: { select: { id: true, name: true, image: true } },
        recordingConsent: true,
        recordingSession: true,
        recordingAssets: { orderBy: { createdAt: "desc" } },
        recordingAccessLogs: { orderBy: { createdAt: "desc" }, take: 100 },
        recordingRequests: { orderBy: { createdAt: "desc" }, take: 100 },
      },
    });
    if (!appt) throw new NotFoundException("Appointment not found");
    return {
      id: appt.id,
      appointmentId: appt.appointmentId,
      date: appt.date,
      time: appt.time,
      type: appt.type,
      status: appt.status,
      user: appt.user,
      doctor: appt.doctor,
      consent: appt.recordingConsent,
      session: this.serializeRecordingSession(appt.id, appt.recordingSession),
      assets: appt.recordingAssets.map((asset) =>
        this.serializeRecordingAsset(asset),
      ),
      accessLogs: appt.recordingAccessLogs,
      requests: appt.recordingRequests.map((request) =>
        this.serializeRecordingRequest(request),
      ),
    };
  }

  async adminListRecordingRequests(query: {
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const where = {
      ...(query.status && query.status !== "ALL"
        ? { status: query.status as never }
        : {}),
      ...(query.type && query.type !== "ALL"
        ? { type: query.type as never }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.appointmentRecordingRequest.findMany({
        where,
        include: {
          appointment: {
            select: {
              id: true,
              appointmentId: true,
              date: true,
              time: true,
              user: { select: { name: true, image: true } },
              doctor: { select: { name: true, image: true } },
            },
          },
          asset: {
            select: {
              id: true,
              fileName: true,
              status: true,
              retainUntil: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.appointmentRecordingRequest.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...this.serializeRecordingRequest(item),
        appointment: item.appointment,
        asset: item.asset,
      })),
      total,
      page,
      limit,
    };
  }

  async adminDecideRecordingRequest(
    requestId: string,
    admin: RecordingSessionRequester,
    input: {
      status?: unknown;
      decisionReason?: unknown;
      disputeHold?: unknown;
      disputeHoldUntil?: unknown;
      disputeHoldReason?: unknown;
    },
  ) {
    const status = this.optionalString(input.status)?.toUpperCase();
    if (
      status !== "APPROVED" &&
      status !== "REJECTED" &&
      status !== "COMPLETED"
    ) {
      throw new BadRequestException(
        "Decision status must be APPROVED, REJECTED, or COMPLETED",
      );
    }
    const existing = await prisma.appointmentRecordingRequest.findUnique({
      where: { id: requestId },
      include: { appointment: true },
    });
    if (!existing) throw new NotFoundException("Recording request not found");

    const now = new Date();
    const update: Record<string, unknown> = {
      status,
      decisionById: admin.sub,
      decisionReason: this.optionalString(input.decisionReason),
      decidedAt: now,
      disputeHold: input.disputeHold === true,
      disputeHoldUntil: this.optionalDate(input.disputeHoldUntil),
      disputeHoldReason: this.optionalString(input.disputeHoldReason),
    };

    if (status === "APPROVED" && existing.type === "EXPORT") {
      const asset = await this.recordingRequestAsset(
        existing.appointmentId,
        existing.assetId,
      );
      const expiresInSeconds = Number(
        process.env.RECORDING_EXPORT_URL_TTL_SECONDS ?? 86400,
      );
      update.exportUrl = this.signedRecordingUrl(asset, expiresInSeconds);
      update.exportExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    }

    if (
      (status === "APPROVED" || status === "COMPLETED") &&
      existing.type === "DELETE"
    ) {
      const holdUntil = this.optionalDate(input.disputeHoldUntil);
      if (
        input.disputeHold === true &&
        (!holdUntil || holdUntil.getTime() > Date.now())
      ) {
        update.status = "APPROVED";
      } else {
        await this.deleteRecordingRequestAssets(
          existing.appointmentId,
          existing.assetId,
          now,
        );
        update.status = "COMPLETED";
        update.completedAt = now;
      }
    }

    const request = await prisma.appointmentRecordingRequest.update({
      where: { id: requestId },
      data: update as never,
    });
    await prisma.appointmentRecordingAccessLog.create({
      data: {
        appointmentId: existing.appointmentId,
        assetId: existing.assetId,
        actorRole: "ADMIN",
        actorId: admin.sub,
        action: `${existing.type}_REQUEST_${String(update.status)}`,
      },
    });
    return this.serializeRecordingRequest(request);
  }

  async setRecordingRequestDisputeHold(
    appointmentId: string,
    requestId: string,
    requester: RecordingSessionRequester,
    input: { disputeHoldUntil?: unknown; disputeHoldReason?: unknown },
  ) {
    const appt = await this.getParticipantAppointment(appointmentId, requester);
    const role = this.recordingActorRole(requester.role);
    if (role !== "DOCTOR" && role !== "ADMIN") {
      throw new ForbiddenException(
        "Only the doctor or an admin can place a dispute hold",
      );
    }
    const request = await prisma.appointmentRecordingRequest.findFirst({
      where: { id: requestId, appointmentId: appt.id },
    });
    if (!request) throw new NotFoundException("Recording request not found");
    const updated = await prisma.appointmentRecordingRequest.update({
      where: { id: request.id },
      data: {
        disputeHold: true,
        disputeHoldUntil: this.optionalDate(input.disputeHoldUntil),
        disputeHoldReason:
          this.optionalString(input.disputeHoldReason) ?? "Dispute/legal hold",
      },
    });
    await prisma.appointmentRecordingAccessLog.create({
      data: {
        appointmentId: appt.id,
        assetId: request.assetId,
        actorRole: role,
        actorId: requester.sub,
        action: "DISPUTE_HOLD_PLACED",
      },
    });
    return this.serializeRecordingRequest(updated);
  }

  async adminUpdateRecordingAssetRetention(
    assetId: string,
    input: {
      retentionDays?: unknown;
      retainUntil?: unknown;
      retentionPolicy?: unknown;
      status?: unknown;
    },
  ) {
    const asset = await prisma.appointmentRecordingAsset.findUnique({
      where: { id: assetId },
    });
    if (!asset) throw new NotFoundException("Recording asset not found");
    const retentionDays = this.positiveInt(input.retentionDays);
    const retainUntil = this.optionalDate(input.retainUntil);
    const status = this.optionalString(input.status);
    return this.serializeRecordingAsset(
      await prisma.appointmentRecordingAsset.update({
        where: { id: assetId },
        data: {
          ...(retentionDays !== undefined && { retentionDays }),
          ...(retainUntil && { retainUntil }),
          ...(this.optionalString(input.retentionPolicy) && {
            retentionPolicy: this.optionalString(input.retentionPolicy),
          }),
          ...(status &&
          ["AVAILABLE", "ARCHIVED", "QUARANTINED", "DELETED"].includes(status)
            ? {
                status: status as never,
                ...(status === "ARCHIVED" ? { archivedAt: new Date() } : {}),
                ...(status === "DELETED" ? { deletedAt: new Date() } : {}),
              }
            : {}),
        },
      }),
    );
  }

  async runRecordingRetention() {
    const action = (
      await this.setting(
        "recording_retention_action",
        process.env.RECORDING_RETENTION_ACTION ?? "ARCHIVE",
      )
    ).toUpperCase();
    const now = new Date();
    const expired = await prisma.appointmentRecordingAsset.findMany({
      where: {
        retainUntil: { lte: now },
        status: { in: ["AVAILABLE", "QUARANTINED"] as never },
      },
      select: { id: true, appointmentId: true },
    });
    if (expired.length === 0) return { processed: 0, action };

    const status = action === "DELETE" ? "DELETED" : "ARCHIVED";
    await prisma.appointmentRecordingAsset.updateMany({
      where: { id: { in: expired.map((a) => a.id) } },
      data:
        status === "DELETED"
          ? { status, deletedAt: now }
          : { status, archivedAt: now },
    });
    await prisma.appointmentRecordingAccessLog.createMany({
      data: expired.map((asset) => ({
        appointmentId: asset.appointmentId,
        assetId: asset.id,
        actorRole: "ADMIN",
        actorId: "system",
        action: `RETENTION_${status}`,
      })),
    });
    return { processed: expired.length, action: status };
  }

  @Cron("0 3 * * *")
  async runRecordingRetentionCron() {
    await this.runRecordingRetention();
  }

  private async assertRecordingPlaybackEntitlement(
    requester: RecordingSessionRequester,
  ) {
    const role = this.recordingActorRole(requester.role);
    if (role === "ADMIN") return;

    if (role === "USER") {
      const ent = await this.entitlements.resolveUserEntitlements(
        requester.sub,
      );
      if (ent.active && ent.recordingPlayback) return;
    }

    if (role === "DOCTOR") {
      const ent = await this.entitlements.resolveDoctorEntitlements(
        requester.sub,
      );
      if (ent.active && ent.recordingPlayback) return;
    }

    throw new ForbiddenException(
      "Consultation playback is available on plans that include recording playback",
    );
  }

  private async recordingRetentionForAppointment(
    appointmentId: string,
    file: Record<string, unknown>,
  ): Promise<RecordingRetention> {
    const explicitDays = this.positiveInt(file.retentionDays);
    const explicitUntil = this.optionalDate(file.retainUntil);
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        user: { select: { country: true } },
        subscription: { include: { plan: true } },
      },
    });

    const benefits = (appt?.subscription?.plan.benefits ?? {}) as {
      recordingRetentionDays?: unknown;
    };
    const planDays = this.positiveInt(benefits.recordingRetentionDays);
    const country = (appt?.user?.country ?? "").trim().toUpperCase();
    const jurisdictionRaw = country
      ? await this.setting(`recording_retention_days_${country}`, "")
      : "";
    const jurisdictionDays = this.positiveInt(
      jurisdictionRaw ||
        (country
          ? process.env[`RECORDING_RETENTION_DAYS_${country}`]
          : undefined),
    );
    const defaultDays = this.positiveInt(
      await this.setting(
        "recording_retention_days_default",
        process.env.RECORDING_RETENTION_DEFAULT_DAYS ?? "90",
      ),
    );
    const retentionDays =
      explicitDays ?? planDays ?? jurisdictionDays ?? defaultDays ?? 90;
    const retainUntil =
      explicitUntil ??
      new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
    const policy =
      this.optionalString(file.retentionPolicy) ??
      (appt?.subscription?.plan.code
        ? `${appt.subscription.plan.code.toUpperCase()}_${retentionDays}_DAYS`
        : country
          ? `${country}_${retentionDays}_DAYS`
          : `STANDARD_${retentionDays}_DAYS`);

    return { retentionPolicy: policy, retentionDays, retainUntil };
  }

  private async assertRecordingConsentReady(appointmentId: string) {
    const consent = await prisma.appointmentRecordingConsent.findUnique({
      where: { appointmentId },
    });
    if (!consent || consent.status !== "CONSENTED") {
      throw new BadRequestException(
        "Recording requires consent from both parties",
      );
    }
  }

  private serializeRecordingAsset(asset: {
    id: string;
    appointmentId: string;
    provider: string;
    storageVendor: string;
    status: string;
    fileName: string;
    mimeType: string;
    sizeBytes: bigint | null;
    durationSeconds: number | null;
    encrypted: boolean;
    encryptionMethod: string;
    retentionPolicy: string;
    retentionDays: number;
    retainUntil: Date | null;
    archivedAt: Date | null;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: asset.id,
      appointmentId: asset.appointmentId,
      provider: asset.provider,
      storageVendor: asset.storageVendor,
      status: asset.status,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes == null ? null : asset.sizeBytes.toString(),
      durationSeconds: asset.durationSeconds,
      encrypted: asset.encrypted,
      encryptionMethod: asset.encryptionMethod,
      retentionPolicy: asset.retentionPolicy,
      retentionDays: asset.retentionDays,
      retainUntil: asset.retainUntil,
      archivedAt: asset.archivedAt,
      deletedAt: asset.deletedAt,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    };
  }

  private serializeRecordingRequest(request: {
    id: string;
    appointmentId: string;
    assetId: string | null;
    type: string;
    status: string;
    requestedByRole: string;
    requestedById: string;
    reason: string;
    decisionById: string | null;
    decisionReason: string | null;
    decidedAt: Date | null;
    completedAt: Date | null;
    disputeHold: boolean;
    disputeHoldUntil: Date | null;
    disputeHoldReason: string | null;
    exportUrl: string | null;
    exportExpiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: request.id,
      appointmentId: request.appointmentId,
      assetId: request.assetId,
      type: request.type,
      status: request.status,
      requestedByRole: request.requestedByRole,
      requestedById: request.requestedById,
      reason: request.reason,
      decisionById: request.decisionById,
      decisionReason: request.decisionReason,
      decidedAt: request.decidedAt,
      completedAt: request.completedAt,
      disputeHold: request.disputeHold,
      disputeHoldUntil: request.disputeHoldUntil,
      disputeHoldReason: request.disputeHoldReason,
      exportUrl: request.exportUrl,
      exportExpiresAt: request.exportExpiresAt,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  private async recordingRequestAsset(
    appointmentId: string,
    assetId: string | null,
  ) {
    const asset = await prisma.appointmentRecordingAsset.findFirst({
      where: {
        appointmentId,
        status: { in: ["AVAILABLE", "ARCHIVED"] as never },
        ...(assetId ? { id: assetId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    if (!asset)
      throw new NotFoundException("No exportable recording asset found");
    return asset;
  }

  private async deleteRecordingRequestAssets(
    appointmentId: string,
    assetId: string | null,
    deletedAt: Date,
  ) {
    const where = {
      appointmentId,
      status: { not: "DELETED" as never },
      ...(assetId ? { id: assetId } : {}),
    };
    const assets = await prisma.appointmentRecordingAsset.findMany({
      where,
      select: { id: true },
    });
    if (assets.length === 0)
      throw new NotFoundException("No recording assets found to delete");
    await prisma.appointmentRecordingAsset.updateMany({
      where: { id: { in: assets.map((asset) => asset.id) } },
      data: { status: "DELETED", deletedAt },
    });
  }

  private signedRecordingUrl(
    asset: {
      storageVendor: string;
      bucket: string | null;
      region: string | null;
      objectKey: string;
      providerUrl: string | null;
    },
    expiresInSeconds: number,
  ) {
    const vendor = asset.storageVendor.toLowerCase();
    if (vendor.includes("s3") || vendor.includes("aws")) {
      return this.signS3GetUrl(asset, expiresInSeconds);
    }
    if (
      process.env.RECORDING_ALLOW_PROVIDER_URL_ACCESS === "true" &&
      asset.providerUrl
    ) {
      return asset.providerUrl;
    }
    throw new InternalServerErrorException(
      "No private URL signer is configured for this recording storage provider",
    );
  }

  private signS3GetUrl(
    asset: { bucket: string | null; region: string | null; objectKey: string },
    expiresInSeconds: number,
  ) {
    const accessKey =
      process.env.RECORDING_S3_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID;
    const secretKey =
      process.env.RECORDING_S3_SECRET_ACCESS_KEY ??
      process.env.AWS_SECRET_ACCESS_KEY;
    const bucket = asset.bucket ?? process.env.RECORDING_S3_BUCKET;
    const region =
      asset.region ??
      process.env.RECORDING_S3_REGION ??
      process.env.AWS_REGION ??
      "us-east-1";
    if (!accessKey || !secretKey || !bucket) {
      throw new InternalServerErrorException(
        "S3 recording URL signing is not configured",
      );
    }

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const service = "s3";
    const host = `${bucket}.s3.${region}.amazonaws.com`;
    const encodedKey = asset.objectKey
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const query = new URLSearchParams({
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${accessKey}/${credentialScope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(Math.max(1, Math.min(expiresInSeconds, 3600))),
      "X-Amz-SignedHeaders": "host",
    });
    const canonicalRequest = [
      "GET",
      `/${encodedKey}`,
      query.toString(),
      `host:${host}`,
      "",
      "host",
      "UNSIGNED-PAYLOAD",
    ].join("\n");
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
    ].join("\n");
    const signature = crypto
      .createHmac(
        "sha256",
        this.awsSigningKey(secretKey, dateStamp, region, service),
      )
      .update(stringToSign)
      .digest("hex");
    query.set("X-Amz-Signature", signature);
    return `https://${host}/${encodedKey}?${query.toString()}`;
  }

  private awsSigningKey(
    secret: string,
    date: string,
    region: string,
    service: string,
  ) {
    const kDate = crypto
      .createHmac("sha256", `AWS4${secret}`)
      .update(date)
      .digest();
    const kRegion = crypto.createHmac("sha256", kDate).update(region).digest();
    const kService = crypto
      .createHmac("sha256", kRegion)
      .update(service)
      .digest();
    return crypto
      .createHmac("sha256", kService)
      .update("aws4_request")
      .digest();
  }

  private optionalString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private optionalNumber(value: unknown) {
    const n =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : NaN;
    return Number.isFinite(n) ? n : undefined;
  }

  private positiveInt(value: unknown) {
    const n = this.optionalNumber(value);
    if (n == null) return undefined;
    const int = Math.floor(n);
    return int > 0 ? int : undefined;
  }

  private optionalDate(value: unknown) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value !== "string" || !value.trim()) return undefined;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  private optionalBigInt(value: unknown) {
    const n = this.optionalNumber(value);
    return n == null ? undefined : BigInt(Math.max(0, Math.floor(n)));
  }

  private recordingRoomId(appointmentId: string) {
    return (
      appointmentId.replace(/[^A-Za-z0-9_]/g, "").slice(0, 100) ||
      "doctium-room"
    );
  }

  private serializeRecordingSession(
    appointmentId: string,
    session: Awaited<
      ReturnType<typeof prisma.appointmentRecordingSession.findUnique>
    >,
  ) {
    return {
      appointmentId,
      status: session?.status ?? "NOT_STARTED",
      provider: session?.provider ?? "ZEGO",
      roomId: session?.roomId ?? this.recordingRoomId(appointmentId),
      taskId: session?.taskId ?? null,
      startedAt: session?.startedAt ?? null,
      stoppedAt: session?.stoppedAt ?? null,
      outputPrefix: session?.outputPrefix ?? null,
      storageVendor: session?.storageVendor ?? null,
      lastError: session?.lastError ?? null,
    };
  }

  private zegoStorageConfig(): {
    vendor: string;
    params: Record<string, unknown>;
  } {
    if (process.env.ZEGO_CLOUD_RECORDING_ENABLED !== "true") {
      throw new InternalServerErrorException("Cloud recording is not enabled");
    }
    const raw = process.env.ZEGO_CLOUD_RECORDING_STORAGE_PARAMS;
    if (!raw) {
      throw new InternalServerErrorException(
        "ZEGO_CLOUD_RECORDING_STORAGE_PARAMS is not configured",
      );
    }
    try {
      const params = JSON.parse(raw) as Record<string, unknown>;
      const vendor = String(params.Vendor ?? params.vendor ?? "");
      return { vendor, params };
    } catch {
      throw new InternalServerErrorException(
        "ZEGO_CLOUD_RECORDING_STORAGE_PARAMS must be valid JSON",
      );
    }
  }

  private async zegoStartRecording(input: {
    roomId: string;
    outputPrefix: string;
    storageParams: Record<string, unknown>;
  }): Promise<{ taskId: string }> {
    const body = {
      RoomId: input.roomId,
      RecordInputParams: {
        RecordMode: Number(process.env.ZEGO_CLOUD_RECORDING_MODE ?? 1),
        StreamType: Number(process.env.ZEGO_CLOUD_RECORDING_STREAM_TYPE ?? 3),
        MaxIdleTime: Number(
          process.env.ZEGO_CLOUD_RECORDING_MAX_IDLE_SECONDS ?? 300,
        ),
      },
      RecordOutputParams: {
        OutputFileFormat: process.env.ZEGO_CLOUD_RECORDING_FORMAT ?? "mp4",
        OutputFolder: input.outputPrefix,
      },
      StorageParams: input.storageParams,
      ...this.optionalJsonEnv("ZEGO_CLOUD_RECORDING_START_PARAMS"),
    };
    const res = await this.zegoRecordingRequest("StartRecord", body);
    const taskId = String(
      (res.Data as Record<string, unknown> | undefined)?.TaskId ??
        (res.Data as Record<string, unknown> | undefined)?.task_id ??
        "",
    );
    if (!taskId) throw new Error("Zego StartRecord did not return a task id");
    return { taskId };
  }

  private async zegoStopRecording(taskId: string) {
    await this.zegoRecordingRequest("StopRecord", {
      TaskId: taskId,
      ...this.optionalJsonEnv("ZEGO_CLOUD_RECORDING_STOP_PARAMS"),
    });
  }

  private async zegoRecordingRequest(
    action: string,
    body: Record<string, unknown>,
  ) {
    const appId = process.env.ZEGO_APP_ID;
    const secret = process.env.ZEGO_SERVER_SECRET;
    if (!appId || !secret) {
      throw new InternalServerErrorException(
        "ZEGO_APP_ID and ZEGO_SERVER_SECRET are required",
      );
    }
    const baseUrl =
      process.env.ZEGO_CLOUD_RECORDING_BASE_URL ??
      "https://cloudrecord-api.zego.im";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(8).toString("hex");
    const signature = crypto
      .createHash("md5")
      .update(appId + nonce + secret + timestamp)
      .digest("hex");
    const url = new URL(baseUrl);
    url.searchParams.set("Action", action);
    url.searchParams.set("AppId", appId);
    url.searchParams.set("SignatureNonce", nonce);
    url.searchParams.set("Timestamp", timestamp);
    url.searchParams.set("Signature", signature);
    url.searchParams.set("SignatureVersion", "2.0");
    url.searchParams.set(
      "IsTest",
      process.env.ZEGO_CLOUD_RECORDING_IS_TEST ?? "false",
    );

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await response.json().catch(() => ({}))) as {
      Code?: number;
      Message?: string;
      Data?: unknown;
    };
    if (!response.ok || (typeof json.Code === "number" && json.Code !== 0)) {
      throw new Error(
        json.Message || `Zego ${action} failed with HTTP ${response.status}`,
      );
    }
    return json;
  }

  private optionalJsonEnv(key: string): Record<string, unknown> {
    const raw = process.env[key];
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new InternalServerErrorException(`${key} must be valid JSON`);
    }
  }

  private async getParticipantAppointment(
    appointmentId: string,
    requester: { sub: string; role: string },
  ) {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appt) throw new NotFoundException("Appointment not found");
    if (
      (requester.role === "user" && appt.userId !== requester.sub) ||
      (requester.role === "doctor" && appt.doctorId !== requester.sub)
    ) {
      throw new ForbiddenException("Not your appointment");
    }
    return appt;
  }

  private assertOnlineAppointment(type: string) {
    if (type !== "ONLINE") {
      throw new BadRequestException("Only video consultations can be recorded");
    }
  }

  private recordingActorRole(role: string): "USER" | "DOCTOR" | "ADMIN" {
    if (role === "user") return "USER";
    if (role === "doctor") return "DOCTOR";
    return "ADMIN";
  }

  private recordingPartyData(
    role: "USER" | "DOCTOR" | "ADMIN",
    consented: boolean,
    meta: ConsentMeta,
  ) {
    const now = new Date();
    if (role === "USER") {
      return consented
        ? {
            patientConsentedAt: now,
            patientDeclinedAt: null,
            patientConsentIp: meta.ip,
            patientUserAgent: meta.userAgent,
          }
        : { patientDeclinedAt: now };
    }
    return consented
      ? {
          doctorConsentedAt: now,
          doctorDeclinedAt: null,
          doctorConsentIp: meta.ip,
          doctorUserAgent: meta.userAgent,
        }
      : { doctorDeclinedAt: now };
  }

  private nextRecordingStatus(input: {
    patientConsentedAt?: Date | null;
    doctorConsentedAt?: Date | null;
    declined: boolean;
  }) {
    if (input.declined) return "DECLINED" as const;
    return input.patientConsentedAt && input.doctorConsentedAt
      ? ("CONSENTED" as const)
      : ("PENDING" as const);
  }

  private serializeRecordingConsent(
    appointmentId: string,
    consent: Awaited<
      ReturnType<typeof prisma.appointmentRecordingConsent.findUnique>
    >,
  ) {
    const patientConsented = !!consent?.patientConsentedAt;
    const doctorConsented = !!consent?.doctorConsentedAt;
    return {
      appointmentId,
      status: consent?.status ?? "NOT_REQUESTED",
      requestedByRole: consent?.requestedByRole ?? null,
      requestedById: consent?.requestedById ?? null,
      requestedAt: consent?.requestedAt ?? null,
      patientConsented,
      doctorConsented,
      bothConsented: patientConsented && doctorConsented,
      patientConsentedAt: consent?.patientConsentedAt ?? null,
      doctorConsentedAt: consent?.doctorConsentedAt ?? null,
      patientDeclinedAt: consent?.patientDeclinedAt ?? null,
      doctorDeclinedAt: consent?.doctorDeclinedAt ?? null,
      revokedAt: consent?.revokedAt ?? null,
    };
  }
}
