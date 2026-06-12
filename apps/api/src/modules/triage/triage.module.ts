import { Module } from "@nestjs/common";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { AdminTriageController, TriageController } from "./triage.controller";
import { TriageService } from "./triage.service";
import { LlmProvider } from "./llm.provider";

@Module({
  imports: [SubscriptionsModule],
  controllers: [TriageController, AdminTriageController],
  providers: [TriageService, LlmProvider],
  exports: [TriageService, LlmProvider],
})
export class TriageModule {}
