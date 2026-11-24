// Formatação do e-mail ao cliente a partir do texto simples (o servidor não grava HTML):
// corpo em azul; linhas de destaque em negrito sublinhado; do título das pendências em diante,
// vermelho, com o prazo e o responsável de cada pendência em negrito.

export const EMAIL_BLUE = '#1F4E9C';
export const EMAIL_RED = '#C00000';
const FONT =
  'font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.35;';

export interface EmailLineView {
  text: string;
  pending: boolean;
  strong: boolean;
  /** Parte final em negrito ("– 28/11 - (CLIENTE)"). */
  tail: string | null;
}

const DEADLINE = /([–-]\s*\d{2}\/\d{2}\s*-\s*\([^)]*\))\s*$/;

export function emailLines(
  text: string,
  strongLines: string[],
  pendingTitle: string,
): EmailLineView[] {
  const strong = new Set(strongLines.map((l) => l.trim()));
  let pending = false;
  return text.split('\n').map((line) => {
    const trimmed = line.trim();
    if (pendingTitle && trimmed === pendingTitle.trim()) pending = true;
    const tail =
      pending && /^\d{2}- /.test(trimmed)
        ? (DEADLINE.exec(line)?.[1] ?? null)
        : null;
    return { text: line, pending, strong: strong.has(trimmed), tail };
  });
}

const escape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** HTML para colar no cliente de e-mail (Outlook, Gmail), com o texto escapado. */
export function emailHtml(lines: EmailLineView[]) {
  const body = lines
    .map((line) => {
      if (!line.text.trim()) return '<div style="margin:0;">&nbsp;</div>';
      const head = line.tail
        ? line.text.slice(0, line.text.lastIndexOf(line.tail))
        : line.text;
      const content =
        escape(head).replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;') +
        (line.tail ? `<b>${escape(line.tail)}</b>` : '');
      const style = `margin:0;color:${line.pending ? EMAIL_RED : EMAIL_BLUE};${
        line.strong ? 'font-weight:700;text-decoration:underline;' : ''
      }`;
      return `<div style="${style}">${content}</div>`;
    })
    .join('');
  return `<div style="${FONT}">${body}</div>`;
}
