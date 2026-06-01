import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  clearSheet,
  countFilledCells,
  createDefaultState,
  evaluateCell,
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

test("exports CSV and JSON downloads from sheet state", () => {
  const state = {
    cells: [
      ["Name", "Note"],
      ["Alpha", "Needs, quote"],
      ["Beta", "Line\nbreak"],
    ],
  };

  assert.equal(toCsv(state), 'Name,Note\nAlpha,"Needs, quote"\nBeta,"Line\nbreak"');
  assert.deepEqual(JSON.parse(toJson(state)).rows[0], {
    Name: "Alpha",
    Note: "Needs, quote",
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
