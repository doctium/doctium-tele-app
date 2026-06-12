import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "@doctium/types";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { TriageService } from "./triage.service";
import {
  StartTriageDto,
  TriageDispositionDto,
  TriageFeedbackDto,
  TriageMessageDto,
  TriageSpeakDto,
  TriageVoiceDto,
} from "./dto/triage.dto";

@ApiTags("Triage")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("triage")
export class TriageController {
  constructor(private readonly triage: TriageService) {}

  /** Availability + today's remaining sessions (and the DoctiumPlus unlimited flag). */
  @Roles("user")
  @Get("status")
  status(@CurrentUser() user: JwtPayload) {
    return this.triage.getStatus(user.sub);
  }

  @Roles("user")
  @Get("mine")
  mine(@CurrentUser() user: JwtPayload) {
    return this.triage.getMine(user.sub);
  }

  @Roles("user")
  @Post("sessions")
  start(@CurrentUser() user: JwtPayload, @Body() dto: StartTriageDto) {
    return this.triage.startSession(user.sub, {
      subPatientId: dto.subPatientId,
      mode: dto.mode,
      language: dto.language,
    });
  }

  @Roles("user")
  @Get("sessions/:id")
  session(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.triage.getSession(id, user.sub);
  }

  @Roles("user")
  @Post("sessions/:id/messages")
  message(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: TriageMessageDto,
  ) {
    return this.triage.sendMessage(id, user.sub, dto.text);
  }

  /** Voice reply: read one of Leenah's messages aloud (on-demand TTS). */
  @Roles("user")
  @Post("sessions/:id/speak")
  speak(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: TriageSpeakDto,
  ) {
    return this.triage.speakMessage(id, user.sub, dto.messageIndex);
  }

  /** Voice note → transcript. The app puts it in the input for review-then-send. */
  @Roles("user")
  @Post("sessions/:id/voice")
  voice(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: TriageVoiceDto,
  ) {
    return this.triage.transcribeVoice(id, user.sub, dto.audio, dto.mimeType);
  }

  @Roles("user")
  @Post("sessions/:id/disposition")
  disposition(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: TriageDispositionDto,
  ) {
    return this.triage.setDisposition(
      id,
      user.sub,
      dto.action,
      dto.appointmentId,
    );
  }

  /** AI intake summary on a triage-linked booking (doctor, patient or admin). */
  @Roles("user", "doctor", "admin")
  @Get("appointments/:appointmentId")
  appointmentSummary(
    @Param("appointmentId") appointmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.triage.appointmentSummary(appointmentId, {
      sub: user.sub,
      role: user.role,
    });
  }

  /** Care lead's routing-accuracy verdict — feeds the admin accuracy metric. */
  @Roles("doctor")
  @Post("appointments/:appointmentId/feedback")
  feedback(
    @Param("appointmentId") appointmentId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: TriageFeedbackDto,
  ) {
    return this.triage.setDoctorFeedback(appointmentId, user.sub, dto.accurate);
  }
}

@ApiTags("Triage")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("admin")
@Permissions("analytics.view")
@Controller("admin/triage")
export class AdminTriageController {
  constructor(private readonly triage: TriageService) {}

  @Get("overview")
  overview() {
    return this.triage.adminOverview();
  }
}
