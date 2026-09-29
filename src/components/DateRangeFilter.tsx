const DATE_INPUT_CLASS =
  "rounded-md bg-surface border border-border px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors";

/**
 * Filtro de período De/Até (datas inclusivas, formato do input date,
 * "AAAA-MM-DD") — mesmo par de campos em Visitas, Histórico (FUC18) e
 * Comparação entre armas (FUC19). Vazio = sem limite daquele lado.
 */
export function DateRangeFilter({
  idPrefix,
  from,
  onFromChange,
  to,
  onToChange,
}: {
  idPrefix: string;
  from: string;
  onFromChange: (value: string) => void;
  to: string;
  onToChange: (value: string) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-1.5">
        <label htmlFor={`${idPrefix}-date-from`} className="text-xs uppercase tracking-wide text-foreground-muted">
          De
        </label>
        <input
          id={`${idPrefix}-date-from`}
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className={DATE_INPUT_CLASS}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <label htmlFor={`${idPrefix}-date-to`} className="text-xs uppercase tracking-wide text-foreground-muted">
          Até
        </label>
        <input
          id={`${idPrefix}-date-to`}
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className={DATE_INPUT_CLASS}
        />
      </div>
    </>
  );
}

/**
 * Período invertido não vai pro backend — a mensagem de validação dele
 * vem com o nome do campo na frente ("periodValid: ..."), então a tela
 * mostra a sua própria. Datas AAAA-MM-DD comparam certo como texto.
 */
export function dateRangeError(from: string, to: string): string | null {
  return from && to && from > to ? "A data inicial não pode ser depois da data final" : null;
}
