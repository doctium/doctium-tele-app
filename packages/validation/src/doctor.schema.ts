import { z } from 'zod';

export const UpdateDoctorProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  image: z.string().url().optional(),
  designation: z.string().optional(),
  education: z.string().optional(),
  yourSelf: z.string().max(1000).optional(),
  clinicName: z.string().optional(),
  address: z.string().optional(),
  experience: z.number().int().min(0).optional(),
  type: z.enum(['ONLINE', 'CLINIC', 'BOTH']).optional(),
  charge: z.number().positive().optional(),
  degree: z.array(z.string()).optional(),
  language: z.array(z.string()).optional(),
  awards: z.array(z.string()).optional(),
  expertise: z.array(z.string()).optional(),
});

export const DoctorScheduleSchema = z.object({
  day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
  startTime: z.string(),
  endTime: z.string(),
  breakStartTime: z.string().optional().default(''),
  breakEndTime: z.string().optional().default(''),
  timeSlot: z.number().int().default(30),
  isBreak: z.boolean().default(false),
});

export type UpdateDoctorProfileInput = z.infer<typeof UpdateDoctorProfileSchema>;
export type DoctorScheduleInput = z.infer<typeof DoctorScheduleSchema>;
