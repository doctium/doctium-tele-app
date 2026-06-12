import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '@doctium/types';
import { ChatService } from './chat.service';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('topics')
  getTopics(@CurrentUser() user: JwtPayload) {
    const role = user.role === 'doctor' ? 'doctor' : 'user';
    return this.chatService.getTopics(user.sub, role);
  }

  @Get('topics/:topicId/messages')
  getMessages(@Param('topicId') topicId: string) {
    return this.chatService.getMessages(topicId);
  }
}
