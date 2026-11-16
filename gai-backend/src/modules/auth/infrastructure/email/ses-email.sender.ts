import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import {
  EmailSender,
  PasswordResetEmailPayload,
} from '../../domain/ports/email-sender.port';

@Injectable()
export class MockEmailSender implements EmailSender {
  private readonly logger = new Logger(MockEmailSender.name);
  // Development-only in-memory mailbox; never logged or exposed by HTTP.
  readonly invitations: Array<{ to: string; activationUrl: string }> = [];
  sendInvitationEmail(payload: {
    to: string;
    activationUrl: string;
  }): Promise<void> {
    this.invitations.push(payload);
    return Promise.resolve();
  }

  sendPasswordResetEmail(payload: PasswordResetEmailPayload): Promise<void> {
    this.logger.log({
      operation: 'PASSWORD_RESET_EMAIL_DISPATCHED',
      provider: 'mock',
      recipientConfigured: payload.to.length > 0,
    });
    return Promise.resolve();
  }
}

@Injectable()
export class SesEmailSender implements EmailSender {
  private readonly client: SESClient;
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new SESClient({
      region: this.configService.get<string>('auth.awsRegion', 'us-east-1'),
    });
    this.fromEmail = this.configService.get<string>(
      'auth.sesFromEmail',
      'noreply@example.com',
    );
  }

  async sendInvitationEmail(payload: {
    to: string;
    activationUrl: string;
  }): Promise<void> {
    await this.client.send(
      new SendEmailCommand({
        Source: this.fromEmail,
        Destination: { ToAddresses: [payload.to] },
        Message: {
          Subject: { Data: 'GAI — Ative sua conta' },
          Body: {
            Text: {
              Data:
                'Defina sua senha para ativar sua conta: ' +
                payload.activationUrl,
            },
          },
        },
      }),
    );
  }
  async sendPasswordResetEmail(
    payload: PasswordResetEmailPayload,
  ): Promise<void> {
    const base = this.configService.get<string>(
      'auth.frontendUrl',
      'http://localhost:5173',
    );
    const link = `${base}/reset-password?token=${encodeURIComponent(payload.resetToken)}`;
    const command = new SendEmailCommand({
      Source: this.fromEmail,
      Destination: { ToAddresses: [payload.to] },
      Message: {
        Subject: { Data: 'GAI — Redefinição de senha', Charset: 'UTF-8' },
        Body: {
          Text: {
            Charset: 'UTF-8',
            Data: [
              'Recebemos um pedido para redefinir a senha da sua conta no GAI.',
              '',
              `Para criar uma nova senha, acesse: ${link}`,
              '',
              `Se preferir, informe este código na tela de redefinição: ${payload.resetToken}`,
              '',
              'O link vale por tempo limitado e só pode ser usado uma vez.',
              'Se você não fez este pedido, ignore este e-mail: sua senha continua a mesma.',
            ].join('\n'),
          },
        },
      },
    });
    await this.client.send(command);
  }
}
