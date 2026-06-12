export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'VIDEO_CALL';
export type CallType = 'RECEIVED' | 'DECLINED' | 'MISSED';

export interface ChatMessage {
  id: string;
  chatTopicId?: string;
  doctorId?: string;
  userId?: string;
  role: 'user' | 'doctor';
  messageType: MessageType;
  message: string;
  image?: string;
  video?: string;
  thumbnail?: string;
  isRead: boolean;
  callType?: CallType;
  callDuration?: string;
  createdAt: Date;
}

export interface ChatTopic {
  id: string;
  appointmentId?: string;
  chats: ChatMessage[];
  createdAt: Date;
}
