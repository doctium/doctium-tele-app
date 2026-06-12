import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "@doctium/types";
import { AnalyticsService } from "./analytics.service";

@ApiTags("Analytics")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** Doctor practice analytics. Advanced section is the DoctiumPlus premium tier. */
  @Roles("doctor")
  @Get("doctor")
  doctor(@CurrentUser() user: JwtPayload) {
    return this.analytics.getDoctorAnalytics(user.sub);
  }

  /** Patient health & spend insights (free — drives engagement). */
  @Roles("user")
  @Get("patient")
  patient(@CurrentUser() user: JwtPayload) {
    return this.analytics.getPatientAnalytics(user.sub);
  }
}

@ApiTags("Analytics")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("admin")
@Permissions("analytics.view")
@Controller("admin/analytics")
export class AdminAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("overview")
  overview() {
    return this.analytics.getAdminOverview();
  }

  @Get("cohorts")
  cohorts() {
    return this.analytics.getAdminCohorts();
  }

  @Get("churn")
  churn() {
    return this.analytics.getChurnRisk();
  }

  @Get("revenue-by-specialty")
  revenueBySpecialty(
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.analytics.getRevenueBySpecialty(startDate, endDate);
  }

  @Get("geo")
  geo(
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.analytics.getGeoDistribution(startDate, endDate);
  }
}
