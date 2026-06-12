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
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "@doctium/types";
import { SupportService } from "./support.service";
import { SendSupportMessageDto } from "./dto/support.dto";

// ── Patient-facing ──────────────────────────────────────────
@ApiTags("Support")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("support")
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get("thread")
  myThread(@CurrentUser() user: JwtPayload) {
    return this.support.getMyThread(user.sub);
  }

  @Post("messages")
  send(@CurrentUser() user: JwtPayload, @Body() dto: SendSupportMessageDto) {
    return this.support.sendUserMessage(user.sub, dto);
  }

  @Patch("read")
  read(@CurrentUser() user: JwtPayload) {
    return this.support.markUserRead(user.sub);
  }
}

// ── Admin-facing ────────────────────────────────────────────
@ApiTags("Admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("admin")
@Controller("admin/support")
export class AdminSupportController {
  constructor(private readonly support: SupportService) {}

  @Permissions("comms.support_view")
  @Get("threads")
  threads(
    @Query("search") search?: string,
    @Query("page") page = 1,
    @Query("limit") limit = 20,
  ) {
    return this.support.listThreads(search ?? "", +page, +limit);
  }

  @Permissions("comms.support_view")
  @Get("unread-count")
  unread() {
    return this.support.adminUnreadTotal();
  }

  @Permissions("comms.support_view")
  @Get("threads/:id")
  thread(@Param("id") id: string) {
    return this.support.getThreadMessages(id);
  }

  @Permissions("comms.support_reply")
  @Post("threads/:id/messages")
  reply(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: SendSupportMessageDto,
  ) {
    return this.support.sendAdminMessage(id, { sub: user.sub }, dto);
  }

  @Permissions("comms.support_reply")
  @Patch("threads/:id/read")
  markRead(@Param("id") id: string) {
    return this.support.markAdminRead(id);
  }
}
