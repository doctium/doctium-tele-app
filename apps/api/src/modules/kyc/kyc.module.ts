import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CloudinaryService } from '../prescriptions/cloudinary.service';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [KycController],
  providers: [KycService, CloudinaryService],
  exports: [KycService],
})
export class KycModule {}
