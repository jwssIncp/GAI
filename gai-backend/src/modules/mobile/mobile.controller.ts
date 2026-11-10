import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  SessionAuthGuard,
  type AuthenticatedUser,
} from '../auth/presentation/guards/session-auth.guard';
import {
  MobileLoginDto,
  MobileRefreshTokenDto,
  MobileTokenResponseDto,
} from './dto/mobile-auth.dto';
import { MobileIdentityService } from './mobile-identity.service';
import { MobileSessionService } from './mobile-session.service';

@ApiTags('Mobile')
@Controller('mobile/auth')
export class MobileAuthController {
  constructor(private readonly sessions: MobileSessionService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Login do aplicativo',
    description:
      '200 | 400 validação | 401 credenciais | 403 MOBILE_ACCESS_DENIED | 423 bloqueio | 429',
  })
  @ApiOkResponse({ type: MobileTokenResponseDto })
  login(@Body() dto: MobileLoginDto, @Req() req: Request) {
    return this.sessions.login(dto, req.ip ?? null);
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Renovar sessão com rotação do refresh token',
    description:
      '200 | 401 INVALID_REFRESH_TOKEN/REFRESH_TOKEN_REUSED/SESSION_EXPIRED/SESSION_REVOKED | 403 MOBILE_ACCESS_DENIED | 409 REFRESH_TOKEN_ALREADY_ROTATED | 423 | 429',
  })
  @ApiOkResponse({ type: MobileTokenResponseDto })
  refresh(@Body() dto: MobileRefreshTokenDto, @Req() req: Request) {
    return this.sessions.refresh(dto.refresh_token, req.ip ?? null);
  }

  @Post('logout')
  @HttpCode(204)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Encerrar a sessão do aparelho (idempotente)' })
  @ApiNoContentResponse()
  async logout(@Body() dto: MobileRefreshTokenDto, @Req() req: Request) {
    await this.sessions.logout(dto.refresh_token, req.ip ?? null);
  }
}

@ApiTags('Mobile')
@Controller('mobile')
@UseGuards(SessionAuthGuard)
@ApiBearerAuth()
export class MobileMeController {
  constructor(private readonly identity: MobileIdentityService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Usuário, inventariante, organização e projetos vigentes',
    description: '200 | 401 | 403 MOBILE_ACCESS_DENIED',
  })
  me(@Req() req: Request & { user?: AuthenticatedUser }) {
    return this.identity.me(req.user!);
  }
}
