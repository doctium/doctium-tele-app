import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '@doctium/types';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  get(@CurrentUser() user: JwtPayload) {
    return user.role === 'doctor'
      ? this.notificationsService.getForDoctor(user.sub)
      : this.notificationsService.getForUser(user.sub);
  }

  @Get('doctor')
  @UseGuards(RolesGuard) @Roles('doctor')
  getDoctor(@CurrentUser() user: JwtPayload) { return this.notificationsService.getForDoctor(user.sub); }
}
