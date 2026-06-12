import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AuthModule } from "../auth/auth.module";
import { PaymentsModule } from "../payments/payments.module";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { KycModule } from "../kyc/kyc.module";
import { HrModule } from "../hr/hr.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AppointmentsModule } from "../appointments/appointments.module";
import { EmrModule } from "../emr/emr.module";
import { ReferralsModule } from "../referrals/referrals.module";
import { CloudinaryService } from "../prescriptions/cloudinary.service";

@Module({
  imports: [
    AuthModule,
    PaymentsModule,
    SubscriptionsModule,
    KycModule,
    HrModule,
    NotificationsModule,
    AppointmentsModule,
    EmrModule,
    ReferralsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, CloudinaryService],
})
export class AdminModule {}
