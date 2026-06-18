import { Injectable, MessageEvent } from '@nestjs/common';
import { ContractStatus, NotificationType, Prisma } from '@prisma/client';
import { Observable, Subject } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly stream$ = new Subject<MessageEvent>();

  constructor(private readonly prisma: PrismaService) {}

  /** Real-time SSE oqimi */
  subscribe(): Observable<MessageEvent> {
    return this.stream$.asObservable();
  }

  private emit(data: unknown) {
    this.stream$.next({ data } as MessageEvent);
  }

  async create(input: {
    title: string;
    message: string;
    type?: NotificationType;
    userId?: string | null;
    meta?: Prisma.InputJsonValue;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        title: input.title,
        message: input.message,
        type: input.type ?? NotificationType.INFO,
        userId: input.userId ?? null,
        meta: input.meta,
      },
    });
    this.emit(notification);
    return notification;
  }

  async findAll(userId?: string) {
    return this.prisma.notification.findMany({
      where: userId ? { OR: [{ userId }, { userId: null }] } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async unreadCount(userId?: string) {
    const count = await this.prisma.notification.count({
      where: {
        isRead: false,
        ...(userId ? { OR: [{ userId }, { userId: null }] } : {}),
      },
    });
    return { count };
  }

  async markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId?: string) {
    await this.prisma.notification.updateMany({
      where: userId ? { OR: [{ userId }, { userId: null }] } : {},
      data: { isRead: true },
    });
    return { message: 'Barchasi o`qildi' };
  }

  async remove(id: string) {
    await this.prisma.notification.delete({ where: { id } });
    return { message: 'O`chirildi' };
  }

  /**
   * Tizimli bildirishnomalarni generatsiya qiladi:
   * - muddati o'tgan shartnomalar
   * - kechikkan to'lovlar
   */
  async generateSystemNotifications() {
    const now = new Date();
    const created: string[] = [];

    // Muddati o'tgan shartnomalar
    const expired = await this.prisma.contract.findMany({
      where: {
        endDate: { lt: now },
        status: { in: [ContractStatus.ACTIVE, ContractStatus.EXPIRED] },
      },
      include: { property: true, tenant: true },
    });

    for (const contract of expired) {
      await this.prisma.contract.update({
        where: { id: contract.id },
        data: { status: ContractStatus.EXPIRED },
      });
      const exists = await this.prisma.notification.findFirst({
        where: {
          type: NotificationType.CONTRACT_EXPIRED,
          meta: { path: ['contractId'], equals: contract.id },
        },
      });
      if (!exists) {
        await this.create({
          title: 'Shartnoma muddati tugadi',
          message: `${contract.property.title} — ${contract.tenant.fullName} shartnomasi muddati o'tgan.`,
          type: NotificationType.CONTRACT_EXPIRED,
          meta: { contractId: contract.id },
        });
        created.push(contract.id);
      }
    }

    // Kechikkan to'lovlar (faol shartnoma, oxirgi 30 kunda to'lov yo'q)
    const activeContracts = await this.prisma.contract.findMany({
      where: { status: ContractStatus.ACTIVE },
      include: {
        property: true,
        tenant: true,
        payments: { orderBy: { paymentDate: 'desc' }, take: 1 },
      },
    });

    const monthAgo = new Date(now.getTime() - 30 * 86400000);
    for (const contract of activeContracts) {
      const lastPayment = contract.payments[0];
      const overdue = !lastPayment || lastPayment.paymentDate < monthAgo;
      if (overdue) {
        const exists = await this.prisma.notification.findFirst({
          where: {
            type: NotificationType.LATE_PAYMENT,
            isRead: false,
            meta: { path: ['contractId'], equals: contract.id },
          },
        });
        if (!exists) {
          await this.create({
            title: 'Kechikkan to`lov',
            message: `${contract.property.title} — ${contract.tenant.fullName} bo'yicha to'lov kechikmoqda.`,
            type: NotificationType.LATE_PAYMENT,
            meta: { contractId: contract.id },
          });
          created.push(contract.id);
        }
      }
    }

    return { generated: created.length };
  }
}
