import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { OrganizationsService } from "./organizations.service";
import {
  AddOrgMemberDto,
  CreateOrganizationDto,
  UpdateOrganizationDto,
  UpsertSponsorshipDto,
} from "./dto/care-programs.dto";

@ApiTags("Enterprise")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("admin")
@Controller("admin/organizations")
export class AdminOrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Permissions("enterprise.view")
  @Get()
  list() {
    return this.orgs.list();
  }

  @Permissions("enterprise.view")
  @Get(":id")
  detail(@Param("id") id: string) {
    return this.orgs.detail(id);
  }

  /** Outcomes report CSV — the renewal artifact for HMO/employer contracts. */
  @Permissions("enterprise.view")
  @Get(":id/report.csv")
  async report(@Param("id") id: string, @Res() res: Response) {
    const { name, csv } = await this.orgs.outcomesCsv(id);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="outcomes-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv"`,
    );
    res.send(csv);
  }

  @Permissions("enterprise.manage")
  @Post()
  create(@Body() dto: CreateOrganizationDto) {
    return this.orgs.create(dto);
  }

  @Permissions("enterprise.manage")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateOrganizationDto) {
    return this.orgs.update(id, dto);
  }

  @Permissions("enterprise.manage")
  @Post(":id/members")
  addMember(@Param("id") id: string, @Body() dto: AddOrgMemberDto) {
    return this.orgs.addMember(id, dto.identifier, dto.externalRef);
  }

  @Permissions("enterprise.manage")
  @Delete(":id/members/:memberId")
  removeMember(@Param("id") id: string, @Param("memberId") memberId: string) {
    return this.orgs.removeMember(id, memberId);
  }

  @Permissions("enterprise.manage")
  @Post(":id/sponsorships")
  upsertSponsorship(
    @Param("id") id: string,
    @Body() dto: UpsertSponsorshipDto,
  ) {
    return this.orgs.upsertSponsorship(id, dto);
  }
}
