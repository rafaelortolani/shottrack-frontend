"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TargetRings } from "@/components/TargetRings";

type Catalog = { id: string; name: string };

const INPUT_CLASS =
  "w-full rounded-md bg-surface border border-border px-3.5 py-2.5 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors";

export default function NovaMunicaoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [manufacturers, setManufacturers] = useState<Catalog[]>([]);
  const [calibers, setCalibers] = useState<Catalog[]>([]);

  const [manufacturerId, setManufacturerId] = useState("");
  const [nickname, setNickname] = useState("");
  const [caliberId, setCaliberId] = useState("");
  const [projectileWeightGrains, setProjectileWeightGrains] = useState("");
  const [powderCharge, setPowderCharge] = useState("");
  const [projectileType, setProjectileType] = useState("");
  const [lot, setLot] = useState("");
  const [notes, setNotes] = useState("");

  const [identificationError, setIdentificationError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      const [manufacturersRes, calibersRes] = await Promise.all([
        fetch("/api/ammunition-catalog/manufacturers"),
        fetch("/api/weapon-catalog/calibers"),
      ]);

      if ([manufacturersRes, calibersRes].some((r) => r.status === 401)) {
        router.push("/login");
        return;
      }

      if (!manufacturersRes.ok || !calibersRes.ok) {
        if (!cancelled) {
          setError("Não foi possível carregar o catálogo");
          setLoading(false);
        }
        return;
      }

      const { data: manufacturersData } = await manufacturersRes.json();
      const { data: calibersData } = await calibersRes.json();

      if (!cancelled) {
        setManufacturers(manufacturersData);
        setCalibers(calibersData);
        setLoading(false);
      }
    }

    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!manufacturerId && !nickname.trim()) {
      setIdentificationError("Informe ao menos o fabricante ou um apelido");
      return;
    }

    setIdentificationError(null);
    setError(null);
    setSaving(true);

    const payload: Record<string, unknown> = {};
    if (manufacturerId) payload.manufacturerId = manufacturerId;
    if (nickname.trim()) payload.nickname = nickname.trim();
    if (caliberId) payload.caliberId = caliberId;
    if (projectileWeightGrains) payload.projectileWeightGrains = Number(projectileWeightGrains);
    if (powderCharge) payload.powderCharge = Number(powderCharge);
    if (projectileType.trim()) payload.projectileType = projectileType.trim();
    if (lot.trim()) payload.lot = lot.trim();
    if (notes.trim()) payload.notes = notes.trim();

    const response = await fetch("/api/ammunitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      if (error?.code === "AMMUNITION_IDENTIFICATION_REQUIRED") {
        setIdentificationError("Informe ao menos o fabricante ou um apelido");
      } else {
        setError(error?.message ?? "Não foi possível cadastrar a munição");
      }
      return;
    }

    router.push("/acervo/municoes");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-foreground-muted">Carregando catálogo...</p>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background text-foreground">
      <div className="relative w-full max-w-sm px-6">
        <TargetRings className="absolute -top-14 -right-14 z-0 w-[380px] h-[380px] text-accent-target-soft pointer-events-none" />

        <div className="relative z-10">
          <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
            Cadastrar munição
          </h1>
          <p className="text-foreground-muted mb-10">
            Informe pelo menos o fabricante ou um apelido pra identificar.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="manufacturerId" className="block text-sm text-foreground-muted mb-1.5">
                Fabricante <span className="text-foreground-muted/60">· opcional</span>
              </label>
              <select
                id="manufacturerId"
                value={manufacturerId}
                onChange={(e) => setManufacturerId(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">Nenhum</option>
                {manufacturers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="nickname" className="block text-sm text-foreground-muted mb-1.5">
                Apelido <span className="text-foreground-muted/60">· opcional</span>
              </label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ex: Minha recarga"
                className={INPUT_CLASS}
              />
            </div>

            {identificationError && (
              <p className="text-sm text-accent-target" role="alert">
                {identificationError}
              </p>
            )}

            <details className="rounded-md border border-border px-4 py-3">
              <summary className="text-sm text-foreground-muted cursor-pointer select-none">
                Detalhes adicionais (opcional)
              </summary>

              <div className="space-y-5 mt-4">
                <div>
                  <label htmlFor="caliberId" className="block text-sm text-foreground-muted mb-1.5">
                    Calibre
                  </label>
                  <select
                    id="caliberId"
                    value={caliberId}
                    onChange={(e) => setCaliberId(e.target.value)}
                    className={INPUT_CLASS}
                  >
                    <option value="">Nenhum</option>
                    {calibers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="projectileWeightGrains" className="block text-sm text-foreground-muted mb-1.5">
                    Peso do projétil (grains)
                  </label>
                  <input
                    id="projectileWeightGrains"
                    type="number"
                    step="any"
                    value={projectileWeightGrains}
                    onChange={(e) => setProjectileWeightGrains(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label htmlFor="powderCharge" className="block text-sm text-foreground-muted mb-1.5">
                    Quantidade de pólvora
                  </label>
                  <input
                    id="powderCharge"
                    type="number"
                    step="any"
                    value={powderCharge}
                    onChange={(e) => setPowderCharge(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label htmlFor="projectileType" className="block text-sm text-foreground-muted mb-1.5">
                    Tipo de projétil
                  </label>
                  <input
                    id="projectileType"
                    type="text"
                    value={projectileType}
                    onChange={(e) => setProjectileType(e.target.value)}
                    placeholder="Ex: FMJ, JHP..."
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label htmlFor="lot" className="block text-sm text-foreground-muted mb-1.5">
                    Lote
                  </label>
                  <input
                    id="lot"
                    type="text"
                    value={lot}
                    onChange={(e) => setLot(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label htmlFor="notes" className="block text-sm text-foreground-muted mb-1.5">
                    Observações
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            </details>

            {error && (
              <p className="text-sm text-accent-target" role="alert">
                {error}
              </p>
            )}

            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-accent-target hover:bg-accent-target-hover disabled:opacity-60 text-foreground font-medium py-2.5 px-6 transition-colors"
              >
                {saving ? "Cadastrando..." : "Cadastrar"}
              </button>
              <Link href="/acervo/municoes" className="text-sm text-foreground-muted hover:text-foreground transition-colors">
                Cancelar
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
