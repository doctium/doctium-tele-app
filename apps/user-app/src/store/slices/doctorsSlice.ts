import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { doctorsApi } from "../../api/doctors.api";

export interface Doctor {
  id: string;
  name: string;
  image: string;
  designation: string;
  experience: number;
  rating: number;
  reviewCount: number;
  charge: number;
  type: string;
  isOnline: boolean;
  expertise: string[];
  language?: string[];
  practiceCountry?: string;
  nationality?: string;
  currency?: string;
  isFeatured?: boolean;
  isVerified?: boolean;
  discountActive?: boolean;
  discountPercent?: number;
  discountLabel?: string;
  discountEndsAt?: string | null;
}

export interface State {
  list: Doctor[];
  selected: Doctor | null;
  slots: string[];
  loading: boolean;
  error: string | null;
}
const initial: State = {
  list: [],
  selected: null,
  slots: [],
  loading: false,
  error: null,
};

export const fetchDoctors = createAsyncThunk(
  "doctors/fetchAll",
  (params?: {
    search?: string;
    serviceId?: string;
    country?: string;
    nationality?: string;
    language?: string;
  }) =>
    doctorsApi
      .getAll(params)
      .then((r: unknown) => (r as { data: Doctor[] }).data),
);

export const fetchDoctor = createAsyncThunk("doctors/fetchOne", (id: string) =>
  doctorsApi.getOne(id).then((r: unknown) => (r as { data: Doctor }).data),
);

export const fetchSlots = createAsyncThunk(
  "doctors/fetchSlots",
  ({ id, date }: { id: string; date: string }) =>
    doctorsApi
      .getSlots(id, date)
      .then((r: unknown) => (r as { data: { slots: string[] } }).data.slots),
);

const slice = createSlice({
  name: "doctors",
  initialState: initial,
  reducers: {
    clearSelected: (s) => {
      s.selected = null;
      s.slots = [];
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchDoctors.pending, (s) => {
      s.loading = true;
      s.error = null;
    });
    b.addCase(fetchDoctors.fulfilled, (s, a) => {
      s.loading = false;
      s.list = a.payload;
    });
    b.addCase(fetchDoctors.rejected, (s, a) => {
      s.loading = false;
      s.error = a.error.message ?? "Failed";
    });
    b.addCase(fetchDoctor.fulfilled, (s, a) => {
      s.selected = a.payload;
    });
    b.addCase(fetchSlots.fulfilled, (s, a) => {
      s.slots = a.payload;
    });
  },
});
export const { clearSelected } = slice.actions;
export default slice.reducer;
