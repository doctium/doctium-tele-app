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
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "@doctium/types";
import { UsersService } from "./users.service";

@ApiTags("Users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("user")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("profile")
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.usersService.getProfile(user.sub);
  }

  @Patch("profile")
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Patch("profile/avatar")
  updateAvatar(
    @CurrentUser() user: JwtPayload,
    @Body("dataUrl") dataUrl: string,
  ) {
    return this.usersService.updateAvatar(user.sub, dataUrl);
  }

  @Get("favorites")
  getFavorites(@CurrentUser() user: JwtPayload) {
    return this.usersService.getFavorites(user.sub);
  }

  @Get("favorites/ids")
  getFavoriteIds(@CurrentUser() user: JwtPayload) {
    return this.usersService.getFavoriteIds(user.sub);
  }

  @Post("favorites/:doctorId/toggle")
  toggleFavorite(
    @CurrentUser() user: JwtPayload,
    @Param("doctorId") doctorId: string,
  ) {
    return this.usersService.toggleFavorite(user.sub, doctorId);
  }

  @Get("sub-patients")
  getSubPatients(@CurrentUser() user: JwtPayload) {
    return this.usersService.getSubPatients(user.sub);
  }

  @Post("sub-patients")
  createSubPatient(
    @CurrentUser() user: JwtPayload,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.usersService.createSubPatient(user.sub, dto);
  }

  @Patch("sub-patients/:id")
  updateSubPatient(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.usersService.updateSubPatient(id, user.sub, dto);
  }

  @Delete("sub-patients/:id")
  deleteSubPatient(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.usersService.deleteSubPatient(id, user.sub);
  }

  @Patch("fcm-token")
  updateFcmToken(
    @CurrentUser() user: JwtPayload,
    @Body("fcmToken") fcmToken: string,
  ) {
    return this.usersService.updateFcmToken(user.sub, fcmToken);
  }
}
