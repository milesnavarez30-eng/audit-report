/*******************************************************
 * AUDIT REPORT MASTERLIST API v2
 *
 * Adds:
 * - full raw grid for Tracker / Master List / Data
 * - keeps the existing rows output
 * - dedicated WEB HR ASSIGNMENTS sheet for website edits
 * - add/update/delete HR assignment actions
 *
 * Your existing Web App URL can stay the same after redeploying
 * this code as a NEW VERSION.
 *******************************************************/

const CONFIG = {
  SPREADSHEET_ID: "12o3O1u2xb3DbXW41jAen-8HSJhpJRzQLSIb_6o5JRc4",

  SHEETS: {
    tracker: 304130933,
    masterList: 684780096,
    data: 1589623984
  },

  WEB_HR_SHEET: "WEB HR ASSIGNMENTS"
};


function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

    const trackerSheet = getSheetByGid(ss, CONFIG.SHEETS.tracker);
    const masterListSheet = getSheetByGid(ss, CONFIG.SHEETS.masterList);
    const dataSheet = getSheetByGid(ss, CONFIG.SHEETS.data);

    const tracker = packSheet(trackerSheet);
    const masterList = packSheet(masterListSheet);
    const data = packSheet(dataSheet);

    const hrSheet = ss.getSheetByName(CONFIG.WEB_HR_SHEET);
    const webHrAssignments = hrSheet
      ? packSheet(hrSheet)
      : emptyPackedSheet(CONFIG.WEB_HR_SHEET);

    return jsonResponse({
      success: true,
      version: "2.0",
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      updatedAt: new Date().toISOString(),

      sheets: {
        tracker,
        masterList,
        data,
        webHrAssignments
      },

      // Backward-compatible fields for the current website.
      tracker: tracker.rows,
      masterList: masterList.rows,
      data: data.rows,
      webHrAssignments: webHrAssignments.rows
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      version: "2.0",
      error: error.message,
      stack: error.stack
    });
  }
}


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
      version: "2.0",
      error: error.message,
      stack: error.stack
    });
  }
}


function parseRequestBody(e) {
  if (!e) return {};

  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (_) {
      // Continue to parameters below.
    }
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
    throw new Error(
      "Site, OM / Team, and HR Assignee are required."
    );
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
    sheet
      .getRange(targetRow, 1, 1, output.length)
      .setValues([output]);
  } else {
    sheet.appendRow(output);
  }

  SpreadsheetApp.flush();

  return {
    success: true,
    version: "2.0",
    action: targetRow > 0 ? "updated" : "created",
    record: {
      id,
      site,
      omTeam,
      hr,
      remarks
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
    return {
      success: true,
      version: "2.0",
      deleted: false
    };
  }

  const values = sheet.getDataRange().getDisplayValues();

  for (let row = values.length - 1; row >= 1; row--) {
    if (cleanText(values[row][0]) === id) {
      sheet.deleteRow(row + 1);

      return {
        success: true,
        version: "2.0",
        deleted: true
      };
    }
  }

  return {
    success: true,
    version: "2.0",
    deleted: false
  };
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

  const grid = sheet
    .getRange(1, 1, lastRow, lastColumn)
    .getDisplayValues();

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

  const headers = grid[0].map(
    (header, index) => {
      const clean = cleanText(header);
      return clean || ("Column_" + (index + 1));
    }
  );

  return grid
    .slice(1)
    .filter(row =>
      row.some(cell => cleanText(cell) !== "")
    )
    .map(row => {
      const object = {};

      headers.forEach((header, index) => {
        object[header] = row[index] || "";
      });

      return object;
    });
}


function getSheetByGid(spreadsheet, gid) {
  const sheet = spreadsheet
    .getSheets()
    .find(item =>
      Number(item.getSheetId()) === Number(gid)
    );

  if (!sheet) {
    throw new Error(
      "Could not find sheet with GID: " + gid
    );
  }

  return sheet;
}


function cleanText(value) {
  return String(
    value == null ? "" : value
  )
    .replace(/\s+/g, " ")
    .trim();
}


function makeId() {
  return "hr_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 8);
}


function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


function testConnection() {
  const ss = SpreadsheetApp.openById(
    CONFIG.SPREADSHEET_ID
  );

  const output = {
    spreadsheetName: ss.getName(),
    tracker: getSheetByGid(
      ss,
      CONFIG.SHEETS.tracker
    ).getName(),
    masterList: getSheetByGid(
      ss,
      CONFIG.SHEETS.masterList
    ).getName(),
    data: getSheetByGid(
      ss,
      CONFIG.SHEETS.data
    ).getName()
  };

  Logger.log(
    JSON.stringify(output, null, 2)
  );

  return output;
}
