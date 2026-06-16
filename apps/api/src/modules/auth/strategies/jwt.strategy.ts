import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Request } from "express";
import { JwtPayload, ALL_PERMISSIONS } from "@doctium/types";
import { prisma } from "@doctium/database";
import { requireEnv } from "../../../common/env";
import { ADMIN_COOKIE, parseCookies } from "../../../common/cookie.util";
import { isSuperAdminRole } from "../../../common/rbac.util";

/** Admin browser sends the JWT as an httpOnly cookie; mobile sends a Bearer header. */
const cookieExtractor = (req: Request): string | null => {
  return parseCookies(req?.headers?.cookie)[ADMIN_COOKIE] ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor,
      ]),
      ignoreExpiration: false,
      secretOrKey: requireEnv("JWT_SECRET"),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const { sub, role } = payload;

    if (role === "user") {
      const user = await prisma.user.findUnique({ where: { id: sub } });
      if (!user || user.isDelete || user.isBlock)
        throw new UnauthorizedException();
    } else if (role === "doctor") {
      const doctor = await prisma.doctor.findUnique({ where: { id: sub } });
      if (!doctor || doctor.isDelete || doctor.isBlock)
        throw new UnauthorizedException();
    } else if (role === "admin") {
      // Admin principals are Employees with panel access; load live RBAC permissions onto request.user.
      const employee = await prisma.employee.findUnique({
        where: { id: sub },
        include: { role: true },
      });
      if (!employee || !employee.isActive || !employee.canLogin)
        throw new UnauthorizedException();
      const isSuper =
        employee.isSuperAdmin || isSuperAdminRole(employee.role?.name);
      const permissions = isSuper
        ? ALL_PERMISSIONS
        : (employee.role?.permissions ?? []);
      return { ...payload, permissions, isSuperAdmin: isSuper };
    }

    return payload;
  }
}
