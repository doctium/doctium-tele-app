import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { ReferralBonusService } from "./referral-bonus.service";

@Module({
  imports: [NotificationsModule],
  providers: [ReferralBonusService],
  exports: [ReferralBonusService],
})
export class ReferralBonusModule {}
