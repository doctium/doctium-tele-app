import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "@doctium/types";
import { VideoService } from "./video.service";

@ApiTags("Videos")
@Controller("videos")
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  findAll(
    @Query() query: { search?: string; mine?: string },
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.videoService.findAll(query, user?.sub, user?.role);
  }

  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user?: JwtPayload) {
    return this.videoService.findOne(id, user?.sub);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("doctor")
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.videoService.createVideo(user.sub, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("doctor")
  @Patch(":id")
  update(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.videoService.updateVideo(id, user.sub, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("doctor")
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.videoService.deleteVideo(id, user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("user")
  @Post(":id/like")
  like(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.videoService.toggleLike(id, user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("user")
  @Post(":id/comment")
  comment(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body("comment") comment: string,
  ) {
    return this.videoService.addComment(id, user.sub, comment);
  }

  @Post(":id/share")
  share(@Param("id") id: string) {
    return this.videoService.share(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("user")
  @Post(":id/report")
  report(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { reason: string; note?: string },
  ) {
    return this.videoService.report(id, user.sub, body.reason, body.note);
  }
}
