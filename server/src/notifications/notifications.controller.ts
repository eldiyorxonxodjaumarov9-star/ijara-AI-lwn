import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Sse,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Bildirishnomalar ro`yxati' })
  findAll(@CurrentUser('id') userId: string) {
    return this.notificationsService.findAll(userId);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'O`qilmagan bildirishnomalar soni' })
  unreadCount(@CurrentUser('id') userId: string) {
    return this.notificationsService.unreadCount(userId);
  }

  @Public()
  @Sse('stream')
  @ApiOperation({ summary: 'Real-time bildirishnoma oqimi (SSE)' })
  stream(): Observable<MessageEvent> {
    return this.notificationsService.subscribe();
  }

  @Post('generate')
  @ApiOperation({ summary: 'Tizimli bildirishnomalarni generatsiya qilish' })
  generate() {
    return this.notificationsService.generateSystemNotifications();
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'O`qilgan deb belgilash' })
  markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Barchasini o`qilgan deb belgilash' })
  markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Bildirishnomani o`chirish' })
  remove(@Param('id') id: string) {
    return this.notificationsService.remove(id);
  }
}
