"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { DateRangeFilter, dateRangeError } from "@/components/DateRangeFilter";
import { weaponLabel, type Weapon } from "@/components/SeriesAccordion";
import { resultTypeKind, resultTypeUnit } from "@/lib/resultTypeFormat";

type Option = { id: string; name: string };
type ModalityOption = Option & { resultTypes: Option[] };

/** Uma entrada por arma (UC48); média/melhor ausentes quando não há dado. */
type ComparisonEntry = {
  weapon: Weapon;
  seriesCount: number;
  average?: number;
  best?: number;
};

const SELECT_CLASS =
  "rounded-md bg-surface border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors";

function formatValue(value: number, resultTypeName: string): string {
  const unit = resultTypeUnit(resultTypeName);
  return `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${unit ? ` ${unit.suffix}` : ""}`;
}

/**
 * FUC19: comparação entre armas (UC48). Seletores encadeados modalidade →
 * tipo de resultado, só com tipos numéricos (mesma lógica do FUC16 — são
 * os únicos com média/melhor). Depois do primeiro "Comparar", qualquer
 * troca de modalidade, tipo, período ou armas recalcula na hora.
 */
export default function CompararArmasPage() {
  const router = useRouter();
  const [options, setOptions] = useState<ModalityOption[] | null>(null);
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalityId, setModalityId] = useState("");
  const [resultTypeId, setResultTypeId] = useState("");
  const [selectedWeaponIds, setSelectedWeaponIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [comparing, setComparing] = useState(false);
  const [entries, setEntries] = useState<ComparisonEntry[] | null>(null);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      const [modalitiesRes, weaponsRes] = await Promise.all([fetch("/api/practiced-modalities"), fetch("/api/weapons")]);
      if (modalitiesRes.status === 401 || weaponsRes.status === 401) {
        router.push("/login");
        return;
      }
      if (!modalitiesRes.ok || !weaponsRes.ok) {
        if (!cancelled) setLoadError("Não foi possível carregar as opções de comparação");
        return;
      }
      const { data: modalities }: { data: Option[] } = await modalitiesRes.json();
      const { data: weaponsData }: { data: Weapon[] } = await weaponsRes.json();

      const withTypes = await Promise.all(
        modalities.map(async (modality) => {
          const res = await fetch(`/api/practiced-modalities/${modality.id}/result-types`);
          const types: Option[] = res.ok ? (await res.json()).data : [];
          return { ...modality, resultTypes: types.filter((t) => resultTypeKind(t.name) === "number") };
        })
      );
      const eligible = withTypes.filter((m) => m.resultTypes.length > 0);
      if (cancelled) return;

      setWeapons(weaponsData);
      setOptions(eligible);
      if (eligible.length > 0) {
        setModalityId(eligible[0].id);
        setResultTypeId(eligible[0].resultTypes[0].id);
      }
    }

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const enoughWeapons = selectedWeaponIds.length >= 2;
  const periodError = dateRangeError(startDate, endDate);

  useEffect(() => {
    if (!comparing || !enoughWeapons || periodError || !modalityId || !resultTypeId) return;
    let cancelled = false;

    async function loadComparison() {
      setLoadingEntries(true);
      const query = new URLSearchParams({ modalityId, resultTypeId });
      for (const id of selectedWeaponIds) query.append("weaponIds", id);
      if (startDate) query.set("startDate", startDate);
      if (endDate) query.set("endDate", endDate);

      const response = await fetch(`/api/weapons/comparison?${query}`);
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (cancelled) return;
      setLoadingEntries(false);

      if (!response.ok) {
        const { error } = await response.json();
        setError(error?.message ?? "Não foi possível comparar as armas");
        return;
      }
      setError(null);
      setEntries((await response.json()).data);
    }

    loadComparison();
    return () => {
      cancelled = true;
    };
  }, [router, comparing, enoughWeapons, periodError, modalityId, resultTypeId, selectedWeaponIds, startDate, endDate]);

  function toggleWeapon(id: string) {
    setSelectedWeaponIds((prev) => (prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]));
  }

  function handleModalityChange(id: string) {
    const next = options!.find((m) => m.id === id)!;
    setModalityId(id);
    setResultTypeId(next.resultTypes[0].id);
  }

  const breadcrumb = (
    <Breadcrumb items={[{ href: "/acervo", label: "Acervo" }, { href: "/acervo/armas", label: "Armas" }, { label: "Comparar" }]} />
  );

  if (loadError || options === null) {
    return (
      <div>
        {breadcrumb}
        <h1 className="font-display text-lg font-semibold mb-4">Comparar armas</h1>
        {loadError ? (
          <p className="text-sm text-accent-target" role="alert">{loadError}</p>
        ) : (
          <p className="text-foreground-muted">Carregando...</p>
        )}
      </div>
    );
  }

  if (weapons.length < 2) {
    return (
      <div>
        {breadcrumb}
        <h1 className="font-display text-lg font-semibold mb-4">Comparar armas</h1>
        <p className="text-foreground-muted mb-3">A comparação precisa de pelo menos 2 armas no acervo.</p>
        <Link href="/acervo/armas/nova" className="text-sm text-accent-target-soft hover:text-accent-target transition-colors">
          + Cadastrar arma
        </Link>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div>
        {breadcrumb}
        <h1 className="font-display text-lg font-semibold mb-4">Comparar armas</h1>
        <p className="text-foreground-muted mb-3">
          Pra comparar, pratique uma modalidade com algum tipo de resultado numérico configurado.
        </p>
        <Link href="/usuario/modalidades" className="text-sm text-accent-target-soft hover:text-accent-target transition-colors">
          Ver modalidades
        </Link>
      </div>
    );
  }

  const modality = options.find((m) => m.id === modalityId)!;
  const resultType = modality.resultTypes.find((t) => t.id === resultTypeId)!;
  const unit = resultTypeUnit(resultType.name);
  const showResults = comparing && enoughWeapons && !periodError && entries !== null;

  return (
    <div>
      {breadcrumb}
      <h1 className="font-display text-lg font-semibold mb-4">Comparar armas</h1>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select
          aria-label="Modalidade"
          value={modalityId}
          onChange={(e) => handleModalityChange(e.target.value)}
          className={SELECT_CLASS}
        >
          {options.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select
          aria-label="Tipo de resultado"
          value={resultTypeId}
          onChange={(e) => setResultTypeId(e.target.value)}
          className={SELECT_CLASS}
        >
          {modality.resultTypes.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <DateRangeFilter
          idPrefix="comparison"
          from={startDate}
          onFromChange={setStartDate}
          to={endDate}
          onToChange={setEndDate}
        />
      </div>

      <fieldset className="mb-3">
        <legend className="text-xs uppercase tracking-wide text-foreground-muted mb-1">Armas</legend>
        <ul>
          {weapons.map((weapon) => (
            <li key={weapon.id} className="border-b border-border last:border-0">
              <label className="flex items-center gap-3 py-2 px-3 border-l-2 border-accent-target cursor-pointer hover:bg-surface rounded-r-md transition-colors">
                <input
                  type="checkbox"
                  checked={selectedWeaponIds.includes(weapon.id)}
                  onChange={() => toggleWeapon(weapon.id)}
                  className="accent-accent-target"
                />
                <span className="text-foreground">{weaponLabel(weapon)}</span>
                <span className="text-sm text-foreground-muted">{weapon.caliber.name}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => setComparing(true)}
          disabled={!enoughWeapons}
          className="rounded-md bg-accent-target hover:bg-accent-target-hover disabled:opacity-60 disabled:cursor-not-allowed text-background text-sm font-medium py-2 px-4 transition-colors"
        >
          Comparar
        </button>
        {!enoughWeapons && <p className="text-sm text-foreground-muted">Selecione pelo menos 2 armas</p>}
      </div>

      {(periodError || error) && (
        <p className="text-sm text-accent-target mb-3" role="alert">{periodError ?? error}</p>
      )}

      {comparing && enoughWeapons && entries === null && !error && !periodError && (
        <p className="text-sm text-foreground-muted">Comparando...</p>
      )}

      {showResults && (
        <section aria-labelledby="comparison-title" className="rounded-md bg-surface p-4">
          <h2 id="comparison-title" className="font-display text-base font-semibold mb-1">
            Resultado
          </h2>
          <p className="text-sm text-foreground-muted mb-2">
            {resultType.name}
            {unit ? ` (${unit.suffix})` : ""} — {modality.name}
          </p>
          {/* recalcular mantém a tabela anterior esmaecida, sem pular layout */}
          <table
            aria-busy={loadingEntries}
            className={`w-full text-sm ${loadingEntries ? "opacity-50" : ""} transition-opacity`}
          >
            <thead>
              <tr className="text-xs uppercase tracking-wide text-foreground-muted text-left">
                <th scope="col" className="py-2 pr-3 font-normal">Arma</th>
                <th scope="col" className="py-2 px-3 font-normal text-right">Séries</th>
                <th scope="col" className="py-2 px-3 font-normal text-right">Média</th>
                <th scope="col" className="py-2 pl-3 font-normal text-right">Melhor</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.weapon.id} className="border-t border-border">
                  <th scope="row" className="py-2 pr-3 text-left font-normal text-foreground">
                    <span className="border-l-2 border-accent-target pl-2">{weaponLabel(entry.weapon)}</span>
                  </th>
                  {entry.seriesCount === 0 || entry.average == null ? (
                    <td colSpan={3} className="py-2 pl-3 text-right text-foreground-muted">
                      Sem dados nesse período/modalidade
                    </td>
                  ) : (
                    <>
                      <td className="py-2 px-3 text-right text-foreground">{entry.seriesCount}</td>
                      <td className="py-2 px-3 text-right text-foreground">{formatValue(entry.average, resultType.name)}</td>
                      <td className="py-2 pl-3 text-right font-display font-semibold text-accent-target-soft">
                        {entry.best != null ? formatValue(entry.best, resultType.name) : "—"}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
