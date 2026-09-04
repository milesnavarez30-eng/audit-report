/*******************************************************
 * CCTV OPS - AUDIT REPORT MASTERLIST API v3
 *
 * UNIFIED TRACKER ENGINE (ONE API, FIVE USERS)
 * - Miles: Main Tracker (gid 304130933), filtered by Name = "Miles" and NOC = "Pending"
 * - Seth: Dedicated Sheet (gid 1498030603), filtered by NOC = "Pending"
 * - Wendie: Dedicated Sheet (gid 217322359), filtered by NOC = "Pending" (Tab/Auditor may be Amor, displayed as Wendie)
 * - Kenneth: Dedicated Sheet (gid 1338240153), filtered by NOC = "Pending"
 * - JR: Dedicated Sheet (gid 487380454), filtered by NOC = "Pending"
 *
 * PRESERVES ALL EXISTING FEATURES:
 * - Full raw grid for Tracker, Master List, and Data
 * - Dedicated WEB HR ASSIGNMENTS sheet for website edits
 * - Add, Update, and Delete HR assignment actions via doPost
 * - Backward compatibility with previous API outputs
 *******************************************************/

const CONFIG = {
  SPREADSHEET_ID: "12o3O1u2xb3DbXW41jAen-8HSJhpJRzQLSIb_6o5JRc4",

  // 5 User Tracker Sources
  TRACKERS: {
    miles: {
      gid: 304130933,
      name: "Miles",
      filterName: "miles" // Filter Name = Miles on shared main tracker
    },
    seth: {
      gid: 1498030603,
      name: "Seth",
      filterName: "" // Dedicated sheet: all rows belong to Seth
    },
    wendie: {
      gid: 217322359,
      name: "Wendie",
      aliasName: "Amor", // Sheet tab or auditor name may be Amor
      filterName: ""
    },
    kenneth: {
      gid: 1338240153,
      name: "Kenneth",
      filterName: ""
    },
    jr: {
      gid: 487380454,
      name: "JR",
      filterName: ""
    }
  },

  // Supporting sheets for Assigned HR per OM & Reports
  SHEETS: {
    tracker: 304130933,
    masterList: 684780096,
    data: 1589623984
  },

  WEB_HR_SHEET: "WEB HR ASSIGNMENTS"
};

/**
 * Handle HTTP GET Requests
 */
function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = cleanText(params.action);

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

    // Diagnostic action to inspect all sheets and GIDs
    if (action === "debugSheets") {
      const allSheets = ss.getSheets().map(function(s) {
        return {
          gid: s.getSheetId(),
          name: s.getName(),
          lastRow: s.getLastRow(),
          lastColumn: s.getLastColumn()
        };
      });
      return jsonResponse({
        success: true,
        version: "3.0",
        spreadsheetName: ss.getName(),
        sheets: allSheets
      });
    }

    // Process all 5 trackers safely (individual failure does not break other trackers)
    const pending = {};
    const sources = {};

    Object.keys(CONFIG.TRACKERS).forEach(function(key) {
      const trackerConf = CONFIG.TRACKERS[key];
      try {
        const result = processTrackerSheet(ss, trackerConf);
        pending[key] = result.rows;
        sources[key] = {
          ok: true,
          gid: trackerConf.gid,
          sheetName: result.sheetName,
          totalRows: result.totalRows,
          pendingRows: result.rows.length
        };
      } catch (err) {
        pending[key] = [];
        sources[key] = {
          ok: false,
          gid: trackerConf.gid,
          sheetName: "",
          totalRows: 0,
          pendingRows: 0,
          error: err.message || String(err)
        };
      }
    });

    // Supporting sheets for Assigned HR per OM
    let trackerSheet = null;
    let masterListSheet = null;
    let dataSheet = null;

    try { trackerSheet = getSheetByGid(ss, CONFIG.SHEETS.tracker); } catch (_) {}
    try { masterListSheet = getSheetByGid(ss, CONFIG.SHEETS.masterList); } catch (_) {}
    try { dataSheet = getSheetByGid(ss, CONFIG.SHEETS.data); } catch (_) {}

    const tracker = packSheet(trackerSheet);
    const masterList = packSheet(masterListSheet);
    const data = packSheet(dataSheet);

    const hrSheet = ss.getSheetByName(CONFIG.WEB_HR_SHEET);
    const webHrAssignments = hrSheet
      ? packSheet(hrSheet)
      : emptyPackedSheet(CONFIG.WEB_HR_SHEET);

    return jsonResponse({
      success: true,
      version: "3.0",
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      updatedAt: new Date().toISOString(),

      // Required Unified 5-User Pending Response
      pending: {
        miles: pending.miles || [],
        seth: pending.seth || [],
        wendie: pending.wendie || [],
        kenneth: pending.kenneth || [],
        jr: pending.jr || []
      },

      // Per-source metadata & connection health
      sources: sources,

      // Backward compatibility for existing website features
      sheets: {
        tracker: tracker,
        masterList: masterList,
        data: data,
        webHrAssignments: webHrAssignments
      },
      tracker: tracker.rows,
      masterList: masterList.rows,
      data: data.rows,
      webHrAssignments: webHrAssignments.rows
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      version: "3.0",
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * Handle HTTP POST Requests (HR Assignments CRUD)
 */
function doPost(e) {
  try {
    const body = parseRequestBody(e);
    const action = cleanText(body.action);

    if (action === "upsertHrAssignment") {
      return jsonResponse(
        upsertHrAssignment(body.record || {})
      );
    }

    if (action === "deleteHrAssignment") {
      return jsonResponse(
        deleteHrAssignment(cleanText(body.id))
      );
    }

    return jsonResponse({
      success: false,
      error: "Unknown action."
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      version: "3.0",
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * Read and process a single tracker sheet with robust header normalization and pending filtering
 */
function processTrackerSheet(spreadsheet, trackerConf) {
  const sheet = getSheetByGid(spreadsheet, trackerConf.gid);
  const sheetName = sheet.getName();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (!lastRow || !lastCol) {
    return {
      sheetName: sheetName,
      totalRows: 0,
      rows: []
    };
  }

  const grid = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  if (!grid || !grid.length) {
    return {
      sheetName: sheetName,
      totalRows: 0,
      rows: []
    };
  }

  // Find header row dynamically (scans first 5 rows for standard tracker headers)
  const headerInfo = findHeaderRow(grid);
  const headerRowIdx = headerInfo.rowIndex;
  const colMap = headerInfo.colMap;

  const dataRows = grid.slice(headerRowIdx + 1);
  const pendingRows = [];

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];

    // Check if entire row is empty
    let hasAnyData = false;
    for (let c = 0; c < row.length; c++) {
      if (cleanText(row[c]) !== "") {
        hasAnyData = true;
        break;
      }
    }
    if (!hasAnyData) continue;

    // Extract fields according to mapped header columns
    const year = getMappedCell(row, colMap.year);
    const month = getMappedCell(row, colMap.month);
    const date = getMappedCell(row, colMap.date);
    let name = getMappedCell(row, colMap.name);
    const om = getMappedCell(row, colMap.om);
    const site = getMappedCell(row, colMap.site);
    const tl = getMappedCell(row, colMap.tl);
    const agentName = getMappedCell(row, colMap.agentName);
    const account = getMappedCell(row, colMap.account);
    const cctvReasonCodes = getMappedCell(row, colMap.cctvReasonCodes);
    const noc = getMappedCell(row, colMap.noc);
    const remarks = getMappedCell(row, colMap.remarks);

    // If row name is blank on a user's dedicated sheet, default to user's name
    if (!name && trackerConf.name && !trackerConf.filterName) {
      name = trackerConf.name;
    }

    // Filter Rule: Only return rows where NOC is Pending (case-insensitive, trimmed)
    const nocClean = cleanText(noc).toLowerCase();
    if (nocClean !== "pending") {
      continue;
    }

    // If sheet requires Name filtering (e.g., Miles on shared main tracker)
    if (trackerConf.filterName) {
      const rowNameNorm = cleanText(name).toLowerCase();
      const targetName = trackerConf.filterName.toLowerCase();
      if (rowNameNorm !== targetName && !rowNameNorm.includes(targetName)) {
        continue;
      }
    }

    // Return normalized object
    pendingRows.push({
      year: year,
      month: month,
      date: date,
      name: name,
      om: om,
      site: site,
      tl: tl,
      agentName: agentName,
      account: account,
      cctvReasonCodes: cctvReasonCodes,
      noc: noc,
      remarks: remarks
    });
  }

  return {
    sheetName: sheetName,
    totalRows: dataRows.length,
    rows: pendingRows
  };
}

/**
 * Scan first few rows to identify the tracker column headers and build index map
 */
function findHeaderRow(grid) {
  const maxScan = Math.min(6, grid.length);
  let bestRowIdx = 0;
  let maxScore = -1;
  let bestColMap = {};

  for (let r = 0; r < maxScan; r++) {
    const row = grid[r];
    const colMap = mapHeaders(row);
    let score = 0;
    if (colMap.noc !== -1) score += 5;
    if (colMap.cctvReasonCodes !== -1) score += 3;
    if (colMap.date !== -1) score += 2;
    if (colMap.name !== -1) score += 2;
    if (colMap.om !== -1) score += 1;
    if (colMap.site !== -1) score += 1;
    if (colMap.tl !== -1) score += 1;
    if (colMap.agentName !== -1) score += 2;
    if (colMap.account !== -1) score += 1;
    if (colMap.year !== -1) score += 1;
    if (colMap.month !== -1) score += 1;
    if (colMap.remarks !== -1) score += 1;

    if (score > maxScore) {
      maxScore = score;
      bestRowIdx = r;
      bestColMap = colMap;
    }
  }

  return {
    rowIndex: bestRowIdx,
    colMap: bestColMap
  };
}

/**
 * Map raw header row strings into canonical field indexes
 */
function mapHeaders(headerRow) {
  const map = {
    year: -1,
    month: -1,
    date: -1,
    name: -1,
    om: -1,
    site: -1,
    tl: -1,
    agentName: -1,
    account: -1,
    cctvReasonCodes: -1,
    noc: -1,
    remarks: -1
  };

  for (let c = 0; c < headerRow.length; c++) {
    const raw = cleanText(headerRow[c]);
    const norm = raw.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (map.year === -1 && (norm === "year" || norm === "yr")) {
      map.year = c;
    } else if (map.month === -1 && (norm === "month" || norm === "mo")) {
      map.month = c;
    } else if (map.date === -1 && (norm === "date" || norm === "dt")) {
      map.date = c;
    } else if (map.name === -1 && (norm === "name" || norm === "auditor" || norm === "staff" || norm === "analyst")) {
      map.name = c;
    } else if (map.om === -1 && (norm === "om" || norm === "operationmanager" || norm === "operationsmanager" || norm === "omname")) {
      map.om = c;
    } else if (map.site === -1 && (norm === "site" || norm === "location")) {
      map.site = c;
    } else if (map.tl === -1 && (norm === "tl" || norm === "teamleader" || norm === "teamlead" || norm === "tlname")) {
      map.tl = c;
    } else if (map.agentName === -1 && (norm === "agentname" || norm === "agent" || norm === "employeename" || norm === "subjectname")) {
      map.agentName = c;
    } else if (map.account === -1 && (norm === "account" || norm === "campaign" || norm === "client")) {
      map.account = c;
    } else if (
      map.cctvReasonCodes === -1 &&
      (norm.indexOf("cctvreason") === 0 ||
       norm === "reasoncode" ||
       norm === "reasoncodes" ||
       norm === "reason" ||
       norm === "cctvreasoncod" ||
       norm === "cctvreasoncode" ||
       norm === "cctvreasoncodes")
    ) {
      map.cctvReasonCodes = c;
    } else if (map.noc === -1 && (norm === "noc" || norm === "nocstatus" || norm === "status")) {
      map.noc = c;
    } else if (map.remarks === -1 && (norm === "remarks" || norm === "remark" || norm === "notes" || norm === "note" || norm === "comments")) {
      map.remarks = c;
    }
  }

  return map;
}

function getMappedCell(row, colIdx) {
  if (colIdx === -1 || colIdx === undefined || colIdx >= row.length) {
    return "";
  }
  return cleanText(row[colIdx]);
}

/**
 * Locate sheet tab by its numeric GID
 */
function getSheetByGid(spreadsheet, gid) {
  const sheets = spreadsheet.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (Number(sheets[i].getSheetId()) === Number(gid)) {
      return sheets[i];
    }
  }
  throw new Error("Could not find sheet with GID: " + gid);
}

function parseRequestBody(e) {
  if (!e) return {};
  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (_) {}
  }
  return e.parameter || {};
}

function upsertHrAssignment(record) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ensureWebHrSheet(ss);

  const id = cleanText(record.id) || makeId();
  const site = cleanText(record.site);
  const omTeam = cleanText(record.omTeam);
  const hr = cleanText(record.hr);
  const remarks = cleanText(record.remarks);

  if (!site || !omTeam || !hr) {
    throw new Error("Site, OM / Team, and HR Assignee are required.");
  }

  const values = sheet.getDataRange().getDisplayValues();
  let targetRow = -1;

  for (let row = 1; row < values.length; row++) {
    if (cleanText(values[row][0]) === id) {
      targetRow = row + 1;
      break;
    }
  }

  const output = [
    id,
    site,
    omTeam,
    hr,
    remarks,
    new Date().toISOString()
  ];

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, output.length).setValues([output]);
  } else {
    sheet.appendRow(output);
  }

  SpreadsheetApp.flush();

  return {
    success: true,
    version: "3.0",
    action: targetRow > 0 ? "updated" : "created",
    record: {
      id: id,
      site: site,
      omTeam: omTeam,
      hr: hr,
      remarks: remarks
    }
  };
}

function deleteHrAssignment(id) {
  if (!id) {
    throw new Error("Assignment ID is required.");
  }

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.WEB_HR_SHEET);

  if (!sheet) {
    return { success: true, version: "3.0", deleted: false };
  }

  const values = sheet.getDataRange().getDisplayValues();

  for (let row = values.length - 1; row >= 1; row--) {
    if (cleanText(values[row][0]) === id) {
      sheet.deleteRow(row + 1);
      return { success: true, version: "3.0", deleted: true };
    }
  }

  return { success: true, version: "3.0", deleted: false };
}

function ensureWebHrSheet(ss) {
  let sheet = ss.getSheetByName(CONFIG.WEB_HR_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.WEB_HR_SHEET);
    sheet.getRange(1, 1, 1, 6).setValues([[
      "ID",
      "SITE",
      "OM / TEAM",
      "HR ASSIGNEE",
      "REMARKS",
      "UPDATED AT"
    ]]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function packSheet(sheet) {
  if (!sheet) {
    return emptyPackedSheet("");
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (!lastRow || !lastColumn) {
    return {
      gid: sheet.getSheetId(),
      name: sheet.getName(),
      rows: [],
      grid: []
    };
  }

  const grid = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();

  return {
    gid: sheet.getSheetId(),
    name: sheet.getName(),
    rows: gridToObjects(grid),
    grid: grid
  };
}

function emptyPackedSheet(name) {
  return {
    gid: null,
    name: name || "",
    rows: [],
    grid: []
  };
}

function gridToObjects(grid) {
  if (!Array.isArray(grid) || !grid.length) {
    return [];
  }

  const headers = grid[0].map(function(header, index) {
    const clean = cleanText(header);
    return clean || ("Column_" + (index + 1));
  });

  return grid
    .slice(1)
    .filter(function(row) {
      return row.some(function(cell) { return cleanText(cell) !== ""; });
    })
    .map(function(row) {
      const object = {};
      headers.forEach(function(header, index) {
        object[header] = row[index] || "";
      });
      return object;
    });
}

function cleanText(value) {
  return String(value == null ? "" : value)
    .replace(/\s+/g, " ")
    .trim();
}

function makeId() {
  return "hr_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Diagnostic test function runnable directly inside the Google Apps Script IDE
 */
function testUnifiedTrackers() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const report = {};

  Object.keys(CONFIG.TRACKERS).forEach(function(key) {
    const conf = CONFIG.TRACKERS[key];
    try {
      const res = processTrackerSheet(ss, conf);
      report[key] = {
        ok: true,
        gid: conf.gid,
        sheetName: res.sheetName,
        totalRowsRead: res.totalRows,
        pendingRowsFound: res.rows.length,
        sampleRow: res.rows.length ? res.rows[0] : null
      };
    } catch (e) {
      report[key] = {
        ok: false,
        gid: conf.gid,
        error: e.message
      };
    }
  });

  Logger.log(JSON.stringify(report, null, 2));
  return report;
}
