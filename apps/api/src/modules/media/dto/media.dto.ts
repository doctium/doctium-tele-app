import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
} from "class-validator";

export const CONTENT_STATUS = [
  "DRAFT",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
] as const;
export const NEWS_KIND = ["ANNOUNCEMENT", "COVERAGE"] as const;
export const JOB_TYPE = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "INTERNSHIP",
] as const;
export const WORK_MODE = ["ON_SITE", "HYBRID", "REMOTE"] as const;
export const JOB_STATUS = ["DRAFT", "OPEN", "CLOSED"] as const;
export const APPLICATION_STATUS = [
  "NEW",
  "REVIEWING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
] as const;
export const LANDING_KIND = [
  "CONDITION",
  "SPECIALTY",
  "CITY",
  "TOPIC",
] as const;

/* ── Author ─────────────────────────────────────────── */
export class CreateAuthorDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsString() @IsOptional() slug?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() role?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() bioMd?: string;
  /** Data-URL or hosted URL. */
  @ApiPropertyOptional() @IsString() @IsOptional() avatar?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() linkedinUrl?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() xUrl?: string;
}
export class UpdateAuthorDto extends CreateAuthorDto {
  @ApiPropertyOptional() @IsString() @IsOptional() declare name: string;
}

/* ── Category (blog + news share the shape) ─────────── */
export class CreateCategoryDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsString() @IsOptional() slug?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
}
export class UpdateCategoryDto {
  @ApiPropertyOptional() @IsString() @IsOptional() name?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() slug?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
}

/* ── Blog post ──────────────────────────────────────── */
export class CreateBlogPostDto {
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsString() @IsOptional() slug?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() excerpt?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() bodyMd?: string;
  /** Cover image: data-URL or hosted URL. */
  @ApiPropertyOptional() @IsString() @IsOptional() coverImage?: string;
  @ApiPropertyOptional({ enum: CONTENT_STATUS })
  @IsIn(CONTENT_STATUS)
  @IsOptional()
  status?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() publishedAt?: string;
  @ApiPropertyOptional() @IsInt() @IsOptional() readingMins?: number;
  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
  @ApiPropertyOptional() @IsString() @IsOptional() authorId?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categoryIds?: string[];
  // SEO
  @ApiPropertyOptional() @IsString() @IsOptional() metaTitle?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() metaDescription?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() ogImage?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() canonicalUrl?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() noindex?: boolean;
}
export class UpdateBlogPostDto extends CreateBlogPostDto {
  @ApiPropertyOptional() @IsString() @IsOptional() declare title: string;
}

/* ── News post ──────────────────────────────────────── */
export class CreateNewsPostDto {
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsString() @IsOptional() slug?: string;
  @ApiPropertyOptional({ enum: NEWS_KIND })
  @IsIn(NEWS_KIND)
  @IsOptional()
  kind?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() excerpt?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() bodyMd?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() coverImage?: string;
  @ApiPropertyOptional({ enum: CONTENT_STATUS })
  @IsIn(CONTENT_STATUS)
  @IsOptional()
  status?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() publishedAt?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() authorId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() categoryId?: string;
  // COVERAGE-only
  @ApiPropertyOptional() @IsString() @IsOptional() outlet?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() outletLogoUrl?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() externalUrl?: string;
  // SEO
  @ApiPropertyOptional() @IsString() @IsOptional() metaTitle?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() metaDescription?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() ogImage?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() canonicalUrl?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() noindex?: boolean;
}
export class UpdateNewsPostDto extends CreateNewsPostDto {
  @ApiPropertyOptional() @IsString() @IsOptional() declare title: string;
}

/* ── Job team ───────────────────────────────────────── */
export class CreateJobTeamDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsString() @IsOptional() slug?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
}
export class UpdateJobTeamDto extends CreateJobTeamDto {
  @ApiPropertyOptional() @IsString() @IsOptional() declare name: string;
}

/* ── Job posting ────────────────────────────────────── */
export class CreateJobPostingDto {
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsString() @IsOptional() slug?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() teamId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() location?: string;
  @ApiPropertyOptional({ enum: JOB_TYPE })
  @IsIn(JOB_TYPE)
  @IsOptional()
  jobType?: string;
  @ApiPropertyOptional({ enum: WORK_MODE })
  @IsIn(WORK_MODE)
  @IsOptional()
  workMode?: string;
  @ApiPropertyOptional({ enum: JOB_STATUS })
  @IsIn(JOB_STATUS)
  @IsOptional()
  status?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() summary?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() bodyMd?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() salaryNote?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() postedAt?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() closesAt?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() metaTitle?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() metaDescription?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() noindex?: boolean;
}
export class UpdateJobPostingDto extends CreateJobPostingDto {
  @ApiPropertyOptional() @IsString() @IsOptional() declare title: string;
}

/* ── Job application (public submission) ────────────── */
export class CreateJobApplicationDto {
  @ApiProperty() @IsString() fullName: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiPropertyOptional() @IsString() @IsOptional() phone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() linkedinUrl?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() portfolioUrl?: string;
  /** CV as a data-URL (PDF/Word), <=5MB. */
  @ApiPropertyOptional() @IsString() @IsOptional() cv?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() cvFileName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() coverNote?: string;
  @ApiProperty() @IsBoolean() consent: boolean;
  /** Honeypot — must stay empty (bots fill it). */
  @ApiPropertyOptional() @IsString() @IsOptional() website?: string;
}
export class UpdateApplicationStatusDto {
  @ApiProperty({ enum: APPLICATION_STATUS })
  @IsIn(APPLICATION_STATUS)
  status: string;
  @ApiPropertyOptional() @IsString() @IsOptional() adminNotes?: string;
}

/* ── Landing page (programmatic SEO) ────────────────── */
export class CreateLandingPageDto {
  @ApiProperty() @IsString() h1: string;
  @ApiPropertyOptional() @IsString() @IsOptional() slug?: string;
  @ApiPropertyOptional({ enum: LANDING_KIND })
  @IsIn(LANDING_KIND)
  @IsOptional()
  kind?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() intro?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() bodyMd?: string;
  @ApiPropertyOptional({ enum: CONTENT_STATUS })
  @IsIn(CONTENT_STATUS)
  @IsOptional()
  status?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() publishedAt?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() metaTitle?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() metaDescription?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() ogImage?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() noindex?: boolean;
}
export class UpdateLandingPageDto extends CreateLandingPageDto {
  @ApiPropertyOptional() @IsString() @IsOptional() declare h1: string;
}

/* ── Team member ────────────────────────────────────── */
export class CreateTeamMemberDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsString() @IsOptional() slug?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() role?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() bioMd?: string;
  /** Avatar: data-URL or hosted URL. */
  @ApiPropertyOptional() @IsString() @IsOptional() avatar?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() linkedinUrl?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() xUrl?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() group?: string;
  @ApiPropertyOptional() @IsInt() @IsOptional() sortOrder?: number;
  @ApiPropertyOptional({ enum: CONTENT_STATUS })
  @IsIn(CONTENT_STATUS)
  @IsOptional()
  status?: string;
}
export class UpdateTeamMemberDto extends CreateTeamMemberDto {
  @ApiPropertyOptional() @IsString() @IsOptional() declare name: string;
}
