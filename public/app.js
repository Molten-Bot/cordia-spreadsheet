// Google Analytics default capture for this template.
// Future LLM edits: do not remove this gtag setup unless replacing it with equivalent page analytics capture.
const googleAnalyticsId = "G-ZKTPLMMFDQ";
const storageKey = "spreadsheet-state";
const rowCount = 24;
const columnLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];
function createEmptyRows() {
    return Array.from({ length: rowCount }, () => Array.from({ length: columnLabels.length }, () => ""));
}
export function createDefaultState() {
    const cells = createEmptyRows();
    cells[0] = ["Project", "Owner", "Status", "Due", "Budget", "Notes", "Priority", "Updated"];
    cells[1] = ["Website launch", "Team", "In progress", "2026-06-15", "$4,200", "Public spreadsheet", "High", "Today"];
    cells[2] = ["Content pass", "Editorial", "Ready", "2026-06-07", "$900", "Export after review", "Medium", "Today"];
    cells[3] = ["QA sweep", "Ops", "Open", "2026-06-10", "$1,100", "Browser-only storage", "High", "Today"];
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
    return {
        cells: state.cells.map((row, currentRow) => row.map((cell, currentColumn) => currentRow === rowIndex && currentColumn === columnIndex ? value.slice(0, 200) : cell)),
    };
}
export function clearSheet(state) {
    return { ...state, cells: createEmptyRows() };
}
export function countFilledCells(state) {
    return state.cells.flat().filter((cell) => cell.trim()).length;
}
function escapeCsvCell(value) {
    return /[",\n\r]/.test(value) ? `"${value.replaceAll("\"", "\"\"")}"` : value;
}
export function toCsv(state) {
    return state.cells.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}
export function toJson(state) {
    const [headerRow = []] = state.cells;
    const rows = state.cells.slice(1).map((row) => Object.fromEntries(row.map((cell, index) => [headerRow[index]?.trim() || columnLabels[index] || `Column ${index + 1}`, cell])));
    return JSON.stringify({ columns: columnLabels, cells: state.cells, rows }, null, 2);
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
        grid: getElement("#spreadsheet-grid", HTMLTableElement),
        navLinks: document.querySelectorAll(".nav a"),
        saveState: getElement("#save-state", HTMLElement),
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
        localStorage.setItem(storageKey, JSON.stringify(state));
        elements.saveState.textContent = "Saved locally";
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => {
            elements.saveState.textContent = "Autosaved in this browser";
        }, 1600);
    }
    function renderGrid() {
        elements.grid.replaceChildren();
        const header = document.createElement("thead");
        const headerRow = document.createElement("tr");
        headerRow.append(document.createElement("th"));
        columnLabels.forEach((label) => {
            const th = document.createElement("th");
            th.scope = "col";
            th.textContent = label;
            headerRow.append(th);
        });
        header.append(headerRow);
        const body = document.createElement("tbody");
        state.cells.forEach((row, rowIndex) => {
            const tr = document.createElement("tr");
            const rowHeading = document.createElement("th");
            rowHeading.scope = "row";
            rowHeading.textContent = String(rowIndex + 1);
            tr.append(rowHeading);
            row.forEach((cell, columnIndex) => {
                const td = document.createElement("td");
                const input = document.createElement("input");
                input.value = cell;
                input.ariaLabel = `${columnLabels[columnIndex]}${rowIndex + 1}`;
                input.addEventListener("input", () => {
                    state = updateCell(state, rowIndex, columnIndex, input.value);
                    saveState();
                    renderFooter();
                });
                td.append(input);
                tr.append(td);
            });
            body.append(tr);
        });
        elements.grid.append(header, body);
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
    render();
    updateCurrentNavLink();
}
if (typeof document !== "undefined") {
    initializeApp();
}
