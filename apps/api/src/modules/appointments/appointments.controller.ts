import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
