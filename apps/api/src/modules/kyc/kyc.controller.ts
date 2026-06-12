import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '@doctium/types';
import { KycService } from './kyc.service';
import { UploadKycDocDto } from './dto/kyc.dto';

@ApiTags('KYC')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('kyc')
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Get('me')
  @UseGuards(RolesGuard) @Roles('doctor')
  myVerification(@CurrentUser() user: JwtPayload) { return this.kyc.getMyVerification(user.sub); }

  @Post('documents')
  @UseGuards(RolesGuard) @Roles('doctor')
  upload(@CurrentUser() user: JwtPayload, @Body() dto: UploadKycDocDto) {
    return this.kyc.uploadDocument(user.sub, dto);
  }

  @Post('submit')
  @UseGuards(RolesGuard) @Roles('doctor')
  submit(@CurrentUser() user: JwtPayload) { return this.kyc.submitForReview(user.sub); }
}
