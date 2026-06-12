import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "@doctium/types";
import { RecordingService } from "./recording.service";

/**
 * Participant-facing consultation recording: consent, session, assets, requests.
 * Routes stay under /appointments/:id/... to preserve the existing public API.
 * Admin oversight routes live in the admin module (they call RecordingService too).
 */
@ApiTags("Appointments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("appointments")
export class RecordingController {
  constructor(private readonly recording: RecordingService) {}

  @Get(":id/recording-consent")
  @UseGuards(RolesGuard)
  @Roles("user", "doctor", "admin")
  getRecordingConsent(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.recording.getRecordingConsent(id, user);
  }

  @Post(":id/recording-consent/request")
  @UseGuards(RolesGuard)
  @Roles("user", "doctor")
  requestRecordingConsent(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Req()
    req: {
      ip?: string;
      headers: Record<string, string | string[] | undefined>;
    },
  ) {
    return this.recording.requestRecordingConsent(id, user, {
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] ?? ""),
    });
  }

  @Patch(":id/recording-consent")
  @UseGuards(RolesGuard)
  @Roles("user", "doctor")
  respondRecordingConsent(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body("consent") consent: boolean,
    @Req()
    req: {
      ip?: string;
      headers: Record<string, string | string[] | undefined>;
    },
  ) {
    return this.recording.respondRecordingConsent(id, user, consent === true, {
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] ?? ""),
    });
  }

  @Get(":id/recording")
  @UseGuards(RolesGuard)
  @Roles("user", "doctor", "admin")
  getRecording(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.recording.getRecordingSession(id, user);
  }

  @Post(":id/recording/start")
  @UseGuards(RolesGuard)
  @Roles("user", "doctor")
  startRecording(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.recording.startRecordingSession(id, user);
  }

  @Post(":id/recording/stop")
  @UseGuards(RolesGuard)
  @Roles("user", "doctor")
  stopRecording(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.recording.stopRecordingSession(id, user);
  }

  @Get(":id/recording/assets")
  @UseGuards(RolesGuard)
  @Roles("user", "doctor", "admin")
  listRecordingAssets(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.recording.listRecordingAssets(id, user);
  }

  @Post(":id/recording/assets")
  @UseGuards(RolesGuard)
  @Roles("admin")
  registerRecordingAssets(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: Record<string, unknown>,
  ) {
    return this.recording.registerRecordingAssets(id, body, user);
  }

  @Get(":id/recording/assets/:assetId/access")
  @UseGuards(RolesGuard)
  @Roles("user", "doctor", "admin")
  getRecordingAssetAccess(
    @Param("id") id: string,
    @Param("assetId") assetId: string,
    @CurrentUser() user: JwtPayload,
    @Req()
    req: {
      ip?: string;
      headers: Record<string, string | string[] | undefined>;
    },
  ) {
    return this.recording.getRecordingAssetAccess(id, assetId, user, {
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] ?? ""),
    });
  }

  @Get(":id/recording/requests")
  @UseGuards(RolesGuard)
  @Roles("user", "doctor", "admin")
  listRecordingRequests(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.recording.listRecordingRequests(id, user);
  }

  @Post(":id/recording/requests")
  @UseGuards(RolesGuard)
  @Roles("user", "doctor", "admin")
  createRecordingRequest(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: Record<string, unknown>,
  ) {
    return this.recording.createRecordingRequest(id, user, body);
  }

  @Patch(":id/recording/requests/:requestId/dispute-hold")
  @UseGuards(RolesGuard)
  @Roles("doctor", "admin")
  setRecordingRequestDisputeHold(
    @Param("id") id: string,
    @Param("requestId") requestId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: Record<string, unknown>,
  ) {
    return this.recording.setRecordingRequestDisputeHold(
      id,
      requestId,
      user,
      body,
    );
  }
}
