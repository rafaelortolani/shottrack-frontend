"use client";

import { useState } from "react";
import { IconEye, IconEyeOff } from "@tabler/icons-react";

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

/** Campo de senha com botão "olho" para mostrar/ocultar o que foi digitado. */
export function PasswordInput({ className = "", ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? IconEyeOff : IconEye;

  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${className} pr-11`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? "Ocultar caracteres" : "Mostrar caracteres"}
        className="absolute inset-y-0 right-0 flex min-h-11 min-w-11 items-center justify-center text-foreground-muted hover:text-foreground transition-colors"
      >
        <Icon size={20} stroke={1.75} />
      </button>
    </div>
  );
}
