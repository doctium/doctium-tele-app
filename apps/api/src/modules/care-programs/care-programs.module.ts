import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import {
  AdminCareProgramsController,
  CareProgramsController,
} from "./care-programs.controller";
import { CareProgramsService } from "./care-programs.service";
import { RiskService } from "./risk.service";
import { TitrationService } from "./titration.service";
import { ScdOutcomesService } from "./scd-outcomes.service";
import { OrganizationsService } from "./organizations.service";
import { AdminOrganizationsController } from "./organizations.controller";

@Module({
  imports: [NotificationsModule],
  controllers: [
    CareProgramsController,
    AdminCareProgramsController,
    AdminOrganizationsController,
  ],
  providers: [
    CareProgramsService,
    RiskService,
    TitrationService,
    ScdOutcomesService,
    OrganizationsService,
  ],
  exports: [
    CareProgramsService,
    RiskService,
    TitrationService,
    ScdOutcomesService,
    OrganizationsService,
  ],
})
export class CareProgramsModule {}
