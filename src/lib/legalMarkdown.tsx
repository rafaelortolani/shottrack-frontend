import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReactNode } from "react";

/**
 * Renderizador mínimo dos textos jurídicos em `docs/legal/` (FUC21): só o
 * subconjunto de markdown que eles usam — títulos (#, ##), citação (>),
 * parágrafos, listas com "-", tabela com "|" e **negrito**. Gera elementos
 * React (sem HTML cru), então o texto exibido é sempre o do arquivo.
 */
export type LegalDocument = "termos-de-uso" | "politica-de-privacidade";

export async function readLegalDocument(name: LegalDocument): Promise<string> {
  return readFile(path.join(process.cwd(), "docs", "legal", `${name}.md`), "utf-8");
}

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index} className="text-foreground font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    )
  );
}

function splitTableRow(line: string): string[] {
  return line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

export function renderLegalMarkdown(markdown: string): ReactNode[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  const isBlockStart = (line: string) =>
    /^#{1,2}\s/.test(line) || line.startsWith(">") || line.startsWith("- ") || line.startsWith("|");

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === "") {
      index++;
      continue;
    }

    const heading = line.match(/^(#{1,2})\s+(.*)$/);
    if (heading) {
      blocks.push(
        heading[1] === "#" ? (
          <h1 key={blocks.length} className="font-display text-lg font-semibold tracking-tight mb-3">
            {heading[2]}
          </h1>
        ) : (
          <h2 key={blocks.length} className="font-display text-base font-semibold mt-6 mb-1.5">
            {heading[2]}
          </h2>
        )
      );
      index++;
      continue;
    }

    if (line.startsWith(">")) {
      const quoted: string[] = [];
      while (index < lines.length && lines[index].startsWith(">")) {
        quoted.push(lines[index].replace(/^>\s?/, ""));
        index++;
      }
      blocks.push(
        <p key={blocks.length} className="text-sm border-l-2 border-accent-brass pl-3 text-foreground-muted mb-4">
          {renderInline(quoted.join(" "))}
        </p>
      );
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length && lines[index].trim() !== "" && !/^#{1,2}\s/.test(lines[index])) {
        if (lines[index].startsWith("- ")) {
          items.push(lines[index].slice(2));
        } else {
          items[items.length - 1] += ` ${lines[index].trim()}`;
        }
        index++;
      }
      blocks.push(
        <ul key={blocks.length} className="list-disc pl-5 space-y-1 text-foreground-muted mb-3">
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (index < lines.length && lines[index].startsWith("|")) {
        rows.push(splitTableRow(lines[index]));
        index++;
      }
      const [header, , ...body] = rows; // a 2ª linha é o separador |---|---|
      blocks.push(
        <div key={blocks.length} className="overflow-x-auto mb-3">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                {header.map((cell, cellIndex) => (
                  <th key={cellIndex} className="py-1.5 pr-3 text-xs uppercase tracking-wide text-foreground-muted border-b border-border">
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, rowIndex) => (
                <tr key={rowIndex} className="align-top">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="py-1.5 pr-3 text-foreground-muted border-b border-border">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() !== "" && !isBlockStart(lines[index])) {
      paragraph.push(lines[index].trim());
      index++;
    }
    blocks.push(
      <p key={blocks.length} className="text-foreground-muted mb-3">
        {renderInline(paragraph.join(" "))}
      </p>
    );
  }

  return blocks;
}
