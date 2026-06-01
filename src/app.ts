// Google Analytics default capture for this template.
// Future LLM edits: do not remove this gtag setup unless replacing it with equivalent page analytics capture.
const googleAnalyticsId = "G-ZKTPLMMFDQ";
const storageKey = "spreadsheet-state";
export const rowCount = 1024;
export const columnCount = 1024;
export const columnLabels = createColumnLabels(columnCount);
const rowHeight = 42;
const columnWidth = 116;
const rowHeaderWidth = 64;
const columnHeaderHeight = 40;
const renderBuffer = 4;

export interface AppState {
  cells: string[][];
}

interface AppElements {
  cellEditorInput: HTMLInputElement;
  cellEditorLabel: HTMLElement;
  cellCount: HTMLElement;
  clearSheetDialog: HTMLDialogElement;
  clearSheetButton: HTMLButtonElement;
  confirmClearSheetButton: HTMLButtonElement;
  downloadCsvButton: HTMLButtonElement;
  downloadJsonButton: HTMLButtonElement;
  grid: HTMLElement;
  importFileInput: HTMLInputElement;
  importSheetButton: HTMLButtonElement;
  navLinks: NodeListOf<HTMLAnchorElement>;
  saveState: HTMLElement;
  sheetWrap: HTMLElement;
}

declare global {
  interface Window {
    dataLayer?: IArguments[];
    gtag?: (...args: unknown[]) => void;
  }
}

function createColumnLabels(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    let label = "";
    let value = index + 1;

    while (value > 0) {
      value -= 1;
      label = String.fromCharCode(65 + (value % 26)) + label;
      value = Math.floor(value / 26);
    }

    return label;
  });
}

function createEmptyRows(): string[][] {
  return Array.from({ length: rowCount }, () => Array.from({ length: columnCount }, () => ""));
}

export function createDefaultState(): AppState {
  const cells = createEmptyRows();
  cells[0] = [
    "Project",
    "Owner",
    "Status",
    "Due",
    "Budget",
    "Notes",
    "Priority",
    "Updated",
    ...Array.from({ length: columnCount - 8 }, () => ""),
  ];
  cells[1] = [
    "Website launch",
    "Team",
    "In progress",
    "2026-06-15",
    "4200",
    "Public spreadsheet",
    "High",
    "Today",
    ...Array.from({ length: columnCount - 8 }, () => ""),
  ];
  cells[2] = [
    "Content pass",
    "Editorial",
    "Ready",
    "2026-06-07",
    "900",
    "Export after review",
    "Medium",
    "Today",
    ...Array.from({ length: columnCount - 8 }, () => ""),
  ];
  cells[3] = [
    "QA sweep",
    "Ops",
    "Open",
    "2026-06-10",
    "1100",
    "Browser-only storage",
    "High",
    "Today",
    ...Array.from({ length: columnCount - 8 }, () => ""),
  ];
  cells[4]![4] = "=SUM(E2:E4)";
  return { cells };
}

function normalizeCell(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 200) : "";
}

function normalizeImportedCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.slice(0, 200);
  if (typeof value === "number" || typeof value === "boolean") return String(value).slice(0, 200);
  return "";
}

function normalizeRows(value: unknown, defaultState: AppState): string[][] {
  if (!Array.isArray(value)) return defaultState.cells;

  return rowsToSheet(value);
}

function rowsToSheet(
  rows: unknown[],
  fallbackCells = createEmptyRows(),
  normalizeValue: (value: unknown) => string = normalizeCell,
): string[][] {
  return createEmptyRows().map((row, rowIndex) => {
    const storedRow = rows[rowIndex];
    if (!Array.isArray(storedRow)) return fallbackCells[rowIndex] ?? row;
    return row.map((_, columnIndex) => normalizeValue(storedRow[columnIndex]));
  });
}

export function parseStoredState(storedState: string | null, defaultState: AppState): AppState {
  if (!storedState) return defaultState;

  try {
    const parsed = JSON.parse(storedState) as Record<string, unknown>;
    return { cells: normalizeRows(parsed.cells, defaultState) };
  } catch {
    return defaultState;
  }
}

export function updateCell(state: AppState, rowIndex: number, columnIndex: number, value: string): AppState {
  if (rowIndex < 0 || rowIndex >= rowCount || columnIndex < 0 || columnIndex >= columnCount) return state;

  const cells = state.cells.slice();
  cells[rowIndex] = [...(cells[rowIndex] ?? []), ...Array.from({ length: columnCount }, () => "")].slice(0, columnCount);
  cells[rowIndex][columnIndex] = value.slice(0, 200);

  return {
    cells,
  };
}

export function clearSheet(state: AppState): AppState {
  return { ...state, cells: createEmptyRows() };
}

export function countFilledCells(state: AppState): number {
  return state.cells.flat().filter((cell) => cell.trim()).length;
}

interface CellReference {
  columnIndex: number;
  rowIndex: number;
}

type FormulaValue = number | string;
interface FormulaRange {
  columnCount: number;
  rowCount: number;
  values: FormulaValue[];
}
type FormulaArgument = FormulaValue | FormulaRange;

function parseCellReference(reference: string): CellReference | undefined {
  const match = /^([A-Z]+)(\d+)$/i.exec(reference.trim());
  if (!match) return undefined;

  const [, letters = "", row = "0"] = match;
  const columnIndex = [...letters.toUpperCase()].reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1;
  const rowIndex = Number.parseInt(row, 10) - 1;

  if (columnIndex < 0 || columnIndex >= columnCount || rowIndex < 0 || rowIndex >= rowCount) return undefined;
  return { columnIndex, rowIndex };
}

function cellAddress(rowIndex: number, columnIndex: number): string {
  return `${columnLabels[columnIndex] ?? ""}${rowIndex + 1}`;
}

function numericCellValue(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;

  const normalized = trimmed.replaceAll(",", "").replace(/^\$/, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formulaValueAsNumber(value: FormulaValue): number {
  return typeof value === "number" ? value : numericCellValue(value);
}

function formulaValueAsText(value: FormulaValue): string {
  return typeof value === "number" ? formatFormulaResult(value) : value;
}

function compareFormulaValues(left: FormulaValue, right: FormulaValue): number {
  const leftNumber = formulaValueAsNumber(left);
  const rightNumber = formulaValueAsNumber(right);
  if (leftNumber || rightNumber || formulaValueAsText(left).trim() === "0" || formulaValueAsText(right).trim() === "0") {
    return leftNumber - rightNumber;
  }
  return formulaValueAsText(left).localeCompare(formulaValueAsText(right), undefined, { sensitivity: "base" });
}

function flattenFormulaArguments(values: FormulaArgument[]): FormulaValue[] {
  return values.flatMap((value) => (typeof value === "object" ? value.values : [value]));
}

function formulaArgumentAsValue(value: FormulaArgument | undefined): FormulaValue {
  if (value === undefined) return "";
  return typeof value === "object" ? value.values[0] ?? "" : value;
}

function formatFormulaResult(value: FormulaValue): string {
  if (typeof value === "string") return value;
  if (!Number.isFinite(value)) return "#ERROR";
  return Number.parseFloat(value.toFixed(10)).toString();
}

export function evaluateCell(state: AppState, rowIndex: number, columnIndex: number): string {
  return evaluateCellValue(state, rowIndex, columnIndex, new Set());
}

function evaluateCellValue(state: AppState, rowIndex: number, columnIndex: number, seen: Set<string>): string {
  const value = state.cells[rowIndex]?.[columnIndex] ?? "";
  if (!value.trim().startsWith("=")) return value;

  const address = cellAddress(rowIndex, columnIndex);
  if (seen.has(address)) return "#CYCLE";

  seen.add(address);
  const result = evaluateFormulaValue(state, value.trim().slice(1), seen);
  seen.delete(address);
  return formatFormulaResult(result);
}

function evaluateFormulaValue(state: AppState, expression: string, seen: Set<string>): FormulaValue {
  let index = 0;

  function skipWhitespace() {
    while (/\s/.test(expression[index] ?? "")) index += 1;
  }

  function readNumber(): number | undefined {
    skipWhitespace();
    const start = index;
    while (/[0-9.]/.test(expression[index] ?? "")) index += 1;
    if (start === index) return undefined;

    const value = Number(expression.slice(start, index));
    if (!Number.isFinite(value)) throw new Error("Invalid number");
    return value;
  }

  function readString(): string | undefined {
    skipWhitespace();
    const quote = expression[index];
    if (quote !== "\"" && quote !== "'") return undefined;
    index += 1;
    let value = "";
    while (index < expression.length) {
      const char = expression[index] ?? "";
      if (char === quote) {
        if (expression[index + 1] === quote) {
          value += quote;
          index += 2;
          continue;
        }
        index += 1;
        return value;
      }
      value += char;
      index += 1;
    }
    throw new Error("Unclosed string");
  }

  function readLetters(): string {
    skipWhitespace();
    const start = index;
    while (/[A-Za-z]/.test(expression[index] ?? "")) index += 1;
    return expression.slice(start, index).toUpperCase();
  }

  function readCellReference(firstLetters: string): CellReference | undefined {
    const start = index;
    while (/[0-9]/.test(expression[index] ?? "")) index += 1;
    if (start === index) return undefined;
    return parseCellReference(`${firstLetters}${expression.slice(start, index)}`);
  }

  function getReferenceValue(reference: CellReference): FormulaValue {
    const value = evaluateCellValue(state, reference.rowIndex, reference.columnIndex, seen);
    if (value === "#CYCLE") throw new Error("Cycle");
    return value;
  }

  function readRange(firstReference: CellReference): FormulaRange | undefined {
    skipWhitespace();
    if (expression[index] !== ":") return undefined;

    index += 1;
    const letters = readLetters();
    const secondReference = letters ? readCellReference(letters) : undefined;
    if (!secondReference) throw new Error("Invalid range");

    const minRow = Math.min(firstReference.rowIndex, secondReference.rowIndex);
    const maxRow = Math.max(firstReference.rowIndex, secondReference.rowIndex);
    const minColumn = Math.min(firstReference.columnIndex, secondReference.columnIndex);
    const maxColumn = Math.max(firstReference.columnIndex, secondReference.columnIndex);
    const values: FormulaValue[] = [];

    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
        values.push(getReferenceValue({ rowIndex, columnIndex }));
      }
    }

    return {
      columnCount: maxColumn - minColumn + 1,
      rowCount: maxRow - minRow + 1,
      values,
    };
  }

  function parseArgument(): FormulaArgument {
    skipWhitespace();
    const start = index;
    const letters = readLetters();
    if (letters) {
      const reference = readCellReference(letters);
      if (reference) {
        const range = readRange(reference);
        if (range) return range;
      }
      index = start;
    }

    return parseExpression();
  }

  function parseFunction(name: string): FormulaValue {
    skipWhitespace();
    if (expression[index] !== "(") throw new Error("Missing function arguments");
    index += 1;

    const args: FormulaArgument[] = [];
    skipWhitespace();
    if (expression[index] !== ")") {
      while (index < expression.length) {
        args.push(parseArgument());
        skipWhitespace();
        if (expression[index] !== ",") break;
        index += 1;
      }
    }

    skipWhitespace();
    if (expression[index] !== ")") throw new Error("Unclosed function");
    index += 1;

    const values = flattenFormulaArguments(args);

    switch (name) {
      case "SUM":
        return values.reduce<number>((total, value) => total + formulaValueAsNumber(value), 0);
      case "COUNT":
        return values.filter((value) => {
          if (typeof value === "number") return Number.isFinite(value);
          return value.trim() !== "" && Number.isFinite(Number(value.replaceAll(",", "").replace(/^\$/, "")));
        }).length;
      case "AVERAGE":
        return values.length
          ? values.reduce<number>((total, value) => total + formulaValueAsNumber(value), 0) / values.length
          : 0;
      case "MIN":
        return values.length ? Math.min(...values.map(formulaValueAsNumber)) : 0;
      case "MAX":
        return values.length ? Math.max(...values.map(formulaValueAsNumber)) : 0;
      case "POWER":
        return Math.pow(formulaValueAsNumber(values[0] ?? 0), formulaValueAsNumber(values[1] ?? 0));
      case "CEILING":
        return Math.ceil(formulaValueAsNumber(values[0] ?? 0) / formulaValueAsNumber(values[1] ?? 1)) * formulaValueAsNumber(values[1] ?? 1);
      case "FLOOR":
        return Math.floor(formulaValueAsNumber(values[0] ?? 0) / formulaValueAsNumber(values[1] ?? 1)) * formulaValueAsNumber(values[1] ?? 1);
      case "CONCAT":
        return values.map(formulaValueAsText).join("");
      case "TRIM":
        return formulaValueAsText(values[0] ?? "").trim().replace(/\s+/g, " ");
      case "REPLACE": {
        const text = formulaValueAsText(values[0] ?? "");
        const start = Math.max(1, Math.trunc(formulaValueAsNumber(values[1] ?? 1)));
        const length = Math.max(0, Math.trunc(formulaValueAsNumber(values[2] ?? 0)));
        return `${text.slice(0, start - 1)}${formulaValueAsText(values[3] ?? "")}${text.slice(start - 1 + length)}`;
      }
      case "SUBSTITUTE":
        return formulaValueAsText(values[0] ?? "").replaceAll(formulaValueAsText(values[1] ?? ""), formulaValueAsText(values[2] ?? ""));
      case "LEFT":
        return formulaValueAsText(values[0] ?? "").slice(0, Math.max(0, Math.trunc(formulaValueAsNumber(values[1] ?? 1))));
      case "RIGHT": {
        const text = formulaValueAsText(values[0] ?? "");
        return text.slice(Math.max(0, text.length - Math.max(0, Math.trunc(formulaValueAsNumber(values[1] ?? 1)))));
      }
      case "MID": {
        const text = formulaValueAsText(values[0] ?? "");
        const start = Math.max(1, Math.trunc(formulaValueAsNumber(values[1] ?? 1)));
        const length = Math.max(0, Math.trunc(formulaValueAsNumber(values[2] ?? 0)));
        return text.slice(start - 1, start - 1 + length);
      }
      case "UPPER":
        return formulaValueAsText(values[0] ?? "").toUpperCase();
      case "LOWER":
        return formulaValueAsText(values[0] ?? "").toLowerCase();
      case "PROPER":
        return formulaValueAsText(values[0] ?? "").toLowerCase().replace(/\b\p{L}/gu, (char) => char.toUpperCase());
      case "NOW":
        return new Date().toISOString();
      case "TODAY":
        return new Date().toISOString().slice(0, 10);
      case "DATEDIF": {
        const start = new Date(formulaValueAsText(values[0] ?? ""));
        const end = new Date(formulaValueAsText(values[1] ?? ""));
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return Number.NaN;
        const unit = formulaValueAsText(values[2] ?? "d").toLowerCase();
        const days = Math.floor((end.getTime() - start.getTime()) / 86400000);
        if (unit === "y") return end.getUTCFullYear() - start.getUTCFullYear();
        if (unit === "m") return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
        return days;
      }
      case "VLOOKUP": {
        const table = args[1];
        if (typeof table !== "object") return Number.NaN;
        const lookup = formulaArgumentAsValue(args[0]);
        const resultColumn = Math.trunc(formulaValueAsNumber(formulaArgumentAsValue(args[2]))) - 1;
        const rangeLookup = formulaValueAsText(formulaArgumentAsValue(args[3])).toLowerCase() === "true";
        let approximateMatch: FormulaValue = "#N/A";
        for (let rowIndex = 0; rowIndex < table.rowCount; rowIndex += 1) {
          const rowOffset = rowIndex * table.columnCount;
          const comparison = compareFormulaValues(table.values[rowOffset] ?? "", lookup);
          if (!rangeLookup && comparison === 0) return table.values[rowOffset + resultColumn] ?? "";
          if (rangeLookup && comparison <= 0) approximateMatch = table.values[rowOffset + resultColumn] ?? "";
        }
        return approximateMatch;
      }
      case "HLOOKUP": {
        const table = args[1];
        if (typeof table !== "object") return Number.NaN;
        const lookup = formulaArgumentAsValue(args[0]);
        const resultRow = Math.trunc(formulaValueAsNumber(formulaArgumentAsValue(args[2]))) - 1;
        const rangeLookup = formulaValueAsText(formulaArgumentAsValue(args[3])).toLowerCase() === "true";
        let approximateMatch: FormulaValue = "#N/A";
        for (let columnIndex = 0; columnIndex < table.columnCount; columnIndex += 1) {
          const comparison = compareFormulaValues(table.values[columnIndex] ?? "", lookup);
          if (!rangeLookup && comparison === 0) return table.values[resultRow * table.columnCount + columnIndex] ?? "";
          if (rangeLookup && comparison <= 0) approximateMatch = table.values[resultRow * table.columnCount + columnIndex] ?? "";
        }
        return approximateMatch;
      }
      case "IF":
        return formulaValueAsNumber(values[0] ?? 0) ? values[1] ?? "" : values[2] ?? "";
      default:
        throw new Error("Unknown function");
    }
  }

  function parsePrimary(): FormulaValue {
    skipWhitespace();

    if (expression[index] === "(") {
      index += 1;
      const value = parseExpression();
      skipWhitespace();
      if (expression[index] !== ")") throw new Error("Unclosed expression");
      index += 1;
      return value;
    }

    const number = readNumber();
    if (number !== undefined) return number;

    const string = readString();
    if (string !== undefined) return string;

    const letters = readLetters();
    if (letters) {
      const reference = readCellReference(letters);
      if (reference) return getReferenceValue(reference);
      if (letters === "TRUE") return 1;
      if (letters === "FALSE") return 0;
      return parseFunction(letters);
    }

    throw new Error("Invalid formula");
  }

  function parseUnary(): FormulaValue {
    skipWhitespace();
    if (expression[index] === "-") {
      index += 1;
      return -formulaValueAsNumber(parseUnary());
    }

    if (expression[index] === "+") {
      index += 1;
      return formulaValueAsNumber(parseUnary());
    }

    return parsePrimary();
  }

  function parseTerm(): FormulaValue {
    let value = parseUnary();

    while (index < expression.length) {
      skipWhitespace();
      const operator = expression[index];
      if (operator !== "*" && operator !== "/") break;
      index += 1;
      const right = parseUnary();
      value =
        operator === "*"
          ? formulaValueAsNumber(value) * formulaValueAsNumber(right)
          : formulaValueAsNumber(value) / formulaValueAsNumber(right);
    }

    return value;
  }

  function parseAdditive(): FormulaValue {
    let value = parseTerm();

    while (index < expression.length) {
      skipWhitespace();
      const operator = expression[index];
      if (operator !== "+" && operator !== "-") break;
      index += 1;
      const right = parseTerm();
      value =
        operator === "+"
          ? formulaValueAsNumber(value) + formulaValueAsNumber(right)
          : formulaValueAsNumber(value) - formulaValueAsNumber(right);
    }

    return value;
  }

  function parseExpression(): FormulaValue {
    let value = parseAdditive();

    skipWhitespace();
    const operator =
      expression.slice(index, index + 2) === ">=" ||
      expression.slice(index, index + 2) === "<=" ||
      expression.slice(index, index + 2) === "<>"
        ? expression.slice(index, index + 2)
        : expression[index] === ">" || expression[index] === "<" || expression[index] === "="
          ? expression[index]
          : "";

    if (operator) {
      index += operator.length;
      const right = parseAdditive();
      const comparison = compareFormulaValues(value, right);
      switch (operator) {
        case ">":
          return comparison > 0 ? 1 : 0;
        case "<":
          return comparison < 0 ? 1 : 0;
        case ">=":
          return comparison >= 0 ? 1 : 0;
        case "<=":
          return comparison <= 0 ? 1 : 0;
        case "=":
          return comparison === 0 ? 1 : 0;
        case "<>":
          return comparison !== 0 ? 1 : 0;
      }
    }

    return value;
  }

  try {
    const value = parseExpression();
    skipWhitespace();
    if (index !== expression.length) throw new Error("Trailing input");
    return value;
  } catch {
    return Number.NaN;
  }
}

function escapeCsvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll("\"", "\"\"")}"` : value;
}

function usedRangeCells(state: AppState): string[][] {
  let lastRowIndex = -1;
  let lastColumnIndex = -1;

  state.cells.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      if (!cell.trim()) return;
      lastRowIndex = Math.max(lastRowIndex, rowIndex);
      lastColumnIndex = Math.max(lastColumnIndex, columnIndex);
    });
  });

  if (lastRowIndex < 0 || lastColumnIndex < 0) return [];

  return state.cells.slice(0, lastRowIndex + 1).map((row) => row.slice(0, lastColumnIndex + 1));
}

export function toCsv(state: AppState): string {
  return usedRangeCells(state)
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");
}

export function toJson(state: AppState): string {
  const cells = usedRangeCells(state);
  const [headerRow = []] = cells;
  const columns = columnLabels.slice(0, cells[0]?.length ?? 0);
  const rows = cells.slice(1).map((row) =>
    Object.fromEntries(
      row.map((cell, index) => [headerRow[index]?.trim() || columnLabels[index] || `Column ${index + 1}`, cell]),
    ),
  );

  return JSON.stringify({ columns, cells, rows }, null, 2);
}

export function fromCsv(content: string): AppState {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let index = 0;
  let inQuotes = false;

  while (index < content.length) {
    const char = content[index] ?? "";
    if (inQuotes) {
      if (char === "\"" && content[index + 1] === "\"") {
        cell += "\"";
        index += 2;
        continue;
      }
      if (char === "\"") {
        inQuotes = false;
      } else {
        cell += char;
      }
      index += 1;
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
    index += 1;
  }

  row.push(cell);
  if (row.length > 1 || row[0] !== "" || content.endsWith(",")) rows.push(row);
  return { cells: rowsToSheet(rows, createEmptyRows(), normalizeImportedCell) };
}

function jsonRowsToCells(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) {
    if (value.every((row) => Array.isArray(row))) return value;
    if (value.every((row) => row && typeof row === "object" && !Array.isArray(row))) {
      const keys = Array.from(new Set(value.flatMap((row) => Object.keys(row as Record<string, unknown>))));
      return [keys, ...value.map((row) => keys.map((key) => (row as Record<string, unknown>)[key]))];
    }
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.cells)) return record.cells;
    if (Array.isArray(record.rows)) return jsonRowsToCells(record.rows);
  }

  return undefined;
}

export function fromJson(content: string): AppState {
  const parsed = JSON.parse(content) as unknown;
  const rows = jsonRowsToCells(parsed);
  if (!rows) throw new Error("JSON must contain rows or cells");
  return { cells: rowsToSheet(rows, createEmptyRows(), normalizeImportedCell) };
}

function initializeGoogleAnalytics() {
  const googleTagScript = document.createElement("script");
  googleTagScript.async = true;
  googleTagScript.src = `https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`;
  document.head.append(googleTagScript);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer?.push(arguments);
  };

  window.gtag("js", new Date());
  window.gtag("config", googleAnalyticsId);
}

function getElement<T extends Element>(selector: string, type: { new (): T }): T {
  const element = document.querySelector(selector);
  if (!(element instanceof type)) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

function getElements(): AppElements {
  return {
    cellEditorInput: getElement("#cell-editor-input", HTMLInputElement),
    cellEditorLabel: getElement("#cell-editor-label", HTMLElement),
    cellCount: getElement("#cell-count", HTMLElement),
    clearSheetDialog: getElement("#clear-sheet-dialog", HTMLDialogElement),
    clearSheetButton: getElement("#clear-sheet", HTMLButtonElement),
    confirmClearSheetButton: getElement("#confirm-clear-sheet", HTMLButtonElement),
    downloadCsvButton: getElement("#download-csv", HTMLButtonElement),
    downloadJsonButton: getElement("#download-json", HTMLButtonElement),
    grid: getElement("#spreadsheet-grid", HTMLElement),
    importFileInput: getElement("#import-file", HTMLInputElement),
    importSheetButton: getElement("#import-sheet", HTMLButtonElement),
    navLinks: document.querySelectorAll<HTMLAnchorElement>(".nav a"),
    saveState: getElement("#save-state", HTMLElement),
    sheetWrap: getElement("#sheet-wrap", HTMLElement),
  };
}

function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function initializeApp() {
  initializeGoogleAnalytics();

  const defaultState = createDefaultState();
  const elements = getElements();
  let state = parseStoredState(localStorage.getItem(storageKey), defaultState);
  let saveTimer: number | undefined;
  let selectedCell: CellReference = { rowIndex: 0, columnIndex: 0 };

  function saveState() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      elements.saveState.textContent = "Saved locally";
    } catch {
      elements.saveState.textContent = "Storage full";
      return;
    }

    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      elements.saveState.textContent = "Autosaved in this browser";
    }, 1600);
  }

  function updateCellEditor() {
    elements.cellEditorLabel.textContent = cellAddress(selectedCell.rowIndex, selectedCell.columnIndex);
    elements.cellEditorInput.value = state.cells[selectedCell.rowIndex]?.[selectedCell.columnIndex] ?? "";
  }

  function selectCell(rowIndex: number, columnIndex: number, input?: HTMLInputElement) {
    selectedCell = { rowIndex, columnIndex };
    updateCellEditor();
    elements.grid.querySelector(".grid-cell.selected")?.classList.remove("selected");
    input?.closest(".grid-cell")?.classList.add("selected");
  }

  function focusCell(rowIndex: number, columnIndex: number) {
    selectedCell = {
      rowIndex: Math.max(0, Math.min(rowCount - 1, rowIndex)),
      columnIndex: Math.max(0, Math.min(columnCount - 1, columnIndex)),
    };

    const cellLeft = rowHeaderWidth + selectedCell.columnIndex * columnWidth;
    const cellTop = columnHeaderHeight + selectedCell.rowIndex * rowHeight;
    const viewportLeft = elements.sheetWrap.scrollLeft;
    const viewportTop = elements.sheetWrap.scrollTop;
    const viewportRight = viewportLeft + elements.sheetWrap.clientWidth;
    const viewportBottom = viewportTop + elements.sheetWrap.clientHeight;

    if (cellLeft < viewportLeft + rowHeaderWidth) {
      elements.sheetWrap.scrollLeft = Math.max(0, cellLeft - rowHeaderWidth);
    } else if (cellLeft + columnWidth > viewportRight) {
      elements.sheetWrap.scrollLeft = cellLeft + columnWidth - elements.sheetWrap.clientWidth;
    }

    if (cellTop < viewportTop + columnHeaderHeight) {
      elements.sheetWrap.scrollTop = Math.max(0, cellTop - columnHeaderHeight);
    } else if (cellTop + rowHeight > viewportBottom) {
      elements.sheetWrap.scrollTop = cellTop + rowHeight - elements.sheetWrap.clientHeight;
    }

    renderGrid();
    updateCellEditor();

    window.requestAnimationFrame(() => {
      const input = elements.grid.querySelector<HTMLInputElement>(
        `input[data-row="${selectedCell.rowIndex}"][data-column="${selectedCell.columnIndex}"]`,
      );
      input?.focus();
      input?.select();
    });
  }

  function moveSelectionForKey(event: KeyboardEvent, rowIndex: number, columnIndex: number): boolean {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;

    switch (event.key) {
      case "ArrowUp":
        focusCell(rowIndex - 1, columnIndex);
        return true;
      case "ArrowDown":
        focusCell(rowIndex + 1, columnIndex);
        return true;
      case "ArrowLeft":
        focusCell(rowIndex, columnIndex - 1);
        return true;
      case "ArrowRight":
        focusCell(rowIndex, columnIndex + 1);
        return true;
      default:
        return false;
    }
  }

  function pasteCellValue(rowIndex: number, columnIndex: number, input: HTMLInputElement, value: string) {
    state = updateCell(state, rowIndex, columnIndex, value);
    const cellValue = state.cells[rowIndex]?.[columnIndex] ?? "";
    input.value = cellValue;
    if (selectedCell.rowIndex === rowIndex && selectedCell.columnIndex === columnIndex) {
      elements.cellEditorInput.value = cellValue;
    }
    saveState();
    renderFooter();
    renderGrid();
  }

  function handleClipboardShortcut(
    event: KeyboardEvent,
    rowIndex: number,
    columnIndex: number,
    input: HTMLInputElement,
  ): boolean {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return false;

    const key = event.key.toLowerCase();
    if (key === "c") {
      if (!navigator.clipboard?.writeText) return false;
      event.preventDefault();
      void navigator.clipboard.writeText(state.cells[rowIndex]?.[columnIndex] ?? "").catch(() => undefined);
      return true;
    }

    if (key === "v") {
      if (!navigator.clipboard?.readText) return false;
      event.preventDefault();
      void navigator.clipboard.readText().then((value) => {
        pasteCellValue(rowIndex, columnIndex, input, value);
      }).catch(() => undefined);
      return true;
    }

    return false;
  }

  function renderGrid() {
    elements.grid.replaceChildren();
    elements.grid.style.width = `${rowHeaderWidth + columnCount * columnWidth}px`;
    elements.grid.style.height = `${columnHeaderHeight + rowCount * rowHeight}px`;

    const scrollLeft = elements.sheetWrap.scrollLeft;
    const scrollTop = elements.sheetWrap.scrollTop;
    const viewportWidth = elements.sheetWrap.clientWidth;
    const viewportHeight = elements.sheetWrap.clientHeight;
    const firstColumn = Math.max(0, Math.floor((scrollLeft - rowHeaderWidth) / columnWidth) - renderBuffer);
    const lastColumn = Math.min(
      columnCount - 1,
      Math.ceil((scrollLeft + viewportWidth - rowHeaderWidth) / columnWidth) + renderBuffer,
    );
    const firstRow = Math.max(0, Math.floor((scrollTop - columnHeaderHeight) / rowHeight) - renderBuffer);
    const lastRow = Math.min(
      rowCount - 1,
      Math.ceil((scrollTop + viewportHeight - columnHeaderHeight) / rowHeight) + renderBuffer,
    );

    const corner = document.createElement("div");
    corner.className = "grid-corner";
    corner.setAttribute("aria-hidden", "true");
    corner.style.transform = `translate(${scrollLeft}px, ${scrollTop}px)`;
    elements.grid.append(corner);

    for (let columnIndex = firstColumn; columnIndex <= lastColumn; columnIndex += 1) {
      const header = document.createElement("div");
      header.className = "grid-header column-header";
      header.role = "columnheader";
      header.textContent = columnLabels[columnIndex] ?? "";
      header.style.transform = `translate(${rowHeaderWidth + columnIndex * columnWidth}px, ${scrollTop}px)`;
      elements.grid.append(header);
    }

    for (let rowIndex = firstRow; rowIndex <= lastRow; rowIndex += 1) {
      const header = document.createElement("div");
      header.className = "grid-header row-header";
      header.role = "rowheader";
      header.textContent = String(rowIndex + 1);
      header.style.transform = `translate(${scrollLeft}px, ${columnHeaderHeight + rowIndex * rowHeight}px)`;
      elements.grid.append(header);

      for (let columnIndex = firstColumn; columnIndex <= lastColumn; columnIndex += 1) {
        const cell = state.cells[rowIndex]?.[columnIndex] ?? "";
        const displayValue = cell.trim().startsWith("=") ? evaluateCell(state, rowIndex, columnIndex) : cell;
        const cellShell = document.createElement("div");
        cellShell.className = "grid-cell";
        if (selectedCell.rowIndex === rowIndex && selectedCell.columnIndex === columnIndex) {
          cellShell.classList.add("selected");
        }
        cellShell.role = "gridcell";
        cellShell.style.transform = `translate(${rowHeaderWidth + columnIndex * columnWidth}px, ${
          columnHeaderHeight + rowIndex * rowHeight
        }px)`;
        const input = document.createElement("input");
        input.value = displayValue;
        input.ariaLabel = `${columnLabels[columnIndex]}${rowIndex + 1}`;
        input.dataset.row = String(rowIndex);
        input.dataset.column = String(columnIndex);
        input.title = cell.trim().startsWith("=") ? cell : displayValue;
        input.addEventListener("focus", () => {
          selectCell(rowIndex, columnIndex, input);
        });
        if (cell.trim().startsWith("=")) {
          input.addEventListener("focus", () => {
            input.value = state.cells[rowIndex]?.[columnIndex] ?? "";
          });
        }
        input.addEventListener("keydown", (event) => {
          if (handleClipboardShortcut(event, rowIndex, columnIndex, input)) return;

          if (moveSelectionForKey(event, rowIndex, columnIndex)) {
            event.preventDefault();
            return;
          }

          if (event.key !== "Enter") return;
          event.preventDefault();
          focusCell(rowIndex + 1, columnIndex);
        });
        input.addEventListener("blur", () => {
          if (cell.trim().startsWith("=") || input.value.trim().startsWith("=")) {
            window.requestAnimationFrame(renderGrid);
          }
        });
        input.addEventListener("input", () => {
          state = updateCell(state, rowIndex, columnIndex, input.value);
          if (selectedCell.rowIndex === rowIndex && selectedCell.columnIndex === columnIndex) {
            elements.cellEditorInput.value = input.value;
          }
          saveState();
          renderFooter();
        });
        cellShell.append(input);
        elements.grid.append(cellShell);
      }
    }
  }

  function renderFooter() {
    const count = countFilledCells(state);
    elements.cellCount.textContent = `${count} ${count === 1 ? "cell" : "cells"} saved`;
  }

  function render() {
    renderGrid();
    renderFooter();
    updateCellEditor();
  }

  function updateCurrentNavLink() {
    const currentHash = window.location.hash || "#sheet";
    elements.navLinks.forEach((link) => {
      link.setAttribute("aria-current", link.getAttribute("href") === currentHash ? "page" : "false");
    });
  }

  elements.clearSheetButton.addEventListener("click", () => {
    elements.clearSheetDialog.showModal();
  });

  elements.confirmClearSheetButton.addEventListener("click", () => {
    state = clearSheet(state);
    selectedCell = { rowIndex: 0, columnIndex: 0 };
    saveState();
    render();
  });

  elements.cellEditorInput.addEventListener("input", () => {
    state = updateCell(state, selectedCell.rowIndex, selectedCell.columnIndex, elements.cellEditorInput.value);
    saveState();
    render();
  });

  elements.cellEditorInput.addEventListener("keydown", (event) => {
    if (
      handleClipboardShortcut(
        event,
        selectedCell.rowIndex,
        selectedCell.columnIndex,
        elements.cellEditorInput,
      )
    ) {
      return;
    }

    if (moveSelectionForKey(event, selectedCell.rowIndex, selectedCell.columnIndex)) {
      event.preventDefault();
      return;
    }

    if (event.key !== "Enter") return;
    event.preventDefault();
    focusCell(selectedCell.rowIndex + 1, selectedCell.columnIndex);
  });

  elements.downloadCsvButton.addEventListener("click", () => {
    downloadFile("spreadsheet.csv", toCsv(state), "text/csv");
  });

  elements.downloadJsonButton.addEventListener("click", () => {
    downloadFile("spreadsheet.json", toJson(state), "application/json");
  });

  elements.importSheetButton.addEventListener("click", () => {
    elements.importFileInput.click();
  });

  elements.importFileInput.addEventListener("change", () => {
    const file = elements.importFileInput.files?.item(0);
    if (!file) return;

    void file.text().then((content: string) => {
      const lowerName = file.name.toLowerCase();
      state = lowerName.endsWith(".json") || file.type === "application/json" ? fromJson(content) : fromCsv(content);
      selectedCell = { rowIndex: 0, columnIndex: 0 };
      elements.importFileInput.value = "";
      saveState();
      render();
    }).catch(() => {
      elements.saveState.textContent = "Upload failed";
      elements.importFileInput.value = "";
    });
  });

  window.addEventListener("hashchange", updateCurrentNavLink);
  elements.sheetWrap.addEventListener("scroll", renderGrid);
  window.addEventListener("resize", renderGrid);

  render();
  updateCurrentNavLink();
}

if (typeof document !== "undefined") {
  initializeApp();
}
