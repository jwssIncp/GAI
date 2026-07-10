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

  async sendPasswordResetEmail(
    payload: PasswordResetEmailPayload,
  ): Promise<void> {
    const command = new SendEmailCommand({
      Source: this.fromEmail,
      Destination: { ToAddresses: [payload.to] },
      Message: {
        Subject: { Data: 'GAI — Password Reset' },
        Body: {
          Text: {
            Data: `Use this token to reset your password: ${payload.resetToken}`,
          },
        },
      },
    });
    await this.client.send(command);
  }
}
