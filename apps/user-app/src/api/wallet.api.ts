import { apiClient } from './client';

export const walletApi = {
  getWallet: () => apiClient.get('/payments/wallet'),
  initTopup: (amount: number) => apiClient.post('/payments/wallet/topup/init', { amount }),
  getDVA: () => apiClient.get('/payments/wallet/dva'),
};
