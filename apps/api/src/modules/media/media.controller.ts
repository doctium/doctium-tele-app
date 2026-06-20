import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { MediaService } from "./media.service";
import {
  CreateJobApplicationDto,
  CreateContactEnquiryDto,
} from "./dto/media.dto";

/**
 * Public, unauthenticated read API for the website (doctiumhealth.com).
 * Returns PUBLISHED content only. Static segments are declared before `:slug`.
 */
@ApiTags("Media (public)")
@Controller("media")
export class MediaController {
  constructor(private readonly media: MediaService) {}

  // Blog
  @Get("blog")
  listBlog(@Query() q: { page?: string; category?: string; tag?: string }) {
    return this.media.publicListBlog(q);
  }
  @Get("blog/categories")
  blogCategories() {
    return this.media.publicBlogCategories();
  }
  @Get("blog/:slug")
  blogBySlug(@Param("slug") slug: string) {
    return this.media.publicBlogBySlug(slug);
  }

  // News & Press
  @Get("news")
  listNews(@Query() q: { page?: string; kind?: string; category?: string }) {
    return this.media.publicListNews(q);
  }
  @Get("news/categories")
  newsCategories() {
    return this.media.publicNewsCategories();
  }
  @Get("news/:slug")
  newsBySlug(@Param("slug") slug: string) {
    return this.media.publicNewsBySlug(slug);
  }

  // Careers
  @Get("jobs")
  listJobs(@Query() q: { team?: string }) {
    return this.media.publicListJobs(q);
  }
  @Get("jobs/teams")
  jobTeams() {
    return this.media.publicJobTeams();
  }
  @Get("jobs/:slug")
  jobBySlug(@Param("slug") slug: string) {
    return this.media.publicJobBySlug(slug);
  }
  @Post("jobs/:slug/apply")
  apply(@Param("slug") slug: string, @Body() dto: CreateJobApplicationDto) {
    return this.media.applyToJob(slug, dto);
  }

  // Programmatic landing pages
  @Get("landing/:slug")
  landing(@Param("slug") slug: string) {
    return this.media.publicLandingBySlug(slug);
  }

  // Team
  @Get("team")
  team() {
    return this.media.publicListTeam();
  }

  // Demo request / contact enquiry (from the website /contact form)
  @Post("contact")
  contact(@Body() dto: CreateContactEnquiryDto) {
    return this.media.submitEnquiry(dto);
  }

  // For the website's dynamic sitemap + RSS
  @Get("sitemap-entries")
  sitemap() {
    return this.media.sitemapEntries();
  }
}
