import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma, Prisma } from "@doctium/database";
import { CloudinaryService } from "../prescriptions/cloudinary.service";
import { resolveImageUrl } from "../../common/image.util";
import type {
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
  CreateJobApplicationDto,
  UpdateApplicationStatusDto,
  CreateLandingPageDto,
  UpdateLandingPageDto,
} from "./dto/media.dto";

const PAGE_SIZE = 12;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

@Injectable()
export class MediaService {
  constructor(private readonly cloudinary: CloudinaryService) {}

  /** Fire-and-forget: ask the website to revalidate a content tag on publish.
   *  No-op unless WEBSITE_REVALIDATE_URL + WEBSITE_REVALIDATE_SECRET are set.
   *  Never blocks or throws — the website also has time-based ISR as a fallback. */
  private revalidateWebsite(tag: "blog" | "news" | "jobs" | "landing") {
    const url = process.env.WEBSITE_REVALIDATE_URL;
    const secret = process.env.WEBSITE_REVALIDATE_SECRET;
    if (!url || !secret) return;
    fetch(`${url}?secret=${encodeURIComponent(secret)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag }),
    }).catch(() => undefined);
  }

  /** Slugify `base`, then suffix -2, -3… until `exists()` returns false. */
  private async uniqueSlug(
    base: string,
    exists: (slug: string) => Promise<boolean>,
  ): Promise<string> {
    const root = slugify(base) || "item";
    let candidate = root;
    let n = 1;
    while (await exists(candidate)) {
      n += 1;
      candidate = `${root}-${n}`;
    }
    return candidate;
  }

  private statusPublishedAt(
    status?: string,
    current?: Date | null,
  ): Date | null {
    if (status === "PUBLISHED") return current ?? new Date();
    return current ?? null;
  }

  // ─────────────────────────────────────────────
  // PUBLIC READS (published only)
  // ─────────────────────────────────────────────

  async publicListBlog(q: { page?: string; category?: string; tag?: string }) {
    const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
    const where: Prisma.BlogPostWhereInput = {
      status: "PUBLISHED",
      ...(q.category ? { categories: { some: { slug: q.category } } } : {}),
      ...(q.tag ? { tags: { has: q.tag } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          title: true,
          slug: true,
          excerpt: true,
          coverImageUrl: true,
          readingMins: true,
          tags: true,
          publishedAt: true,
          author: {
            select: { name: true, slug: true, avatarUrl: true, role: true },
          },
          categories: { select: { name: true, slug: true } },
        },
      }),
      prisma.blogPost.count({ where }),
    ]);
    return { items, total, page, pageSize: PAGE_SIZE };
  }

  async publicBlogBySlug(slug: string) {
    const post = await prisma.blogPost.findFirst({
      where: { slug, status: "PUBLISHED" },
      include: {
        author: true,
        categories: { select: { name: true, slug: true } },
      },
    });
    if (!post) throw new NotFoundException("Post not found");
    return post;
  }

  publicBlogCategories() {
    return prisma.blogCategory.findMany({
      orderBy: { name: "asc" },
      select: { name: true, slug: true, description: true },
    });
  }

  async publicListNews(q: { page?: string; kind?: string; category?: string }) {
    const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
    const where: Prisma.NewsPostWhereInput = {
      status: "PUBLISHED",
      ...(q.kind ? { kind: q.kind as Prisma.NewsPostWhereInput["kind"] } : {}),
      ...(q.category ? { category: { slug: q.category } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.newsPost.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          title: true,
          slug: true,
          kind: true,
          excerpt: true,
          coverImageUrl: true,
          outlet: true,
          outletLogoUrl: true,
          externalUrl: true,
          publishedAt: true,
          category: { select: { name: true, slug: true } },
        },
      }),
      prisma.newsPost.count({ where }),
    ]);
    return { items, total, page, pageSize: PAGE_SIZE };
  }

  async publicNewsBySlug(slug: string) {
    const post = await prisma.newsPost.findFirst({
      where: { slug, status: "PUBLISHED" },
      include: {
        author: true,
        category: { select: { name: true, slug: true } },
      },
    });
    if (!post) throw new NotFoundException("News item not found");
    return post;
  }

  publicNewsCategories() {
    return prisma.newsCategory.findMany({
      orderBy: { name: "asc" },
      select: { name: true, slug: true, description: true },
    });
  }

  publicListJobs(q: { team?: string }) {
    return prisma.jobPosting.findMany({
      where: {
        status: "OPEN",
        ...(q.team ? { team: { slug: q.team } } : {}),
      },
      orderBy: { postedAt: "desc" },
      select: {
        title: true,
        slug: true,
        location: true,
        jobType: true,
        workMode: true,
        summary: true,
        postedAt: true,
        team: { select: { name: true, slug: true } },
      },
    });
  }

  async publicJobBySlug(slug: string) {
    const job = await prisma.jobPosting.findFirst({
      where: { slug, status: "OPEN" },
      include: { team: { select: { name: true, slug: true } } },
    });
    if (!job) throw new NotFoundException("Role not found");
    return job;
  }

  publicJobTeams() {
    return prisma.jobTeam.findMany({
      orderBy: { name: "asc" },
      select: { name: true, slug: true, description: true },
    });
  }

  async publicLandingBySlug(slug: string) {
    const page = await prisma.landingPage.findFirst({
      where: { slug, status: "PUBLISHED" },
    });
    if (!page) throw new NotFoundException("Page not found");
    return page;
  }

  /** Slug + lastmod lists for the website's dynamic sitemap + RSS. */
  async sitemapEntries() {
    const [blog, news, jobs, landing] = await Promise.all([
      prisma.blogPost.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true, publishedAt: true },
      }),
      prisma.newsPost.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true, publishedAt: true },
      }),
      prisma.jobPosting.findMany({
        where: { status: "OPEN" },
        select: { slug: true, updatedAt: true },
      }),
      prisma.landingPage.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true },
      }),
    ]);
    return { blog, news, jobs, landing };
  }

  /** Public job application (careers form). Honeypot + consent gated. */
  async applyToJob(slug: string, dto: CreateJobApplicationDto) {
    if (dto.website && dto.website.trim() !== "") return { ok: true }; // bot
    const job = await prisma.jobPosting.findFirst({
      where: { slug, status: "OPEN" },
      select: { id: true },
    });
    if (!job) throw new NotFoundException("Role not found or closed");

    let cvUrl = "";
    if (dto.cv) {
      cvUrl =
        (await resolveImageUrl(
          this.cloudinary,
          dto.cv,
          `careers/cv/${job.id}-${Date.now()}`,
        )) ?? "";
    }

    await prisma.jobApplication.create({
      data: {
        jobId: job.id,
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone ?? "",
        linkedinUrl: dto.linkedinUrl ?? "",
        portfolioUrl: dto.portfolioUrl ?? "",
        cvUrl,
        cvFileName: dto.cvFileName ?? "",
        coverNote: dto.coverNote ?? "",
        consent: dto.consent,
      },
    });
    // TODO(comms): notify careers inbox via NotifierService / comms email.
    return { ok: true };
  }

  // ─────────────────────────────────────────────
  // ADMIN — Authors
  // ─────────────────────────────────────────────

  adminListAuthors() {
    return prisma.author.findMany({ orderBy: { name: "asc" } });
  }

  async adminCreateAuthor(dto: CreateAuthorDto) {
    const slug = await this.uniqueSlug(dto.slug || dto.name, (s) =>
      prisma.author.findUnique({ where: { slug: s } }).then(Boolean),
    );
    const avatarUrl = dto.avatar
      ? ((await resolveImageUrl(
          this.cloudinary,
          dto.avatar,
          `authors/${slug}`,
        )) ?? "")
      : "";
    return prisma.author.create({
      data: {
        name: dto.name,
        slug,
        role: dto.role ?? "",
        bioMd: dto.bioMd ?? "",
        avatarUrl,
        linkedinUrl: dto.linkedinUrl ?? "",
        xUrl: dto.xUrl ?? "",
      },
    });
  }

  async adminUpdateAuthor(id: string, dto: UpdateAuthorDto) {
    const existing = await prisma.author.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Author not found");
    const data: Prisma.AuthorUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.bioMd !== undefined) data.bioMd = dto.bioMd;
    if (dto.linkedinUrl !== undefined) data.linkedinUrl = dto.linkedinUrl;
    if (dto.xUrl !== undefined) data.xUrl = dto.xUrl;
    if (dto.avatar)
      data.avatarUrl =
        (await resolveImageUrl(this.cloudinary, dto.avatar, `authors/${id}`)) ??
        "";
    return prisma.author.update({ where: { id }, data });
  }

  async adminDeleteAuthor(id: string) {
    await prisma.author.delete({ where: { id } });
    return { deleted: true };
  }

  // ─────────────────────────────────────────────
  // ADMIN — Blog categories
  // ─────────────────────────────────────────────

  adminListBlogCategories() {
    return prisma.blogCategory.findMany({ orderBy: { name: "asc" } });
  }

  async adminCreateBlogCategory(dto: CreateCategoryDto) {
    const slug = await this.uniqueSlug(dto.slug || dto.name, (s) =>
      prisma.blogCategory.findUnique({ where: { slug: s } }).then(Boolean),
    );
    return prisma.blogCategory.create({
      data: { name: dto.name, slug, description: dto.description ?? "" },
    });
  }

  async adminUpdateBlogCategory(id: string, dto: UpdateCategoryDto) {
    const existing = await prisma.blogCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Category not found");
    return prisma.blogCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.slug !== undefined ? { slug: slugify(dto.slug) } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
      },
    });
  }

  async adminDeleteBlogCategory(id: string) {
    await prisma.blogCategory.delete({ where: { id } });
    return { deleted: true };
  }

  // ─────────────────────────────────────────────
  // ADMIN — Blog posts
  // ─────────────────────────────────────────────

  adminListBlog() {
    return prisma.blogPost.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        author: { select: { name: true } },
        categories: { select: { name: true, slug: true } },
      },
    });
  }

  adminGetBlog(id: string) {
    return prisma.blogPost.findUnique({
      where: { id },
      include: { author: true, categories: true },
    });
  }

  async adminCreateBlog(dto: CreateBlogPostDto) {
    const slug = await this.uniqueSlug(dto.slug || dto.title, (s) =>
      prisma.blogPost.findUnique({ where: { slug: s } }).then(Boolean),
    );
    const coverImageUrl = dto.coverImage
      ? ((await resolveImageUrl(
          this.cloudinary,
          dto.coverImage,
          `blog/${slug}`,
        )) ?? "")
      : "";
    const status = (dto.status ??
      "DRAFT") as Prisma.BlogPostCreateInput["status"];
    return prisma.blogPost.create({
      data: {
        title: dto.title,
        slug,
        excerpt: dto.excerpt ?? "",
        bodyMd: dto.bodyMd ?? "",
        coverImageUrl,
        status,
        publishedAt: this.statusPublishedAt(
          dto.status,
          dto.publishedAt ? new Date(dto.publishedAt) : null,
        ),
        readingMins: dto.readingMins ?? 0,
        tags: dto.tags ?? [],
        ...(dto.authorId ? { author: { connect: { id: dto.authorId } } } : {}),
        ...(dto.categoryIds?.length
          ? { categories: { connect: dto.categoryIds.map((id) => ({ id })) } }
          : {}),
        metaTitle: dto.metaTitle ?? "",
        metaDescription: dto.metaDescription ?? "",
        ogImageUrl: dto.ogImage ?? "",
        canonicalUrl: dto.canonicalUrl ?? "",
        noindex: dto.noindex ?? false,
      },
    });
  }

  async adminUpdateBlog(id: string, dto: UpdateBlogPostDto) {
    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Post not found");
    const data: Prisma.BlogPostUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.slug !== undefined) data.slug = slugify(dto.slug);
    if (dto.excerpt !== undefined) data.excerpt = dto.excerpt;
    if (dto.bodyMd !== undefined) data.bodyMd = dto.bodyMd;
    if (dto.readingMins !== undefined) data.readingMins = dto.readingMins;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.metaTitle !== undefined) data.metaTitle = dto.metaTitle;
    if (dto.metaDescription !== undefined)
      data.metaDescription = dto.metaDescription;
    if (dto.ogImage !== undefined) data.ogImageUrl = dto.ogImage;
    if (dto.canonicalUrl !== undefined) data.canonicalUrl = dto.canonicalUrl;
    if (dto.noindex !== undefined) data.noindex = dto.noindex;
    if (dto.status !== undefined) {
      data.status = dto.status as Prisma.BlogPostUpdateInput["status"];
      data.publishedAt = this.statusPublishedAt(
        dto.status,
        existing.publishedAt,
      );
    }
    if (dto.publishedAt !== undefined)
      data.publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : null;
    if (dto.coverImage)
      data.coverImageUrl =
        (await resolveImageUrl(
          this.cloudinary,
          dto.coverImage,
          `blog/${id}`,
        )) ?? "";
    if (dto.authorId !== undefined)
      data.author = dto.authorId
        ? { connect: { id: dto.authorId } }
        : { disconnect: true };
    if (dto.categoryIds !== undefined)
      data.categories = { set: dto.categoryIds.map((cid) => ({ id: cid })) };
    const updated = await prisma.blogPost.update({ where: { id }, data });
    this.revalidateWebsite("blog");
    return updated;
  }

  async adminDeleteBlog(id: string) {
    await prisma.blogPost.delete({ where: { id } });
    return { deleted: true };
  }

  async setBlogStatus(id: string, status: "PUBLISHED" | "DRAFT" | "ARCHIVED") {
    const updated = await prisma.blogPost.update({
      where: { id },
      data: {
        status,
        publishedAt: status === "PUBLISHED" ? new Date() : undefined,
      },
    });
    this.revalidateWebsite("blog");
    return updated;
  }

  // ─────────────────────────────────────────────
  // ADMIN — News categories + posts
  // ─────────────────────────────────────────────

  adminListNewsCategories() {
    return prisma.newsCategory.findMany({ orderBy: { name: "asc" } });
  }

  async adminCreateNewsCategory(dto: CreateCategoryDto) {
    const slug = await this.uniqueSlug(dto.slug || dto.name, (s) =>
      prisma.newsCategory.findUnique({ where: { slug: s } }).then(Boolean),
    );
    return prisma.newsCategory.create({
      data: { name: dto.name, slug, description: dto.description ?? "" },
    });
  }

  async adminUpdateNewsCategory(id: string, dto: UpdateCategoryDto) {
    const existing = await prisma.newsCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Category not found");
    return prisma.newsCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.slug !== undefined ? { slug: slugify(dto.slug) } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
      },
    });
  }

  async adminDeleteNewsCategory(id: string) {
    await prisma.newsCategory.delete({ where: { id } });
    return { deleted: true };
  }

  adminListNews() {
    return prisma.newsPost.findMany({
      orderBy: { updatedAt: "desc" },
      include: { category: { select: { name: true } } },
    });
  }

  adminGetNews(id: string) {
    return prisma.newsPost.findUnique({
      where: { id },
      include: { category: true },
    });
  }

  async adminCreateNews(dto: CreateNewsPostDto) {
    const slug = await this.uniqueSlug(dto.slug || dto.title, (s) =>
      prisma.newsPost.findUnique({ where: { slug: s } }).then(Boolean),
    );
    const coverImageUrl = dto.coverImage
      ? ((await resolveImageUrl(
          this.cloudinary,
          dto.coverImage,
          `news/${slug}`,
        )) ?? "")
      : "";
    return prisma.newsPost.create({
      data: {
        title: dto.title,
        slug,
        kind: (dto.kind ??
          "ANNOUNCEMENT") as Prisma.NewsPostCreateInput["kind"],
        excerpt: dto.excerpt ?? "",
        bodyMd: dto.bodyMd ?? "",
        coverImageUrl,
        status: (dto.status ?? "DRAFT") as Prisma.NewsPostCreateInput["status"],
        publishedAt: this.statusPublishedAt(
          dto.status,
          dto.publishedAt ? new Date(dto.publishedAt) : null,
        ),
        ...(dto.authorId ? { author: { connect: { id: dto.authorId } } } : {}),
        ...(dto.categoryId
          ? { category: { connect: { id: dto.categoryId } } }
          : {}),
        outlet: dto.outlet ?? "",
        outletLogoUrl: dto.outletLogoUrl ?? "",
        externalUrl: dto.externalUrl ?? "",
        metaTitle: dto.metaTitle ?? "",
        metaDescription: dto.metaDescription ?? "",
        ogImageUrl: dto.ogImage ?? "",
        canonicalUrl: dto.canonicalUrl ?? "",
        noindex: dto.noindex ?? false,
      },
    });
  }

  async adminUpdateNews(id: string, dto: UpdateNewsPostDto) {
    const existing = await prisma.newsPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("News item not found");
    const data: Prisma.NewsPostUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.slug !== undefined) data.slug = slugify(dto.slug);
    if (dto.kind !== undefined)
      data.kind = dto.kind as Prisma.NewsPostUpdateInput["kind"];
    if (dto.excerpt !== undefined) data.excerpt = dto.excerpt;
    if (dto.bodyMd !== undefined) data.bodyMd = dto.bodyMd;
    if (dto.outlet !== undefined) data.outlet = dto.outlet;
    if (dto.outletLogoUrl !== undefined) data.outletLogoUrl = dto.outletLogoUrl;
    if (dto.externalUrl !== undefined) data.externalUrl = dto.externalUrl;
    if (dto.metaTitle !== undefined) data.metaTitle = dto.metaTitle;
    if (dto.metaDescription !== undefined)
      data.metaDescription = dto.metaDescription;
    if (dto.ogImage !== undefined) data.ogImageUrl = dto.ogImage;
    if (dto.canonicalUrl !== undefined) data.canonicalUrl = dto.canonicalUrl;
    if (dto.noindex !== undefined) data.noindex = dto.noindex;
    if (dto.status !== undefined) {
      data.status = dto.status as Prisma.NewsPostUpdateInput["status"];
      data.publishedAt = this.statusPublishedAt(
        dto.status,
        existing.publishedAt,
      );
    }
    if (dto.publishedAt !== undefined)
      data.publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : null;
    if (dto.coverImage)
      data.coverImageUrl =
        (await resolveImageUrl(
          this.cloudinary,
          dto.coverImage,
          `news/${id}`,
        )) ?? "";
    if (dto.authorId !== undefined)
      data.author = dto.authorId
        ? { connect: { id: dto.authorId } }
        : { disconnect: true };
    if (dto.categoryId !== undefined)
      data.category = dto.categoryId
        ? { connect: { id: dto.categoryId } }
        : { disconnect: true };
    const updated = await prisma.newsPost.update({ where: { id }, data });
    this.revalidateWebsite("news");
    return updated;
  }

  async adminDeleteNews(id: string) {
    await prisma.newsPost.delete({ where: { id } });
    return { deleted: true };
  }

  // ─────────────────────────────────────────────
  // ADMIN — Job teams + postings + applications
  // ─────────────────────────────────────────────

  adminListJobTeams() {
    return prisma.jobTeam.findMany({ orderBy: { name: "asc" } });
  }

  async adminCreateJobTeam(dto: CreateJobTeamDto) {
    const slug = await this.uniqueSlug(dto.slug || dto.name, (s) =>
      prisma.jobTeam.findUnique({ where: { slug: s } }).then(Boolean),
    );
    return prisma.jobTeam.create({
      data: { name: dto.name, slug, description: dto.description ?? "" },
    });
  }

  async adminUpdateJobTeam(id: string, dto: UpdateJobTeamDto) {
    const existing = await prisma.jobTeam.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Team not found");
    return prisma.jobTeam.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.slug !== undefined ? { slug: slugify(dto.slug) } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
      },
    });
  }

  async adminDeleteJobTeam(id: string) {
    await prisma.jobTeam.delete({ where: { id } });
    return { deleted: true };
  }

  adminListJobs() {
    return prisma.jobPosting.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        team: { select: { name: true } },
        _count: { select: { applications: true } },
      },
    });
  }

  adminGetJob(id: string) {
    return prisma.jobPosting.findUnique({
      where: { id },
      include: { team: true },
    });
  }

  async adminCreateJob(dto: CreateJobPostingDto) {
    const slug = await this.uniqueSlug(dto.slug || dto.title, (s) =>
      prisma.jobPosting.findUnique({ where: { slug: s } }).then(Boolean),
    );
    const status = (dto.status ??
      "DRAFT") as Prisma.JobPostingCreateInput["status"];
    return prisma.jobPosting.create({
      data: {
        title: dto.title,
        slug,
        ...(dto.teamId ? { team: { connect: { id: dto.teamId } } } : {}),
        location: dto.location ?? "",
        jobType: (dto.jobType ??
          "FULL_TIME") as Prisma.JobPostingCreateInput["jobType"],
        workMode: (dto.workMode ??
          "ON_SITE") as Prisma.JobPostingCreateInput["workMode"],
        status,
        summary: dto.summary ?? "",
        bodyMd: dto.bodyMd ?? "",
        salaryNote: dto.salaryNote ?? "",
        postedAt:
          status === "OPEN"
            ? dto.postedAt
              ? new Date(dto.postedAt)
              : new Date()
            : dto.postedAt
              ? new Date(dto.postedAt)
              : null,
        closesAt: dto.closesAt ? new Date(dto.closesAt) : null,
        metaTitle: dto.metaTitle ?? "",
        metaDescription: dto.metaDescription ?? "",
        noindex: dto.noindex ?? false,
      },
    });
  }

  async adminUpdateJob(id: string, dto: UpdateJobPostingDto) {
    const existing = await prisma.jobPosting.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Role not found");
    const data: Prisma.JobPostingUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.slug !== undefined) data.slug = slugify(dto.slug);
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.jobType !== undefined)
      data.jobType = dto.jobType as Prisma.JobPostingUpdateInput["jobType"];
    if (dto.workMode !== undefined)
      data.workMode = dto.workMode as Prisma.JobPostingUpdateInput["workMode"];
    if (dto.summary !== undefined) data.summary = dto.summary;
    if (dto.bodyMd !== undefined) data.bodyMd = dto.bodyMd;
    if (dto.salaryNote !== undefined) data.salaryNote = dto.salaryNote;
    if (dto.metaTitle !== undefined) data.metaTitle = dto.metaTitle;
    if (dto.metaDescription !== undefined)
      data.metaDescription = dto.metaDescription;
    if (dto.noindex !== undefined) data.noindex = dto.noindex;
    if (dto.closesAt !== undefined)
      data.closesAt = dto.closesAt ? new Date(dto.closesAt) : null;
    if (dto.status !== undefined) {
      data.status = dto.status as Prisma.JobPostingUpdateInput["status"];
      if (dto.status === "OPEN" && !existing.postedAt)
        data.postedAt = new Date();
    }
    if (dto.postedAt !== undefined)
      data.postedAt = dto.postedAt ? new Date(dto.postedAt) : null;
    if (dto.teamId !== undefined)
      data.team = dto.teamId
        ? { connect: { id: dto.teamId } }
        : { disconnect: true };
    const updated = await prisma.jobPosting.update({ where: { id }, data });
    this.revalidateWebsite("jobs");
    return updated;
  }

  async adminDeleteJob(id: string) {
    await prisma.jobPosting.delete({ where: { id } });
    return { deleted: true };
  }

  adminListApplications(q: { jobId?: string; status?: string }) {
    return prisma.jobApplication.findMany({
      where: {
        ...(q.jobId ? { jobId: q.jobId } : {}),
        ...(q.status
          ? { status: q.status as Prisma.JobApplicationWhereInput["status"] }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { job: { select: { title: true, slug: true } } },
    });
  }

  adminGetApplication(id: string) {
    return prisma.jobApplication.findUnique({
      where: { id },
      include: { job: { select: { title: true, slug: true } } },
    });
  }

  async adminUpdateApplicationStatus(
    id: string,
    dto: UpdateApplicationStatusDto,
    reviewerId?: string,
  ) {
    const existing = await prisma.jobApplication.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Application not found");
    return prisma.jobApplication.update({
      where: { id },
      data: {
        status: dto.status as Prisma.JobApplicationUpdateInput["status"],
        ...(dto.adminNotes !== undefined ? { adminNotes: dto.adminNotes } : {}),
        reviewedById: reviewerId ?? existing.reviewedById,
        reviewedAt: new Date(),
      },
    });
  }

  // ─────────────────────────────────────────────
  // ADMIN — Landing pages
  // ─────────────────────────────────────────────

  adminListLanding() {
    return prisma.landingPage.findMany({ orderBy: { updatedAt: "desc" } });
  }

  adminGetLanding(id: string) {
    return prisma.landingPage.findUnique({ where: { id } });
  }

  async adminCreateLanding(dto: CreateLandingPageDto) {
    const slug = await this.uniqueSlug(dto.slug || dto.h1, (s) =>
      prisma.landingPage.findUnique({ where: { slug: s } }).then(Boolean),
    );
    return prisma.landingPage.create({
      data: {
        h1: dto.h1,
        slug,
        kind: (dto.kind ?? "TOPIC") as Prisma.LandingPageCreateInput["kind"],
        intro: dto.intro ?? "",
        bodyMd: dto.bodyMd ?? "",
        status: (dto.status ??
          "DRAFT") as Prisma.LandingPageCreateInput["status"],
        publishedAt: this.statusPublishedAt(
          dto.status,
          dto.publishedAt ? new Date(dto.publishedAt) : null,
        ),
        metaTitle: dto.metaTitle ?? "",
        metaDescription: dto.metaDescription ?? "",
        ogImageUrl: dto.ogImage ?? "",
        noindex: dto.noindex ?? false,
      },
    });
  }

  async adminUpdateLanding(id: string, dto: UpdateLandingPageDto) {
    const existing = await prisma.landingPage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Page not found");
    const data: Prisma.LandingPageUpdateInput = {};
    if (dto.h1 !== undefined) data.h1 = dto.h1;
    if (dto.slug !== undefined) data.slug = slugify(dto.slug);
    if (dto.kind !== undefined)
      data.kind = dto.kind as Prisma.LandingPageUpdateInput["kind"];
    if (dto.intro !== undefined) data.intro = dto.intro;
    if (dto.bodyMd !== undefined) data.bodyMd = dto.bodyMd;
    if (dto.metaTitle !== undefined) data.metaTitle = dto.metaTitle;
    if (dto.metaDescription !== undefined)
      data.metaDescription = dto.metaDescription;
    if (dto.ogImage !== undefined) data.ogImageUrl = dto.ogImage;
    if (dto.noindex !== undefined) data.noindex = dto.noindex;
    if (dto.status !== undefined) {
      data.status = dto.status as Prisma.LandingPageUpdateInput["status"];
      data.publishedAt = this.statusPublishedAt(
        dto.status,
        existing.publishedAt,
      );
    }
    if (dto.publishedAt !== undefined)
      data.publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : null;
    const updated = await prisma.landingPage.update({ where: { id }, data });
    this.revalidateWebsite("landing");
    return updated;
  }

  async adminDeleteLanding(id: string) {
    await prisma.landingPage.delete({ where: { id } });
    return { deleted: true };
  }
}
