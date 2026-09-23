"use client";

import { useEffect, useRef, useState } from "react";

export type TimePoint = { date: string; value: number };

const HEIGHT = 180;
const MARGIN = { top: 12, right: 56, bottom: 24, left: 44 };
const DAY_MS = 24 * 60 * 60 * 1000;

// Datas vêm como "AAAA-MM-DD" (dia do calendário, sem hora) — tratadas em
// UTC do começo ao fim, senão new Date() em UTC-3 mostraria o dia anterior.
function dayNumber(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

function formatShortDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

export function formatFullDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

/** 3–5 marcas "redondas" (1, 2, 2,5, 5 × 10ⁿ) cobrindo [min, max]. */
function niceTicks(min: number, max: number): number[] {
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const rawStep = (max - min) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * magnitude).find((s) => s >= rawStep)!;
  const ticks: number[] = [];
  for (let t = Math.floor(min / step) * step; t <= max + step * 1e-9; t += step) {
    ticks.push(Number(t.toFixed(10)));
  }
  if (ticks[ticks.length - 1] < max) ticks.push(Number((ticks[ticks.length - 1] + step).toFixed(10)));
  return ticks;
}

/**
 * Gráfico de linha de uma série no tempo (inline SVG). Eixo X proporcional
 * ao calendário entre `startDate` e `endDate`: dia sem ponto é só um vão na
 * linha, nunca zero. Uma série só → sem legenda (o título nomeia); rótulo
 * direto só no último valor; crosshair com tooltip no hover/teclado; a
 * tabela (só pra leitor de tela) traz todos os valores.
 */
export function TimeLineChart({
  label,
  points,
  startDate,
  endDate,
  formatValue,
}: {
  label: string;
  points: TimePoint[];
  startDate: string;
  endDate: string;
  formatValue: (value: number) => string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 0);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

  const firstDay = dayNumber(startDate);
  const totalDays = Math.max(dayNumber(endDate) - firstDay, 1);
  const x = (date: string) => MARGIN.left + ((dayNumber(date) - firstDay) / totalDays) * innerWidth;

  const values = points.map((p) => p.value);
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const y = (value: number) => MARGIN.top + (1 - (value - yMin) / (yMax - yMin)) * innerHeight;

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.date)},${y(p.value)}`).join(" ");
  const last = points[points.length - 1];
  const active = activeIndex !== null ? points[activeIndex] : null;

  function handlePointerMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const pointerX = MARGIN.left + (e.clientX - rect.left);
    let nearest = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.date) - pointerX) < Math.abs(x(points[nearest].date) - pointerX)) nearest = i;
    });
    setActiveIndex(nearest);
  }

  function handleKeyDown(e: React.KeyboardEvent<SVGSVGElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const current = activeIndex ?? points.length - 1;
    const next = e.key === "ArrowLeft" ? Math.max(current - 1, 0) : Math.min(current + 1, points.length - 1);
    setActiveIndex(next);
  }

  const middleDate = new Date((firstDay + totalDays / 2) * DAY_MS).toISOString().slice(0, 10);

  return (
    <div ref={containerRef} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${label}. Use as setas pra percorrer os pontos.`}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onFocus={() => setActiveIndex(points.length - 1)}
          onBlur={() => setActiveIndex(null)}
          className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-target/50 rounded-md"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={MARGIN.left} x2={MARGIN.left + innerWidth} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
              <text
                x={MARGIN.left - 8}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-foreground-muted text-[11px] tabular-nums"
              >
                {t.toLocaleString("pt-BR")}
              </text>
            </g>
          ))}

          {[startDate, middleDate, endDate].map((date, i) => (
            <text
              key={date}
              x={x(date)}
              y={HEIGHT - 6}
              textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
              className="fill-foreground-muted text-[11px] tabular-nums"
            >
              {formatShortDate(date)}
            </text>
          ))}

          {active && (
            <line
              x1={x(active.date)}
              x2={x(active.date)}
              y1={MARGIN.top}
              y2={MARGIN.top + innerHeight}
              stroke="var(--foreground-muted)"
              strokeWidth={1}
            />
          )}

          <path d={path} fill="none" stroke="var(--accent-target-soft)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {points.map((p, i) => (
            <circle
              key={p.date}
              cx={x(p.date)}
              cy={y(p.value)}
              r={i === activeIndex ? 5 : 4}
              fill="var(--accent-target-soft)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          ))}

          <text
            x={x(last.date) + 8}
            y={y(last.value)}
            dominantBaseline="middle"
            className="fill-foreground text-xs font-medium"
          >
            {formatValue(last.value)}
          </text>

          {/* alvo de hover do tamanho da área toda: o ponteiro só precisa estar perto da data */}
          <rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setActiveIndex(null)}
          />
        </svg>
      )}

      {active && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 rounded-md bg-surface-raised px-2 py-1 text-xs whitespace-nowrap"
          style={{
            left: Math.min(Math.max(x(active.date) - 50, 0), Math.max(width - 110, 0)),
          }}
        >
          <span className="block font-medium text-foreground">{formatValue(active.value)}</span>
          <span className="block text-foreground-muted">{formatFullDate(active.date)}</span>
        </div>
      )}

      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Valor</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <td>{formatFullDate(p.date)}</td>
              <td>{formatValue(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
