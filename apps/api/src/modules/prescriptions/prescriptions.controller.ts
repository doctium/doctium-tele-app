import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '@doctium/types';
import { PrescriptionsService } from './prescriptions.service';
import { renderVerifyPage } from './verify-page';

@ApiTags('Prescriptions')
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly service: PrescriptionsService) {}

  // ── Doctor issues ─────────────────────────────────────────
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('doctor')
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() body: Parameters<PrescriptionsService['create']>[1]) {
    return this.service.create(user.sub, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('doctor')
  @Get('doctor/mine')
  doctorMine(@CurrentUser() user: JwtPayload) {
    return this.service.getDoctorMine(user.sub);
  }

  // ── Patient timeline ──────────────────────────────────────
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  @Get('mine')
  mine(@CurrentUser() user: JwtPayload) {
    return this.service.getUserMine(user.sub);
  }

  // ── Public verification (QR target) ───────────────────────
  @Get('verify/:code/json')
  verifyJson(@Param('code') code: string) {
    return this.service.verifyByCode(code);
  }

  @Get('verify/:code')
  async verifyPage(@Param('code') code: string, @Res() res: Response) {
    const result = await this.service.verifyByCode(code);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderVerifyPage(result));
  }

  // ── PDF (authorized owner / admin) ────────────────────────
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id/pdf')
  async pdf(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Res() res: Response) {
    const buffer = await this.service.buildPdf(id, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="prescription-${id}.pdf"`);
    res.send(buffer);
  }

  // ── Detail (authorized) ───────────────────────────────────
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.getById(id, user);
  }
}
