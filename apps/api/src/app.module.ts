import { Module } from "@nestjs/common";
import { APP_GUARD, APP_FILTER } from "@nestjs/core";
import { SentryModule } from "@sentry/nestjs/setup";
import { SentryGlobalFilter } from "@sentry/nestjs/setup";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { CsrfGuard } from "./common/csrf.guard";
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
import { HealthModule } from "./modules/health/health.module";
import { RecordingModule } from "./modules/recording/recording.module";

@Module({
  imports: [
    SentryModule.forRoot(),
    ScheduleModule.forRoot(),
    // Global rate limiting. A generous default protects every route from abuse;
    // auth/OTP routes apply much stricter per-route limits via @Throttle, and the
    // Paystack webhook opts out with @SkipThrottle (it must accept provider retries).
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 100 }]),
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
    HealthModule,
    RecordingModule,
  ],
  providers: [
    // Captures unhandled exceptions to Sentry (then delegates to Nest's default
    // handling, so error responses are unchanged). No-op when SENTRY_DSN is unset.
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule {}
