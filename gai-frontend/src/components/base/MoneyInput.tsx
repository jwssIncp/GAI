import { forwardRef, useEffect, useState, type InputHTMLAttributes } from "react";
import { cn } from "@/utils/cn";
import { formatMoneyInput, parseMoneyInput } from "./moneyInputFormat";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "type"> & {
  /** Valor no formato da API ("50000.00"); controlado. */
  value?: string | number | null;
  /** Valor inicial no formato da API (modo não controlado). */
  defaultValue?: string | number | null;
  /** Recebe o valor no formato da API ("50000.00"), ou "" se vazio/inválido. */
  onValueChange?: (api: string) => void;
  /** Gera <input type="hidden" name=…> com o valor da API (formulários lidos com FormData). */
  name?: string;
  /** Aceita negativo (ajustes da DRE). */
  negative?: boolean;
};

/**
 * Campo de valor em reais, único no sistema: mostra e aceita "50.000,00"
 * (também cola "50000,00" e "50000.00") e envia à API o número "50000.00".
 * O rótulo do campo deve dizer "(R$)".
 */
export const MoneyInput = forwardRef<HTMLInputElement, Props>(function MoneyInput(
  { value, defaultValue, onValueChange, name, negative = false, className, onBlur, required, ...rest },
  ref,
) {
  const controlled = value !== undefined;
  const [text, setText] = useState(() => formatMoneyInput(controlled ? value : defaultValue));
  const [api, setApi] = useState(() => parseMoneyInput(formatMoneyInput(controlled ? value : defaultValue), negative) ?? "");
  const [inner, setInner] = useState<HTMLInputElement | null>(null);
  // valor controlado mudou por fora: reflete no campo
  useEffect(() => {
    if (!controlled) return;
    const next = value === null || value === "" ? "" : (parseMoneyInput(String(value).replace(".", ","), negative) ?? "");
    if (next !== api) {
      setApi(next);
      setText(formatMoneyInput(next));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const invalid = text !== "" && parseMoneyInput(text, negative) === null;
  useEffect(() => {
    inner?.setCustomValidity(invalid ? "Valor inválido. Use o formato 50.000,00." : "");
  }, [inner, invalid]);
  return (
    <>
      {name ? <input type="hidden" name={name} value={api} /> : null}
      <input
        {...rest}
        ref={(el) => {
          setInner(el);
          if (typeof ref === "function") ref(el);
          else if (ref) ref.current = el;
        }}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        required={required}
        aria-invalid={invalid || rest["aria-invalid"] || undefined}
        placeholder={rest.placeholder ?? "0,00"}
        className={cn(
          "h-10 w-full rounded-md border bg-background px-3 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const parsed = parseMoneyInput(e.target.value, negative) ?? "";
          setApi(parsed);
          onValueChange?.(parsed);
        }}
        onBlur={(e) => {
          // ao sair, mostra no padrão "50.000,00"
          const parsed = parseMoneyInput(text, negative);
          if (parsed !== null) setText(formatMoneyInput(parsed));
          onBlur?.(e);
        }}
      />
    </>
  );
});
