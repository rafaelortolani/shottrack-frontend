"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { TargetRings } from "@/components/TargetRings";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_LENGTH = 6;

type Step = "request" | "confirm";

export default function TrocarEmailPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("request");
  const [newEmail, setNewEmail] = useState("");
  const [confirmedEmail, setConfirmedEmail] = useState("");
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const codeInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  async function requestEmailChange(email: string) {
    const response = await fetch("/api/users/me/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (response.status === 401) {
      router.push("/login");
      return false;
    }

    if (!response.ok) {
      const { error } = await response.json();
      setEmailError(
        error?.code === "EMAIL_ALREADY_REGISTERED"
          ? "Esse email já está em uso por outra conta"
          : error?.message ?? "Não foi possível solicitar a troca de email"
      );
      return false;
    }

    return true;
  }

  async function handleRequestSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!EMAIL_PATTERN.test(newEmail)) {
      setEmailError("Email precisa ter um formato válido");
      return;
    }

    setEmailError(null);
    setSending(true);
    const ok = await requestEmailChange(newEmail);
    setSending(false);

    if (ok) {
      setConfirmedEmail(newEmail);
      setCode(Array(CODE_LENGTH).fill(""));
      setCodeError(null);
      setStep("confirm");
    }
  }

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);

    setCode((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });

    if (digit && index < CODE_LENGTH - 1) {
      codeInputsRef.current[index + 1]?.focus();
    }
  }

  function handleDigitKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && code[index] === "" && index > 0) {
      codeInputsRef.current[index - 1]?.focus();
    }
  }

  async function handleConfirmSubmit(e: React.FormEvent) {
    e.preventDefault();

    setCodeError(null);
    setConfirming(true);

    const response = await fetch("/api/users/me/email/confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.join("") }),
    });

    setConfirming(false);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      if (error?.code === "VERIFICATION_CODE_EXPIRED") {
        setCodeError("Código expirado, peça um novo");
      } else if (error?.code === "INVALID_VERIFICATION_CODE") {
        setCodeError("Código incorreto");
      } else {
        setCodeError(error?.message ?? "Não foi possível confirmar a troca de email");
      }
      return;
    }

    router.push("/usuario/perfil");
  }

  async function handleResend() {
    setResendMessage(null);
    setCodeError(null);
    setSending(true);
    const ok = await requestEmailChange(confirmedEmail);
    setSending(false);

    if (ok) {
      setCode(Array(CODE_LENGTH).fill(""));
      setResendMessage("Código reenviado");
      codeInputsRef.current[0]?.focus();
    }
  }

  function handleBack() {
    setStep("request");
    setCode(Array(CODE_LENGTH).fill(""));
    setCodeError(null);
    setResendMessage(null);
  }

  const codeComplete = code.every((digit) => digit !== "");

  return (
    <div className="relative">
      <TargetRings className="absolute -right-24 -top-24 w-[500px] h-[500px] text-accent-target pointer-events-none" />

      <div className="relative max-w-sm px-5 md:px-6 py-6 pb-20 md:pb-6">
        <Breadcrumb items={[{ href: "/usuario", label: "Usuário" }, { href: "/usuario/perfil", label: "Perfil" }, { label: "Trocar email" }]} />
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Trocar email
        </h1>
        <p className="text-foreground-muted mb-10">
          {step === "request"
            ? "Informe o novo email de login."
            : `Enviamos um código pra ${confirmedEmail}.`}
        </p>

        {step === "request" ? (
          <form onSubmit={handleRequestSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="newEmail" className="block text-sm text-foreground-muted mb-1.5">
                Novo email
              </label>
              <input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full rounded-md bg-surface border border-border px-3.5 py-2.5 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
                placeholder="novo@email.com"
              />
              {emailError && (
                <p className="text-sm text-accent-target mt-1.5" role="alert">
                  {emailError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-md bg-accent-target hover:bg-accent-target-hover disabled:opacity-60 text-foreground font-medium py-2.5 transition-colors"
            >
              {sending ? "Enviando código..." : "Enviar código"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleConfirmSubmit} noValidate className="space-y-5">
            <fieldset>
              <legend className="block text-sm text-foreground-muted mb-1.5">
                Código de verificação
              </legend>
              <div className="flex gap-2">
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      codeInputsRef.current[i] = el;
                    }}
                    aria-label={`Dígito ${i + 1} do código`}
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(i, e)}
                    className="w-12 h-14 text-center text-lg rounded-md bg-surface border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
                  />
                ))}
              </div>
              {codeError && (
                <p className="text-sm text-accent-target mt-2" role="alert">
                  {codeError}
                </p>
              )}
              {resendMessage && !codeError && (
                <p className="text-sm text-accent-brass mt-2" role="status">
                  {resendMessage}
                </p>
              )}
            </fieldset>

            <button
              type="submit"
              disabled={confirming || !codeComplete}
              className="w-full rounded-md bg-accent-target hover:bg-accent-target-hover disabled:opacity-60 text-foreground font-medium py-2.5 transition-colors"
            >
              {confirming ? "Confirmando..." : "Confirmar"}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={handleBack}
                className="text-foreground-muted hover:text-foreground transition-colors"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={sending}
                className="text-foreground-muted hover:text-foreground disabled:opacity-60 transition-colors"
              >
                Reenviar código
              </button>
            </div>
          </form>
        )}

        <p className="text-sm text-foreground-muted mt-6 text-center">
          <Link href="/usuario/perfil" className="hover:text-foreground transition-colors">
            Cancelar e voltar pro perfil
          </Link>
        </p>
      </div>
    </div>
  );
}
