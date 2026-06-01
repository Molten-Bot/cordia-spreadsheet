import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  clearSheet,
  countFilledCells,
  createDefaultState,
  evaluateCell,
  fromCsv,
  fromJson,
  parseStoredState,
  toCsv,
  toJson,
  updateCell,
} from "../public/app.js";

test("createDefaultState seeds a fixed spreadsheet", () => {
  const state = createDefaultState();

  assert.equal(state.cells.length, 1024);
  assert.equal(state.cells[0].length, 1024);
  assert.deepEqual(state.cells[0].slice(0, 8), [
    "Project",
    "Owner",
    "Status",
    "Due",
    "Budget",
    "Notes",
    "Priority",
    "Updated",
  ]);
});

test("parseStoredState normalizes stored spreadsheet cells", () => {
  const defaultState = createDefaultState();
  const stored = JSON.stringify({
    cells: [["Name", 42], ["Alpha", "Ready", "Ignored extra"]],
  });

  const parsed = parseStoredState(stored, defaultState);

  assert.deepEqual(parsed.cells[0].slice(0, 3), ["Name", "", ""]);
  assert.deepEqual(parsed.cells[1].slice(0, 3), ["Alpha", "Ready", "Ignored extra"]);
  assert.equal(parsed.cells.length, 1024);
  assert.equal(parsed.cells[0].length, 1024);
});

test("parseStoredState falls back when stored JSON is invalid", () => {
  const defaultState = createDefaultState();

  assert.equal(parseStoredState("{", defaultState), defaultState);
});

test("cell reducers update and clear immutably", () => {
  const state = createDefaultState();
  const updated = updateCell(state, 4, 2, "Blocked");
  const cleared = clearSheet(updated);

  assert.equal(updated.cells[4][2], "Blocked");
  assert.equal(state.cells[4][2], "");
  assert.equal(countFilledCells(cleared), 0);
});

test("formulas evaluate arithmetic, references, and range functions", () => {
  let state = clearSheet(createDefaultState());
  state = updateCell(state, 0, 0, "10");
  state = updateCell(state, 1, 0, "15");
  state = updateCell(state, 0, 1, "=A1+A2*2");
  state = updateCell(state, 1, 1, "=SUM(A1:A2)");
  state = updateCell(state, 2, 1, "=AVERAGE(A1:A2, 5)");

  assert.equal(evaluateCell(state, 0, 1), "40");
  assert.equal(evaluateCell(state, 1, 1), "25");
  assert.equal(evaluateCell(state, 2, 1), "10");
});

test("formulas concatenate string cell contents", () => {
  let state = clearSheet(createDefaultState());
  state = updateCell(state, 7, 4, "Hello");
  state = updateCell(state, 7, 5, " world");
  state = updateCell(state, 7, 6, "=CONCAT(E8,F8)");
  state = updateCell(state, 8, 6, "=CONCAT(E8:F8)");

  assert.equal(evaluateCell(state, 7, 6), "Hello world");
  assert.equal(evaluateCell(state, 8, 6), "Hello world");
});

test("formulas evaluate numeric aggregate and rounding functions", () => {
  let state = clearSheet(createDefaultState());
  state = updateCell(state, 0, 0, "2");
  state = updateCell(state, 1, 0, "8");
  state = updateCell(state, 2, 0, "Text");
  state = updateCell(state, 0, 1, "=COUNT(A1:A3)");
  state = updateCell(state, 1, 1, "=POWER(A2,A1)");
  state = updateCell(state, 2, 1, "=CEILING(12,5)");
  state = updateCell(state, 3, 1, "=FLOOR(12,5)");

  assert.equal(evaluateCell(state, 0, 1), "2");
  assert.equal(evaluateCell(state, 1, 1), "64");
  assert.equal(evaluateCell(state, 2, 1), "15");
  assert.equal(evaluateCell(state, 3, 1), "10");
});

test("formulas evaluate text, date, lookup, and conditional functions", () => {
  let state = clearSheet(createDefaultState());
  state = updateCell(state, 0, 0, " alpha beta ");
  state = updateCell(state, 1, 0, "Old value");
  state = updateCell(state, 2, 0, "spreadsheet");
  state = updateCell(state, 0, 3, "Key");
  state = updateCell(state, 0, 4, "Score");
  state = updateCell(state, 1, 3, "A");
  state = updateCell(state, 1, 4, "10");
  state = updateCell(state, 2, 3, "B");
  state = updateCell(state, 2, 4, "20");
  state = updateCell(state, 0, 5, "Q1");
  state = updateCell(state, 0, 6, "Q2");
  state = updateCell(state, 1, 5, "7");
  state = updateCell(state, 1, 6, "9");
  state = updateCell(state, 0, 1, "=TRIM(A1)");
  state = updateCell(state, 1, 1, '=SUBSTITUTE(A2,"Old","New")');
  state = updateCell(state, 2, 1, "=LEFT(A3,6)");
  state = updateCell(state, 3, 1, "=RIGHT(A3,5)");
  state = updateCell(state, 4, 1, "=MID(A3,2,4)");
  state = updateCell(state, 5, 1, "=UPPER(A3)");
  state = updateCell(state, 6, 1, "=LOWER(B6)");
  state = updateCell(state, 7, 1, '=PROPER("alpha beta")');
  state = updateCell(state, 8, 1, '=DATEDIF("2026-06-01","2026-06-10","d")');
  state = updateCell(state, 9, 1, '=VLOOKUP("B",D1:E3,2,FALSE)');
  state = updateCell(state, 10, 1, '=HLOOKUP("Q2",F1:G2,2,FALSE)');
  state = updateCell(state, 11, 1, '=IF(E3>10,"High","Low")');

  assert.equal(evaluateCell(state, 0, 1), "alpha beta");
  assert.equal(evaluateCell(state, 1, 1), "New value");
  assert.equal(evaluateCell(state, 2, 1), "spread");
  assert.equal(evaluateCell(state, 3, 1), "sheet");
  assert.equal(evaluateCell(state, 4, 1), "prea");
  assert.equal(evaluateCell(state, 5, 1), "SPREADSHEET");
  assert.equal(evaluateCell(state, 6, 1), "spreadsheet");
  assert.equal(evaluateCell(state, 7, 1), "Alpha Beta");
  assert.equal(evaluateCell(state, 8, 1), "9");
  assert.equal(evaluateCell(state, 9, 1), "20");
  assert.equal(evaluateCell(state, 10, 1), "9");
  assert.equal(evaluateCell(state, 11, 1), "High");
});

test("imports CSV and JSON into spreadsheet cells", () => {
  const csv = fromCsv('Name,Note\nAlpha,"Needs, quote"\nBeta,"Line\nbreak"');
  assert.deepEqual(csv.cells[0].slice(0, 2), ["Name", "Note"]);
  assert.deepEqual(csv.cells[1].slice(0, 2), ["Alpha", "Needs, quote"]);
  assert.deepEqual(csv.cells[2].slice(0, 2), ["Beta", "Line\nbreak"]);

  const json = fromJson(JSON.stringify({ rows: [{ Name: "Alpha", Score: 10 }, { Name: "Beta", Score: 20 }] }));
  assert.deepEqual(json.cells[0].slice(0, 2), ["Name", "Score"]);
  assert.deepEqual(json.cells[1].slice(0, 2), ["Alpha", "10"]);
  assert.deepEqual(json.cells[2].slice(0, 2), ["Beta", "20"]);
});

test("exports CSV and JSON downloads from the used sheet range", () => {
  const state = {
    cells: [
      ["Name", "Note", ""],
      ["Alpha", "Needs, quote", ""],
      ["Beta", "Line\nbreak", ""],
      ["", "", ""],
    ],
  };

  assert.equal(toCsv(state), 'Name,Note\nAlpha,"Needs, quote"\nBeta,"Line\nbreak"');
  const exported = JSON.parse(toJson(state));
  assert.deepEqual(exported.columns, ["A", "B"]);
  assert.deepEqual(exported.cells, [
    ["Name", "Note"],
    ["Alpha", "Needs, quote"],
    ["Beta", "Line\nbreak"],
  ]);
  assert.deepEqual(exported.rows[0], {
    Name: "Alpha",
    Note: "Needs, quote",
  });
});

test("exports empty CSV and JSON when sheet has no data", () => {
  const state = clearSheet(createDefaultState());

  assert.equal(toCsv(state), "");
  assert.deepEqual(JSON.parse(toJson(state)), {
    columns: [],
    cells: [],
    rows: [],
  });
});

test("served files do not reference disallowed providers or tooling", async () => {
  const servedFiles = [
    "public/app.js",
    "public/humans.txt",
    "public/index.html",
    "public/llm.txt",
  ];

  for (const file of servedFiles) {
    const content = await readFile(file, "utf8");
    assert.doesNotMatch(content, /\bgit\b|cloudflare/i, file);
  }
});
