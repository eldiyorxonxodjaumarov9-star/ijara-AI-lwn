import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private get saltRounds(): number {
    return Number(this.config.get('BCRYPT_SALT_ROUNDS') ?? 10);
  }

  private async hash(value: string): Promise<string> {
    return bcrypt.hash(value, this.saltRounds);
  }

  private sanitize(user: User) {
    const {
      password: _p,
      refreshTokenHash: _r,
      resetToken: _t,
      resetTokenExp: _e,
      ...rest
    } = user;
    void _p;
    void _r;
    void _t;
    void _e;
    return rest;
  }

  private async generateTokens(payload: JwtPayload) {
    const accessOptions = {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES') ?? '15m',
    } as JwtSignOptions;
    const refreshOptions = {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES') ?? '7d',
    } as JwtSignOptions;
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, accessOptions),
      this.jwt.signAsync(payload, refreshOptions),
    ]);
    return { accessToken, refreshToken };
  }

  private async persistRefreshToken(userId: string, refreshToken: string) {
    const refreshTokenHash = await this.hash(refreshToken);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  }

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) {
      throw new ConflictException('Bu email allaqachon ro`yxatdan o`tgan');
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: await this.hash(dto.password),
        fullName: dto.fullName,
        phone: dto.phone,
        role: dto.role ?? Role.MANAGER,
      },
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const tokens = await this.generateTokens(payload);
    await this.persistRefreshToken(user.id, tokens.refreshToken);

    await this.audit.log({
      userId: user.id,
      action: 'REGISTER',
      entity: 'auth',
      entityId: user.id,
    });

    return { user: this.sanitize(user), ...tokens };
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Email yoki parol noto`g`ri');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Email yoki parol noto`g`ri');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const tokens = await this.generateTokens(payload);
    await this.persistRefreshToken(user.id, tokens.refreshToken);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit.log({
      userId: user.id,
      action: 'LOGIN',
      entity: 'auth',
      entityId: user.id,
      ip,
      userAgent,
    });

    return { user: this.sanitize(user), ...tokens };
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token yaroqsiz');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Sessiya topilmadi');
    }

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) {
      throw new UnauthorizedException('Refresh token mos kelmadi');
    }

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    await this.persistRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    return { message: 'Tizimdan chiqildi' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    // Xavfsizlik uchun foydalanuvchi mavjudligini oshkor qilmaymiz
    if (user) {
      const token = randomBytes(32).toString('hex');
      const resetToken = createHash('sha256').update(token).digest('hex');
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExp: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      // Ishlab chiqarishda token email orqali yuboriladi.
      return {
        message: 'Parolni tiklash ko`rsatmasi yuborildi',
        resetToken: token,
      };
    }
    return { message: 'Parolni tiklash ko`rsatmasi yuborildi' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const hashed = createHash('sha256').update(dto.token).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: { resetToken: hashed, resetTokenExp: { gt: new Date() } },
    });
    if (!user) {
      throw new BadRequestException('Token yaroqsiz yoki muddati o`tgan');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: await this.hash(dto.newPassword),
        resetToken: null,
        resetTokenExp: null,
        refreshTokenHash: null,
      },
    });
    return { message: 'Parol muvaffaqiyatli yangilandi' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid) {
      throw new BadRequestException('Joriy parol noto`g`ri');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: await this.hash(dto.newPassword) },
    });
    return { message: 'Parol o`zgartirildi' };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.sanitize(user);
  }
}
