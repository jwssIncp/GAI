import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/base/DataTable";
import { ErrorState, LoadingState } from "@/components/base/States";
import { Button } from "@/components/ui/button";
import { ModalForm } from "@/components/ui/dialog";
import { usePermissions } from "@/features/auth/usePermissions";
import { useAuth } from "@/features/auth/AuthContext";
import {
  budgetApi,
  budgetDate,
  pricingMoney,
  pricingNumbers,
  pricingRates,
  type Pricing,
  type PricingValues,
} from "./budgetApi";
const cls = "rounded-lg border bg-background p-2 text-sm";
export function BudgetPricingPage() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions(),
    cache = useQueryClient(),
    [open, setOpen] = useState(false),
    [copy, setCopy] = useState<Pricing>();
  const query = useQuery({
    queryKey: ["budget-pricing", user?.id, user?.organization_id],
    queryFn: budgetApi.pricing,
  });
  const save = useMutation({
    mutationFn: (form: FormData) => {
      const values = Object.fromEntries(
        [...pricingMoney, ...pricingRates].map(([key]) => [
          key,
          String(form.get(key)),
        ]),
      );
      const numbers = Object.fromEntries(
        pricingNumbers.map(([key]) => [key, Number(form.get(key))]),
      );
      return budgetApi.publish({
        ...values,
        ...numbers,
        currency: String(form.get("currency")),
        name: String(form.get("name")),
        valid_from: String(form.get("valid_from")),
        valid_to: String(form.get("valid_to")),
        reason: String(form.get("reason")),
      } as PricingValues & {
        name: string;
        valid_from: string;
        valid_to: string;
        reason: string;
      });
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["budget-pricing"] });
      setOpen(false);
    },
  });
  function show(p?: Pricing) {
    setCopy(p);
    save.reset();
    setOpen(true);
  }
  return (
    <div className="grid gap-4">
      <h2 className="text-lg font-semibold">Parâmetros de precificação</h2>
      <p className="text-sm text-muted-foreground">
        Não há valores oficiais pré-preenchidos. Publicar exige autorização
        comercial e justificativa. Cada versão é imutável, com vigência sem
        sobreposição para o mesmo conjunto. Taxas são premissas informadas, sem
        cálculo tributário legal automático.
      </p>
      {hasPermission("budgets:configure-prices") ? (
        <Button onClick={() => show()}>Publicar parâmetros</Button>
      ) : null}
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState />
      ) : (
        <DataTable
          items={query.data ?? []}
          getKey={(p) => p.id}
          columns={[
            {
              header: "Conjunto / versão",
              cell: (p) => `${p.name} · v${p.version}`,
            },
            {
              header: "Vigência",
              cell: (p) =>
                `${budgetDate(p.validFrom)} a ${budgetDate(p.validTo)}`,
            },
            { header: "Produtividade", cell: (p) => p.values.productivity },
            { header: "Moeda", cell: (p) => p.values.currency },
            {
              header: "Responsável / justificativa",
              cell: (p) => `Usuário #${p.actorId} · ${p.reason}`,
            },
            {
              header: "Ações",
              cell: (p) => (
                <div className="grid gap-2">
                  <details>
                    <summary>Consultar valores</summary>
                    {[...pricingNumbers, ...pricingMoney, ...pricingRates].map(
                      ([key, label]) => (
                        <p className="text-xs" key={key}>
                          {label}: {p.values[key]}
                        </p>
                      ),
                    )}
                  </details>
                  {hasPermission("budgets:configure-prices") ? (
                    <button
                      className="text-primary underline"
                      onClick={() => show(p)}
                    >
                      Nova versão deste conjunto
                    </button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      )}
      <ModalForm
        open={open}
        onOpenChange={setOpen}
        title="Publicar parâmetros de preços"
      >
        <form
          key={copy?.id ?? "new"}
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(new FormData(e.currentTarget));
          }}
        >
          <label className="grid gap-1 text-sm">
            Nome do conjunto
            <input
              className={cls}
              name="name"
              defaultValue={copy?.name}
              required
              minLength={2}
              maxLength={100}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Início da vigência
            <input className={cls} type="date" name="valid_from" required />
          </label>
          <label className="grid gap-1 text-sm">
            Fim da vigência
            <input className={cls} type="date" name="valid_to" required />
          </label>
          <label className="grid gap-1 text-sm">
            Moeda
            <select
              aria-label="Moeda"
              className={cls}
              name="currency"
              defaultValue={copy?.values.currency ?? "BRL"}
            >
              {["BRL", "USD", "EUR"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          {pricingNumbers.map(([key, label, min, max]) => (
            <label key={key} className="grid gap-1 text-sm">
              {label}
              <input
                className={cls}
                name={key}
                type="number"
                min={min}
                max={max}
                step="1"
                defaultValue={copy?.values[key]}
                required
              />
            </label>
          ))}
          {pricingMoney.map(([key, label]) => (
            <label key={key} className="grid gap-1 text-sm">
              {label}
              <input
                className={cls}
                name={key}
                inputMode="decimal"
                pattern="[0-9]{1,13}(\.[0-9]{1,2})?"
                defaultValue={copy?.values[key]}
                required
              />
            </label>
          ))}
          {pricingRates.map(([key, label]) => (
            <label key={key} className="grid gap-1 text-sm">
              {label}
              <input
                className={cls}
                name={key}
                inputMode="decimal"
                pattern={
                  key === "address_factor"
                  ? "[0-9]{1,2}([.][0-9]{1,4})?"
                  : "[0-9]{1,2}([.][0-9]{1,2})?"
                }
                defaultValue={copy?.values[key]}
                required
              />
            </label>
          ))}
          <label className="grid gap-1 text-sm">
            Justificativa e referência de aprovação comercial
            <textarea
              className={cls}
              name="reason"
              required
              minLength={5}
              maxLength={2000}
            />
          </label>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" required />
            Confirmo a autorização comercial destes parâmetros e sua vigência.
          </label>
          {save.isError ? <p role="alert">{save.error.message}</p> : null}
          <Button
            type="submit"
            loading={save.isPending}
            disabled={save.isPending}
          >
            Confirmar publicação
          </Button>
        </form>
      </ModalForm>
    </div>
  );
}
