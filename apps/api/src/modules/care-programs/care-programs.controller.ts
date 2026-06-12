import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "@doctium/types";
import { CareProgramsService } from "./care-programs.service";
import { RiskService } from "./risk.service";
import { TitrationService } from "./titration.service";
import { ScdOutcomesService } from "./scd-outcomes.service";
import {
  CreateGoalDto,
  CreateProgramDto,
  EnrollDto,
  LogCrisisDto,
  LogReadingDto,
  RecordLabDto,
  ResolveCrisisDto,
  SetDoseDto,
  UpdateProgramDto,
  UpdateThresholdsDto,
} from "./dto/care-programs.dto";

@ApiTags("Care Programs")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("care-programs")
export class CareProgramsController {
  constructor(
    private readonly care: CareProgramsService,
    private readonly risk: RiskService,
    private readonly titration: TitrationService,
  ) {}

  // ─── Patient ─────────────────────────────────────────────
  @Roles("user")
  @Get()
  catalog(@CurrentUser() user: JwtPayload) {
    return this.care.getCatalog(user.sub);
  }

  @Roles("user")
  @Get("mine")
  mine(@CurrentUser() user: JwtPayload) {
    return this.care.getMine(user.sub);
  }

  @Roles("user")
  @Post(":id/enroll")
  enroll(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: EnrollDto,
  ) {
    return this.care.enroll(
      user.sub,
      id,
      dto.doctorId,
      dto.subPatientId,
      dto.genotype,
    );
  }

  @Roles("user", "doctor", "admin")
  @Get("enrollments/:id")
  async enrollment(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    const detail = await this.care.getEnrollmentDetail(id, {
      sub: user.sub,
      role: user.role,
    });
    // SCD Phase 4: live crisis risk + 14-day trend for crisis-tracked programs.
    // Composed here (not inside either service) to keep Care ↔ Risk DI one-way.
    const { risk, riskHistory } = await this.risk.detailRisk(id);
    return { ...detail, risk, riskHistory };
  }

  @Roles("user")
  @Post("enrollments/:id/readings")
  logReading(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: LogReadingDto,
  ) {
    return this.care.logReading(id, user.sub, dto);
  }

  @Roles("user")
  @Post("enrollments/:id/withdraw")
  withdraw(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.care.withdraw(id, user.sub);
  }

  // ─── Crisis diary (SCD Phase 3) ──────────────────────────
  @Roles("user")
  @Post("enrollments/:id/crises")
  logCrisis(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: LogCrisisDto,
  ) {
    return this.care.logCrisis(id, user.sub, dto);
  }

  @Roles("user")
  @Post("crises/:id/resolve")
  resolveCrisis(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ResolveCrisisDto,
  ) {
    return this.care.resolveCrisis(id, user.sub, dto);
  }

  // ─── Titration (SCD Phase 5) ─────────────────────────────
  @Roles("user", "doctor", "admin")
  @Get("enrollments/:id/titration")
  titrationPicture(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.titration.getTitration(id, {
      sub: user.sub,
      role: user.role,
    });
  }

  /** Patient or care lead records a CBC; safety flags fan out to the doctor. */
  @Roles("user", "doctor")
  @Post("enrollments/:id/labs")
  recordLab(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RecordLabDto,
  ) {
    return this.titration.recordLab(
      id,
      { sub: user.sub, role: user.role },
      dto,
    );
  }

  /** Care lead only — the engine never doses autonomously. */
  @Roles("doctor")
  @Post("enrollments/:id/doses")
  setDose(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SetDoseDto,
  ) {
    return this.titration.setDose(id, user.sub, dto);
  }

  // ─── Care lead (doctor) ──────────────────────────────────
  @Roles("doctor")
  @Get("doctor/cohort")
  async cohort(@CurrentUser() user: JwtPayload) {
    const res = await this.care.getDoctorCohort(user.sub);
    // Risk badges for crisis-tracked programs (SCD Phase 4)
    const painIds = res.cohort
      .filter(
        (r) =>
          Array.isArray((r.program as { vitals?: unknown } | null)?.vitals) &&
          ((r.program as { vitals: unknown[] }).vitals ?? []).some(
            (v) => (v as { type?: string } | null)?.type === "PAIN",
          ),
      )
      .map((r) => r.id);
    const risks = await this.risk.riskFor(painIds);
    return {
      ...res,
      cohort: res.cohort.map((r) => ({ ...r, risk: risks[r.id] ?? null })),
    };
  }

  /** Pre-visit brief: genotype, live risk, crisis picture, vitals, adherence — for the consult. */
  @Roles("doctor")
  @Get("brief/:appointmentId")
  brief(
    @Param("appointmentId") appointmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.risk.buildBrief(user.sub, appointmentId);
  }

  @Roles("doctor")
  @Get("doctor/alerts")
  alerts(@CurrentUser() user: JwtPayload, @Query("all") all?: string) {
    return this.care.getDoctorAlerts(user.sub, all !== "true");
  }

  @Roles("doctor")
  @Post("alerts/:id/ack")
  ack(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.care.ackAlert(id, user.sub);
  }

  @Roles("doctor")
  @Post("enrollments/:id/goals")
  createGoal(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateGoalDto,
  ) {
    return this.care.createGoal(id, user.sub, dto);
  }

  @Roles("doctor")
  @Post("goals/:id/cancel")
  cancelGoal(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.care.cancelGoal(id, user.sub);
  }

  @Roles("doctor")
  @Patch("enrollments/:id/thresholds")
  thresholds(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateThresholdsDto,
  ) {
    return this.care.updateThresholds(id, user.sub, dto.thresholds);
  }
}

@ApiTags("Care Programs")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("admin")
@Controller("admin/care-programs")
export class AdminCareProgramsController {
  constructor(
    private readonly care: CareProgramsService,
    private readonly risk: RiskService,
    private readonly titration: TitrationService,
    private readonly scdOutcomes: ScdOutcomesService,
  ) {}

  @Permissions("analytics.view")
  @Get()
  list() {
    return this.care.adminListPrograms();
  }

  @Permissions("analytics.view")
  @Get("overview")
  overview() {
    return this.care.adminOverview();
  }

  /** Manual engagement sweep: cadence check-ins, silent-patient escalation, goal expiry. */
  @Permissions("analytics.view")
  @Post("run")
  run() {
    return this.care.runEngagement();
  }

  /** Manual risk-agent sweep (SCD Phase 4): daily assessments + HIGH/CRITICAL nudges. */
  @Permissions("analytics.view")
  @Post("run-risk")
  runRisk() {
    return this.risk.runRiskSweep();
  }

  /** Manual titration sweep (SCD Phase 5): CBC-due reminders. */
  @Permissions("analytics.view")
  @Post("run-titration")
  runTitration() {
    return this.titration.runLabReminders();
  }

  /** SCD outcomes (Phase 6): the investor/payer view of the sickle cell program. */
  @Permissions("analytics.view")
  @Get("scd-outcomes")
  scdOutcomesOverview() {
    return this.scdOutcomes.overview();
  }

  /** Anonymized per-patient outcomes CSV — refs only, no names or contacts. */
  @Permissions("analytics.view")
  @Get("scd-outcomes.csv")
  async scdOutcomesCsv(@Res() res: Response) {
    const csv = await this.scdOutcomes.investorCsv();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="scd-outcomes.csv"',
    );
    res.send(csv);
  }

  @Permissions("catalog.manage")
  @Post()
  create(@Body() dto: CreateProgramDto) {
    return this.care.createProgram(dto);
  }

  @Permissions("catalog.manage")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateProgramDto) {
    return this.care.updateProgram(id, dto);
  }
}
