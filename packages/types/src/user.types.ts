export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  image: string;
  gender: string;
  dob: string;
  country: string;
  isBlock: boolean;
  isDelete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubPatient {
  id: string;
  userId: string;
  name: string;
  gender: string;
  relation: string;
  age?: number;
  image?: string;
}

export interface UserWallet {
  id: string;
  userId: string;
  balance: number;
}

export type LoginType = 'EMAIL_PASSWORD' | 'GOOGLE' | 'MOBILE' | 'APPLE';
