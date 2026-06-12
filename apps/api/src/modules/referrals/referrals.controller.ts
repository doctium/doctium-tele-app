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
import { Response } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "@doctium/types";
import { ReferralsService } from "./referrals.service";
import { ReferralPdfService } from "./referral-pdf.service";

@ApiTags("Referrals")
@ApiBearerAuth()
@Controller("referrals")
@UseGuards(JwtAuthGuard)
export class ReferralsController {
  constructor(
    private readonly referrals: ReferralsService,
    private readonly pdf: ReferralPdfService,
  ) {}

  // ─── Doctor ──────────────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles("doctor")
  @Get("specialists")
  specialists(
    @CurrentUser() doctor: JwtPayload,
    @Query("specialty") specialty?: string,
  ) {
    return this.referrals.listSpecialists(doctor.sub, specialty);
  }

  @UseGuards(RolesGuard)
  @Roles("doctor")
  @Post()
  create(
    @CurrentUser() doctor: JwtPayload,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.referrals.create(doctor.sub, dto);
  }

  @UseGuards(RolesGuard)
  @Roles("doctor")
  @Get("sent")
  sent(@CurrentUser() doctor: JwtPayload) {
    return this.referrals.getSent(doctor.sub);
  }

  @UseGuards(RolesGuard)
  @Roles("doctor")
  @Get("sent/stats")
  sentStats(@CurrentUser() doctor: JwtPayload) {
    return this.referrals.sentStats(doctor.sub);
  }

  @UseGuards(RolesGuard)
  @Roles("doctor")
  @Get("received")
  received(@CurrentUser() doctor: JwtPayload) {
    return this.referrals.getReceived(doctor.sub);
  }

  @UseGuards(RolesGuard)
  @Roles("doctor")
  @Patch(":id/respond")
  respond(
    @CurrentUser() doctor: JwtPayload,
    @Param("id") id: string,
    @Body() body: { accept: boolean; reason?: string; commissionPct?: number },
  ) {
    return this.referrals.respond(
      doctor.sub,
      id,
      !!body.accept,
      body.reason,
      body.commissionPct,
    );
  }

  @UseGuards(RolesGuard)
  @Roles("doctor")
  @Patch(":id/commission")
  setCommission(
    @CurrentUser() doctor: JwtPayload,
    @Param("id") id: string,
    @Body("pct") pct: number,
  ) {
    return this.referrals.setCommission(doctor.sub, id, Number(pct));
  }

  @UseGuards(RolesGuard)
  @Roles("doctor")
  @Patch(":id/cancel")
  cancel(@CurrentUser() doctor: JwtPayload, @Param("id") id: string) {
    return this.referrals.cancel(doctor.sub, id);
  }

  // ─── Patient ─────────────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles("user")
  @Get("mine")
  mine(@CurrentUser() user: JwtPayload) {
    return this.referrals.getMine(user.sub);
  }

  // ─── Shared (referring doctor, specialist, patient, admin) ──
  /** Referral letter PDF — party-gated (reuses getOne's access check). */
  @Get(":id/pdf")
  async letterPdf(
    @CurrentUser() requester: JwtPayload,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    await this.referrals.getOne(id, requester); // throws 403/404 if not a party
    const buffer = await this.pdf.build(id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="referral-${id}.pdf"`,
    );
    res.send(buffer);
  }

  @Get(":id")
  getOne(@CurrentUser() requester: JwtPayload, @Param("id") id: string) {
    return this.referrals.getOne(id, requester);
  }
}
