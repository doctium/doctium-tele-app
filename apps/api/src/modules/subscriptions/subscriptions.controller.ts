import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '@doctium/types';
import { PlansService } from './plans.service';
import { SubscriptionsService } from './subscriptions.service';
import { SubscribeDto } from './dto/subscriptions.dto';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly plans: PlansService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  // ── Patient (DoctiumPlus) ──────────────────────────────────
  @Get('plans')
  @UseGuards(RolesGuard) @Roles('user')
  getPlans() { return this.plans.listActivePlans('USER'); }

  @Get('me')
  @UseGuards(RolesGuard) @Roles('user')
  getMine(@CurrentUser() user: JwtPayload) { return this.subscriptions.getMySubscription('USER', user.sub); }

  @Post('subscribe')
  @UseGuards(RolesGuard) @Roles('user')
  subscribe(@CurrentUser() user: JwtPayload, @Body() dto: SubscribeDto) {
    return this.subscriptions.subscribe('USER', user.sub, dto);
  }

  @Patch('me/cancel')
  @UseGuards(RolesGuard) @Roles('user')
  cancel(@CurrentUser() user: JwtPayload) { return this.subscriptions.cancel('USER', user.sub); }

  @Patch('me/change-plan')
  @UseGuards(RolesGuard) @Roles('user')
  changePlan(@CurrentUser() user: JwtPayload, @Body() dto: SubscribeDto) {
    return this.subscriptions.changePlan('USER', user.sub, dto);
  }

  // ── Doctor (DoctiumPlus for Doctors) ───────────────────────
  @Get('doctor/plans')
  @UseGuards(RolesGuard) @Roles('doctor')
  getDoctorPlans() { return this.plans.listActivePlans('DOCTOR'); }

  @Get('doctor/me')
  @UseGuards(RolesGuard) @Roles('doctor')
  getDoctorMine(@CurrentUser() user: JwtPayload) { return this.subscriptions.getMySubscription('DOCTOR', user.sub); }

  @Post('doctor/subscribe')
  @UseGuards(RolesGuard) @Roles('doctor')
  subscribeDoctor(@CurrentUser() user: JwtPayload, @Body() dto: SubscribeDto) {
    return this.subscriptions.subscribe('DOCTOR', user.sub, dto);
  }

  @Patch('doctor/me/cancel')
  @UseGuards(RolesGuard) @Roles('doctor')
  cancelDoctor(@CurrentUser() user: JwtPayload) { return this.subscriptions.cancel('DOCTOR', user.sub); }
}
