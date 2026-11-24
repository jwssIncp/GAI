import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/http';
import { ErrorState, LoadingState } from '@/components/base/States';
import { Tabs } from '@/components/base/Tabs';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, ModalForm } from '@/components/ui/dialog';
import { formatDateTime } from '@/utils/format';
import {
  EMAIL_BLUE,
  EMAIL_RED,
  emailHtml,
  emailLines,
} from './clientEmailFormat';
import { preparationApi, preparationKeys } from './preparationQueries';
import type { ClientEmail } from './preparationTypes';

const SAVE_DELAY = 1200;

/**
 * "Gerar e-mail cliente": texto gerado no servidor pelo modelo da organização, editável
 * (salvo sozinho), com "Restaurar original", aviso quando as respostas mudaram depois da
 * edição e "Copiar" com formatação. Nada é enviado por esta tela.
 */
export function ClientEmailPanel({
  projectId,
  instance,
  canEdit,
  onClose,
}: {
  projectId: number;
  instance: number;
  canEdit: boolean;
  onClose: () => void;
}) {
  const client = useQueryClient();
  // Chave própria: mudanças nas respostas não geram o e-mail de novo sozinhas (cada geração fica no histórico).
  const key = ['preparation-email', projectId, instance] as const;
  const query = useQuery({
    queryKey: key,
    queryFn: () => preparationApi.email(projectId, instance),
    retry: false,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const [tab, setTab] = useState<'view' | 'edit'>('view');
  const [text, setText] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [restoring, setRestoring] = useState(false);
  const sent = useRef<string | null>(null);
  const data = query.data;
  const current = text ?? data?.text ?? '';
  const dirty = data !== undefined && text !== null && text !== data.text;

  const refreshHistory = () =>
    client.invalidateQueries({
      queryKey: [...preparationKeys.project(projectId), 'history', instance],
    });
  const accept = (next: ClientEmail) => {
    client.setQueryData(key, next);
    void refreshHistory();
  };
  const save = useMutation({
    mutationFn: (value: string) =>
      preparationApi.saveEmail(projectId, instance, {
        email_version: data!.email_version,
        source_revision: data!.revision,
        text: value,
      }),
    onSuccess: (next, value) => {
      accept(next);
      // Se nada mudou desde o envio, o texto local volta a seguir o servidor.
      setText((local) => (local === value ? null : local));
    },
  });
  const restore = useMutation({
    mutationFn: () =>
      preparationApi.restoreEmail(projectId, instance, data!.email_version),
    onSuccess: (next) => {
      accept(next);
      setText(null);
      setRestoring(false);
      setMessage('E-mail restaurado: gerado de novo com as respostas atuais.');
    },
  });
  const conflict =
    (save.error instanceof ApiError && save.error.status === 409) ||
    (restore.error instanceof ApiError && restore.error.status === 409);

  // Salvamento automático, depois de uma pausa na digitação.
  useEffect(() => {
    if (!dirty || !canEdit || save.isPending || conflict || !current.trim())
      return;
    if (sent.current === current && save.isError) return;
    const timer = setTimeout(() => {
      sent.current = current;
      save.mutate(current);
    }, SAVE_DELAY);
    return () => clearTimeout(timer);
  }, [dirty, canEdit, current, save, conflict]);

  async function copy() {
    const lines = emailLines(
      current,
      data?.strong_lines ?? [],
      data?.pending_title ?? '',
    );
    const html = emailHtml(lines);
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([current], { type: 'text/plain' }),
          }),
        ]);
        setMessage(
          'E-mail copiado com formatação. Nenhuma mensagem foi enviada.',
        );
      } else {
        await navigator.clipboard.writeText(current);
        setMessage(
          'E-mail copiado como texto simples. Nenhuma mensagem foi enviada.',
        );
      }
    } catch {
      setMessage(
        'Não foi possível copiar. Selecione o texto e copie manualmente.',
      );
    }
  }

  function close() {
    // Não perde a última edição: salva antes de fechar, se ainda não foi.
    if (dirty && canEdit && !conflict && current.trim() && !save.isPending)
      save.mutate(current);
    onClose();
  }

  return (
    <ModalForm
      open
      onOpenChange={(open) => !open && close()}
      title="E-mail para o cliente"
    >
      {query.isLoading ? (
        <LoadingState label="Gerando e-mail" />
      ) : query.isError || !data ? (
        <ErrorState
          message={
            (query.error as Error | null)?.message ?? 'E-mail indisponível'
          }
          onRetry={() => query.refetch()}
        />
      ) : (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Assunto sugerido:{' '}
            <span className="font-semibold text-foreground">
              {data.subject}
            </span>
            . Revise e copie para o seu e-mail; nada é enviado por esta tela.
          </p>
          {data.stale ? (
            <div
              role="alert"
              className="rounded-lg border border-warning/70 bg-warning-subtle p-3 text-sm text-warning-text"
            >
              As respostas do kick-off mudaram depois desta edição. Gere de novo
              para usar os dados atuais (a edição será descartada) ou confira o
              texto antes de enviar.
            </div>
          ) : null}
          {data.edited ? (
            <p className="text-xs text-muted-foreground">
              Editado
              {data.updated_by_name ? ` por ${data.updated_by_name}` : ''}
              {data.updated_at ? ` em ${formatDateTime(data.updated_at)}` : ''}.
            </p>
          ) : null}
          {canEdit ? (
            <Tabs
              label="Modo do e-mail"
              value={tab}
              onChange={(value) => setTab(value as 'view' | 'edit')}
              tabs={[
                { value: 'view', label: 'Formatado' },
                { value: 'edit', label: 'Editar texto' },
              ]}
            />
          ) : null}
          {tab === 'edit' && canEdit ? (
            <textarea
              aria-label="Texto do e-mail"
              className="min-h-96 w-full rounded-lg border bg-background p-3 font-[Calibri,Arial,sans-serif] text-sm leading-6"
              value={current}
              maxLength={15000}
              onChange={(e) => {
                setMessage('');
                setText(e.target.value);
              }}
            />
          ) : (
            <EmailPreview text={current} data={data} />
          )}
          <p role="status" className="min-h-5 text-xs text-muted-foreground">
            {conflict
              ? 'O e-mail foi alterado por outro usuário. Recarregue para ver a versão atual; sua edição não foi salva.'
              : save.isError
                ? `Não foi possível salvar: ${(save.error as Error).message}`
                : save.isPending
                  ? 'Salvando…'
                  : dirty
                    ? 'Alterações ainda não salvas.'
                    : data.edited
                      ? 'Edição salva.'
                      : ''}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            {conflict ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setText(null);
                  save.reset();
                  restore.reset();
                  void query.refetch();
                }}
              >
                Recarregar
              </Button>
            ) : null}
            {canEdit && data.edited ? (
              <Button variant="secondary" onClick={() => setRestoring(true)}>
                {data.stale ? 'Gerar de novo' : 'Restaurar original'}
              </Button>
            ) : null}
            <Button variant="secondary" onClick={close}>
              Fechar
            </Button>
            <Button onClick={() => void copy()}>Copiar</Button>
          </div>
          {message ? (
            <p role="status" className="text-sm text-primary">
              {message}
            </p>
          ) : null}
        </div>
      )}
      <ConfirmDialog
        open={restoring}
        onOpenChange={setRestoring}
        title="Restaurar o e-mail original"
        description="A versão editada será descartada e o e-mail será gerado de novo com as respostas atuais. A ação fica no histórico."
        busy={restore.isPending}
        error={restore.isError ? (restore.error as Error).message : null}
        confirmLabel="Restaurar"
        onConfirm={() => restore.mutate()}
      />
    </ModalForm>
  );
}

function EmailPreview({ text, data }: { text: string; data: ClientEmail }) {
  const lines = emailLines(text, data.strong_lines, data.pending_title);
  return (
    <div
      aria-label="Prévia do e-mail"
      className="max-h-[28rem] overflow-auto rounded-lg border bg-white p-4 text-[11pt] leading-snug"
      style={{ fontFamily: 'Calibri, Arial, sans-serif' }}
    >
      {lines.map((line, index) => {
        const head = line.tail
          ? line.text.slice(0, line.text.lastIndexOf(line.tail))
          : line.text;
        return (
          <div
            key={index}
            className="whitespace-pre-wrap"
            style={{
              color: line.pending ? EMAIL_RED : EMAIL_BLUE,
              fontWeight: line.strong ? 700 : undefined,
              textDecoration: line.strong ? 'underline' : undefined,
            }}
          >
            {line.text.trim() ? head : ' '}
            {line.tail ? <b>{line.tail}</b> : null}
          </div>
        );
      })}
    </div>
  );
}
