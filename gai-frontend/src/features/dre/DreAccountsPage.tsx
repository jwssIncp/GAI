import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ModalForm } from "@/components/ui/dialog";
import { DataTable } from "@/components/base/DataTable";
import { ErrorState, LoadingState } from "@/components/base/States";
import { usePermissions } from "@/features/auth/usePermissions";
import { useAuth } from "@/features/auth/AuthContext";
import { cls, dreApi, groups, scope, type Account } from "./dreApi";
export function DreAccountsPage() {
  const [p] = useSearchParams(),
    f = scope(p, false),
    { user } = useAuth(),
    { hasPermission } = usePermissions(),
    cache = useQueryClient();
  const q = useQuery({
      queryKey: ["dre", "accounts", user?.id, f],
      queryFn: () => dreApi.accounts(f),
    }),
    [mode, setMode] = useState(""),
    [selected, setSelected] = useState<Account>(),
    [key, setKey] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [historyId, setHistoryId] = useState<number>();
  const history = useQuery({
    queryKey: ["dre", "account-history", historyId],
    queryFn: () => dreApi.account(historyId!),
    enabled: !!historyId,
  });
  const open = (m: string, a?: Account) => {
    setMode(m);
    setSelected(a);
    setKey(crypto.randomUUID());
    setError("");
  };
  return (
    <div className="grid gap-4">
      <h3 className="font-semibold">
        Plano de contas gerencial da organização
      </h3>
      <p className="text-sm text-muted-foreground">
        Os grupos têm significado estável nas fórmulas. Nomes e ativação são
        versionados. Código, grupo, hierarquia e natureza analítica não mudam
        retroativamente. Publicar categorias não cria receitas, despesas ou
        tributos.
      </p>
      {hasPermission("dre:configure") && (
        <div className="flex gap-2">
          <Button onClick={() => open("create")}>Nova conta gerencial</Button>
          <Button variant="secondary" onClick={() => open("bootstrap")}>
            Publicar plano sugerido
          </Button>
        </div>
      )}
      {q.isLoading ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState message={q.error.message} />
      ) : (
        q.data && (
          <DataTable
            items={q.data}
            getKey={(a) => a.id}
            columns={[
              { header: "Código", cell: (a) => a.code },
              { header: "Conta", cell: (a) => a.data.name },
              { header: "Grupo", cell: (a) => groups[a.data.group] },
              {
                header: "Natureza",
                cell: (a) => (a.data.posting ? "Analítica" : "Agrupadora"),
              },
              {
                header: "Estado",
                cell: (a) => (a.data.active ? "Ativa" : "Inativa"),
              },
              { header: "Versão", cell: (a) => a.revision },
              {
                header: "Ações",
                cell: (a) => (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setHistoryId(a.id)}
                    >
                      Histórico #{a.id}
                    </Button>
                    {hasPermission("dre:configure") && (
                      <Button
                        variant="secondary"
                        onClick={() => open("edit", a)}
                      >
                        Editar {a.code}
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )
      )}
      <ModalForm
        open={!!mode}
        onOpenChange={(v) => {
          if (!busy && !v) setMode("");
        }}
        title={
          mode === "bootstrap"
            ? "Publicar plano sugerido"
            : mode === "edit"
              ? "Editar conta gerencial"
              : "Nova conta gerencial"
        }
      >
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const fd = new FormData(e.currentTarget),
              v = (k: string) => String(fd.get(k) ?? "").trim(),
              base = { command_key: key, reason: v("reason") };
            try {
              if (mode === "bootstrap") await dreApi.bootstrap(base, f);
              else if (mode === "edit")
                await dreApi.editAccount(
                  selected!.id,
                  {
                    ...base,
                    revision: selected!.revision,
                    name: v("name"),
                    active: fd.get("active") === "on",
                  },
                  f,
                );
              else
                await dreApi.createAccount(
                  {
                    ...base,
                    code: v("code"),
                    name: v("name"),
                    group: v("group"),
                    posting: fd.get("posting") === "on",
                    ...(v("parent_id")
                      ? { parent_id: Number(v("parent_id")) }
                      : {}),
                  },
                  f,
                );
              await cache.invalidateQueries({ queryKey: ["dre"] });
              setMode("");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {mode === "bootstrap" ? (
            <p className="text-sm">
              Cria categorias sugeridas para receitas, deduções, equipes,
              deslocamento, hospedagem, alimentação, materiais, despesas
              operacionais e resultado financeiro. Só é permitido em organização
              sem plano. Nenhum lançamento ou alíquota será criado.
            </p>
          ) : (
            <>
              <label className="grid gap-1 text-sm">
                Nome da conta
                <input
                  className={cls}
                  name="name"
                  required
                  minLength={3}
                  defaultValue={selected?.data.name ?? ""}
                />
              </label>
              {mode === "create" ? (
                <>
                  <label className="grid gap-1 text-sm">
                    Código
                    <input className={cls} name="code" required />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Grupo gerencial
                    <select name="group" className={cls}>
                      {Object.entries(groups).map(([v, l]) => (
                        <option value={v} key={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    Conta pai (opcional)
                    <select name="parent_id" className={cls}>
                      <option value="">Raiz</option>
                      {q.data
                        ?.filter((a) => !a.data.posting && a.data.active)
                        .map((a) => (
                          <option value={a.id} key={a.id}>
                            {a.code} · {a.data.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="posting" defaultChecked />
                    Conta analítica, permite classificações
                  </label>
                </>
              ) : (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={selected?.data.active}
                  />
                  Conta ativa para novos reconhecimentos
                </label>
              )}
            </>
          )}
          <label className="grid gap-1 text-sm">
            Justificativa
            <input name="reason" className={cls} required minLength={5} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" required />
            Confirmo a configuração gerencial
          </label>
          {error && <p role="alert">{error}</p>}
          <Button disabled={busy}>Confirmar configuração</Button>
        </form>
      </ModalForm>
      <ModalForm
        open={!!historyId}
        onOpenChange={(v) => {
          if (!v) setHistoryId(undefined);
        }}
        title="Histórico da conta"
      >
        {history.error ? (
          <ErrorState message={history.error.message} />
        ) : history.data ? (
          <DataTable
            items={history.data.versions}
            getKey={(v) => v.revision}
            columns={[
              { header: "Versão", cell: (v) => v.revision },
              { header: "Nome", cell: (v) => v.data.name },
              { header: "Motivo", cell: (v) => v.reason },
              { header: "Autor", cell: (v) => v.actorId },
            ]}
          />
        ) : (
          <LoadingState />
        )}
      </ModalForm>
    </div>
  );
}
