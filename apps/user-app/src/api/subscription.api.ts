import { apiClient } from './client';

export const subscriptionApi = {
  getPlans: () => apiClient.get('/subscriptions/plans'),
  getMine: () => apiClient.get('/subscriptions/me'),
  subscribe: (planId: string, paymentSource: 'CARD' | 'WALLET') =>
    apiClient.post('/subscriptions/subscribe', { planId, paymentSource }),
  changePlan: (planId: string, paymentSource: 'CARD' | 'WALLET') =>
    apiClient.patch('/subscriptions/me/change-plan', { planId, paymentSource }),
  cancel: () => apiClient.patch('/subscriptions/me/cancel', {}),
};
