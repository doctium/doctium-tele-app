import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { PaystackWebhookController } from "./paystack-webhook.controller";
import { PaymentsService } from "./payments.service";
import { PaystackProvider } from "./paystack.provider";
import { AuthModule } from "../auth/auth.module";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { ReferralBonusModule } from "../referral-bonus/referral-bonus.module";
import { MailerProvider } from "../notifications/channels/mailer.provider";

@Module({
  imports: [AuthModule, SubscriptionsModule, ReferralBonusModule],
  controllers: [PaymentsController, PaystackWebhookController],
  providers: [PaymentsService, PaystackProvider, MailerProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
