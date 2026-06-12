import { Module } from "@nestjs/common";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import {
  AdminAnalyticsController,
  AnalyticsController,
} from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";

@Module({
  imports: [SubscriptionsModule],
  controllers: [AnalyticsController, AdminAnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
