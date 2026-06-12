import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrescriptionsController } from './prescriptions.controller';
import { PharmacyController } from './pharmacy.controller';
import { RefillRequestsController } from './refills.controller';
import { PrescriptionsService } from './prescriptions.service';
import { CryptoSignService } from './crypto-sign.service';
import { PdfService } from './pdf.service';
import { PharmacyService } from './pharmacy.service';
import { RefillRequestsService } from './refills.service';
import { CloudinaryService } from './cloudinary.service';
import { ApiKeyGuard } from './api-key.guard';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [PrescriptionsController, PharmacyController, RefillRequestsController],
  providers: [PrescriptionsService, CryptoSignService, PdfService, PharmacyService, RefillRequestsService, CloudinaryService, ApiKeyGuard],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
