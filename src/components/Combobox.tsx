"use client";

import { useId, useMemo, useRef, useState } from "react";

export type ComboboxOption = { id: string; name: string };

type Props = {
  id: string;
  label: string;
  options: ComboboxOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

const INPUT_CLASS =
  "w-full rounded-md bg-surface border border-border pl-3 pr-9 py-2 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors disabled:opacity-60";

/** Sem acento e sem caixa, para "sao" achar "São" e "g2c" achar "G2C". */
function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Seletor com busca digitável (padrão ARIA 1.2 "combobox com lista"): o campo filtra a lista enquanto se
 * digita; setas, Home/End, Enter e Esc funcionam; só se escolhe um item da lista (texto livre não vira valor).
 */
export function Combobox({ id, label, options, value, onChange, disabled, placeholder }: Props) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  // null = não está digitando: o campo mostra o nome do item selecionado
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const selected = options.find((o) => o.id === value);
  const filtered = useMemo(() => {
    const q = normalize(query ?? "");
    return q ? options.filter((o) => normalize(o.name).includes(q)) : options;
  }, [options, query]);

  const activeIndex = Math.min(active, Math.max(filtered.length - 1, 0));
  const optionId = (index: number) => `${listId}-${index}`;

  function openList() {
    if (disabled) return;
    setOpen(true);
    const index = filtered.findIndex((o) => o.id === value);
    setActive(index >= 0 ? index : 0);
  }

  function close() {
    setOpen(false);
    setQuery(null);
  }

  function choose(option: ComboboxOption) {
    if (option.id !== value) onChange(option.id);
    close();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) openList();
        else setActive(Math.min(activeIndex + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) openList();
        else setActive(Math.max(activeIndex - 1, 0));
        break;
      case "Home":
        if (open) {
          e.preventDefault();
          setActive(0);
        }
        break;
      case "End":
        if (open) {
          e.preventDefault();
          setActive(filtered.length - 1);
        }
        break;
      case "Enter":
        // Com a lista aberta, Enter escolhe o item — nunca envia o formulário
        if (open) {
          e.preventDefault();
          if (filtered[activeIndex]) choose(filtered[activeIndex]);
        }
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          close();
        }
        break;
      case "Tab":
        close();
        break;
    }
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="block text-xs uppercase tracking-wide text-foreground-muted mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[activeIndex] ? optionId(activeIndex) : undefined}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="done"
          disabled={disabled}
          placeholder={placeholder}
          value={query ?? selected?.name ?? ""}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={(e) => {
            // Selecionar o texto: digitar já substitui a escolha atual
            e.currentTarget.select();
            openList();
          }}
          onClick={() => {
            if (!open) openList();
          }}
          onBlur={close}
          onKeyDown={onKeyDown}
          className={INPUT_CLASS}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-foreground-muted"
        >
          ▾
        </span>
      </div>

      {open && !disabled && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          // mousedown não pode tirar o foco do campo, senão o blur fecha a lista antes do clique
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 right-0 z-content mt-1 max-h-60 overflow-y-auto overscroll-contain rounded-md border border-border bg-surface-raised shadow-lg"
        >
          {filtered.length === 0 ? (
            <li role="presentation" className="px-3 py-2 text-sm text-foreground-muted">
              Nenhum resultado
            </li>
          ) : (
            filtered.map((option, index) => (
              <li
                key={option.id}
                id={optionId(index)}
                role="option"
                aria-selected={option.id === value}
                ref={(el) => {
                  if (el && index === activeIndex) el.scrollIntoView({ block: "nearest" });
                }}
                onClick={() => choose(option)}
                onMouseMove={() => setActive(index)}
                className={`min-h-11 flex items-center px-3 py-2 cursor-pointer ${
                  index === activeIndex ? "bg-accent-target/15 text-foreground" : "text-foreground"
                } ${option.id === value ? "font-medium" : ""}`}
              >
                {option.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
