import { Injectable } from '@nestjs/common';
import { prisma } from '@doctium/database';

@Injectable()
export class ChatService {
  async getTopics(userId: string, role: 'user' | 'doctor') {
    return prisma.chatTopic.findMany({
      where: role === 'user' ? { chats: { some: { userId } } } : { chats: { some: { doctorId: userId } } },
      include: {
        chats: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            user: { select: { name: true, image: true } },
            doctor: { select: { name: true, image: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMessages(topicId: string) {
    return prisma.chat.findMany({
      where: { chatTopicId: topicId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessage(dto: {
    chatTopicId?: string; doctorId: string; userId: string;
    role: string; messageType: string; message?: string;
    image?: string; video?: string;
  }) {
    let topicId = dto.chatTopicId;
    if (!topicId) {
      const topic = await prisma.chatTopic.create({ data: {} });
      topicId = topic.id;
    }

    return prisma.chat.create({
      data: { ...dto, chatTopicId: topicId, messageType: dto.messageType as never },
    });
  }

  async markRead(topicId: string, role: string) {
    return prisma.chat.updateMany({
      where: { chatTopicId: topicId, role: { not: role } },
      data: { isRead: true },
    });
  }
}
