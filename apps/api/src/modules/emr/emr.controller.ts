import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "@doctium/types";
import { EmrService } from "./emr.service";
import { FhirService } from "./fhir.service";
import { ScribeService } from "./scribe.service";
import {
  CreateAllergyDto,
  CreateConditionDto,
  CreateImmunizationDto,
  CreateMedicalFileDto,
  CreateSurgeryDto,
  UpdateHealthProfileDto,
  UpsertClinicalNoteDto,
} from "./dto/emr.dto";

@ApiTags("EMR")
@ApiBearerAuth()
@Controller("emr")
@UseGuards(JwtAuthGuard)
export class EmrController {
  constructor(
    private readonly emr: EmrService,
    private readonly fhir: FhirService,
    private readonly scribe: ScribeService,
  ) {}

  // ─── Patient: own record (self or a family member via ?subPatientId) ──
  @UseGuards(RolesGuard)
  @Roles("user")
  @Get("me/patients")
  myPatients(@CurrentUser() user: JwtPayload) {
    return this.emr.listAccountPatients(user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles("user")
  @Get("me")
  myRecord(
    @CurrentUser() user: JwtPayload,
    @Query("subPatientId") subPatientId?: string,
  ) {
    return this.emr.getMyRecord(user.sub, subPatientId);
  }

  @UseGuards(RolesGuard)
  @Roles("user")
  @Get("me/fhir")
  myFhir(
    @CurrentUser() user: JwtPayload,
    @Query("subPatientId") subPatientId?: string,
  ) {
    return this.fhir.exportPatient(user.sub, subPatientId);
  }

  @UseGuards(RolesGuard)
  @Roles("user")
  @Put("me/profile")
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateHealthProfileDto,
  ) {
    return this.emr.upsertProfile(user.sub, { ...dto }, dto.subPatientId);
  }

  @UseGuards(RolesGuard)
  @Roles("user")
  @Post("me/conditions")
  addCondition(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateConditionDto,
  ) {
    return this.emr.addCondition(
      user.sub,
      { ...dto },
      {
        subPatientId: dto.subPatientId,
      },
    );
  }

  @UseGuards(RolesGuard)
  @Roles("user")
  @Post("me/allergies")
  addAllergy(@CurrentUser() user: JwtPayload, @Body() dto: CreateAllergyDto) {
    return this.emr.addAllergy(
      user.sub,
      { ...dto },
      {
        subPatientId: dto.subPatientId,
      },
    );
  }

  @UseGuards(RolesGuard)
  @Roles("user")
  @Post("me/surgeries")
  addSurgery(@CurrentUser() user: JwtPayload, @Body() dto: CreateSurgeryDto) {
    return this.emr.addSurgery(user.sub, { ...dto }, dto.subPatientId);
  }

  @UseGuards(RolesGuard)
  @Roles("user")
  @Post("me/immunizations")
  addImmunization(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateImmunizationDto,
  ) {
    return this.emr.addImmunization(user.sub, { ...dto }, dto.subPatientId);
  }

  @UseGuards(RolesGuard)
  @Roles("user")
  @Delete("me/:type/:id")
  deleteEntry(
    @CurrentUser() user: JwtPayload,
    @Param("type") type: "condition" | "allergy" | "surgery" | "immunization",
    @Param("id") id: string,
  ) {
    return this.emr.deleteEntry(type, id, user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles("user")
  @Post("me/files")
  addMyFile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateMedicalFileDto,
  ) {
    return this.emr.addFile(
      user.sub,
      { ...dto },
      {
        by: "PATIENT",
        id: user.sub,
        subPatientId: dto.subPatientId,
      },
    );
  }

  @UseGuards(RolesGuard)
  @Roles("user")
  @Delete("me/files/:id")
  deleteMyFile(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.emr.deleteFile(id, user.sub);
  }

  // ─── Doctor: appointment-gated patient access ────────────
  @UseGuards(RolesGuard)
  @Roles("doctor")
  @Get("patient/:userId")
  patientRecord(
    @CurrentUser() doctor: JwtPayload,
    @Param("userId") userId: string,
    @Query("subPatientId") subPatientId?: string,
  ) {
    return this.emr.getPatientRecord(doctor.sub, userId, subPatientId);
  }

  @UseGuards(RolesGuard)
  @Roles("doctor")
  @Get("patient/:userId/fhir")
  async patientFhir(
    @CurrentUser() doctor: JwtPayload,
    @Param("userId") userId: string,
    @Query("subPatientId") subPatientId?: string,
  ) {
    await this.emr.assertDoctorCanAccess(doctor.sub, userId, subPatientId);
    return this.fhir.exportPatient(userId, subPatientId);
  }

  @UseGuards(RolesGuard)
  @Roles("doctor")
  @Post("patient/:userId/conditions")
  docAddCondition(
    @CurrentUser() doctor: JwtPayload,
    @Param("userId") userId: string,
    @Body() dto: CreateConditionDto,
  ) {
    return this.emr.addCondition(
      userId,
      { ...dto },
      {
        doctorId: doctor.sub,
        subPatientId: dto.subPatientId,
      },
    );
  }

  @UseGuards(RolesGuard)
  @Roles("doctor")
  @Post("patient/:userId/allergies")
  docAddAllergy(
    @CurrentUser() doctor: JwtPayload,
    @Param("userId") userId: string,
    @Body() dto: CreateAllergyDto,
  ) {
    return this.emr.addAllergy(
      userId,
      { ...dto },
      {
        doctorId: doctor.sub,
        subPatientId: dto.subPatientId,
      },
    );
  }

  @UseGuards(RolesGuard)
  @Roles("doctor")
  @Post("patient/:userId/files")
  docAddFile(
    @CurrentUser() doctor: JwtPayload,
    @Param("userId") userId: string,
    @Body() dto: CreateMedicalFileDto,
  ) {
    return this.emr.addFile(
      userId,
      { ...dto },
      {
        by: "DOCTOR",
        id: doctor.sub,
        subPatientId: dto.subPatientId,
      },
    );
  }

  // ─── SOAP clinical notes ─────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles("doctor")
  @Post("notes")
  upsertNote(
    @CurrentUser() doctor: JwtPayload,
    @Body() dto: UpsertClinicalNoteDto,
  ) {
    return this.emr.upsertNote(doctor.sub, { ...dto });
  }

  /** Scribe: AI-draft a SOAP note from the consult chat or a dictation. Returns a draft for review — never saves SOAP text. */
  @UseGuards(RolesGuard)
  @Roles("doctor")
  @Post("notes/:appointmentId/draft")
  draftNote(
    @CurrentUser() doctor: JwtPayload,
    @Param("appointmentId") appointmentId: string,
    @Body() dto: { source?: string; audio?: string; mimeType?: string },
  ) {
    return this.scribe.draftNote(doctor.sub, appointmentId, dto);
  }

  /** Scribe action hub: recommend a matched care program to the patient (notification only — enrolling stays their choice). */
  @UseGuards(RolesGuard)
  @Roles("doctor")
  @Post("notes/:appointmentId/suggest-program")
  suggestProgram(
    @CurrentUser() doctor: JwtPayload,
    @Param("appointmentId") appointmentId: string,
    @Body() dto: { programId?: string },
  ) {
    return this.scribe.suggestProgram(
      doctor.sub,
      appointmentId,
      String(dto.programId ?? ""),
    );
  }

  @Get("notes/appointment/:appointmentId")
  getNote(
    @CurrentUser() requester: JwtPayload,
    @Param("appointmentId") appointmentId: string,
  ) {
    return this.emr.getNoteForAppointment(appointmentId, requester);
  }
}
