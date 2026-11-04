export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export interface PasswordResetEmailPayload {
  to: string;
  resetToken: string;
}

export interface EmailSender {
  sendInvitationEmail?(payload: {
    to: string;
    activationUrl: string;
  }): Promise<void>;
  sendPasswordResetEmail(payload: PasswordResetEmailPayload): Promise<void>;
}
