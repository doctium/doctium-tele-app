import { Module } from "@nestjs/common";
import { AppointmentsController } from "./appointments.controller";
import { AppointmentsService } from "./appointments.service";
import { PricingService } from "./pricing.service";
import { AppointmentRemindersService } from "./appointment-reminders.service";
import { FollowUpsService } from "./follow-ups.service";
import { FollowUpsController } from "./follow-ups.controller";
import { AuthModule } from "../auth/auth.module";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { SatisfactionModule } from "../satisfaction/satisfaction.module";
import { SupportModule } from "../support/support.module";
import { ReferralBonusModule } from "../referral-bonus/referral-bonus.module";

@Module({
  imports: [
    AuthModule,
    SubscriptionsModule,
    NotificationsModule,
    SatisfactionModule,
    SupportModule,
    ReferralBonusModule,
  ],
  controllers: [AppointmentsController, FollowUpsController],
  providers: [
    AppointmentsService,
    PricingService,
    AppointmentRemindersService,
    FollowUpsService,
  ],
  exports: [
    AppointmentsService,
    PricingService,
    AppointmentRemindersService,
    FollowUpsService,
  ],
})
export class AppointmentsModule {}
