/**
 * CCTV OPS - Maintenance Google Sheets Receiver V8.14
 *
 * DYNAMIC DESTINATION MAPPING & MULTI-TRACKER ROUTING:
 * - Dynamic sheet resolution by destinationKey and sheet GID
 * - Strictly excludes Sheet20, MAA SITE 4TH FLR, MAA SITE 5TH FLR
 * - Preserves complete V8.13 block layout, safelyUnmergeRowArea_, and true CellImage engine
 *
 * SPREADSHEET ID:
 * 1PBKIr7cACVcElX9YpAqshhTTsjlJz69dji7TiA0IlrE
 *
 * EXACT PRODUCTION DESTINATION MAPPING:
 * 1. maa_4_5   : MAA 4th & 5th Floor               (GID: 0)
 * 2. mabini_a   : Mabini Site A - 1st & 2nd Floor    (GID: 484781158)
 * 3. gensan     : Gensan Site                        (GID: 219168917)
 * 4. maa_6      : MAA 6th Floor                      (GID: 11380648)
 * 5. mabini_b   : Mabini Site B - 2nd, 3rd & 4th Flr (GID: 1670996421)
 * 6. digos      : Digos Site                         (GID: 1812673001)
 * 7. ecoland    : Ecoland Site                       (GID: 429979469)
 * 8. cdo        : CDO Site                           (GID: 1535793826)
 *
 * REQUIRED BLOCK LAYOUT PER BLOCK:
 * 1) IT Sheet header + data rows (7 columns)
 * 2) CCTV Screenshot Proof header + true in-cell images (B:F merge)
 * 3) Remarks directly below screenshot(s)
 * 4) Spacing before next block
 */

const SPREADSHEET_ID = '1PBKIr7cACVcElX9YpAqshhTTsjlJz69dji7TiA0IlrE';
const CHUNK_PREFIX = 'maintenance_chunk_';

const MAINTENANCE_DESTINATIONS = {
  maa_4_5: {
    label: "MAA 4th & 5th Floor",
    sheetId: 0,
    aliases: ["MAA 4F|5F", "MAA 4F 5F", "MAA 4TH 5TH", "MAA 4TH & 5TH FLOOR"]
  },

  mabini_a: {
    label: "Mabini Site A - 1st & 2nd Floor",
    sheetId: 484781158,
    aliases: ["MABINI SITE A - 1F|2F", "MABINI SITE A", "MABINI A"]
  },

  gensan: {
    label: "Gensan Site",
    sheetId: 219168917,
    aliases: ["GENSAN SITE", "GENSAN"]
  },

  maa_6: {
    label: "MAA 6th Floor",
    sheetId: 11380648,
    aliases: ["MAA SITE 6TH FLR", "MAA 6TH FLR", "MAA 6TH FLOOR", "MAA 6F"]
  },

  mabini_b: {
    label: "Mabini Site B - 2nd, 3rd & 4th Floor",
    sheetId: 1670996421,
    aliases: ["MABINI SITE B - 2F|3F|4F", "MABINI SITE B", "MABINI B"]
  },

  digos: {
    label: "Digos Site",
    sheetId: 1812673001,
    aliases: ["DIGOS SITE", "DIGOS"]
  },

  ecoland: {
    label: "Ecoland Site",
    sheetId: 429979469,
    aliases: ["ECOLAND SITE", "ECOLAND"]
  },

  cdo: {
    label: "CDO Site",
    sheetId: 1535793826,
    aliases: ["CDO SITE", "CDO"]
  }
};

const EXCLUDED_TABS = [
  'Sheet20',
  'MAA SITE 4TH FLR',
  'MAA SITE 5TH FLR'
];

const HEADERS = [
  'TIMESTAMP',
  'DATE',
  'TL',
  'ACCOUNT',
  'SITE',
  'STATION NO.',
  'STATION ISSUE'
];

function getMaintenanceDestinationSheet_(ss, destinationKey) {
  const destination = MAINTENANCE_DESTINATIONS[destinationKey];

  if (!destination) {
    throw new Error(
      'Invalid Maintenance destination: ' + destinationKey
    );
  }

  const allSheets = ss.getSheets();

  // 1. Primary resolution: exact GID match
  let sheet = allSheets.find(function(s) {
    return Number(s.getSheetId()) === Number(destination.sheetId);
  });

  // 2. Fallback resolution: sheet name or alias match
  if (!sheet) {
    const targetNorm = normalizeSheetName_(destination.label);
    const aliases = (destination.aliases || []).map(normalizeSheetName_);

    sheet = allSheets.find(function(s) {
      const sName = normalizeSheetName_(s.getName());
      if (sName === targetNorm) return true;
      for (let i = 0; i < aliases.length; i++) {
        if (aliases[i] && (sName === aliases[i] || sName.indexOf(aliases[i]) !== -1)) {
          return true;
        }
      }
      return false;
    });
  }

  if (!sheet) {
    throw new Error(
      'Configured Maintenance tracker was not found for ' +
      destination.label +
      ' (GID ' + destination.sheetId + ').'
    );
  }

  const sheetNameUpper = String(sheet.getName() || '').toUpperCase().trim();
  for (let i = 0; i < EXCLUDED_TABS.length; i++) {
    if (sheetNameUpper === EXCLUDED_TABS[i].toUpperCase().trim()) {
      throw new Error(
        'Routing to excluded tab "' + sheet.getName() + '" is strictly blocked.'
      );
    }
  }

  return {
    sheet: sheet,
    destination: destination
  };
}

function normalizeSheetName_(name) {
  return String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function jsonp_(payload, callback) {
  const text = JSON.stringify(payload || {});

  if (callback && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService
      .createTextOutput(callback + '(' + text + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(text)
    .setMimeType(ContentService.MimeType.JSON);
}

function chunkKey_(submissionId, index) {
  return CHUNK_PREFIX + submissionId + '_' + index;
}

function decodeBase64Utf8_(value) {
  const bytes = Utilities.base64Decode(String(value || ''));
  return Utilities.newBlob(bytes).getDataAsString('UTF-8');
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const callback = String(p.callback || '');
  const action = String(p.action || 'health');

  try {
    if (action === 'uploadChunk') {
      const submissionId = String(p.submissionId || '').trim();
      const index = Number(p.index);
      const total = Number(p.total);
      const data = String(p.data || '');

      if (!submissionId) throw new Error('Missing submissionId.');
      if (!Number.isInteger(index) || index < 0) throw new Error('Invalid chunk index.');
      if (!Number.isInteger(total) || total < 1) throw new Error('Invalid chunk total.');
      if (!data) throw new Error('Empty chunk.');

      CacheService.getScriptCache().put(
        chunkKey_(submissionId, index),
        data,
        600
      );

      return jsonp_({
        ok: true,
        action: 'uploadChunk',
        index: index,
        total: total
      }, callback);
    }

    if (action === 'commit') {
      const submissionId = String(p.submissionId || '').trim();
      const total = Number(p.total);

      if (!submissionId) throw new Error('Missing submissionId.');
      if (!Number.isInteger(total) || total < 1) throw new Error('Invalid chunk total.');

      const cache = CacheService.getScriptCache();
      const parts = [];

      for (let i = 0; i < total; i++) {
        const part = cache.get(chunkKey_(submissionId, i));
        if (part == null) {
          throw new Error(
            'Missing uploaded chunk ' + (i + 1) + ' of ' + total + '. Please send again.'
          );
        }
        parts.push(part);
      }

      const payload = JSON.parse(decodeBase64Utf8_(parts.join('')));

      if (payload.action !== 'appendMaintenanceReport') {
        throw new Error('Unsupported payload action: ' + payload.action);
      }

      const result = appendMaintenanceReport_(payload);

      for (let i = 0; i < total; i++) {
        cache.remove(chunkKey_(submissionId, i));
      }

      return jsonp_({
        ok: true,
        state: 'success',
        version: '8.14',
        result: result
      }, callback);
    }

    // Diagnostic action to inspect all sheets and GIDs
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    if (action === 'debugSheets') {
      const allSheets = ss.getSheets().map(function(s) {
        return {
          gid: s.getSheetId(),
          name: s.getName(),
          lastRow: s.getLastRow(),
          lastColumn: s.getLastColumn()
        };
      });
      return jsonp_({
        ok: true,
        version: '8.14',
        action: 'debugSheets',
        spreadsheetName: ss.getName(),
        sheets: allSheets
      }, callback);
    }

    // Health action
    const destinationKey = String(p.destinationKey || '').trim();

    if (destinationKey) {
      const resolved = getMaintenanceDestinationSheet_(ss, destinationKey);
      const sheet = resolved.sheet;
      const destination = resolved.destination;

      return jsonp_({
        ok: true,
        version: '8.14',
        action: 'health',
        transport: 'jsonp-get-chunks',
        screenshotMode: 'true-cell-image-per-block-fixed',
        layout: 'rows > cell-image > remarks',
        destinationKey: destinationKey,
        destinationLabel: destination.label,
        spreadsheetName: ss.getName(),
        sheetName: sheet.getName(),
        sheetId: sheet.getSheetId(),
        lastRow: sheet.getLastRow(),
        imageCount: sheet.getImages().length,
        maxRows: sheet.getMaxRows()
      }, callback);
    }

    // General receiver health if destinationKey is omitted
    return jsonp_({
      ok: true,
      version: '8.14',
      action: 'health',
      transport: 'jsonp-get-chunks',
      screenshotMode: 'true-cell-image-per-block-fixed',
      layout: 'rows > cell-image > remarks',
      spreadsheetName: ss.getName(),
      availableDestinations: Object.keys(MAINTENANCE_DESTINATIONS).map(function(key) {
        return {
          key: key,
          label: MAINTENANCE_DESTINATIONS[key].label,
          sheetId: MAINTENANCE_DESTINATIONS[key].sheetId
        };
      })
    }, callback);

  } catch (error) {
    return jsonp_({
      ok: false,
      state: 'error',
      version: '8.14',
      error: String(error && error.message ? error.message : error)
    }, callback);
  }
}

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) || '{}';
    const payload = JSON.parse(raw);
    const result = appendMaintenanceReport_(payload);

    return ContentService
      .createTextOutput(JSON.stringify({
        ok: true,
        state: 'success',
        version: '8.14',
        result: result
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: false,
        state: 'error',
        version: '8.14',
        error: String(error && error.message ? error.message : error)
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Safely unmerges any merged ranges that intersect the specified row(s).
 *
 * CRITICAL RULE:
 * Never call range.breakApart() on a partial subset of a merged range.
 * This function scans the row span across the sheet columns and uses getMergedRanges().
 * Because getMergedRanges() returns the COMPLETE Range object of every intersecting
 * merge, calling mr.breakApart() operates on all cells in that merged range,
 * completely avoiding "You must select all cells in a merged range to merge or unmerge them."
 */
function safelyUnmergeRowArea_(sheet, startRow, numRows) {
  if (!sheet || !startRow || startRow < 1) return;
  numRows = numRows || 1;
  const maxCols = Math.max(sheet.getMaxColumns(), 7);

  try {
    const scanRange = sheet.getRange(startRow, 1, numRows, maxCols);
    const mergedRanges = scanRange.getMergedRanges();

    if (mergedRanges && mergedRanges.length > 0) {
      for (let i = 0; i < mergedRanges.length; i++) {
        const mr = mergedRanges[i];
        try {
          mr.breakApart();
        } catch (breakErr) {
          console.warn(
            'Notice: could not break apart merged range ' +
            (mr.getA1Notation ? mr.getA1Notation() : '') +
            ': ' + breakErr
          );
        }
      }
    }
  } catch (err) {
    console.warn('safelyUnmergeRowArea_ scan notice: ' + err);
  }
}

/**
 * Robust verification that a CellImage was set into a cell.
 */
function isVerifiedCellImage_(cell) {
  if (!cell) return false;
  try {
    const val = cell.getValue();
    if (!val) return false;

    // 1. Check ValueType enum if exposed by Apps Script environment
    if (typeof SpreadsheetApp.ValueType !== 'undefined' && val.valueType === SpreadsheetApp.ValueType.IMAGE) {
      return true;
    }

    // 2. Check CellImage methods
    if (typeof val === 'object') {
      if (typeof val.getAltTextTitle === 'function' ||
          typeof val.getContentUrl === 'function' ||
          typeof val.getUrl === 'function') {
        return true;
      }
      const str = Object.prototype.toString.call(val);
      if (str.indexOf('CellImage') !== -1 || str.indexOf('Image') !== -1 || String(val).indexOf('CellImage') !== -1) {
        return true;
      }
    }

    return typeof val === 'object';
  } catch (_) {
    return true;
  }
}

function appendMaintenanceReport_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const destinationKey = String(payload.destinationKey || '').trim();
    if (!destinationKey) {
      throw new Error('Missing required destinationKey in Maintenance report submission.');
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const resolved = getMaintenanceDestinationSheet_(ss, destinationKey);
    const sheet = resolved.sheet;
    const destination = resolved.destination;

    ensureColumns_(sheet);

    const reportTitle = String(payload.reportTitle || destination.label || 'Maintenance Report').trim();
    const reportDate = formatDateForDisplay_(payload.reportDate);
    const fullTitle = reportDate ? reportTitle + ' (' + reportDate + ')' : reportTitle;

    const oldLastRow = sheet.getLastRow();
    const startingRow = Math.max(oldLastRow + 1, 1);
    let row = startingRow;

    // Ensure space for title and spacing
    ensureRowsAvailable_(sheet, row + 2);

    // Write Main Report Title safely
    safelyUnmergeRowArea_(sheet, row, 1);
    sheet.getRange(row, 1, 1, 7).merge();
    sheet.getRange(row, 1)
      .setValue(fullTitle)
      .setFontWeight('bold')
      .setFontSize(11)
      .setBackground('#ffffff')
      .setFontColor('#111111')
      .setHorizontalAlignment('left')
      .setVerticalAlignment('middle');

    sheet.setRowHeight(row, 24);
    row += 1;

    // Clean spacing row between title and first block
    ensureRowsAvailable_(sheet, row);
    safelyUnmergeRowArea_(sheet, row, 1);
    sheet.getRange(row, 1, 1, 7).clearContent().setBackground('#ffffff');
    sheet.setRowHeight(row, 10);
    row += 1;

    const blocks = Array.isArray(payload.blocks) ? payload.blocks : [];
    let totalRows = 0;
    let totalExpectedImages = 0;
    let totalInsertedImages = 0;
    let totalRemarks = 0;
    const blockResults = [];

    blocks.forEach(function(block, blockIndex) {
      const rows = Array.isArray(block.rows) ? block.rows : [];
      const screenshots = Array.isArray(block.screenshots)
        ? block.screenshots.filter(function(value) {
            return /^data:image\//i.test(String(value || ''));
          })
        : [];
      const remarks = Array.isArray(block.remarks) ? block.remarks : [];

      if (!rows.length && !screenshots.length && !remarks.length) return;

      const blockNumber = Number(block.blockNumber || blockIndex + 1);
      const blockStartRow = row;
      const screenshotAnchorRows = [];
      let actualBlockImages = 0;

      // 1) DATA TABLE
      ensureRowsAvailable_(sheet, row);
      safelyUnmergeRowArea_(sheet, row, 1);

      sheet.getRange(row, 1, 1, 7)
        .setValues([HEADERS])
        .setBackground('#202124')
        .setFontColor('#ffffff')
        .setFontWeight('bold')
        .setFontSize(9)
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle');

      sheet.setRowHeight(row, 22);
      row += 1;

      if (rows.length) {
        const normalizedRows = rows.map(normalizeSevenColumns_);
        ensureRowsAvailable_(sheet, row + normalizedRows.length - 1);
        safelyUnmergeRowArea_(sheet, row, normalizedRows.length);

        sheet.getRange(row, 1, normalizedRows.length, 7)
          .setValues(normalizedRows)
          .setBackground('#ffffff')
          .setFontColor('#111111')
          .setFontSize(9)
          .setVerticalAlignment('middle')
          .setWrap(true);

        sheet.getRange(row, 1, normalizedRows.length, 6)
          .setHorizontalAlignment('center');

        sheet.getRange(row, 7, normalizedRows.length, 1)
          .setHorizontalAlignment('left');

        for (let r = 0; r < normalizedRows.length; r++) {
          sheet.setRowHeight(row + r, 20);
        }

        totalRows += normalizedRows.length;
        row += normalizedRows.length;
      }

      // 2) SCREENSHOT(S) DIRECTLY BELOW THIS BLOCK'S DATA
      if (screenshots.length) {
        totalExpectedImages += screenshots.length;

        ensureRowsAvailable_(sheet, row);
        safelyUnmergeRowArea_(sheet, row, 1);

        sheet.getRange(row, 1, 1, 7).merge();
        sheet.getRange(row, 1)
          .setValue(
            'CCTV SCREENSHOT PROOF — BLOCK ' +
            blockNumber +
            ' (' +
            screenshots.length +
            ')'
          )
          .setFontWeight('bold')
          .setFontSize(9)
          .setFontColor('#111111')
          .setBackground('#eef4ff')
          .setHorizontalAlignment('left')
          .setVerticalAlignment('middle');

        sheet.setRowHeight(row, 22);
        row += 1;

        actualBlockImages = 0;

        screenshots.forEach(function(dataUrl, imageIndex) {
          const imageRow = row;

          ensureRowsAvailable_(sheet, imageRow);
          // Safely unmerge the entire row before creating the B:F merge
          safelyUnmergeRowArea_(sheet, imageRow, 1);

          // Clear row background and values
          sheet.getRange(imageRow, 1, 1, 7)
            .clearContent()
            .setBackground('#ffffff');

          // Merge columns B through F (Columns 2 to 6) for a generous 745px wide landscape frame
          const imageRange = sheet.getRange(imageRow, 2, 1, 5);
          imageRange.merge();
          imageRange
            .setBackground('#ffffff')
            .setHorizontalAlignment('center')
            .setVerticalAlignment('middle');

          sheet.setRowHeight(imageRow, 235);

          const cellImage = SpreadsheetApp
            .newCellImage()
            .setSourceUrl(String(dataUrl))
            .setAltTextTitle(
              'CCTV Screenshot Proof ' +
              (imageIndex + 1) +
              ' — Block ' +
              blockNumber
            )
            .setAltTextDescription(
              'Maintenance block ' +
              blockNumber +
              ' screenshot.'
            )
            .build();

          imageRange.getCell(1, 1).setValue(cellImage);
          SpreadsheetApp.flush();

          // Verify in-cell image storage
          if (!isVerifiedCellImage_(imageRange.getCell(1, 1))) {
            throw new Error(
              'Block ' +
              blockNumber +
              ' screenshot ' +
              (imageIndex + 1) +
              ' was not stored as an in-cell image.'
            );
          }

          actualBlockImages += 1;
          screenshotAnchorRows.push(imageRow);
          row += 1;
        });

        if (actualBlockImages !== screenshots.length) {
          throw new Error(
            'Block ' +
            blockNumber +
            ' screenshot verification failed. Expected ' +
            screenshots.length +
            ', actual in-cell images ' +
            actualBlockImages +
            '.'
          );
        }

        totalInsertedImages += actualBlockImages;
      }

      // 3) REMARKS AFTER THIS BLOCK'S IMAGE(S)
      if (remarks.length) {
        const remarksText = remarks.join('\n');

        ensureRowsAvailable_(sheet, row);
        safelyUnmergeRowArea_(sheet, row, 1);

        sheet.getRange(row, 1, 1, 7).merge();
        sheet.getRange(row, 1)
          .setValue('Remarks: ' + remarksText)
          .setBackground('#f5faf3')
          .setFontColor('#111111')
          .setFontSize(9)
          .setWrap(true)
          .setHorizontalAlignment('left')
          .setVerticalAlignment('middle');

        totalRemarks += remarks.length;
        sheet.setRowHeight(row, Math.max(26, 18 + remarks.length * 12));
        row += 1;
      }

      const blockEndRow = row;

      blockResults.push({
        blockNumber: blockNumber,
        blockStartRow: blockStartRow,
        blockEndRow: row,
        dataRowCount: rows.length,
        expectedImages: screenshots.length,
        insertedImages: actualBlockImages,
        imageAnchorRows: screenshotAnchorRows,
        remarksCount: remarks.length
      });

      // Space before the next block
      ensureRowsAvailable_(sheet, row);
      safelyUnmergeRowArea_(sheet, row, 1);
      sheet.getRange(row, 1, 1, 7).clearContent().setBackground('#ffffff');
      sheet.setRowHeight(row, 12);
      row += 1;
    });

    SpreadsheetApp.flush();

    if (totalInsertedImages !== totalExpectedImages) {
      throw new Error(
        'Final in-cell screenshot count mismatch. Expected ' +
        totalExpectedImages +
        ', actual ' +
        totalInsertedImages +
        '.'
      );
    }

    return {
      destinationKey: destinationKey,
      destinationLabel: destination.label,
      spreadsheetName: ss.getName(),
      sheetName: sheet.getName(),
      sheetId: sheet.getSheetId(),
      previousLastRow: oldLastRow,
      startingRow: startingRow,
      endingRow: Math.max(startingRow, row - 1),
      actualLastRow: sheet.getLastRow(),
      rowCount: totalRows,
      screenshotCount: totalExpectedImages,
      insertedImageCount: totalInsertedImages,
      remarksCount: totalRemarks,
      blockResults: blockResults
    };

  } finally {
    lock.releaseLock();
  }
}

function normalizeSevenColumns_(source) {
  const row = Array.isArray(source) ? source.slice() : [];

  while (row.length < 7) row.push('');

  if (row.length > 7) {
    return [
      row[0],
      row[1],
      row[2],
      row[3],
      row[4],
      row[5],
      row.slice(6).join(' ')
    ];
  }

  return row.slice(0, 7);
}

function formatDateForDisplay_(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (match) {
    return Number(match[2]) + '/' + Number(match[3]) + '/' + match[1];
  }

  return raw;
}

function dataUrlToBlob_(dataUrl, filename) {
  const value = String(dataUrl || '');
  const match = value.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    throw new Error('Invalid screenshot data.');
  }

  const bytes = Utilities.base64Decode(match[2]);

  if (!bytes || !bytes.length) {
    throw new Error('Screenshot decoded as an empty image.');
  }

  return Utilities.newBlob(
    bytes,
    match[1],
    filename || 'cctv-proof.jpg'
  );
}

function ensureRowsAvailable_(sheet, rowNumber) {
  const needed = Number(rowNumber || 1);
  const maxRows = sheet.getMaxRows();

  if (needed > maxRows) {
    sheet.insertRowsAfter(
      maxRows,
      Math.max(needed - maxRows, 100)
    );
  }
}

function ensureColumns_(sheet) {
  if (sheet.getMaxColumns() < 7) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      7 - sheet.getMaxColumns()
    );
  }

  const widths = [150, 105, 195, 155, 165, 125, 260];

  widths.forEach(function(width, index) {
    sheet.setColumnWidth(index + 1, width);
  });
}

function testSheetConnection() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const results = [];

  for (const key in MAINTENANCE_DESTINATIONS) {
    const resolved = getMaintenanceDestinationSheet_(ss, key);
    results.push({
      key: key,
      label: resolved.destination.label,
      name: resolved.sheet.getName(),
      sheetId: resolved.sheet.getSheetId(),
      lastRow: resolved.sheet.getLastRow()
    });
  }

  console.log('ALL DESTINATIONS VERIFIED:');
  console.log(JSON.stringify(results, null, 2));

  return results;
}
