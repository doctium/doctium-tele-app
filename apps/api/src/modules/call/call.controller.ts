import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '@doctium/types';
import { CallService } from './call.service';

@ApiTags('Call')
@Controller('call')
export class CallController {
  constructor(private readonly callService: CallService) {}

  /** Issues a Zego token for the authenticated user (user or doctor). */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('token')
  token(@CurrentUser() user: JwtPayload) {
    return this.callService.generateToken(user.sub);
  }
}
