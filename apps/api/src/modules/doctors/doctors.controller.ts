import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "@doctium/types";
import { DoctorsService } from "./doctors.service";

@ApiTags("Doctors")
@Controller("doctors")
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get()
  findAll(
    @Query()
    query: {
      search?: string;
      serviceId?: string;
      type?: string;
      country?: string;
      nationality?: string;
      language?: string;
    },
  ) {
    return this.doctorsService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.doctorsService.findOne(id);
  }

  @Get(":id/slots")
  getAvailableSlots(@Param("id") id: string, @Query("date") date: string) {
    return this.doctorsService.getAvailableSlots(id, date);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("doctor")
  @Get("me/profile")
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.doctorsService.getProfile(user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("doctor")
  @Patch("me/profile")
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.doctorsService.updateProfile(user.sub, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("doctor")
  @Patch("me/avatar")
  updateAvatar(
    @CurrentUser() user: JwtPayload,
    @Body("dataUrl") dataUrl: string,
  ) {
    return this.doctorsService.updateAvatar(user.sub, dataUrl);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("doctor")
  @Patch("me/banner")
  updateBanner(
    @CurrentUser() user: JwtPayload,
    @Body("dataUrl") dataUrl: string,
  ) {
    return this.doctorsService.updateBanner(user.sub, dataUrl);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("doctor")
  @Patch("me/schedule")
  upsertSchedule(
    @CurrentUser() user: JwtPayload,
    @Body() body: { schedules: Record<string, unknown>[] },
  ) {
    return this.doctorsService.upsertSchedule(user.sub, body.schedules);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("doctor")
  @Patch("me/fcm-token")
  updateFcmToken(
    @CurrentUser() user: JwtPayload,
    @Body("fcmToken") fcmToken: string,
  ) {
    return this.doctorsService.updateFcmToken(user.sub, fcmToken);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("doctor")
  @Patch("me/signature")
  updateSignature(
    @CurrentUser() user: JwtPayload,
    @Body("signatureImage") signatureImage: string,
  ) {
    return this.doctorsService.updateSignature(user.sub, signatureImage);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("doctor")
  @Patch("me/pricing")
  updatePricing(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      scheduledFee?: number;
      instantDayFee?: number;
      instantNightFee?: number;
      discountActive?: boolean;
      discountPercent?: number;
      discountLabel?: string;
      discountEndsAt?: string | null;
    },
  ) {
    return this.doctorsService.updatePricing(user.sub, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("doctor")
  @Patch("me/region")
  updateRegion(
    @CurrentUser() user: JwtPayload,
    @Body() body: { nationality?: string; practiceCountry?: string },
  ) {
    return this.doctorsService.updateRegion(user.sub, body);
  }
}
