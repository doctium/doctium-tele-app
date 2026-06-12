import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ServicesService } from './services.service';

@ApiTags('Services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  findAll() { return this.servicesService.findAll(); }

  @Get(':id/doctors')
  getDoctors(@Param('id') id: string) { return this.servicesService.findDoctorsByService(id); }
}
