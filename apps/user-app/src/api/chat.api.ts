import { apiClient } from './client';

export const chatApi = {
  getTopics: () => apiClient.get('/chat/topics'),
  getMessages: (topicId: string) => apiClient.get(`/chat/topics/${topicId}/messages`),
};
