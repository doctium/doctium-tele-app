import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { prisma } from "@doctium/database";

/**
 * Unauthenticated probes for load balancers / orchestrators.
 * Throttling is skipped because health checks poll frequently by design.
 */
@ApiTags("Health")
@SkipThrottle()
@Controller("health")
export class HealthController {
  /** Liveness — the process is up and serving. */
  @Get()
  live() {
    return { status: "ok", uptime: process.uptime() };
  }

  /** Readiness — the process can reach its database and take traffic. */
  @Get("ready")
  async ready() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok", db: "up" };
    } catch {
      return { status: "degraded", db: "down" };
    }
  }
}
