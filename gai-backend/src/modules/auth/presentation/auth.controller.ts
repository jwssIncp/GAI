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
  ApiAccountLockedResponse,
  ApiUnauthorizedResponse,
  ApiValidationErrorResponse,
} from '../../../common/swagger/api-error-responses';
import { ConfirmPasswordResetUseCase } from '../application/use-cases/confirm-password-reset.use-case';
import { GetCurrentUserUseCase } from '../application/use-cases/get-current-user.use-case';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { LogoutUseCase } from '../application/use-cases/logout.use-case';
import { RequestPasswordResetUseCase } from '../application/use-cases/request-password-reset.use-case';
import { LoginDto } from '../application/dto/login.dto';
import {
  CurrentUserDto,
  LoginResponseDto,
} from '../application/dto/login-response.dto';
import {
  PasswordResetConfirmDto,
  PasswordResetConfirmResponseDto,
} from '../application/dto/password-reset-confirm.dto';
import {
  PasswordResetRequestDto,
  PasswordResetRequestResponseDto,
} from '../application/dto/password-reset-request.dto';
import { SessionAuthGuard } from './guards/session-auth.guard';

interface AuthenticatedRequest extends Request {
  user?: { id: number; sessionId: string };
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly confirmPasswordResetUseCase: ConfirmPasswordResetUseCase,
  ) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Autenticar usuário',
    description:
      'Fluxos: 200 sucesso | 400 validação | 401 credenciais inválidas | 423 conta bloqueada',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiAccountLockedResponse()
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.loginUseCase.execute(dto, this.extractIp(req));
  }

  @Post('logout')
  @HttpCode(204)
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  @ApiOperation({
    summary: 'Encerrar sessão',
    description: 'Fluxos: 204 sucesso | 401 token inválido',
  })
  @ApiNoContentResponse({ description: 'Sessão encerrada' })
  @ApiUnauthorizedResponse()
  async logout(@Req() req: AuthenticatedRequest) {
    await this.logoutUseCase.execute(
      req.user!.sessionId,
      req.user!.id,
      this.extractIp(req),
    );
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  @ApiOperation({
    summary: 'Dados do usuário autenticado',
    description: 'Fluxos: 200 sucesso | 401 token inválido',
  })
  @ApiOkResponse({ type: CurrentUserDto })
  @ApiUnauthorizedResponse()
  async me(@Req() req: AuthenticatedRequest) {
    return this.getCurrentUserUseCase.execute(req.user!.id);
  }

  @Post('password-reset/request')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Solicitar recuperação de senha',
    description:
      'Fluxos: 200 resposta genérica (sempre, anti-enumeração) | 400 e-mail inválido',
  })
  @ApiOkResponse({ type: PasswordResetRequestResponseDto })
  @ApiValidationErrorResponse()
  async requestPasswordReset(
    @Body() dto: PasswordResetRequestDto,
    @Req() req: Request,
  ): Promise<PasswordResetRequestResponseDto> {
    return this.requestPasswordResetUseCase.execute(dto, this.extractIp(req));
  }

  @Post('password-reset/confirm')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Confirmar nova senha',
    description:
      'Fluxos: 200 sucesso | 400 senha inválida | 401 token inválido/expirado',
  })
  @ApiOkResponse({ type: PasswordResetConfirmResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  async confirmPasswordReset(
    @Body() dto: PasswordResetConfirmDto,
    @Req() req: Request,
  ): Promise<PasswordResetConfirmResponseDto> {
    return this.confirmPasswordResetUseCase.execute(dto, this.extractIp(req));
  }

  private extractIp(req: Request): string | null {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.ip ??
      null
    );
  }
}
