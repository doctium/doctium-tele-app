import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Like JwtAuthGuard, but never rejects an anonymous request. When a valid
 * Bearer token is present `request.user` is populated; otherwise it stays
 * undefined and the request proceeds. Used by public feeds (e.g. MediGram)
 * that want per-user context (likedByMe, mine) only when signed in.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // Swallow auth failures — anonymous access is allowed.
    }
    return true;
  }

  // Don't throw when passport reports no/invalid user; just return undefined.
  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
    return user || (undefined as unknown as TUser);
  }
}
