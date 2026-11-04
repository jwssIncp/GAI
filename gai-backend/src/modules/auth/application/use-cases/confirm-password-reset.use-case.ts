import { Injectable } from '@nestjs/common';
import { CredentialTransactionsService } from '../services/credential-transactions.service';
import { PasswordResetConfirmDto } from '../dto/password-reset-confirm.dto';
@Injectable()
export class ConfirmPasswordResetUseCase {
  constructor(private readonly credentials: CredentialTransactionsService) {}
  execute(dto: PasswordResetConfirmDto, ip: string | null) {
    return this.credentials.consumeToken(
      dto.token,
      dto.new_password,
      'PASSWORD_RESET',
      ip,
    );
  }
}
