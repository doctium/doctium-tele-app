import { z } from 'zod';

export const BookAppointmentSchema = z.object({
  doctorId: z.string().cuid(),
  serviceId: z.string().cuid().optional(),
  subPatientId: z.string().cuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string(),
  type: z.enum(['ONLINE', 'CLINIC']),
  paymentGateway: z.enum(['RAZORPAY', 'STRIPE', 'FLUTTERWAVE', 'WALLET']),
  couponCode: z.string().optional(),
  details: z.string().optional(),
});

export const CancelAppointmentSchema = z.object({
  reason: z.string().min(1).max(500),
});

export type BookAppointmentInput = z.infer<typeof BookAppointmentSchema>;
export type CancelAppointmentInput = z.infer<typeof CancelAppointmentSchema>;
