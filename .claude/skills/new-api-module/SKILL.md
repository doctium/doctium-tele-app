---
name: new-api-module
description: Scaffold a new NestJS feature module in the Doctium API (apps/api/src/modules) following project conventions — controller/service/module/DTOs, the shared prisma singleton, the global {status,message,data} envelope, JWT/Roles guards, and Swagger tags. Use when adding a new API feature, module, resource, or set of endpoints to apps/api.
---

# New API Module (Doctium)

Scaffold a feature module that matches how every existing module in `apps/api/src/modules/` is built. Mirror these conventions exactly.

## Conventions (verified against the codebase)

- **Location**: `apps/api/src/modules/<feature>/`
- **Files**: `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`, and a `dto/` folder with an `index.ts` barrel (only if there are request bodies).
- **Global prefix**: all routes are served under `api/v1` (set in `main.ts`). Use the bare resource path, e.g. `@Controller('regions')` → `/api/v1/regions`.
- **Response envelope**: do NOT wrap responses. `ResponseInterceptor` (`common/interceptors/response.interceptor.ts`) wraps every return value as `{ status, message, data }` globally. Just return the raw data.
- **Database**: import the shared singleton — `import { prisma } from '@doctium/database';` — and call `prisma.<model>...` directly. Do NOT inject a PrismaService and do NOT `new PrismaClient()`.
- **Soft delete / flags**: respect existing flags like `isDelete`, `isBlock`, `isActive` in `where` clauses.
- **Auth**: protect endpoints with `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('user' | 'doctor' | 'admin')`, read the caller with `@CurrentUser()`, and add `@ApiBearerAuth()`.
- **Swagger**: every controller gets `@ApiTags('<Name>')`.
- **Validation**: request DTOs use `class-validator` decorators; shared schemas live in `packages/validation` (zod). Reuse a zod schema there if the shape is also used by the apps.

## Import map (copy these exact paths)

```ts
import { prisma } from '@doctium/database';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
```

## Steps

1. Confirm: feature name (kebab + Pascal), resource route, Prisma model(s) it touches, and which roles may call each endpoint.
2. Create the files from the templates below.
3. Register the module in `apps/api/src/app.module.ts` (add `<Feature>Module` to the `imports` array) — without this the routes won't mount.
4. If endpoints accept a body, add DTOs in `dto/` and export them from `dto/index.ts`.
5. Run `npm run typecheck` (or `npx turbo typecheck --filter=api`) and fix errors.

## Templates

### `<feature>.module.ts`
```ts
import { Module } from '@nestjs/common';
import { <Feature>Controller } from './<feature>.controller';
import { <Feature>Service } from './<feature>.service';

@Module({
  controllers: [<Feature>Controller],
  providers: [<Feature>Service],
  exports: [<Feature>Service], // only if another module injects it
})
export class <Feature>Module {}
```

### `<feature>.service.ts`
```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@doctium/database';
import { Create<Feature>Dto } from './dto';

@Injectable()
export class <Feature>Service {
  list() {
    return prisma.<model>.findMany({
      where: { isDelete: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const item = await prisma.<model>.findFirst({ where: { id, isDelete: false } });
    if (!item) throw new NotFoundException('<Feature> not found');
    return item;
  }

  create(userId: string, dto: Create<Feature>Dto) {
    return prisma.<model>.create({ data: { ...dto /*, userId */ } });
  }
}
```

### `<feature>.controller.ts`
```ts
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { <Feature>Service } from './<feature>.service';
import { Create<Feature>Dto } from './dto';

@ApiTags('<Feature>')
@Controller('<route>')
export class <Feature>Controller {
  constructor(private readonly <feature>: <Feature>Service) {}

  @Get()
  list() {
    return this.<feature>.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.<feature>.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  create(@CurrentUser() user: { id: string }, @Body() dto: Create<Feature>Dto) {
    return this.<feature>.create(user.id, dto);
  }
}
```

### `dto/create-<feature>.dto.ts`
```ts
import { IsInt, IsOptional, IsString } from 'class-validator';

export class Create<Feature>Dto {
  @IsString() name!: string;
  @IsOptional() @IsInt() order?: number;
}
```

### `dto/index.ts`
```ts
export * from './create-<feature>.dto';
```

## Don't
- Don't manually return `{ status, message, data }` — the interceptor does it.
- Don't inject a PrismaService or instantiate `PrismaClient` — always import the shared `prisma`.
- Don't forget to add the module to `app.module.ts` imports.
