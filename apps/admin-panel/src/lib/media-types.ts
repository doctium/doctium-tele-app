// Shared types for the Website & Media (CMS) admin pages. Mirrors the API
// responses from apps/api/src/modules/media.

export type ContentStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
export type NewsKind = "ANNOUNCEMENT" | "COVERAGE";
export type JobType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";
export type WorkMode = "ON_SITE" | "HYBRID" | "REMOTE";
export type JobStatus = "DRAFT" | "OPEN" | "CLOSED";
export type ApplicationStatus =
  | "NEW"
  | "REVIEWING"
  | "INTERVIEW"
  | "OFFER"
  | "HIRED"
  | "REJECTED";
export type LandingKind = "CONDITION" | "SPECIALTY" | "CITY" | "TOPIC";

export interface Author {
  id: string;
  name: string;
  slug: string;
  role: string;
  bioMd: string;
  avatarUrl: string;
  linkedinUrl: string;
  xUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface MediaCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  bodyMd: string;
  coverImageUrl: string;
  status: ContentStatus;
  publishedAt: string | null;
  readingMins: number;
  tags: string[];
  authorId: string | null;
  author?: { name: string } | Author | null;
  categories: MediaCategory[];
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string;
  canonicalUrl: string;
  noindex: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NewsPost {
  id: string;
  title: string;
  slug: string;
  kind: NewsKind;
  excerpt: string;
  bodyMd: string;
  coverImageUrl: string;
  status: ContentStatus;
  publishedAt: string | null;
  authorId: string | null;
  categoryId: string | null;
  category?: { name: string } | MediaCategory | null;
  outlet: string;
  outletLogoUrl: string;
  externalUrl: string;
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string;
  canonicalUrl: string;
  noindex: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JobTeam {
  id: string;
  name: string;
  slug: string;
  description: string;
}

export interface JobPosting {
  id: string;
  title: string;
  slug: string;
  teamId: string | null;
  team?: { name: string } | JobTeam | null;
  location: string;
  jobType: JobType;
  workMode: WorkMode;
  status: JobStatus;
  summary: string;
  bodyMd: string;
  salaryNote: string;
  postedAt: string | null;
  closesAt: string | null;
  metaTitle: string;
  metaDescription: string;
  noindex: boolean;
  _count?: { applications: number };
  createdAt: string;
  updatedAt: string;
}

export interface JobApplication {
  id: string;
  jobId: string;
  job?: { title: string; slug: string } | null;
  fullName: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  portfolioUrl: string;
  cvUrl: string;
  cvFileName: string;
  coverNote: string;
  consent: boolean;
  status: ApplicationStatus;
  adminNotes: string;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface LandingPage {
  id: string;
  kind: LandingKind;
  slug: string;
  h1: string;
  intro: string;
  bodyMd: string;
  status: ContentStatus;
  publishedAt: string | null;
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string;
  noindex: boolean;
  createdAt: string;
  updatedAt: string;
}

export const CONTENT_STATUSES: ContentStatus[] = [
  "DRAFT",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
];
export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "NEW",
  "REVIEWING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
];
