"use client";

import { useEffect, useRef, useState } from "react";
import { callApi } from "@/lib/clientApi";
import { PLAN_CODE_FORMAT, PLAN_NAME_MAX, PLAN_NAME_MIN, PLAN_ERROR_MESSAGES, planErrorMessage, type Plan } from "@/lib/plans";
import { INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "../../habitualidade/_components/ui";

const CODE_ERRORS = new Set(["PLAN_CODE_INVALID", "PLAN_CODE_ALREADY_EXISTS"]);
const NAME_ERRORS = new Set(["PLAN_NAME_INVALID", "PLAN_NAME_ALREADY_EXISTS"]);

/** "Novo plano" (UC68): nome, código em maiúsculas (não muda depois) e cópia opcional dos limites de outro plano. */
export function NewPlanDialog({
  plans,
  onCreated,
  onClose,
}: {
  plans: Plan[];
  onCreated: (plan: Plan) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    const nameProblem =
      trimmed.length < PLAN_NAME_MIN || trimmed.length > PLAN_NAME_MAX ? PLAN_ERROR_MESSAGES.PLAN_NAME_INVALID : null;
    const codeProblem = PLAN_CODE_FORMAT.test(code) ? null : PLAN_ERROR_MESSAGES.PLAN_CODE_INVALID;
    setNameError(nameProblem);
    setCodeError(codeProblem);
    setFormError(null);
    if (nameProblem || codeProblem) return;

    setSaving(true);
    const result = await callApi<Plan>("/api/admin/plans", {
      method: "POST",
      body: { name: trimmed, code, copyFromCode: copyFrom || null },
      fallback: "Não foi possível criar o plano",
    });
    setSaving(false);
    if (result.ok) {
      onCreated(result.data);
      return;
    }
    const message = planErrorMessage(result.code, result.message, result.status);
    if (result.code && CODE_ERRORS.has(result.code)) setCodeError(message);
    else if (result.code && NAME_ERRORS.has(result.code)) setNameError(message);
    else setFormError(message);
  }

  return (
    <div className="fixed inset-0 z-dialog flex items-center justify-center bg-background/80 p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-plan-title"
        noValidate
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-md bg-surface p-5 space-y-3"
      >
        <h2 id="new-plan-title" className="font-display text-base font-semibold">
          Novo plano
        </h2>

        <div>
          <label htmlFor="new-plan-name" className={LABEL_CLASS}>
            Nome
          </label>
          <input
            id="new-plan-name"
            ref={nameRef}
            value={name}
            maxLength={PLAN_NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={nameError !== null}
            aria-describedby={nameError ? "new-plan-name-error" : undefined}
            placeholder="Ex.: Avançado"
            className={INPUT_CLASS}
          />
          {nameError && (
            <p id="new-plan-name-error" className="text-sm text-accent-target mt-1" role="alert">
              {nameError}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="new-plan-code" className={LABEL_CLASS}>
            Código
          </label>
          <input
            id="new-plan-code"
            value={code}
            maxLength={30}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            aria-invalid={codeError !== null}
            aria-describedby={codeError ? "new-plan-code-hint new-plan-code-error" : "new-plan-code-hint"}
            placeholder="Ex.: AVANCADO"
            className={INPUT_CLASS}
          />
          <p id="new-plan-code-hint" className="text-xs text-foreground-muted mt-1">
            Letras maiúsculas, números e _, começando por letra. O código não muda depois de criado.
          </p>
          {codeError && (
            <p id="new-plan-code-error" className="text-sm text-accent-target mt-1" role="alert">
              {codeError}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="new-plan-copy" className={LABEL_CLASS}>
            Copiar limites de (opcional)
          </label>
          <select id="new-plan-copy" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} className={INPUT_CLASS}>
            <option value="">Não copiar (limites padrão)</option>
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {formError && (
          <p className="text-sm text-accent-target" role="alert">
            {formError}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className={`min-h-11 ${PRIMARY_BUTTON_CLASS}`}>
            {saving ? "Criando..." : "Criar plano"}
          </button>
          <button type="button" onClick={onClose} className={`min-h-11 ${SECONDARY_BUTTON_CLASS}`}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
