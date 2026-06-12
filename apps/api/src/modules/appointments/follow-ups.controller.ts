import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "@doctium/types";
import { FollowUpsService } from "./follow-ups.service";

@ApiTags("Follow-ups")
@ApiBearerAuth()
@Controller("follow-ups")
@UseGuards(JwtAuthGuard)
export class FollowUpsController {
  constructor(private readonly followUps: FollowUpsService) {}

  /** Doctor recall: "come back in N days." */
  @UseGuards(RolesGuard)
  @Roles("doctor")
  @Post()
  schedule(
    @CurrentUser() doctor: JwtPayload,
    @Body() body: { appointmentId: string; inDays: number; note?: string },
  ) {
    return this.followUps.scheduleDoctorFollowUp(
      doctor.sub,
      body.appointmentId,
      Number(body.inDays),
      body.note ?? "",
    );
  }

  @UseGuards(RolesGuard)
  @Roles("user")
  @Get("mine")
  mine(@CurrentUser() user: JwtPayload) {
    return this.followUps.getMine(user.sub);
  }

  @Patch(":id/cancel")
  cancel(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.followUps.cancel(id, user);
  }
}
