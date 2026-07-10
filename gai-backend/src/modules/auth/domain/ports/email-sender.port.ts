export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export interface PasswordResetEmailPayload {
  to: string;
  resetToken: string;
}

export interface EmailSender {
  sendPasswordResetEmail(payload: PasswordResetEmailPayload): Promise<void>;
}
