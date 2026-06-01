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
function createColumnLabels(count) {
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
function createEmptyRows() {
    return Array.from({ length: rowCount }, () => Array.from({ length: columnCount }, () => ""));
}
export function createDefaultState() {
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
    cells[4][4] = "=SUM(E2:E4)";
    return { cells };
}
function normalizeCell(value) {
    return typeof value === "string" ? value.slice(0, 200) : "";
}
function normalizeRows(value, defaultState) {
    if (!Array.isArray(value))
        return defaultState.cells;
    return createEmptyRows().map((row, rowIndex) => {
        const storedRow = value[rowIndex];
        if (!Array.isArray(storedRow))
            return row;
        return row.map((_, columnIndex) => normalizeCell(storedRow[columnIndex]));
    });
}
export function parseStoredState(storedState, defaultState) {
    if (!storedState)
        return defaultState;
    try {
        const parsed = JSON.parse(storedState);
        return { cells: normalizeRows(parsed.cells, defaultState) };
    }
    catch {
        return defaultState;
    }
}
export function updateCell(state, rowIndex, columnIndex, value) {
    if (rowIndex < 0 || rowIndex >= rowCount || columnIndex < 0 || columnIndex >= columnCount)
        return state;
    const cells = state.cells.slice();
    cells[rowIndex] = [...(cells[rowIndex] ?? []), ...Array.from({ length: columnCount }, () => "")].slice(0, columnCount);
    cells[rowIndex][columnIndex] = value.slice(0, 200);
    return {
        cells,
    };
}
export function clearSheet(state) {
    return { ...state, cells: createEmptyRows() };
}
export function countFilledCells(state) {
    return state.cells.flat().filter((cell) => cell.trim()).length;
}
function parseCellReference(reference) {
    const match = /^([A-Z]+)(\d+)$/i.exec(reference.trim());
    if (!match)
        return undefined;
    const [, letters = "", row = "0"] = match;
    const columnIndex = [...letters.toUpperCase()].reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1;
    const rowIndex = Number.parseInt(row, 10) - 1;
    if (columnIndex < 0 || columnIndex >= columnCount || rowIndex < 0 || rowIndex >= rowCount)
        return undefined;
    return { columnIndex, rowIndex };
}
function cellAddress(rowIndex, columnIndex) {
    return `${columnLabels[columnIndex] ?? ""}${rowIndex + 1}`;
}
function numericCellValue(value) {
    const trimmed = value.trim();
    if (!trimmed)
        return 0;
    const normalized = trimmed.replaceAll(",", "").replace(/^\$/, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}
function formatFormulaResult(value) {
    if (!Number.isFinite(value))
        return "#ERROR";
    return Number.parseFloat(value.toFixed(10)).toString();
}
export function evaluateCell(state, rowIndex, columnIndex) {
    return evaluateCellValue(state, rowIndex, columnIndex, new Set());
}
function evaluateCellValue(state, rowIndex, columnIndex, seen) {
    const value = state.cells[rowIndex]?.[columnIndex] ?? "";
    if (!value.trim().startsWith("="))
        return value;
    const address = cellAddress(rowIndex, columnIndex);
    if (seen.has(address))
        return "#CYCLE";
    seen.add(address);
    const result = evaluateFormulaValue(state, value.trim().slice(1), seen);
    seen.delete(address);
    return formatFormulaResult(result);
}
function evaluateFormulaValue(state, expression, seen) {
    let index = 0;
    function skipWhitespace() {
        while (/\s/.test(expression[index] ?? ""))
            index += 1;
    }
    function readNumber() {
        skipWhitespace();
        const start = index;
        while (/[0-9.]/.test(expression[index] ?? ""))
            index += 1;
        if (start === index)
            return undefined;
        const value = Number(expression.slice(start, index));
        if (!Number.isFinite(value))
            throw new Error("Invalid number");
        return value;
    }
    function readLetters() {
        skipWhitespace();
        const start = index;
        while (/[A-Za-z]/.test(expression[index] ?? ""))
            index += 1;
        return expression.slice(start, index).toUpperCase();
    }
    function readCellReference(firstLetters) {
        const start = index;
        while (/[0-9]/.test(expression[index] ?? ""))
            index += 1;
        if (start === index)
            return undefined;
        return parseCellReference(`${firstLetters}${expression.slice(start, index)}`);
    }
    function getReferenceValue(reference) {
        const value = evaluateCellValue(state, reference.rowIndex, reference.columnIndex, seen);
        if (value === "#CYCLE")
            throw new Error("Cycle");
        return numericCellValue(value);
    }
    function readRange(firstReference) {
        skipWhitespace();
        if (expression[index] !== ":")
            return undefined;
        index += 1;
        const letters = readLetters();
        const secondReference = letters ? readCellReference(letters) : undefined;
        if (!secondReference)
            throw new Error("Invalid range");
        const minRow = Math.min(firstReference.rowIndex, secondReference.rowIndex);
        const maxRow = Math.max(firstReference.rowIndex, secondReference.rowIndex);
        const minColumn = Math.min(firstReference.columnIndex, secondReference.columnIndex);
        const maxColumn = Math.max(firstReference.columnIndex, secondReference.columnIndex);
        const values = [];
        for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
            for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
                values.push(getReferenceValue({ rowIndex, columnIndex }));
            }
        }
        return values;
    }
    function parseArgument() {
        skipWhitespace();
        const start = index;
        const letters = readLetters();
        if (letters) {
            const reference = readCellReference(letters);
            if (reference) {
                const range = readRange(reference);
                if (range)
                    return range;
                return [getReferenceValue(reference)];
            }
            index = start;
        }
        return [parseExpression()];
    }
    function parseFunction(name) {
        skipWhitespace();
        if (expression[index] !== "(")
            throw new Error("Missing function arguments");
        index += 1;
        const values = [];
        skipWhitespace();
        if (expression[index] !== ")") {
            while (index < expression.length) {
                values.push(...parseArgument());
                skipWhitespace();
                if (expression[index] !== ",")
                    break;
                index += 1;
            }
        }
        skipWhitespace();
        if (expression[index] !== ")")
            throw new Error("Unclosed function");
        index += 1;
        switch (name) {
            case "SUM":
                return values.reduce((total, value) => total + value, 0);
            case "AVERAGE":
                return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
            case "MIN":
                return values.length ? Math.min(...values) : 0;
            case "MAX":
                return values.length ? Math.max(...values) : 0;
            default:
                throw new Error("Unknown function");
        }
    }
    function parsePrimary() {
        skipWhitespace();
        if (expression[index] === "(") {
            index += 1;
            const value = parseExpression();
            skipWhitespace();
            if (expression[index] !== ")")
                throw new Error("Unclosed expression");
            index += 1;
            return value;
        }
        const number = readNumber();
        if (number !== undefined)
            return number;
        const letters = readLetters();
        if (letters) {
            const reference = readCellReference(letters);
            if (reference)
                return getReferenceValue(reference);
            return parseFunction(letters);
        }
        throw new Error("Invalid formula");
    }
    function parseUnary() {
        skipWhitespace();
        if (expression[index] === "-") {
            index += 1;
            return -parseUnary();
        }
        if (expression[index] === "+") {
            index += 1;
            return parseUnary();
        }
        return parsePrimary();
    }
    function parseTerm() {
        let value = parseUnary();
        while (index < expression.length) {
            skipWhitespace();
            const operator = expression[index];
            if (operator !== "*" && operator !== "/")
                break;
            index += 1;
            const right = parseUnary();
            value = operator === "*" ? value * right : value / right;
        }
        return value;
    }
    function parseExpression() {
        let value = parseTerm();
        while (index < expression.length) {
            skipWhitespace();
            const operator = expression[index];
            if (operator !== "+" && operator !== "-")
                break;
            index += 1;
            const right = parseTerm();
            value = operator === "+" ? value + right : value - right;
        }
        return value;
    }
    try {
        const value = parseExpression();
        skipWhitespace();
        if (index !== expression.length)
            throw new Error("Trailing input");
        return value;
    }
    catch {
        return Number.NaN;
    }
}
function escapeCsvCell(value) {
    return /[",\n\r]/.test(value) ? `"${value.replaceAll("\"", "\"\"")}"` : value;
}
function usedRangeCells(state) {
    let lastRowIndex = -1;
    let lastColumnIndex = -1;
    state.cells.forEach((row, rowIndex) => {
        row.forEach((cell, columnIndex) => {
            if (!cell.trim())
                return;
            lastRowIndex = Math.max(lastRowIndex, rowIndex);
            lastColumnIndex = Math.max(lastColumnIndex, columnIndex);
        });
    });
    if (lastRowIndex < 0 || lastColumnIndex < 0)
        return [];
    return state.cells.slice(0, lastRowIndex + 1).map((row) => row.slice(0, lastColumnIndex + 1));
}
export function toCsv(state) {
    return usedRangeCells(state)
        .map((row) => row.map(escapeCsvCell).join(","))
        .join("\n");
}
export function toJson(state) {
    const cells = usedRangeCells(state);
    const [headerRow = []] = cells;
    const columns = columnLabels.slice(0, cells[0]?.length ?? 0);
    const rows = cells.slice(1).map((row) => Object.fromEntries(row.map((cell, index) => [headerRow[index]?.trim() || columnLabels[index] || `Column ${index + 1}`, cell])));
    return JSON.stringify({ columns, cells, rows }, null, 2);
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
function getElement(selector, type) {
    const element = document.querySelector(selector);
    if (!(element instanceof type)) {
        throw new Error(`Missing required element: ${selector}`);
    }
    return element;
}
function getElements() {
    return {
        cellCount: getElement("#cell-count", HTMLElement),
        clearSheetButton: getElement("#clear-sheet", HTMLButtonElement),
        downloadCsvButton: getElement("#download-csv", HTMLButtonElement),
        downloadJsonButton: getElement("#download-json", HTMLButtonElement),
        grid: getElement("#spreadsheet-grid", HTMLElement),
        navLinks: document.querySelectorAll(".nav a"),
        saveState: getElement("#save-state", HTMLElement),
        sheetWrap: getElement("#sheet-wrap", HTMLElement),
    };
}
function downloadFile(filename, content, type) {
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
    let saveTimer;
    function saveState() {
        try {
            localStorage.setItem(storageKey, JSON.stringify(state));
            elements.saveState.textContent = "Saved locally";
        }
        catch {
            elements.saveState.textContent = "Storage full";
            return;
        }
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => {
            elements.saveState.textContent = "Autosaved in this browser";
        }, 1600);
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
        const lastColumn = Math.min(columnCount - 1, Math.ceil((scrollLeft + viewportWidth - rowHeaderWidth) / columnWidth) + renderBuffer);
        const firstRow = Math.max(0, Math.floor((scrollTop - columnHeaderHeight) / rowHeight) - renderBuffer);
        const lastRow = Math.min(rowCount - 1, Math.ceil((scrollTop + viewportHeight - columnHeaderHeight) / rowHeight) + renderBuffer);
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
                cellShell.role = "gridcell";
                cellShell.style.transform = `translate(${rowHeaderWidth + columnIndex * columnWidth}px, ${columnHeaderHeight + rowIndex * rowHeight}px)`;
                const input = document.createElement("input");
                input.value = displayValue;
                input.ariaLabel = `${columnLabels[columnIndex]}${rowIndex + 1}`;
                input.title = cell.trim().startsWith("=") ? cell : displayValue;
                if (cell.trim().startsWith("=")) {
                    input.addEventListener("focus", () => {
                        input.value = state.cells[rowIndex]?.[columnIndex] ?? "";
                    });
                }
                input.addEventListener("blur", () => {
                    if (cell.trim().startsWith("=") || input.value.trim().startsWith("=")) {
                        renderGrid();
                    }
                });
                input.addEventListener("input", () => {
                    state = updateCell(state, rowIndex, columnIndex, input.value);
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
    }
    function updateCurrentNavLink() {
        const currentHash = window.location.hash || "#sheet";
        elements.navLinks.forEach((link) => {
            link.setAttribute("aria-current", link.getAttribute("href") === currentHash ? "page" : "false");
        });
    }
    elements.clearSheetButton.addEventListener("click", () => {
        state = clearSheet(state);
        saveState();
        render();
    });
    elements.downloadCsvButton.addEventListener("click", () => {
        downloadFile("spreadsheet.csv", toCsv(state), "text/csv");
    });
    elements.downloadJsonButton.addEventListener("click", () => {
        downloadFile("spreadsheet.json", toJson(state), "application/json");
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
