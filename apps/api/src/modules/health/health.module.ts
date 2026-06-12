import { Injectable, Module, OnApplicationShutdown } from "@nestjs/common";
import { prisma } from "@doctium/database";
import { HealthController } from "./health.controller";

/**
 * Closes the shared Prisma connection pool when Nest shuts down, so rolling
 * deploys and SIGTERM don't leak database connections. Relies on
 * app.enableShutdownHooks() being called in bootstrap.
 */
@Injectable()
class PrismaShutdown implements OnApplicationShutdown {
  async onApplicationShutdown() {
    await prisma.$disconnect();
  }
}

@Module({
  controllers: [HealthController],
  providers: [PrismaShutdown],
})
export class HealthModule {}
