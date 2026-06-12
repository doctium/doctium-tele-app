import {
  Body,
  Controller,
  Get,
  Param,
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
import { SatisfactionService } from "./satisfaction.service";
import { RespondSurveyDto } from "./dto/satisfaction.dto";

@ApiTags("Satisfaction")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("satisfaction")
export class SatisfactionController {
  constructor(private readonly satisfaction: SatisfactionService) {}

  /** Patient: open + answered surveys (with the category catalog for the form). */
  @Roles("user")
  @Get("mine")
  mine(@CurrentUser() user: JwtPayload) {
    return this.satisfaction.getMine(user.sub);
  }

  @Roles("user")
  @Post(":id/respond")
  respond(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RespondSurveyDto,
  ) {
    return this.satisfaction.respond(id, user.sub, dto);
  }

  /** Doctor: NPS, category benchmarks, anonymized comments + improvement recommendations. */
  @Roles("doctor")
  @Get("doctor/summary")
  doctorSummary(@CurrentUser() user: JwtPayload) {
    return this.satisfaction.getDoctorSummary(user.sub);
  }
}

@ApiTags("Satisfaction")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("admin")
@Permissions("analytics.view")
@Controller("admin/satisfaction")
export class AdminSatisfactionController {
  constructor(private readonly satisfaction: SatisfactionService) {}

  @Get("overview")
  overview() {
    return this.satisfaction.getAdminOverview();
  }

  @Get("responses")
  responses(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("status") status?: string,
  ) {
    return this.satisfaction.getAdminResponses(
      parseInt(page ?? "1", 10) || 1,
      Math.min(100, parseInt(limit ?? "20", 10) || 20),
      status,
    );
  }

  /** Manual cron trigger (deliver due surveys + expire stale ones). */
  @Post("run")
  run() {
    return this.satisfaction.runManual();
  }
}
