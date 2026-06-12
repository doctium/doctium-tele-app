import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { usersApi } from "../../api/users.api";
import type { Doctor } from "./doctorsSlice";

export interface State {
  ids: string[];
  doctors: Doctor[];
  loading: boolean;
}
const initial: State = { ids: [], doctors: [], loading: false };

export const fetchFavoriteIds = createAsyncThunk("favorites/ids", () =>
  usersApi
    .getFavoriteIds()
    .then((r: unknown) => (r as { data: string[] }).data ?? []),
);

export const fetchFavorites = createAsyncThunk("favorites/list", () =>
  usersApi
    .getFavorites()
    .then((r: unknown) => (r as { data: Doctor[] }).data ?? []),
);

// Optimistically flip the heart, then persist. Reverts on failure.
export const toggleFavorite = createAsyncThunk(
  "favorites/toggle",
  async (doctorId: string, { dispatch }) => {
    dispatch(optimisticToggle(doctorId));
    try {
      const r = await usersApi.toggleFavorite(doctorId);
      return {
        doctorId,
        favorite: (r as { data: { favorite: boolean } }).data?.favorite,
      };
    } catch (e) {
      dispatch(optimisticToggle(doctorId)); // revert
      throw e;
    }
  },
);

const slice = createSlice({
  name: "favorites",
  initialState: initial,
  reducers: {
    optimisticToggle: (s, a: PayloadAction<string>) => {
      s.ids = s.ids.includes(a.payload)
        ? s.ids.filter((x) => x !== a.payload)
        : [...s.ids, a.payload];
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchFavoriteIds.fulfilled, (s, a) => {
      s.ids = a.payload;
    });
    b.addCase(fetchFavorites.pending, (s) => {
      s.loading = true;
    });
    b.addCase(fetchFavorites.fulfilled, (s, a) => {
      s.loading = false;
      s.doctors = a.payload;
      s.ids = a.payload.map((d) => d.id);
    });
    b.addCase(fetchFavorites.rejected, (s) => {
      s.loading = false;
    });
    b.addCase(toggleFavorite.fulfilled, (s, a) => {
      const { doctorId, favorite } = a.payload;
      if (favorite === false) {
        s.ids = s.ids.filter((x) => x !== doctorId);
        s.doctors = s.doctors.filter((d) => d.id !== doctorId);
      } else if (favorite === true && !s.ids.includes(doctorId)) {
        s.ids.push(doctorId);
      }
    });
  },
});

export const { optimisticToggle } = slice.actions;
export default slice.reducer;
