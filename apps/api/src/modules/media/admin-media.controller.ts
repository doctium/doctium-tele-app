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
import { RolesGuard } from "../auth/guards/roles.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "@doctium/types";
import { MediaService } from "./media.service";
import {
  CreateAuthorDto,
  UpdateAuthorDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateBlogPostDto,
  UpdateBlogPostDto,
  CreateNewsPostDto,
  UpdateNewsPostDto,
  CreateJobTeamDto,
  UpdateJobTeamDto,
  CreateJobPostingDto,
  UpdateJobPostingDto,
  UpdateApplicationStatusDto,
  CreateLandingPageDto,
  UpdateLandingPageDto,
  CreateTeamMemberDto,
  UpdateTeamMemberDto,
  UpdateEnquiryStatusDto,
} from "./dto/media.dto";

@ApiTags("Admin · Media")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("admin")
@Controller("admin/media")
export class AdminMediaController {
  constructor(private readonly media: MediaService) {}

  // ── Authors (shared by blog + news) ──
  @Permissions("media.blog.view")
  @Get("authors")
  authors() {
    return this.media.adminListAuthors();
  }
  @Permissions("media.blog.manage")
  @Post("authors")
  createAuthor(@Body() dto: CreateAuthorDto) {
    return this.media.adminCreateAuthor(dto);
  }
  @Permissions("media.blog.manage")
  @Patch("authors/:id")
  updateAuthor(@Param("id") id: string, @Body() dto: UpdateAuthorDto) {
    return this.media.adminUpdateAuthor(id, dto);
  }
  @Permissions("media.blog.manage")
  @Delete("authors/:id")
  deleteAuthor(@Param("id") id: string) {
    return this.media.adminDeleteAuthor(id);
  }

  // ── Blog categories ──
  @Permissions("media.blog.view")
  @Get("blog-categories")
  blogCategories() {
    return this.media.adminListBlogCategories();
  }
  @Permissions("media.blog.manage")
  @Post("blog-categories")
  createBlogCategory(@Body() dto: CreateCategoryDto) {
    return this.media.adminCreateBlogCategory(dto);
  }
  @Permissions("media.blog.manage")
  @Patch("blog-categories/:id")
  updateBlogCategory(@Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    return this.media.adminUpdateBlogCategory(id, dto);
  }
  @Permissions("media.blog.manage")
  @Delete("blog-categories/:id")
  deleteBlogCategory(@Param("id") id: string) {
    return this.media.adminDeleteBlogCategory(id);
  }

  // ── Blog posts ──
  @Permissions("media.blog.view")
  @Get("blog")
  listBlog() {
    return this.media.adminListBlog();
  }
  @Permissions("media.blog.view")
  @Get("blog/:id")
  getBlog(@Param("id") id: string) {
    return this.media.adminGetBlog(id);
  }
  @Permissions("media.blog.manage")
  @Post("blog")
  createBlog(@Body() dto: CreateBlogPostDto) {
    return this.media.adminCreateBlog(dto);
  }
  @Permissions("media.blog.manage")
  @Patch("blog/:id")
  updateBlog(@Param("id") id: string, @Body() dto: UpdateBlogPostDto) {
    return this.media.adminUpdateBlog(id, dto);
  }
  @Permissions("media.blog.manage")
  @Post("blog/:id/publish")
  publishBlog(@Param("id") id: string) {
    return this.media.setBlogStatus(id, "PUBLISHED");
  }
  @Permissions("media.blog.manage")
  @Post("blog/:id/unpublish")
  unpublishBlog(@Param("id") id: string) {
    return this.media.setBlogStatus(id, "DRAFT");
  }
  @Permissions("media.blog.manage")
  @Delete("blog/:id")
  deleteBlog(@Param("id") id: string) {
    return this.media.adminDeleteBlog(id);
  }

  // ── News categories ──
  @Permissions("media.news.view")
  @Get("news-categories")
  newsCategories() {
    return this.media.adminListNewsCategories();
  }
  @Permissions("media.news.manage")
  @Post("news-categories")
  createNewsCategory(@Body() dto: CreateCategoryDto) {
    return this.media.adminCreateNewsCategory(dto);
  }
  @Permissions("media.news.manage")
  @Patch("news-categories/:id")
  updateNewsCategory(@Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    return this.media.adminUpdateNewsCategory(id, dto);
  }
  @Permissions("media.news.manage")
  @Delete("news-categories/:id")
  deleteNewsCategory(@Param("id") id: string) {
    return this.media.adminDeleteNewsCategory(id);
  }

  // ── News posts ──
  @Permissions("media.news.view")
  @Get("news")
  listNews() {
    return this.media.adminListNews();
  }
  @Permissions("media.news.view")
  @Get("news/:id")
  getNews(@Param("id") id: string) {
    return this.media.adminGetNews(id);
  }
  @Permissions("media.news.manage")
  @Post("news")
  createNews(@Body() dto: CreateNewsPostDto) {
    return this.media.adminCreateNews(dto);
  }
  @Permissions("media.news.manage")
  @Patch("news/:id")
  updateNews(@Param("id") id: string, @Body() dto: UpdateNewsPostDto) {
    return this.media.adminUpdateNews(id, dto);
  }
  @Permissions("media.news.manage")
  @Delete("news/:id")
  deleteNews(@Param("id") id: string) {
    return this.media.adminDeleteNews(id);
  }

  // ── Job teams ──
  @Permissions("media.careers.view")
  @Get("teams")
  teams() {
    return this.media.adminListJobTeams();
  }
  @Permissions("media.careers.manage")
  @Post("teams")
  createTeam(@Body() dto: CreateJobTeamDto) {
    return this.media.adminCreateJobTeam(dto);
  }
  @Permissions("media.careers.manage")
  @Patch("teams/:id")
  updateTeam(@Param("id") id: string, @Body() dto: UpdateJobTeamDto) {
    return this.media.adminUpdateJobTeam(id, dto);
  }
  @Permissions("media.careers.manage")
  @Delete("teams/:id")
  deleteTeam(@Param("id") id: string) {
    return this.media.adminDeleteJobTeam(id);
  }

  // ── Job postings ──
  @Permissions("media.careers.view")
  @Get("jobs")
  listJobs() {
    return this.media.adminListJobs();
  }
  @Permissions("media.careers.view")
  @Get("jobs/:id")
  getJob(@Param("id") id: string) {
    return this.media.adminGetJob(id);
  }
  @Permissions("media.careers.manage")
  @Post("jobs")
  createJob(@Body() dto: CreateJobPostingDto) {
    return this.media.adminCreateJob(dto);
  }
  @Permissions("media.careers.manage")
  @Patch("jobs/:id")
  updateJob(@Param("id") id: string, @Body() dto: UpdateJobPostingDto) {
    return this.media.adminUpdateJob(id, dto);
  }
  @Permissions("media.careers.manage")
  @Delete("jobs/:id")
  deleteJob(@Param("id") id: string) {
    return this.media.adminDeleteJob(id);
  }

  // ── Applications inbox ──
  @Permissions("media.applications.view")
  @Get("applications")
  applications(@Query() q: { jobId?: string; status?: string }) {
    return this.media.adminListApplications(q);
  }
  @Permissions("media.applications.view")
  @Get("applications/:id")
  application(@Param("id") id: string) {
    return this.media.adminGetApplication(id);
  }
  @Permissions("media.applications.manage")
  @Patch("applications/:id/status")
  applicationStatus(
    @Param("id") id: string,
    @Body() dto: UpdateApplicationStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.media.adminUpdateApplicationStatus(id, dto, user.sub);
  }

  // ── Landing pages (programmatic SEO) ──
  @Permissions("media.landing.manage")
  @Get("landing")
  listLanding() {
    return this.media.adminListLanding();
  }
  @Permissions("media.landing.manage")
  @Get("landing/:id")
  getLanding(@Param("id") id: string) {
    return this.media.adminGetLanding(id);
  }
  @Permissions("media.landing.manage")
  @Post("landing")
  createLanding(@Body() dto: CreateLandingPageDto) {
    return this.media.adminCreateLanding(dto);
  }
  @Permissions("media.landing.manage")
  @Patch("landing/:id")
  updateLanding(@Param("id") id: string, @Body() dto: UpdateLandingPageDto) {
    return this.media.adminUpdateLanding(id, dto);
  }
  @Permissions("media.landing.manage")
  @Delete("landing/:id")
  deleteLanding(@Param("id") id: string) {
    return this.media.adminDeleteLanding(id);
  }

  // ── Team members ──
  @Permissions("media.team.view")
  @Get("team-members")
  teamMembers() {
    return this.media.adminListTeam();
  }
  @Permissions("media.team.manage")
  @Post("team-members")
  createTeamMember(@Body() dto: CreateTeamMemberDto) {
    return this.media.adminCreateTeamMember(dto);
  }
  @Permissions("media.team.manage")
  @Patch("team-members/:id")
  updateTeamMember(@Param("id") id: string, @Body() dto: UpdateTeamMemberDto) {
    return this.media.adminUpdateTeamMember(id, dto);
  }
  @Permissions("media.team.manage")
  @Delete("team-members/:id")
  deleteTeamMember(@Param("id") id: string) {
    return this.media.adminDeleteTeamMember(id);
  }

  // ── Demo requests / contact enquiries ──
  @Permissions("media.enquiries.view")
  @Get("enquiries")
  enquiries(@Query() q: { status?: string }) {
    return this.media.adminListEnquiries(q);
  }
  @Permissions("media.enquiries.view")
  @Get("enquiries/:id")
  enquiry(@Param("id") id: string) {
    return this.media.adminGetEnquiry(id);
  }
  @Permissions("media.enquiries.manage")
  @Patch("enquiries/:id/status")
  enquiryStatus(
    @Param("id") id: string,
    @Body() dto: UpdateEnquiryStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.media.adminUpdateEnquiryStatus(id, dto, user.sub);
  }
}
