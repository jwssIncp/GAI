import { Injectable } from '@nestjs/common';
import { CredentialTransactionsService } from '../services/credential-transactions.service';
import { PasswordResetRequestDto } from '../dto/password-reset-request.dto';
@Injectable()
export class RequestPasswordResetUseCase {
  constructor(private readonly credentials: CredentialTransactionsService) {}
  execute(dto: PasswordResetRequestDto, ip: string | null) {
    return this.credentials.requestReset(dto.email, ip);
  }
}
