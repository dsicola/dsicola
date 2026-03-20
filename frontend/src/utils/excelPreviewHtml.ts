/**
 * Pré-visualização fiel de .xlsx: alinhamento, merges, larguras/alturas, fontes, bordas e fundos.
 * SheetJS (xlsx) na versão comunitária não expõe estilos completos; ExcelJS lê o OOXML corretamente.
 * ExcelJS é carregado só ao abrir a pré-visualização (import dinâmico) para não incher o bundle principal.
 */
import type { Cell } from "exceljs";

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function argbToCss(argb: string | undefined): string | undefined {
  if (!argb || typeof argb !== "string") return undefined;
  const s = argb.replace(/^#/, "").toUpperCase();
  if (s.length === 8) return `#${s.slice(2)}`;
  if (s.length === 6) return `#${s}`;
  return undefined;
}

function borderCss(side: { style?: string; color?: { argb?: string } } | undefined): string {
  if (!side?.style) return "";
  const color = argbToCss(side.color?.argb) ?? "#000000";
  const style = side.style;
  const width =
    style === "thick"
      ? "3px"
      : style === "medium" || style === "mediumDashed" || style === "mediumDashDot" || style === "mediumDashDotDot"
        ? "2px"
        : style === "hair" || style === "dotted"
          ? "1px"
          : "1px";
  const line =
    style === "double"
      ? "double"
      : style === "dotted" || style === "dashDot" || style === "dashDotDot"
        ? "dotted"
        : style.includes("dash") || style === "slantDashDot"
          ? "dashed"
          : "solid";
  return `${width} ${line} ${color}`;
}

function buildCellInlineStyle(cell: Cell): string {
  const parts: string[] = ["box-sizing:border-box"];

  const font = cell.font;
  if (font?.bold) parts.push("font-weight:700");
  if (font?.italic) parts.push("font-style:italic");
  if (font?.underline) parts.push("text-decoration:underline");
  if (typeof font?.size === "number") parts.push(`font-size:${font.size}pt`);
  if (font?.name) {
    const fn = String(font.name).replace(/'/g, "\\'");
    parts.push(`font-family:'${fn}',Arial,sans-serif`);
  }
  const fg = argbToCss(font?.color?.argb);
  if (fg) parts.push(`color:${fg}`);

  const fill = cell.fill;
  if (fill && fill.type === "pattern" && fill.pattern && fill.pattern !== "none") {
    const bg = argbToCss(fill.fgColor?.argb);
    if (bg) parts.push(`background-color:${bg}`);
  }

  const al = cell.alignment;
  if (al?.horizontal) {
    const h = al.horizontal;
    const map: Record<string, string> = {
      centerContinuous: "center",
      distributed: "justify",
      fill: "left",
      justify: "justify",
    };
    parts.push(`text-align:${map[h] ?? h}`);
  }
  if (al?.vertical) {
    const v = al.vertical === "middle" ? "middle" : al.vertical === "bottom" ? "bottom" : "top";
    parts.push(`vertical-align:${v}`);
  }
  if (al?.wrapText) {
    parts.push("white-space:normal", "word-wrap:break-word");
  } else {
    parts.push("white-space:nowrap", "overflow:hidden", "text-overflow:ellipsis");
  }
  if (typeof al?.indent === "number" && al.indent > 0) {
    parts.push(`padding-left:${al.indent * 8}px`);
  }

  const tr = al?.textRotation;
  if (tr === "vertical") {
    parts.push("writing-mode:vertical-rl", "text-orientation:mixed", "max-height:12em");
  } else if (typeof tr === "number" && tr !== 0) {
    const deg = tr > 90 ? 90 - tr : -tr;
    parts.push(
      `transform:rotate(${deg}deg)`,
      "transform-origin:center center",
      "white-space:normal"
    );
  }

  const b = cell.border;
  if (b?.top?.style) parts.push(`border-top:${borderCss(b.top)}`);
  if (b?.left?.style) parts.push(`border-left:${borderCss(b.left)}`);
  if (b?.bottom?.style) parts.push(`border-bottom:${borderCss(b.bottom)}`);
  if (b?.right?.style) parts.push(`border-right:${borderCss(b.right)}`);

  return parts.join(";");
}

function normalizeMergeRange(s: string): string {
  const i = s.lastIndexOf("!");
  const raw = i >= 0 ? s.slice(i + 1) : s;
  return raw.replace(/^'|'$/g, "");
}

function decodeA1(ref: string): { row: number; col: number } {
  const m = ref.trim().match(/^([A-Za-z]+)(\d+)$/);
  if (!m) return { row: 1, col: 1 };
  let col = 0;
  const L = m[1].toUpperCase();
  for (let i = 0; i < L.length; i++) col = col * 26 + (L.charCodeAt(i) - 64);
  return { row: parseInt(m[2], 10), col };
}

function parseMergeRange(rangeStr: string): { top: number; left: number; bottom: number; right: number } {
  const r = normalizeMergeRange(rangeStr);
  const parts = r.split(":");
  const a = decodeA1(parts[0]);
  if (parts.length === 1) return { top: a.row, left: a.col, bottom: a.row, right: a.col };
  const b = decodeA1(parts[1]);
  return {
    top: Math.min(a.row, b.row),
    left: Math.min(a.col, b.col),
    bottom: Math.max(a.row, b.row),
    right: Math.max(a.col, b.col),
  };
}

const DOC_STYLES = `
  html, body { margin: 0; padding: 0; background: #e8e8e8; }
  body { padding: 12px; overflow: auto; }
  table.excel-fiel {
    border-collapse: collapse;
    table-layout: fixed;
    background: #fff;
    margin: 0 auto;
    box-shadow: 0 1px 4px rgba(0,0,0,.12);
  }
  table.excel-fiel td {
    margin: 0;
    padding: 0 3px;
    line-height: 1.2;
  }
  table.excel-fiel col { min-width: 40px; }
`;

/**
 * Documento HTML completo (para iframe srcDoc) com a primeira folha do .xlsx.
 */
export async function excelBase64ToPreviewHtmlDocument(base64: string): Promise<string | null> {
  try {
    const mod = await import("exceljs");
    const Excel = mod.default as {
      Workbook: new () => import("exceljs").Workbook;
      ValueType: { Merge: number };
    };

    const binary = atob(base64.replace(/\s/g, ""));
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);

    const workbook = new Excel.Workbook();
    await workbook.xlsx.load(buf);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) return null;

    const dim = worksheet.dimensions;
    const top = dim.top;
    const left = dim.left;
    const bottom = dim.bottom;
    const right = dim.right;

    const covered = new Set<string>();
    const mergeSpan = new Map<string, { rs: number; cs: number }>();
    const merges = worksheet.model.merges ?? [];
    for (const m of merges) {
      if (typeof m !== "string") continue;
      const rng = parseMergeRange(m);
      mergeSpan.set(`${rng.top},${rng.left}`, {
        rs: rng.bottom - rng.top + 1,
        cs: rng.right - rng.left + 1,
      });
      for (let r = rng.top; r <= rng.bottom; r++) {
        for (let c = rng.left; c <= rng.right; c++) {
          if (r !== rng.top || c !== rng.left) covered.add(`${r},${c}`);
        }
      }
    }

    const colParts: string[] = [];
    for (let c = left; c <= right; c++) {
      const col = worksheet.getColumn(c);
      const w = col.width;
      const widthStyle =
        typeof w === "number" && w > 0
          ? `width:${w}ch;min-width:${Math.max(4, w * 0.55)}em`
          : "width:8.5ch;min-width:4.5em";
      colParts.push(`<col style="${widthStyle}" />`);
    }

    const rowsHtml: string[] = [];
    for (let r = top; r <= bottom; r++) {
      const row = worksheet.getRow(r);
      const rh = row.height;
      const trStyle =
        typeof rh === "number" && rh > 0 ? ` style="height:${rh}pt;max-height:${rh}pt"` : "";

      const cells: string[] = [];
      for (let c = left; c <= right; c++) {
        if (covered.has(`${r},${c}`)) continue;

        const cell = worksheet.getCell(r, c);
        if (cell.type === Excel.ValueType.Merge) continue;

        const span = mergeSpan.get(`${r},${c}`);
        const rs = span?.rs ?? 1;
        const cs = span?.cs ?? 1;
        const spanAttr = rs > 1 || cs > 1 ? ` rowspan="${rs}" colspan="${cs}"` : "";

        const inner = escapeHtmlText(cell.text ?? "");
        const style = buildCellInlineStyle(cell);
        cells.push(`<td${spanAttr} style="${style}">${inner}</td>`);
      }
      rowsHtml.push(`<tr${trStyle}>${cells.join("")}</tr>`);
    }

    const table = `<table class="excel-fiel" role="presentation"><colgroup>${colParts.join("")}</colgroup><tbody>${rowsHtml.join("")}</tbody></table>`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${DOC_STYLES}</style></head><body>${table}</body></html>`;
  } catch {
    return null;
  }
}
