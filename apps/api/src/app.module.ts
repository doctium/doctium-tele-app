import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { DoctorsModule } from "./modules/doctors/doctors.module";
import { AppointmentsModule } from "./modules/appointments/appointments.module";
import { ServicesModule } from "./modules/services/services.module";
import { ChatModule } from "./modules/chat/chat.module";
import { VideoModule } from "./modules/video/video.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { CouponsModule } from "./modules/coupons/coupons.module";
import { BannersModule } from "./modules/banners/banners.module";
import { AdminModule } from "./modules/admin/admin.module";
import { CallModule } from "./modules/call/call.module";
import { PrescriptionsModule } from "./modules/prescriptions/prescriptions.module";
import { RegionsModule } from "./modules/regions/regions.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";
import { KycModule } from "./modules/kyc/kyc.module";
import { HrModule } from "./modules/hr/hr.module";
import { SupportModule } from "./modules/support/support.module";
import { CommsModule } from "./modules/comms/comms.module";
import { EmrModule } from "./modules/emr/emr.module";
import { ReferralsModule } from "./modules/referrals/referrals.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { SatisfactionModule } from "./modules/satisfaction/satisfaction.module";
import { CareProgramsModule } from "./modules/care-programs/care-programs.module";
import { TriageModule } from "./modules/triage/triage.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    DoctorsModule,
    AppointmentsModule,
    ServicesModule,
    ChatModule,
    VideoModule,
    NotificationsModule,
    PaymentsModule,
    ReviewsModule,
    CouponsModule,
    BannersModule,
    AdminModule,
    CallModule,
    PrescriptionsModule,
    RegionsModule,
    SubscriptionsModule,
    KycModule,
    HrModule,
    SupportModule,
    CommsModule,
    EmrModule,
    ReferralsModule,
    AnalyticsModule,
    SatisfactionModule,
    CareProgramsModule,
    TriageModule,
  ],
})
export class AppModule {}
