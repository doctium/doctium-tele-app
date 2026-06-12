import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";

async function bootstrap() {
  // rawBody lets the Paystack webhook verify its HMAC signature against the exact bytes.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Leenah voice notes (and data-URL uploads) arrive as base64 JSON — the
  // default 100kb limit is far too small. useBodyParser is Nest's rawBody-aware
  // registration, so the Paystack webhook's exact-bytes HMAC keeps working.
  app.useBodyParser("json", { limit: "10mb" });
  app.useBodyParser("urlencoded", { extended: true, limit: "10mb" });

  app.setGlobalPrefix("api/v1");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Wrap every response as { status, message, data } — the envelope all
  // clients (admin panel + both mobile apps) are coded to unwrap via `.data`.
  app.useGlobalInterceptors(new ResponseInterceptor());

  app.enableCors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://admin.doctium.com", "https://doctium.com"]
        : "*",
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Doctium API")
    .setDescription("Doctium telemedicine platform API")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Doctium API running on http://localhost:${port}/api/v1`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
