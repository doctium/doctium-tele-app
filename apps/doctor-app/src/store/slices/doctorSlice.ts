import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { doctorApi } from "../../api/doctor.api";

export interface DoctorProfile {
  id: string;
  name: string;
  email: string;
  mobile: string;
  image?: string;
  bannerImage?: string;
  yourSelf?: string;
  designation: string;
  experience: number;
  rating: number;
  reviewCount: number;
  charge: number;
  language?: string[];
  wallet?: { balance: number; total: number };
}
export interface State {
  profile: DoctorProfile | null;
  appointments: unknown[];
  loading: boolean;
}
const initial: State = { profile: null, appointments: [], loading: false };

export const fetchDoctorProfile = createAsyncThunk("doctor/profile", () =>
  doctorApi
    .getProfile()
    .then((r: unknown) => (r as { data: DoctorProfile }).data),
);

export const fetchDoctorAppointments = createAsyncThunk(
  "doctor/appointments",
  (status?: string) =>
    doctorApi
      .getAppointments(status)
      .then((r: unknown) => (r as { data: unknown[] }).data),
);

const slice = createSlice({
  name: "doctor",
  initialState: initial,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchDoctorProfile.pending, (s) => {
      s.loading = true;
    });
    b.addCase(fetchDoctorProfile.fulfilled, (s, a) => {
      s.loading = false;
      s.profile = a.payload;
    });
    b.addCase(fetchDoctorAppointments.fulfilled, (s, a) => {
      s.appointments = a.payload;
    });
  },
});
export default slice.reducer;
