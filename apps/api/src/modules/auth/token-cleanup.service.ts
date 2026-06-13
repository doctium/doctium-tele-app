import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { prisma } from "@doctium/database";

/**
 * Prunes the refresh_tokens table so it doesn't grow unbounded. Rows are safe to
 * delete once expired (and revoked rows a bit after, since reuse detection only
 * needs them while the family could still be replayed within its TTL).
 */
@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name);

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpired() {
    const { count } = await prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (count > 0) this.logger.log(`Purged ${count} expired refresh token(s)`);
  }
}
