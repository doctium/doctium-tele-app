import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from './api-key.guard';
import { PrescriptionsService } from './prescriptions.service';

/**
 * Partner-facing pharmacy API. Authenticated with the `x-api-key` header
 * (see PharmacyService.apiKey). Lets a pharmacy fetch a prescription by its
 * code and mark it dispensed.
 */
@ApiTags('Pharmacy')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard)
@Controller('pharmacy')
export class PharmacyController {
  constructor(private readonly service: PrescriptionsService) {}

  @Get('rx/:code')
  fetch(@Param('code') code: string) {
    return this.service.getByCode(code);
  }

  @Post('rx/:code/dispense')
  dispense(@Param('code') code: string, @Body() body: { dispensedBy?: string }) {
    return this.service.dispense(code, body?.dispensedBy);
  }
}
