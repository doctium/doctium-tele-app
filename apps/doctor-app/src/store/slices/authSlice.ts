import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import * as SecureStore from 'expo-secure-store';

export interface AuthState {
  accessToken: string | null;
  doctorId: string | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  accessToken: null,
  doctorId: null,
  isAuthenticated: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setTokens(state, action: PayloadAction<{ accessToken: string; doctorId: string }>) {
      state.accessToken = action.payload.accessToken;
      state.doctorId = action.payload.doctorId;
      state.isAuthenticated = true;
      SecureStore.setItemAsync('doctorAccessToken', action.payload.accessToken);
    },
    logout(state) {
      state.accessToken = null;
      state.doctorId = null;
      state.isAuthenticated = false;
      SecureStore.deleteItemAsync('doctorAccessToken');
    },
  },
});

export const { setTokens, logout } = authSlice.actions;
export default authSlice.reducer;
