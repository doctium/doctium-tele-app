import { Module } from "@nestjs/common";
import { RecordingController } from "./recording.controller";
import { RecordingWebhookController } from "./recording-webhook.controller";
import { RecordingService } from "./recording.service";
import { AuthModule } from "../auth/auth.module";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";

/**
 * Consultation recording: consent, sessions, assets, retention, export/delete
 * requests. Extracted from the appointments module (the logic was ~1,400 lines
 * inside appointments.service). AdminModule also consumes RecordingService for
 * its oversight routes.
 */
@Module({
  imports: [AuthModule, SubscriptionsModule],
  controllers: [RecordingController, RecordingWebhookController],
  providers: [RecordingService],
  exports: [RecordingService],
})
export class RecordingModule {}
