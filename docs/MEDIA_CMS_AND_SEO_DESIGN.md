# Doctium — Media/CMS Module + Website SEO — Design & Scoping

**Status:** Design proposed 2026-06-16. Awaiting approval before build.
**Spans 3 codebases:** `doctium-app/apps/api` (CMS backend) · `doctium-app/apps/admin-panel` (authoring) · `doctium-website` (public pages + SEO).

---

## 1. Understanding Summary

- **What:** An in-house **Media/Content module** in the doctium-app admin that lets the team publish **Blog**, **News & Press**, and **Careers** content, which the public **doctium-website** renders as `/blog`, `/newsroom`, and `/careers` — plus a **robust SEO system** designed to maximize Doctium's visibility for healthcare / AI-in-healthcare / telemedicine / hospital-EHR searches in Nigeria.
- **Why:** The website is currently static (content in `src/content/*.ts`). A CMS gives non-engineers a publishing workflow, and the blog/newsroom + programmatic pages become the **content engine** that actually earns search rankings.
- **Who:** Marketing/content editors (authoring), the public (readers + job applicants), and the talent team (reviewing applications).
- **Confirmed decisions:** in-house CMS · careers with built-in apply form + CV upload + applicant inbox · News & Press incl. external coverage + press kit · dedicated Author model · programmatic SEO pages · **Markdown** authoring · English-only · one design pass → 3-phase build.

## 2. Architecture (3 layers)

```
ADMIN (apps/admin-panel)            API (apps/api, /api/v1)                 WEBSITE (doctium-website)
"Content" sidebar group       ──▶   /admin/media/*  (JWT + RBAC, write)
 Markdown editor, image up.          media module (banners-style)
 Applications inbox + CSV            /media/*  (public, published-only) ──▶  ISR fetch (server components)
        │ on publish ─────────────▶  triggers ─────────────────────────▶   POST /api/revalidate (secret)
        ▼                            Neon Postgres (Prisma)                 /blog /newsroom /careers + programmatic
   audit log                        Cloudinary (images + CV raw)            dynamic sitemap + RSS + JSON-LD
```

**Key integration:** the website gains a typed fetcher (`lib/api.ts`, base `NEXT_PUBLIC_API_URL=https://api.doctiumhealth.com/api/v1`), fetches **published** content via the public endpoints with **ISR** (time-based + tag revalidation), and exposes a secret `/api/revalidate` route the admin calls on publish so content goes live without a redeploy. Drafts are viewable via Next **draft mode** (preview).

## 3. Data model (Prisma — `packages/database/prisma/schema.prisma`)

Conventions matched: `@id @default(cuid())`, `createdAt`/`updatedAt`, status enums, unique slugs, implicit m2m for categories, embedded SEO fields. New enums + models:

```prisma
enum ContentStatus { DRAFT SCHEDULED PUBLISHED ARCHIVED }
enum NewsType      { ANNOUNCEMENT COVERAGE }   // COVERAGE = external press mention
enum JobType       { FULL_TIME PART_TIME CONTRACT INTERNSHIP }
enum WorkMode      { ON_SITE HYBRID REMOTE }
enum JobStatus     { DRAFT OPEN CLOSED }
enum ApplicationStatus { NEW REVIEWING INTERVIEW OFFER HIRED REJECTED }
enum LandingKind   { CONDITION SPECIALTY CITY TOPIC }

model Author       { id, name, slug @unique, role, bioMd?, avatarUrl?, linkedinUrl?, xUrl?, posts BlogPost[], news NewsPost[], timestamps }
model BlogCategory { id, name, slug @unique, description?, posts BlogPost[] (m2m), timestamps }
model BlogPost     { id, title, slug @unique, excerpt, bodyMd, coverImageUrl?, status, publishedAt?, readingMins?,
                     authorId?, categories BlogCategory[] (m2m), tags String[], // SEO:
                     metaTitle?, metaDescription?, ogImageUrl?, canonicalUrl?, noindex @default(false), timestamps }
model NewsCategory { id, name, slug @unique, posts NewsPost[] }
model NewsPost     { id, title, slug @unique, type NewsType, excerpt, bodyMd?, coverImageUrl?, status, publishedAt?,
                     categoryId?, // COVERAGE-only: outlet?, outletLogoUrl?, externalUrl?
                     metaTitle?, metaDescription?, ogImageUrl?, canonicalUrl?, noindex, timestamps }
model JobTeam      { id, name, slug @unique, description?, jobs JobPosting[] }          // "Teams" / departments
model JobPosting   { id, title, slug @unique, teamId, location, jobType, workMode, status, summary, bodyMd,
                     postedAt?, closesAt?, salaryNote?, // SEO + Google Jobs:
                     metaTitle?, metaDescription?, applications JobApplication[], timestamps }
model JobApplication { id, jobId, fullName, email, phone, linkedinUrl?, portfolioUrl?, cvUrl, cvFileName,
                     coverNote?, consent Boolean, status ApplicationStatus @default(NEW),
                     adminNotes?, reviewedById?, reviewedAt?, createdAt }
model LandingPage  { id, kind LandingKind, slug @unique, h1, intro, bodyMd, status, // programmatic SEO
                     metaTitle?, metaDescription?, ogImageUrl?, noindex, timestamps }
```

> `bodyMd` = Markdown. Rendered on the site with `react-markdown` + `remark-gfm` + `rehype-sanitize`, styled as branded prose. **Migration gotcha (known):** `prisma migrate dev` dies on non-interactive warning prompts → hand-write `migration.sql` + `migrate deploy`.

## 4. API (module `apps/api/src/modules/media/`, banners-style: public + admin controllers)

**Public** (no JWT / `OptionalJwtAuthGuard`, **published-only**, throttled):

```
GET  /media/blog            ?category=&tag=&page=          GET /media/blog/:slug          GET /media/blog/categories
GET  /media/news            ?type=&category=&page=         GET /media/news/:slug          GET /media/news/categories
GET  /media/jobs            ?team=                         GET /media/jobs/:slug          GET /media/jobs/teams
POST /media/jobs/:slug/apply   (public, CV dataURL ≤5MB; rate-limited; honeypot)
GET  /media/landing/:slug                                  GET /media/sitemap-entries     (slugs + lastmod for sitemap/RSS)
```

**Admin** (`JwtAuthGuard` + `RolesGuard` + `PermissionsGuard`, `{status,message,data}` envelope, class-validator DTOs):

```
CRUD /admin/media/blog[/:id]  + POST :id/publish|unpublish|schedule         CRUD /admin/media/blog-categories
CRUD /admin/media/news[/:id]  + publish/unpublish                           CRUD /admin/media/news-categories
CRUD /admin/media/jobs[/:id]  + open/close                                  CRUD /admin/media/teams
GET  /admin/media/applications ?jobId=&status=  · GET :id · PATCH :id/status · GET :id/cv (download) · GET export.csv
CRUD /admin/media/landing-pages
GET  /admin/media/<type>/:id/preview   (draft fetch for website preview mode)
```

Publish mutations fire: **audit log** + **website revalidation webhook** + (applications) **email alert** to the careers inbox (reuses existing comms/email infra; no-op-safe without SMTP).

## 5. RBAC (`packages/types/src/rbac.types.ts` → new `Content` group)

New permission keys: `media.blog.view|manage`, `media.news.view|manage`, `media.careers.view|manage`, `media.applications.view|manage`, `media.seo.manage`. New seeded role **"Content Editor"** holding only `media.*` (no clinical/finance/HR access). Super-admin bypass already covers it. Admin nav/pages gated via existing `can()` / auth-context.

## 6. Admin UI (`apps/admin-panel`, new "Content" sidebar group)

Sub-modules (each = list + create/edit, following the banners/video/comms CRUD + Modal + `lib/csv.ts` patterns, Plus-Jakarta/navy design system, dark-mode tokens):
**Blog Posts · Blog Categories · News & Press · News Categories · Job Postings · Teams · Applications · Landing Pages.**

- **Editor:** Markdown editor (toolbar + live preview), cover/OG image upload (existing dataURL→Cloudinary), SEO fields panel (meta title/description/OG/canonical/slug), status + publish/schedule, author + category pickers.
- **Applications inbox:** list (filter by job/status) → detail (download CV, applicant info, cover note) → status pipeline (NEW→…→HIRED/REJECTED) + admin notes + CSV export.

## 7. Website (`doctium-website`)

- `lib/api.ts` typed fetcher (unwraps `.data`); `NEXT_PUBLIC_API_URL` env.
- Routes: `/blog`, `/blog/[slug]`, `/blog/category/[slug]`, `/newsroom`, `/newsroom/[slug]`, `/careers`, `/careers/[slug]` (job detail + **inline apply form** mirroring the reference: name/email/phone/LinkedIn/portfolio/**CV PDF·Word ≤5MB**/cover note/consent → posts to public apply endpoint), and programmatic landing pages.
- ISR (`revalidate` + cache tags) + secret `/api/revalidate` route (called by admin on publish) + Next **draft mode** preview.
- Markdown → branded prose; **dynamic `sitemap.ts`** (static + blog/news/jobs/landing from `sitemap-entries`); **RSS** for blog + newsroom; Header/Footer get Blog/Newsroom/Careers links (footer mirrors the reference layout).

## 8. SEO blueprint (the "rank in Nigeria" system)

**A. Technical (extends what's already shipped):** canonical URLs; dynamic **OG images** (`next/og`) per post/job; **JSON-LD** per type — `WebSite`+`SearchAction`, `BreadcrumbList`, `BlogPosting`/`Article`, `NewsArticle`, **`JobPosting`** (→ eligible for **Google Jobs** rich results — big for careers), `FAQPage`, `MedicalOrganization`/`MedicalWebPage`; `en-NG` locale; XML sitemap index + RSS; strong CWV (already 154–159 kB).
**B. On-page / content architecture:** pillar→cluster topic model — pillars for _Telemedicine in Nigeria_, _AI in healthcare / hospital EHR_, _Sickle cell care_, _Clinical documentation_ — each surrounded by internally-linked cluster posts; keyword-mapped slugs, semantic headings, descriptive internal links, mandatory alt text.
**C. Local / Nigeria SEO:** `MedicalOrganization` w/ `areaServed: NG` + address; Google Business Profile (your action); NAP consistency; city landing pages (Lagos/Abuja/PH).
**D. Programmatic pages (the long-tail lever):** `LandingPage` model drives condition × city / specialty × city / topic pages ("Online doctor in Lagos", "See a cardiologist online in Nigeria", "Sickle cell care in Nigeria", "Hospital EHR Nigeria"). **Quality gate:** each page must carry genuine unique value (real specialties/FAQs/links) — thin doorway pages get penalized, so this is curated, not mass-spun.
**E. Search Console + measurement:** verify domain (DNS TXT or a meta token I wire into Next metadata) → submit sitemap → monitor. Analytics (GA4 or Plausible) + rank tracking.

**Honest expectation:** code delivers A, the structure for B–D, and the engine. Ranking **#1 for competitive head terms** ("telemedicine Nigeria") additionally needs sustained publishing, backlinks/PR, GBP, and time — none of which code alone guarantees. Deliverable includes a concrete **"how to actually rank" playbook** (cadence, digital-PR via the newsroom, link targets, GBP) for the parts that need you.

## 9. Phased delivery

- **Phase 1 — SEO foundation on the LIVE site** (fast, high ROI, independent): expand JSON-LD, dynamic OG images, `en-NG`, GSC verification + sitemap submission, metadata/internal-link polish, RSS scaffold.
- **Phase 2 — CMS backend:** Prisma models + migration → `media` API module (public + admin) → RBAC perms + Content Editor role → admin "Content" pages + Markdown editor + applications inbox + CSV + email alert + revalidation hook.
- **Phase 3 — Website consumption:** `lib/api` + ISR + preview → `/blog`, `/newsroom`, `/careers` (+ job detail/apply + CV upload + JobPosting schema) → programmatic landing pages → dynamic sitemap/RSS → header/footer → pillar/cluster content scaffolding.

## 10. Decision log

| Decision         | Choice                                        | Why                                                        |
| ---------------- | --------------------------------------------- | ---------------------------------------------------------- |
| CMS              | In-house in doctium-app                       | Consistent w/ NestJS+Prisma+RBAC+Cloudinary; no new vendor |
| Editor           | Markdown (`react-markdown`)                   | Portable, simple, user-chosen                              |
| Careers          | Built-in apply form + CV + inbox/pipeline     | Matches reference; long-term ownership                     |
| News             | Announcements + external coverage + press kit | Full PR surface                                            |
| Authors          | Dedicated Author model                        | Clean public bylines, no staff-data exposure               |
| Programmatic SEO | Yes, curated `LandingPage` system             | Long-tail ranking lever for the Nigeria goal               |
| Delivery         | 1 design pass → 3 phases                      | SEO ships fast; CMS+site follow                            |

## 11. Open items to confirm

1. **GSC verification method** — recommend the **meta-tag token** (I add `verification.google` to Next metadata; you paste the token from Search Console). DNS TXT also fine.
2. **CV storage** — uses Cloudinary `raw` upload (same as KYC docs). Needs Cloudinary creds in prod for real file storage (go-live notes list them as pending); without creds it falls back to data-URL (works but heavy). Recommend enabling Cloudinary before careers goes live.
3. **Application alert recipient** — which inbox/admins get the "new application" email (e.g. `careers@doctiumhealth.com`).
4. **Analytics tool** — GA4 vs Plausible (defer; not blocking).
