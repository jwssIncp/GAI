export type InvitationDelivery = "SENT" | "FAILED" | "DEVELOPMENT";

export const DEVELOPMENT_INVITATION_MESSAGE =
  "Ambiente de desenvolvimento: o convite foi registrado, mas nenhum e-mail é enviado. Use a senha temporária para testar o acesso.";

/** Texto do resultado do envio do convite (usuários e inventariantes). */
export function invitationDeliveryMessage(delivery?: string | null): string {
  if (delivery === "SENT") return "Convite enviado por e-mail.";
  if (delivery === "DEVELOPMENT") return DEVELOPMENT_INVITATION_MESSAGE;
  return "O convite não foi entregue. Verifique a configuração e a disponibilidade do serviço de e-mail e use Reenviar convite.";
}
