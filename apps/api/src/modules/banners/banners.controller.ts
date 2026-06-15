import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { BannersService } from "./banners.service";
import { CreateBannerDto, UpdateBannerDto } from "./dto/banner.dto";

// ── Public: the app's home slider ──
@ApiTags("Banners")
@Controller("banners")
export class BannersController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  active() {
    return this.banners.listActive();
  }

  @Post(":id/click")
  click(@Param("id") id: string) {
    return this.banners.recordClick(id);
  }
}

// ── Admin: full CRUD (gated by catalog.manage) ──
@ApiTags("Admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("admin")
@Controller("admin/banners")
export class AdminBannersController {
  constructor(private readonly banners: BannersService) {}

  @Permissions("catalog.manage")
  @Get()
  list() {
    return this.banners.listAll();
  }

  @Permissions("catalog.manage")
  @Post()
  create(@Body() dto: CreateBannerDto) {
    return this.banners.create(dto);
  }

  // Must precede ":id" so "/reorder" isn't captured as an id.
  @Permissions("catalog.manage")
  @Patch("reorder")
  reorder(@Body() body: { ids: string[] }) {
    return this.banners.reorder(body.ids ?? []);
  }

  @Permissions("catalog.manage")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateBannerDto) {
    return this.banners.update(id, dto);
  }

  @Permissions("catalog.manage")
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.banners.remove(id);
  }
}
