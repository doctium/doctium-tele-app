import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PharmacyService } from './pharmacy.service';

/** Guards partner-facing pharmacy endpoints with the `x-api-key` header. */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly pharmacy: PharmacyService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const provided = req.headers['x-api-key'];
    const expected = await this.pharmacy.apiKey();
    if (!expected) throw new UnauthorizedException('Pharmacy API is not configured');
    if (!provided || provided !== expected) throw new UnauthorizedException('Invalid API key');
    return true;
  }
}
