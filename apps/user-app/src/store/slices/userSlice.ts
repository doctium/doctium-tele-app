import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { usersApi } from '../../api/users.api';

export interface UserProfile {
  id: string; name: string; email: string; mobile: string;
  image: string; gender: string; dob: string; wallet?: { balance: number };
}
export interface State { profile: UserProfile | null; subPatients: unknown[]; loading: boolean; }
const initial: State = { profile: null, subPatients: [], loading: false };

export const fetchProfile = createAsyncThunk('user/fetchProfile', () =>
  usersApi.getProfile().then((r: unknown) => (r as { data: UserProfile }).data));

export const fetchSubPatients = createAsyncThunk('user/fetchSubPatients', () =>
  usersApi.getSubPatients().then((r: unknown) => (r as { data: unknown[] }).data));

const slice = createSlice({
  name: 'user', initialState: initial,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchProfile.pending, (s) => { s.loading = true; });
    b.addCase(fetchProfile.fulfilled, (s, a) => { s.loading = false; s.profile = a.payload; });
    b.addCase(fetchSubPatients.fulfilled, (s, a) => { s.subPatients = a.payload; });
  },
});
export default slice.reducer;
