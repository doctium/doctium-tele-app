import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { FirebaseProvider } from './channels/firebase.provider';
import { MailerProvider } from './channels/mailer.provider';
import { SmsProvider } from './channels/sms.provider';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, FirebaseProvider, MailerProvider, SmsProvider],
  exports: [NotificationsService],
})
export class NotificationsModule {}
