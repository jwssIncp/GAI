import { useEffect, useRef, useState, type ReactNode } from "react";
import { equalPercentages, percentSumCents, type ContractPaymentPlan } from "./contractsApi";

const MAX_INSTALLMENTS = 60;

/**
 * Forma de pagamento do contrato: parcelas iguais, ou um percentual por parcela
 * (um campo por parcela, soma em tempo real; o envio fica bloqueado se não fechar 100%).
 */
export function PaymentPlanFields({
  initial,
  inputClass,
  Field,
}: {
  initial?: ContractPaymentPlan | null;
  inputClass: string;
  Field: (props: { label: string; children: ReactNode }) => ReactNode;
}) {
  const [mode, setMode] = useState<"" | "equal" | "percentages">(initial?.mode ?? "");
  const [countText, setCountText] = useState(String(initial?.installments ?? 1));
  const [percentages, setPercentages] = useState<string[]>(
    initial?.mode === "percentages" && initial.percentages?.length
      ? initial.percentages
      : equalPercentages(initial?.installments ?? 1),
  );
  const firstPct = useRef<HTMLInputElement>(null);
  const sum = percentSumCents(percentages);
  const closes = sum === 10000;

  useEffect(() => {
    firstPct.current?.setCustomValidity(
      mode === "percentages" && !closes ? "Os percentuais das parcelas precisam somar 100%." : "",
    );
  }, [mode, closes]);

  /** Guarda o texto digitado; só regenera as parcelas quando o número é válido (1 a 60). */
  function changeCount(text: string) {
    setCountText(text);
    const value = Number(text);
    if (Number.isInteger(value) && value >= 1 && value <= MAX_INSTALLMENTS)
      setPercentages(equalPercentages(value));
  }

  return (
    <>
      <Field label="Forma de pagamento">
        <select
          aria-label="Forma de pagamento"
          className={inputClass}
          name="plan_mode"
          value={mode}
          onChange={(event) => setMode(event.target.value as typeof mode)}
        >
          <option value="">Não informada</option>
          <option value="equal">Parcelas iguais</option>
          <option value="percentages">Percentual por parcela</option>
        </select>
      </Field>
      {mode ? (
        <Field label="Número de parcelas">
          <input
            className={inputClass}
            name="plan_installments"
            type="number"
            min="1"
            max={MAX_INSTALLMENTS}
            required
            value={countText}
            onChange={(event) => changeCount(event.target.value)}
          />
        </Field>
      ) : null}
      {mode === "percentages" ? (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Percentual de cada parcela</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {percentages.map((value, index) => (
              <label key={index} className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Parcela {index + 1} (%)</span>
                <input
                  ref={index === 0 ? firstPct : undefined}
                  className={inputClass}
                  name="plan_pct"
                  inputMode="decimal"
                  required
                  aria-label={`Percentual da parcela ${index + 1}`}
                  value={value}
                  onChange={(event) => {
                    const next = [...percentages];
                    next[index] = event.target.value.replace(",", ".");
                    setPercentages(next);
                  }}
                />
              </label>
            ))}
          </div>
          <p
            aria-live="polite"
            className={`text-sm font-medium ${closes ? "text-muted-foreground" : "text-destructive"}`}
          >
            Soma: {(sum / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%
            {closes ? "" : " — precisa fechar 100% para salvar."}
          </p>
        </fieldset>
      ) : null}
    </>
  );
}
