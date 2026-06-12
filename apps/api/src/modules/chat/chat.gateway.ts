import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: 'chat' })
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket) {
    const topicId = client.handshake.query['topicId'] as string;
    if (topicId) client.join(topicId);
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(@MessageBody() dto: Record<string, unknown>, @ConnectedSocket() client: Socket) {
    const message = await this.chatService.sendMessage(dto as never);
    const topicId = (dto['chatTopicId'] as string) ?? (message as { chatTopicId: string }).chatTopicId;
    client.to(topicId).emit('newMessage', message);
    return message;
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(@MessageBody() data: { topicId: string; role: string }) {
    await this.chatService.markRead(data.topicId, data.role);
    this.server.to(data.topicId).emit('messagesRead', data);
  }
}
