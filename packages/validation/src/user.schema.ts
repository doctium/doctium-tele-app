import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  image: z.string().url().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  dob: z.string().optional(),
  bio: z.string().max(500).optional(),
  country: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
});

export const SubPatientSchema = z.object({
  name: z.string().min(2),
  gender: z.enum(['male', 'female', 'other']),
  relation: z.string().min(1),
  age: z.number().int().positive().optional(),
  image: z.string().url().optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type SubPatientInput = z.infer<typeof SubPatientSchema>;
