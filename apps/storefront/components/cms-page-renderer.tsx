import React from "react";
import type { CmsPage } from "@/lib/medusa";

interface CmsPageRendererProps {
  page: CmsPage;
}

/**
 * Lightweight, zero-dependency Markdown renderer for CMS editorial and policy pages.
 * Formats headings, tables, bullet points and paragraphs according to brutalist luxury tokens.
 */
export function CmsPageRenderer({ page }: CmsPageRendererProps) {
  const sections = parseMarkdown(page.body_md);

  return (
    <article className="mx-auto w-full max-w-4xl px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
      <header className="mb-10 border-b border-ink pb-6">
        <div className="flex items-center gap-2 font-mono text-label-caps uppercase text-muted">
          <span>The Hidden Label</span>
          <span>/</span>
          <span>{page.kind}</span>
        </div>
        <h1 className="mt-2 font-display text-headline-xl uppercase text-ink">
          {page.title}
        </h1>
      </header>

      <div className="space-y-8 font-sans text-body-md text-on-surface leading-relaxed">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-4">
            {section.heading && (
              <h2 className="font-display text-headline-sm uppercase text-ink border-b border-line pb-2 mt-8 first:mt-0">
                {section.heading}
              </h2>
            )}
            {section.subheading && (
              <h3 className="font-mono text-sm uppercase font-bold text-ink mt-4">
                {section.subheading}
              </h3>
            )}
            {section.table && (
              <div className="overflow-x-auto border border-line bg-surface my-4">
                <table className="w-full text-left font-sans text-body-sm border-collapse">
                  <thead>
                    <tr className="border-b border-line bg-surface-container/50 font-mono text-label-caps uppercase text-muted">
                      {section.table.headers.map((h, i) => (
                        <th key={i} className="p-3 font-semibold text-ink">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.table.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="border-b border-line/50 last:border-b-0 hover:bg-surface-container/20">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="p-3 text-ink font-mono text-xs">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {section.paragraphs.map((p, pIdx) => (
              <p key={pIdx} className="text-on-surface-variant leading-relaxed">
                {p}
              </p>
            ))}
          </div>
        ))}
      </div>
    </article>
  );
}

interface ParsedSection {
  heading?: string;
  subheading?: string;
  paragraphs: string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
}

function parseMarkdown(md: string): ParsedSection[] {
  const lines = md.split("\n");
  const sections: ParsedSection[] = [];
  let current: ParsedSection = { paragraphs: [] };

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    if (rawLine === undefined) {
      i++;
      continue;
    }
    const line = rawLine.trim();

    if (line.startsWith("## ")) {
      if (current.heading || current.paragraphs.length > 0 || current.table) {
        sections.push(current);
      }
      current = { heading: line.replace(/^##\s+/, ""), paragraphs: [] };
      i++;
      continue;
    }

    if (line.startsWith("### ")) {
      current.subheading = line.replace(/^###\s+/, "");
      i++;
      continue;
    }

    if (line.startsWith("|") && line.endsWith("|")) {
      // Parse markdown table
      const tableLines: string[] = [];
      while (i < lines.length) {
        const candidate = lines[i];
        if (candidate !== undefined && candidate.trim().startsWith("|")) {
          tableLines.push(candidate.trim());
          i++;
        } else {
          break;
        }
      }

      const firstLine = tableLines[0];
      if (tableLines.length >= 2 && firstLine !== undefined) {
        const parseRow = (rowStr: string) =>
          rowStr
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim());

        const headers = parseRow(firstLine);
        // line 1 is separator | --- | --- |
        const rows = tableLines.slice(2).map(parseRow);

        current.table = { headers, rows };
      }
      continue;
    }

    if (line.length > 0) {
      current.paragraphs.push(line);
    }

    i++;
  }

  if (current.heading || current.paragraphs.length > 0 || current.table) {
    sections.push(current);
  }

  return sections;
}
