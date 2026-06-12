import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  Req,
} from "@nestjs/common";
import { ApiExcludeEndpoint } from "@nestjs/swagger";
import * as crypto from "crypto";
import { Request } from "express";
import { RecordingService } from "./recording.service";

@Controller("recording")
export class RecordingWebhookController {
  constructor(private readonly recording: RecordingService) {}

  @ApiExcludeEndpoint()
  @Post("assets/callback")
  async assetsCallback(
    @Req() req: Request & { rawBody?: Buffer; body: Record<string, unknown> },
    @Headers("x-doctium-recording-signature") signature?: string,
  ) {
    const secret = process.env.RECORDING_WEBHOOK_SECRET;
    if (!secret)
      throw new BadRequestException("Recording webhook is not configured");

    if (!req.rawBody) {
      throw new BadRequestException(
        "Raw request body is required for webhook verification",
      );
    }
    const raw = req.rawBody;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(raw)
      .digest("hex");
    if (
      !signature ||
      signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      throw new BadRequestException("Invalid recording webhook signature");
    }

    const appointmentId = String(
      req.body.appointmentId ??
        req.body.AppointmentId ??
        req.body.appointment_id ??
        "",
    );
    if (!appointmentId)
      throw new BadRequestException("appointmentId is required");

    return this.recording.registerRecordingAssets(appointmentId, {
      taskId: typeof req.body.taskId === "string" ? req.body.taskId : undefined,
      provider:
        typeof req.body.provider === "string" ? req.body.provider : "ZEGO",
      storageVendor:
        typeof req.body.storageVendor === "string"
          ? req.body.storageVendor
          : undefined,
      files: Array.isArray(req.body.files)
        ? (req.body.files as Record<string, unknown>[])
        : Array.isArray(req.body.Files)
          ? (req.body.Files as Record<string, unknown>[])
          : [],
    });
  }
}
