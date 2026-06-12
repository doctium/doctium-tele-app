import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "@doctium/types";
import { AppointmentsService } from "./appointments.service";
import { AppointmentStatus } from "@doctium/database";
import { BookAppointmentDto } from "./dto/book-appointment.dto";

@ApiTags("Appointments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("appointments")
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles("user")
  book(@CurrentUser() user: JwtPayload, @Body() dto: BookAppointmentDto) {
    return this.appointmentsService.bookAppointment(user.sub, dto);
  }

  @Get("mine")
  @UseGuards(RolesGuard)
  @Roles("user")
  getUserAppointments(
    @CurrentUser() user: JwtPayload,
    @Query("status") status?: AppointmentStatus,
  ) {
    return this.appointmentsService.getUserAppointments(user.sub, status);
  }

  @Get("doctor/mine")
  @UseGuards(RolesGuard)
  @Roles("doctor")
  getDoctorAppointments(
    @CurrentUser() user: JwtPayload,
    @Query("status") status?: AppointmentStatus,
  ) {
    return this.appointmentsService.getDoctorAppointments(user.sub, status);
  }

  @Get(":id/recording-consent")
  @UseGuards(RolesGuard)
  @Roles("user", "doctor", "admin")
  getRecordingConsent(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.appointmentsService.getRecordingConsent(id, user);
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
    return this.appointmentsService.requestRecordingConsent(id, user, {
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
    return this.appointmentsService.respondRecordingConsent(
      id,
      user,
      consent === true,
      {
        ip: req.ip,
        userAgent: String(req.headers["user-agent"] ?? ""),
      },
    );
  }

  @Get(":id/recording")
  @UseGuards(RolesGuard)
  @Roles("user", "doctor", "admin")
  getRecording(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.appointmentsService.getRecordingSession(id, user);
  }

  @Post(":id/recording/start")
  @UseGuards(RolesGuard)
  @Roles("user", "doctor")
  startRecording(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.appointmentsService.startRecordingSession(id, user);
  }

  @Post(":id/recording/stop")
  @UseGuards(RolesGuard)
  @Roles("user", "doctor")
  stopRecording(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.appointmentsService.stopRecordingSession(id, user);
  }

  @Get(":id/recording/assets")
  @UseGuards(RolesGuard)
  @Roles("user", "doctor", "admin")
  listRecordingAssets(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.appointmentsService.listRecordingAssets(id, user);
  }

  @Post(":id/recording/assets")
  @UseGuards(RolesGuard)
  @Roles("admin")
  registerRecordingAssets(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: Record<string, unknown>,
  ) {
    return this.appointmentsService.registerRecordingAssets(id, body, user);
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
    return this.appointmentsService.getRecordingAssetAccess(id, assetId, user, {
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
    return this.appointmentsService.listRecordingRequests(id, user);
  }

  @Post(":id/recording/requests")
  @UseGuards(RolesGuard)
  @Roles("user", "doctor", "admin")
  createRecordingRequest(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: Record<string, unknown>,
  ) {
    return this.appointmentsService.createRecordingRequest(id, user, body);
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
    return this.appointmentsService.setRecordingRequestDisputeHold(
      id,
      requestId,
      user,
      body,
    );
  }

  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.appointmentsService.getAppointmentById(id);
  }

  @Patch(":id/cancel")
  @UseGuards(RolesGuard)
  @Roles("user", "doctor", "admin")
  cancel(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body("reason") reason: string,
  ) {
    const role =
      user.role === "user"
        ? "PATIENT"
        : user.role === "doctor"
          ? "DOCTOR"
          : "ADMIN";
    return this.appointmentsService.cancelAppointment(
      id,
      role as never,
      reason,
    );
  }

  @Patch(":id/status")
  @UseGuards(RolesGuard)
  @Roles("doctor", "admin")
  updateStatus(
    @Param("id") id: string,
    @Body("status") status: AppointmentStatus,
  ) {
    return this.appointmentsService.updateStatus(id, status);
  }
}
