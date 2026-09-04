/**
 * CCTV OPS - Maintenance Google Sheets Receiver V8.11
 *
 * TRUE IN-CELL SCREENSHOT FIX:
 * V8.11 does NOT use sheet.insertImage().
 * It writes each CCTV screenshot as a Spreadsheet CellImage value using
 * SpreadsheetApp.newCellImage().setSourceUrl(dataUrl).build().
 *
 * This means the screenshot is stored INSIDE the merged cell directly
 * below its own report data.
 *
 * FIXED BLOCK LAYOUT:
 * For EVERY report block:
 *   1) IT Sheet header + data rows
 *   2) Screenshot proof row
 *   3) The screenshot(s) anchored immediately BELOW that block's data
 *   4) Remarks
 *   5) Then the next report block
 *
 * The receiver verifies image insertion PER BLOCK before returning success.
 */

const SPREADSHEET_ID = '1PBKIr7cACVcElX9YpAqshhTTsjlJz69dji7TiA0IlrE';
const SHEET_NAME = 'MABINI SITE A - 1F|2F';
const CHUNK_PREFIX = 'maintenance_chunk_';

const HEADERS = [
  'TIMESTAMP',
  'DATE',
  'TL',
  'ACCOUNT',
  'SITE',
  'STATION NO.',
  'STATION ISSUE'
];

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
        version: '8.11',
        result: result
      }, callback);
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      throw new Error(
        'Target tab "' + SHEET_NAME + '" was not found. Available tabs: ' +
        ss.getSheets().map(function(s) { return s.getName(); }).join(' | ')
      );
    }

    return jsonp_({
      ok: true,
      version: '8.11',
      transport: 'jsonp-get-chunks',
      screenshotMode: 'true-cell-image-per-block',
      layout: 'rows > cell-image > remarks',
      spreadsheetName: ss.getName(),
      sheetName: sheet.getName(),
      sheetId: sheet.getSheetId(),
      lastRow: sheet.getLastRow(),
      imageCount: sheet.getImages().length,
      maxRows: sheet.getMaxRows()
    }, callback);

  } catch (error) {
    return jsonp_({
      ok: false,
      state: 'error',
      version: '8.11',
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
        version: '8.11',
        result: result
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: false,
        state: 'error',
        version: '8.11',
        error: String(error && error.message ? error.message : error)
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function appendMaintenanceReport_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      throw new Error('Target sheet "' + SHEET_NAME + '" does not exist.');
    }

    ensureColumns_(sheet);

    const reportTitle = String(payload.reportTitle || 'Maintenance Report').trim();
    const reportDate = formatDateForDisplay_(payload.reportDate);
    const fullTitle = reportDate ? reportTitle + ' (' + reportDate + ')' : reportTitle;

    const oldLastRow = sheet.getLastRow();
    const startingRow = Math.max(oldLastRow + 1, 1);
    let row = startingRow;

    ensureRowsAvailable_(sheet, row + 2);

    sheet.getRange(row, 1, 1, 7).breakApart();
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
    row += 2;

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

      // 1) DATA TABLE
      ensureRowsAvailable_(sheet, row);

      sheet.getRange(row, 1, 1, 7).breakApart();
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

        totalRows += normalizedRows.length;
        row += normalizedRows.length;
      }

      // 2) SCREENSHOT(S) DIRECTLY BELOW THIS BLOCK'S DATA.
      // V8.11 uses TRUE IN-CELL images instead of over-grid images.
      if (screenshots.length) {
        totalExpectedImages += screenshots.length;

        row += 1;
        ensureRowsAvailable_(sheet, row);

        sheet.getRange(row, 1, 1, 7).breakApart();
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
          .setHorizontalAlignment('left');

        sheet.setRowHeight(row, 22);
        row += 1;

        let actualBlockImages = 0;

        screenshots.forEach(function(dataUrl, imageIndex) {
          const imageRow = row;

          ensureRowsAvailable_(sheet, imageRow);

          // Give the image a wide merged cell below the report data.
          // This is a real cell image, not a floating/over-grid image.
          const imageRange = sheet.getRange(imageRow, 2, 1, 5); // B:F
          imageRange.breakApart();
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

          // Verify that Google Sheets stored an IMAGE value in the merged cell.
          const stored = imageRange.getCell(1, 1).getValue();
          if (!stored || stored.valueType !== SpreadsheetApp.ValueType.IMAGE) {
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
          row += 2;
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
      } else {
        // No screenshots for this block.
      }

      // 3) REMARKS AFTER THIS BLOCK'S IMAGE(S)
      if (remarks.length) {
        const remarksText = remarks.join('\n');

        ensureRowsAvailable_(sheet, row);

        sheet.getRange(row, 1, 1, 7).breakApart();
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
        blockEndRow: blockEndRow,
        dataRowCount: rows.length,
        expectedImages: screenshots.length,
        insertedImages: actualBlockImages,
        imageAnchorRows: screenshotAnchorRows,
        remarksCount: remarks.length
      });

      // Space before the next block.
      row += 2;
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
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    throw new Error(
      'Target tab missing. Available tabs: ' +
      ss.getSheets().map(function(s) {
        return s.getName();
      }).join(' | ')
    );
  }

  console.log('SUCCESS');
  console.log('Spreadsheet: ' + ss.getName());
  console.log('Tab: ' + sheet.getName());
  console.log('Sheet ID: ' + sheet.getSheetId());
  console.log('Last row: ' + sheet.getLastRow());
  console.log('Image count: ' + sheet.getImages().length);

  return true;
}
