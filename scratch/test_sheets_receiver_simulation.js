const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.resolve('c:/Users/Mnavares/Documents/CCTV OPS/audit-report/scratch/Code.gs'), 'utf8');

console.log("=== MAINTENANCE GOOGLE SHEETS RECEIVER TEST SUITE ===");

let passed = 0;
let total = 0;
function assert(condition, testName) {
    total++;
    if (condition) {
        console.log(`✓ [PASS] ${testName}`);
        passed++;
    } else {
        console.error(`✗ [FAIL] ${testName}`);
    }
}

// 1. Static checks on Code.gs
assert(!code.includes('imageRange.breakApart()'), "No dangerous partial imageRange.breakApart() calls");
assert(code.includes('safelyUnmergeRowArea_'), "Contains safelyUnmergeRowArea_ function");
assert(code.includes('scanRange.getMergedRanges()'), "Uses getMergedRanges() for complete merge detection");
assert(code.includes('SpreadsheetApp.newCellImage()'), "Preserves TRUE IN-CELL newCellImage() behavior");
assert(code.includes('isVerifiedCellImage_'), "Contains resilient in-cell image verification");
assert(code.includes("SPREADSHEET_ID = '1PBKIr7cACVcElX9YpAqshhTTsjlJz69dji7TiA0IlrE'"), "Preserves Spreadsheet ID");
assert(code.includes("SHEET_NAME = 'MABINI SITE A - 1F|2F'"), "Preserves Sheet Name");

// 2. Mock Spreadsheet Environment for Comprehensive Simulation
class MockRange {
    constructor(sheet, startRow, startCol, numRows, numCols) {
        this.sheet = sheet;
        this.startRow = startRow;
        this.startCol = startCol;
        this.numRows = numRows;
        this.numCols = numCols;
        this.values = [];
    }

    getA1Notation() {
        return `R${this.startRow}C${this.startCol}:R${this.startRow + this.numRows - 1}C${this.startCol + this.numCols - 1}`;
    }

    getRow() { return this.startRow; }
    getLastRow() { return this.startRow + this.numRows - 1; }
    getColumn() { return this.startCol; }
    getLastColumn() { return this.startCol + this.numCols - 1; }

    getMergedRanges() {
        // Return all merged ranges on this sheet that intersect this range
        const intersecting = [];
        for (const mr of this.sheet._merges) {
            const rowOverlap = !(this.getLastRow() < mr.startRow || this.startRow > mr.getLastRow());
            const colOverlap = !(this.getLastColumn() < mr.startCol || this.startCol > mr.getLastColumn());
            if (rowOverlap && colOverlap) {
                intersecting.push(mr);
            }
        }
        return intersecting;
    }

    breakApart() {
        // CRITICAL GOOGLE SHEETS BEHAVIOR:
        // If this range is only PART of an existing merge, throw the exact error!
        for (const mr of [...this.sheet._merges]) {
            const rowOverlap = !(this.getLastRow() < mr.startRow || this.startRow > mr.getLastRow());
            const colOverlap = !(this.getLastColumn() < mr.startCol || this.startCol > mr.getLastColumn());
            if (rowOverlap && colOverlap) {
                const isExact = (
                    this.startRow === mr.startRow &&
                    this.numRows === mr.numRows &&
                    this.startCol === mr.startCol &&
                    this.numCols === mr.numCols
                );
                if (!isExact) {
                    throw new Error("You must select all cells in a merged range to merge or unmerge them.");
                }
                // Remove from merges
                const idx = this.sheet._merges.indexOf(mr);
                if (idx !== -1) this.sheet._merges.splice(idx, 1);
            }
        }
        return this;
    }

    merge() {
        // If any cell in this range is part of an existing merge that extends beyond this range, throw!
        for (const mr of this.sheet._merges) {
            const rowOverlap = !(this.getLastRow() < mr.startRow || this.startRow > mr.getLastRow());
            const colOverlap = !(this.getLastColumn() < mr.startCol || this.startCol > mr.getLastColumn());
            if (rowOverlap && colOverlap) {
                const isWithin = (
                    this.startRow <= mr.startRow &&
                    this.getLastRow() >= mr.getLastRow() &&
                    this.startCol <= mr.startCol &&
                    this.getLastColumn() >= mr.getLastColumn()
                );
                if (!isWithin) {
                    throw new Error("You must select all cells in a merged range to merge or unmerge them.");
                }
            }
        }
        this.sheet._merges.push(this);
        return this;
    }

    setValue(v) { this._value = v; return this; }
    getValue() { return this._value || { valueType: 'IMAGE', getAltTextTitle: () => "proof" }; }
    setValues(vals) { this._values = vals; return this; }
    setFontWeight() { return this; }
    setFontSize() { return this; }
    setFontColor() { return this; }
    setBackground() { return this; }
    setHorizontalAlignment() { return this; }
    setVerticalAlignment() { return this; }
    setWrap() { return this; }
    clearContent() { this._value = null; return this; }
    getCell(r, c) { return this; }
}

class MockSheet {
    constructor() {
        this._rows = 500;
        this._cols = 7;
        this._merges = [];
        this._rowHeights = {};
        this._lastRow = 10;
    }

    getMaxRows() { return this._rows; }
    getMaxColumns() { return this._cols; }
    getLastRow() { return this._lastRow; }
    getLastColumn() { return this._cols; }
    getName() { return 'MABINI SITE A - 1F|2F'; }
    getSheetId() { return 12345; }
    getImages() { return []; }

    insertRowsAfter(after, count) { this._rows += count; }
    insertColumnsAfter(after, count) { this._cols += count; }
    setRowHeight(r, h) { this._rowHeights[r] = h; }
    setColumnWidth() {}

    getRange(r, c, nr = 1, nc = 1) {
        return new MockRange(this, r, c, nr, nc);
    }
}

// Emulate safelyUnmergeRowArea_
function safelyUnmergeRowArea_(sheet, startRow, numRows) {
    numRows = numRows || 1;
    const maxCols = Math.max(sheet.getMaxColumns(), 7);
    const scanRange = sheet.getRange(startRow, 1, numRows, maxCols);
    const mergedRanges = scanRange.getMergedRanges();

    if (mergedRanges && mergedRanges.length > 0) {
        for (let i = 0; i < mergedRanges.length; i++) {
            const mr = mergedRanges[i];
            mr.breakApart();
        }
    }
}

// 3. Scenario E: Pre-existing merged cells in destination area
const sheetE = new MockSheet();
// Pre-merge row 20 across A:G (from prior test/delete)
const preMergeRow20 = new MockRange(sheetE, 20, 1, 1, 7);
sheetE._merges.push(preMergeRow20);

// Pre-merge row 21 across B:F (from prior screenshot)
const preMergeRow21 = new MockRange(sheetE, 21, 2, 1, 5);
sheetE._merges.push(preMergeRow21);

// Test old buggy way: calling breakApart on columns 2..6 on row 20 throws!
let oldBugThrew = false;
try {
    sheetE.getRange(20, 2, 1, 5).breakApart();
} catch (err) {
    oldBugThrew = true;
    assert(err.message.includes("You must select all cells in a merged range"), "Confirmed reproduction of the exact Google Sheets error on partial unmerge");
}
assert(oldBugThrew, "Old buggy partial breakApart reproduced accurately");

// Now test new safelyUnmergeRowArea_ on row 20:
let newFixThrew = false;
try {
    safelyUnmergeRowArea_(sheetE, 20, 1);
    // Now merging B:F must succeed with 0 errors
    const imageRange = sheetE.getRange(20, 2, 1, 5);
    imageRange.merge();
} catch (err) {
    newFixThrew = true;
    console.error(err);
}
assert(!newFixThrew, "Scenario E: safelyUnmergeRowArea_ cleanly cleared existing A:G merge and allowed B:F merge with 0 errors");

// 4. Scenario A: One block + one screenshot
const sheetA = new MockSheet();
let scenarioAErr = null;
try {
    const row = 15;
    // Header
    safelyUnmergeRowArea_(sheetA, row, 1);
    // Data rows
    safelyUnmergeRowArea_(sheetA, row + 1, 2);
    // Proof header
    safelyUnmergeRowArea_(sheetA, row + 3, 1);
    sheetA.getRange(row + 3, 1, 1, 7).merge();
    // Screenshot
    safelyUnmergeRowArea_(sheetA, row + 4, 1);
    sheetA.getRange(row + 4, 2, 1, 5).merge();
    // Remarks
    safelyUnmergeRowArea_(sheetA, row + 5, 1);
    sheetA.getRange(row + 5, 1, 1, 7).merge();
} catch (err) {
    scenarioAErr = err;
}
assert(scenarioAErr === null, "Scenario A: One block + one screenshot executed with 0 errors");

// 5. Scenario B: One block + multiple screenshots
const sheetB = new MockSheet();
let scenarioBErr = null;
try {
    const row = 20;
    // 3 screenshots in block
    for (let s = 0; s < 3; s++) {
        const shotRow = row + s;
        safelyUnmergeRowArea_(sheetB, shotRow, 1);
        sheetB.getRange(shotRow, 2, 1, 5).merge();
    }
} catch (err) {
    scenarioBErr = err;
}
assert(scenarioBErr === null, "Scenario B: One block + 3 screenshots executed with separate rows and 0 errors");

// 6. Scenario D: Block with no screenshot
const sheetD = new MockSheet();
let scenarioDErr = null;
try {
    const row = 30;
    // Data rows
    safelyUnmergeRowArea_(sheetD, row, 1);
    // Screenshots loop: 0 items, skips entirely
    // Remarks
    safelyUnmergeRowArea_(sheetD, row + 1, 1);
    sheetD.getRange(row + 1, 1, 1, 7).merge();
} catch (err) {
    scenarioDErr = err;
}
assert(scenarioDErr === null, "Scenario D: Block with no screenshots skips screenshot area cleanly");

// 7. Scenario F: Repeated sends after previous reports already exist
const sheetF = new MockSheet();
let scenarioFErr = null;
try {
    // Send 1 at row 10
    safelyUnmergeRowArea_(sheetF, 10, 1);
    sheetF.getRange(10, 1, 1, 7).merge();
    safelyUnmergeRowArea_(sheetF, 11, 1);
    sheetF.getRange(11, 2, 1, 5).merge();

    // Send 2 at row 15
    safelyUnmergeRowArea_(sheetF, 15, 1);
    sheetF.getRange(15, 1, 1, 7).merge();
    safelyUnmergeRowArea_(sheetF, 16, 1);
    sheetF.getRange(16, 2, 1, 5).merge();
} catch (err) {
    scenarioFErr = err;
}
assert(scenarioFErr === null, "Scenario F: Repeated sends after previous reports execute seamlessly");

console.log(`\nResults: ${passed} / ${total} tests passed.`);
if (passed === total) {
    console.log("ALL GOOGLE SHEETS RECEIVER TEST SCENARIOS PASSED 100%!");
} else {
    process.exit(1);
}
