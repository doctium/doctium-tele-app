export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
export type AppointmentType = 'ONLINE' | 'CLINIC';
export type PaymentGateway = 'RAZORPAY' | 'STRIPE' | 'FLUTTERWAVE' | 'WALLET';

export interface Appointment {
  id: string;
  appointmentId: string;
  userId: string;
  doctorId: string;
  serviceId?: string;
  subPatientId?: string;
  date: string;
  time: string;
  duration: number;
  status: AppointmentStatus;
  type: AppointmentType;
  paymentGateway?: PaymentGateway;
  amount: number;
  discount: number;
  couponCode?: string;
  adminEarning: number;
  doctorEarning: number;
  isReviewed: boolean;
  isSettled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
