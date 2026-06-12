import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '@doctium/types';
import { RefillRequestsService } from './refills.service';

@ApiTags('Refill Requests')
@ApiBearerAuth()
@Controller('refills')
export class RefillRequestsController {
  constructor(private readonly service: RefillRequestsService) {}

  // ── Patient ───────────────────────────────────────────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() body: { prescriptionId: string; patientNote?: string }) {
    return this.service.create(user.sub, body.prescriptionId, body.patientNote);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  @Get('prescription/:prescriptionId')
  forPrescription(@CurrentUser() user: JwtPayload, @Param('prescriptionId') prescriptionId: string) {
    return this.service.getForPrescription(prescriptionId, user.sub);
  }

  // ── Doctor (static routes before the param route) ─────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('doctor')
  @Get('doctor/pending')
  doctorPending(@CurrentUser() user: JwtPayload) {
    return this.service.getDoctorPending(user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('doctor')
  @Get('doctor/count')
  doctorCount(@CurrentUser() user: JwtPayload) {
    return this.service.getDoctorCount(user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('doctor')
  @Patch(':requestId/decision')
  decide(
    @CurrentUser() user: JwtPayload,
    @Param('requestId') requestId: string,
    @Body() body: { decision: 'APPROVED' | 'DECLINED'; doctorNote?: string },
  ) {
    return this.service.decide(requestId, user.sub, body.decision, body.doctorNote);
  }
}
