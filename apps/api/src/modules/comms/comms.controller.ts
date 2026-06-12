import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "@doctium/types";
import { CommsService } from "./comms.service";
import { SendPushDto, SendEmailDto, SendSmsDto } from "./dto/comms.dto";

@ApiTags("Admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("admin")
@Controller("admin/comms")
export class CommsController {
  constructor(private readonly comms: CommsService) {}

  @Permissions("comms.notifications")
  @Get("audience-counts")
  counts() {
    return this.comms.audienceCounts();
  }

  @Permissions("comms.notifications")
  @Post("push")
  push(@CurrentUser() user: JwtPayload, @Body() dto: SendPushDto) {
    return this.comms.sendPush(dto, { sub: user.sub });
  }

  @Permissions("comms.notifications")
  @Get("broadcasts")
  broadcasts(@Query("limit") limit = 30, @Query("channel") channel?: string) {
    return this.comms.listBroadcasts(+limit, channel);
  }

  // Shared recipient picker for email + SMS (admin-only; returns names + contact for selection).
  @Get("recipients")
  recipients(@Query("type") type = "USER", @Query("search") search?: string) {
    return this.comms.searchRecipients(type, search ?? "");
  }

  @Permissions("comms.email")
  @Post("email")
  email(@CurrentUser() user: JwtPayload, @Body() dto: SendEmailDto) {
    return this.comms.sendEmail(dto, { sub: user.sub });
  }

  @Permissions("comms.sms")
  @Post("sms")
  sms(@CurrentUser() user: JwtPayload, @Body() dto: SendSmsDto) {
    return this.comms.sendSms(dto, { sub: user.sub });
  }
}
