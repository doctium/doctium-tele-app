export type DoctorType = 'ONLINE' | 'CLINIC' | 'BOTH';

export interface DoctorSchedule {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  breakStartTime: string;
  breakEndTime: string;
  timeSlot: number;
  isBreak: boolean;
}

export interface Doctor {
  id: string;
  name: string;
  email: string;
  mobile: string;
  image: string;
  designation: string;
  education: string;
  yourSelf: string;
  experience: number;
  type: DoctorType;
  charge: number;
  rating: number;
  reviewCount: number;
  degree: string[];
  language: string[];
  awards: string[];
  expertise: string[];
  schedule: DoctorSchedule[];
  isBlock: boolean;
  isOnline: boolean;
  createdAt: Date;
  updatedAt: Date;
}
