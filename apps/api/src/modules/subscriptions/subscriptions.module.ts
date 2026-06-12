import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PaystackProvider } from '../payments/paystack.provider';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { PlansService } from './plans.service';
import { EntitlementsService } from './entitlements.service';
import { BillingService } from './billing.service';

@Module({
  imports: [AuthModule],
  controllers: [SubscriptionsController],
  // PaystackProvider is stateless; providing it here keeps SubscriptionsModule free of a
  // PaymentsModule import, so PaymentsModule → SubscriptionsModule stays a one-way edge (no cycle).
  providers: [SubscriptionsService, PlansService, EntitlementsService, BillingService, PaystackProvider],
  exports: [SubscriptionsService, PlansService, EntitlementsService, BillingService],
})
export class SubscriptionsModule {}
