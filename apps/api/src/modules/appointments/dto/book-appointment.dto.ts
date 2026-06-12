import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Booking payload. Mirrors what the patient app's confirm screen sends; the
 * service applies pricing, coupons and membership benefits server-side.
 * date/time are optional because INSTANT consults derive them from "now".
 */
export class BookAppointmentDto {
  @IsString()
  doctorId!: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  time?: string;

  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsString()
  subPatientId?: string;

  @IsIn(["ONLINE", "CLINIC"])
  type!: "ONLINE" | "CLINIC";

  @IsOptional()
  @IsIn(["INSTANT", "SCHEDULED"])
  mode?: "INSTANT" | "SCHEDULED";

  @IsOptional()
  @IsIn(["WALLET", "PAYSTACK"])
  paymentMethod?: "WALLET" | "PAYSTACK";

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;

  @IsOptional()
  @IsString()
  referralId?: string;
}
