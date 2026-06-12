import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtPayload } from "@doctium/types";
import { PERMISSIONS_KEY } from "../../../common/decorators/permissions.decorator";

/**
 * Fine-grained RBAC: allows the request if the admin (Employee) principal is a super-admin, or holds
 * ALL the permission keys required by `@Permissions(...)`. No decorator → no permission gate (still
 * subject to `@Roles('admin')`). `permissions`/`isSuperAdmin` are attached live by the JWT strategy.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    if (user?.isSuperAdmin) return true;

    const held = user?.permissions ?? [];
    const ok = required.every((p) => held.includes(p));
    if (!ok)
      throw new ForbiddenException(
        "You do not have permission for this action",
      );
    return true;
  }
}
