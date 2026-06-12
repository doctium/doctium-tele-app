import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { appointmentsApi } from '../../api/appointments.api';

export interface Appointment {
  id: string; appointmentId: string; date: string; time: string;
  status: string; type: string; amount: number;
  doctor?: { name?: string; image?: string; designation?: string };
  service?: { name?: string };
}
export interface State { list: Appointment[]; selected: Appointment | null; loading: boolean; error: string | null; }
const initial: State = { list: [], selected: null, loading: false, error: null };

export const fetchAppointments = createAsyncThunk('appointments/fetchMine', (status?: string) =>
  appointmentsApi.getMine(status).then((r: unknown) => (r as { data: Appointment[] }).data));

export const fetchAppointment = createAsyncThunk('appointments/fetchOne', (id: string) =>
  appointmentsApi.getOne(id).then((r: unknown) => (r as { data: Appointment }).data));

const slice = createSlice({
  name: 'appointments', initialState: initial,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchAppointments.pending, (s) => { s.loading = true; });
    b.addCase(fetchAppointments.fulfilled, (s, a) => { s.loading = false; s.list = a.payload; });
    b.addCase(fetchAppointments.rejected, (s, a) => { s.loading = false; s.error = a.error.message ?? 'Failed'; });
    b.addCase(fetchAppointment.fulfilled, (s, a) => { s.selected = a.payload; });
  },
});
export default slice.reducer;
