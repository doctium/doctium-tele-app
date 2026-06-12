import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().optional(),
  mobile: z.string().min(10).max(15),
  password: z.string().min(8).max(64).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  dob: z.string().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email().optional(),
  mobile: z.string().optional(),
  password: z.string().min(1),
}).refine((d) => d.email ?? d.mobile, { message: 'email or mobile required' });

export const OtpVerifySchema = z.object({
  mobile: z.string().min(10),
  otp: z.string().length(6),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type OtpVerifyInput = z.infer<typeof OtpVerifySchema>;
