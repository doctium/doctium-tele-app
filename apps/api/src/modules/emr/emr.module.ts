import { Module } from "@nestjs/common";
import { EmrController } from "./emr.controller";
import { EmrService } from "./emr.service";
import { FhirService } from "./fhir.service";
import { ScribeService } from "./scribe.service";
import { AudioExtractorService } from "./audio-extractor.service";
import { CloudinaryService } from "../prescriptions/cloudinary.service";
import { TriageModule } from "../triage/triage.module";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  // TriageModule provides the shared LlmProvider (Whisper + strict-schema GPT);
  // SubscriptionsModule provides EntitlementsService for the aiScribe gate;
  // NotificationsModule delivers the care-program suggestion to the patient.
  imports: [TriageModule, SubscriptionsModule, NotificationsModule],
  controllers: [EmrController],
  providers: [
    EmrService,
    FhirService,
    ScribeService,
    AudioExtractorService,
    CloudinaryService,
  ],
  exports: [EmrService, FhirService],
})
export class EmrModule {}
