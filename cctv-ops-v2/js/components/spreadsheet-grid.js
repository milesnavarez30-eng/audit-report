/**
 * CCTV OPS V2 - Interactive Spreadsheet Grid Controller
 * Excel & Google Sheets Parity: Cell selection, keyboard navigation, inline editing,
 * range copy/paste, context menu, and date-aware row insertion.
 */

window.SpreadsheetGrid = (function () {
  "use strict";

  function escapeHtml(val) {
    if (typeof window.escapeHtml === "function") return window.escapeHtml(val);
    return String(val == null ? "" : val)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  class SpreadsheetGrid {
    constructor(container, service) {
      this.container = container;
      this.service = service;

      this.selectedCell = { row: 0, col: 0 };
      this.selectionRange = null; // { startRow, startCol, endRow, endCol }
      this.isSelecting = false;
      this.isEditing = false;
      this.activeEditor = null;

      this.findState = {
        isOpen: false,
        query: "",
        caseSensitive: false,
        matches: [],
        currentIndex: -1
      };

      this.columns = this.service.getColumns();

      this._initDom();
      this._bindEvents();
      this._render();

      this.service.subscribe(() => {
        this._render();
      });
    }

    render() {
      this._render();
    }

    _initDom() {
      this.container.innerHTML = `
        <div class="sheet-viewport">
          <!-- In-App Spreadsheet-style Find Control -->
          <div class="sheet-find-bar" style="display:none;" role="search" aria-label="Find in sheet">
            <div class="sheet-find-inner">
              <svg class="icon icon-xs sheet-find-icon" viewBox="0 0 24 24" style="color:var(--text-muted);"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" class="sheet-find-input" placeholder="Find in sheet (Enter / Shift+Enter)..." autocomplete="off" spellcheck="false">
              <span class="sheet-find-counter">0 of 0</span>
              <button type="button" class="sheet-find-btn" data-action="prev" title="Previous match (Shift+Enter)">▲</button>
              <button type="button" class="sheet-find-btn" data-action="next" title="Next match (Enter)">▼</button>
              <button type="button" class="sheet-find-btn sheet-find-toggle" data-action="toggle-case" title="Match case (Aa)">Aa</button>
              <button type="button" class="sheet-find-btn sheet-find-close" data-action="close" title="Close (Esc)">✕</button>
            </div>
          </div>

          <div class="sheet-table-wrapper" tabindex="0" role="grid" aria-label="Live Tracker Spreadsheet">
            <table class="sheet-table">
              <thead>
                <tr class="sheet-header-letters">
                  <th class="sheet-corner"></th>
                  ${this.columns.map((c, i) => `<th>${String.fromCharCode(65 + i)}</th>`).join("")}
                </tr>
                <tr class="sheet-header-labels">
                  <th class="sheet-corner-label">#</th>
                  ${this.columns.map(c => `<th>${c.label}</th>`).join("")}
                </tr>
              </thead>
              <tbody class="sheet-body">
                <!-- Rows injected here -->
              </tbody>
            </table>
          </div>
          <div class="sheet-context-menu" style="display:none;"></div>
        </div>
      `;

      this.wrapper = this.container.querySelector(".sheet-table-wrapper");
      this.tbody = this.container.querySelector(".sheet-body");
      this.contextMenu = this.container.querySelector(".sheet-context-menu");
      this.findBar = this.container.querySelector(".sheet-find-bar");
      this.findInput = this.container.querySelector(".sheet-find-input");
      this.findCounter = this.container.querySelector(".sheet-find-counter");
      this.findCaseBtn = this.container.querySelector('[data-action="toggle-case"]');
    }

    _bindEvents() {
      // Click selection & inline edit
      this.tbody.addEventListener("mousedown", (e) => {
        const cell = e.target.closest(".sheet-cell");
        if (!cell) return;
        const row = parseInt(cell.getAttribute("data-row"), 10);
        const col = parseInt(cell.getAttribute("data-col"), 10);

        if (e.button === 0) {
          const wasAlreadySelected = this.selectedCell.row === row && this.selectedCell.col === col;
          if (this.isEditing && !wasAlreadySelected) {
            this._commitEditor();
          }
          this.selectedCell = { row, col };
          this.selectionRange = { startRow: row, startCol: col, endRow: row, endCol: col };
          this.isSelecting = true;
          this._updateSelectionHighlight();
          this.wrapper.focus();

          if (wasAlreadySelected && !this.isEditing) {
            this._startEditing(row, col);
          }
        } else if (e.button === 2) {
          // Right click
          this.selectedCell = { row, col };
          this.selectionRange = { startRow: row, startCol: col, endRow: row, endCol: col };
          this._updateSelectionHighlight();
        }
      });

      // Compact row action trigger click
      this.tbody.addEventListener("click", (e) => {
        const optBtn = e.target.closest(".sheet-row-opt-btn");
        if (optBtn) {
          e.stopPropagation();
          const row = parseInt(optBtn.getAttribute("data-row"), 10);
          const rect = optBtn.getBoundingClientRect();
          this.selectedCell = { row, col: 0 };
          this.selectionRange = { startRow: row, startCol: 0, endRow: row, endCol: this.columns.length - 1 };
          this._updateSelectionHighlight();
          this._showContextMenu(rect.right + 4, rect.top, row);
        }
      });

      window.addEventListener("mousemove", (e) => {
        if (!this.isSelecting) return;
        const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest(".sheet-cell");
        if (cell) {
          const row = parseInt(cell.getAttribute("data-row"), 10);
          const col = parseInt(cell.getAttribute("data-col"), 10);
          this.selectionRange.endRow = row;
          this.selectionRange.endCol = col;
          this._updateSelectionHighlight();
        }
      });

      window.addEventListener("mouseup", () => {
        this.isSelecting = false;
      });

      // Double-click to start edit
      this.tbody.addEventListener("dblclick", (e) => {
        const cell = e.target.closest(".sheet-cell");
        if (cell) {
          const row = parseInt(cell.getAttribute("data-row"), 10);
          const col = parseInt(cell.getAttribute("data-col"), 10);
          this._startEditing(row, col);
        }
      });

      // Keyboard navigation & shortcuts
      this.wrapper.addEventListener("keydown", (e) => {
        if (this.isEditing) {
          if (e.key === "Enter") {
            e.preventDefault();
            this._commitEditor();
            this._moveSelection(e.shiftKey ? -1 : 1, 0);
          } else if (e.key === "Tab") {
            e.preventDefault();
            this._commitEditor();
            this._moveSelection(0, e.shiftKey ? -1 : 1);
          } else if (e.key === "Escape") {
            e.preventDefault();
            this._cancelEditor();
          }
          return;
        }

        // Ctrl Shortcuts
        if (e.ctrlKey || e.metaKey) {
          const key = e.key.toLowerCase();
          if (key === "c") {
            e.preventDefault();
            this._copySelection();
          } else if (key === "v") {
            // Native paste event handled by onpaste
          } else if (key === "x") {
            e.preventDefault();
            this._cutSelection();
          } else if (key === "z") {
            e.preventDefault();
            if (e.shiftKey) {
              this.service.redo();
            } else {
              this.service.undo();
            }
          } else if (key === "y") {
            e.preventDefault();
            this.service.redo();
          }
          return;
        }

        switch (e.key) {
          case "ArrowUp":
            e.preventDefault();
            this._moveSelection(-1, 0, e.shiftKey);
            break;
          case "ArrowDown":
            e.preventDefault();
            this._moveSelection(1, 0, e.shiftKey);
            break;
          case "ArrowLeft":
            e.preventDefault();
            this._moveSelection(0, -1, e.shiftKey);
            break;
          case "ArrowRight":
            e.preventDefault();
            this._moveSelection(0, 1, e.shiftKey);
            break;
          case "Tab":
            e.preventDefault();
            this._moveSelection(0, e.shiftKey ? -1 : 1);
            break;
          case "F2":
            e.preventDefault();
            this._startEditing(this.selectedCell.row, this.selectedCell.col);
            break;
          case "Enter":
            e.preventDefault();
            if (e.shiftKey) {
              this._moveSelection(-1, 0);
            } else {
              this._startEditing(this.selectedCell.row, this.selectedCell.col);
            }
            break;
          case "Delete":
          case "Backspace":
            e.preventDefault();
            this._clearSelectionValues();
            break;
          default:
            // Alphanumeric starts editing immediately
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
              this._startEditing(this.selectedCell.row, this.selectedCell.col, e.key);
              e.preventDefault();
            }
            break;
        }
      });

      // Tabular Clipboard Paste
      this.wrapper.addEventListener("paste", (e) => {
        const text = e.clipboardData?.getData("text/plain");
        if (!text) return;
        e.preventDefault();
        this._pasteTabularData(text);
      });

      // Context Menu
      this.container.addEventListener("contextmenu", (e) => {
        const target = e.target.closest(".sheet-cell, .sheet-row-num");
        if (!target) return;
        e.preventDefault();
        const row = parseInt(target.getAttribute("data-row"), 10);
        this._showContextMenu(e.clientX, e.clientY, row);
      });

      document.addEventListener("click", (e) => {
        if (!e.target.closest(".sheet-context-menu")) {
          this.contextMenu.style.display = "none";
        }
      });

      // Global Ctrl + F for Live Tracker Workspace
      window.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
          const paneAudit = document.getElementById("paneAudit");
          if (paneAudit && !paneAudit.hidden) {
            e.preventDefault();
            this.openFind();
          }
        }
      });

      // Find Bar event handlers
      if (this.findInput) {
        this.findInput.addEventListener("input", () => {
          this._executeFind();
        });

        this.findInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) {
              this.findPrev();
            } else {
              this.findNext();
            }
          } else if (e.key === "Escape") {
            e.preventDefault();
            this.closeFind();
          }
        });
      }

      if (this.findBar) {
        this.findBar.addEventListener("click", (e) => {
          const btn = e.target.closest(".sheet-find-btn");
          if (!btn) return;
          const action = btn.getAttribute("data-action");
          if (action === "next") this.findNext();
          else if (action === "prev") this.findPrev();
          else if (action === "close") this.closeFind();
          else if (action === "toggle-case") {
            this.findState.caseSensitive = !this.findState.caseSensitive;
            btn.classList.toggle("is-active", this.findState.caseSensitive);
            this._executeFind();
          }
        });
      }
    }

    _moveSelection(rowDelta, colDelta, isRangeSelect = false) {
      const rowCount = this.service.getRowCount();
      const colCount = this.columns.length;
      if (!rowCount) return;

      const newRow = Math.max(0, Math.min(rowCount - 1, this.selectedCell.row + rowDelta));
      const newCol = Math.max(0, Math.min(colCount - 1, this.selectedCell.col + colDelta));

      if (isRangeSelect) {
        this.selectionRange = this.selectionRange || {
          startRow: this.selectedCell.row,
          startCol: this.selectedCell.col,
          endRow: this.selectedCell.row,
          endCol: this.selectedCell.col
        };
        this.selectionRange.endRow = newRow;
        this.selectionRange.endCol = newCol;
      } else {
        this.selectedCell = { row: newRow, col: newCol };
        this.selectionRange = { startRow: newRow, startCol: newCol, endRow: newRow, endCol: newCol };
      }

      this._updateSelectionHighlight();
      this._scrollCellIntoView(newRow, newCol);
    }

    _scrollCellIntoView(row, col) {
      const cell = this.tbody.querySelector(`.sheet-cell[data-row="${row}"][data-col="${col}"]`);
      if (cell) {
        cell.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    }

    _startEditing(row, col, initialChar = null) {
      if (this.isEditing) this._commitEditor();
      const rows = this.service.getRows();
      if (!rows[row]) return;

      const cellEl = this.tbody.querySelector(`.sheet-cell[data-row="${row}"][data-col="${col}"]`);
      if (!cellEl) return;

      const colDef = this.columns[col];
      const currentValue = rows[row][colDef.key] || "";

      this.isEditing = true;
      this.selectedCell = { row, col };
      this.selectionRange = { startRow: row, startCol: col, endRow: row, endCol: col };
      this._updateSelectionHighlight();

      cellEl.classList.add("is-editing");
      cellEl.innerHTML = "";

      let input;
      if (colDef.type === "select") {
        input = document.createElement("select");
        input.className = "sheet-editor-select";
        const optionsList = Array.isArray(colDef.options) ? [...colDef.options] : [];
        if (currentValue && !optionsList.includes(currentValue)) {
          optionsList.push(currentValue);
        }
        optionsList.forEach(opt => {
          const optEl = document.createElement("option");
          optEl.value = opt;
          optEl.textContent = opt ? opt : "(Blank)";
          if (opt === currentValue) optEl.selected = true;
          input.appendChild(optEl);
        });
      } else {
        input = document.createElement("input");
        input.type = "text";
        input.className = "sheet-editor-input";
        input.value = initialChar !== null ? initialChar : currentValue;
      }

      cellEl.appendChild(input);
      input.focus();
      if (input.type === "text" && initialChar === null) {
        input.select();
      }

      this.activeEditor = { input, row, col, colDef, originalValue: currentValue };
    }

    _commitEditor() {
      if (!this.isEditing || !this.activeEditor) return;
      const { input, row, colDef } = this.activeEditor;
      const newValue = input.value;
      this.service.setCellValue(row, colDef.key, newValue);

      this.isEditing = false;
      this.activeEditor = null;
      this._render();
      this.wrapper.focus();
    }

    _cancelEditor() {
      if (!this.isEditing) return;
      this.isEditing = false;
      this.activeEditor = null;
      this._render();
      this.wrapper.focus();
    }

    _getNormalizedRange() {
      if (!this.selectionRange) {
        return {
          minRow: this.selectedCell.row,
          maxRow: this.selectedCell.row,
          minCol: this.selectedCell.col,
          maxCol: this.selectedCell.col
        };
      }
      return {
        minRow: Math.min(this.selectionRange.startRow, this.selectionRange.endRow),
        maxRow: Math.max(this.selectionRange.startRow, this.selectionRange.endRow),
        minCol: Math.min(this.selectionRange.startCol, this.selectionRange.endCol),
        maxCol: Math.max(this.selectionRange.startCol, this.selectionRange.endCol)
      };
    }

    _copySelection() {
      const range = this._getNormalizedRange();
      const rows = this.service.getRows();
      const lines = [];

      for (let r = range.minRow; r <= range.maxRow; r++) {
        const row = rows[r];
        if (!row) continue;
        const lineParts = [];
        for (let c = range.minCol; c <= range.maxCol; c++) {
          lineParts.push(row[this.columns[c].key] || "");
        }
        lines.push(lineParts.join("\t"));
      }

      const tsv = lines.join("\r\n");
      navigator.clipboard.writeText(tsv).then(() => {
        if (window.showToast) window.showToast("Copied cells to clipboard.", "info");
      }).catch(err => {
        console.warn("Clipboard write failed:", err);
      });
    }

    _cutSelection() {
      this._copySelection();
      this._clearSelectionValues();
    }

    _clearSelectionValues() {
      const range = this._getNormalizedRange();
      const changes = [];
      for (let r = range.minRow; r <= range.maxRow; r++) {
        for (let c = range.minCol; c <= range.maxCol; c++) {
          changes.push({ rowIdx: r, colKey: this.columns[c].key, newValue: "" });
        }
      }
      this.service.setCellBatch(changes);
    }

    _pasteTabularData(rawText) {
      if (!rawText) return;
      const lines = rawText.split(/\r?\n/).filter((l, i, arr) => i < arr.length - 1 || l.trim().length > 0);
      if (!lines.length) return;

      const startRow = this.selectedCell.row;
      const startCol = this.selectedCell.col;
      const changes = [];

      lines.forEach((line, rOffset) => {
        const targetRowIdx = startRow + rOffset;
        if (targetRowIdx >= this.service.getRowCount()) {
          // Auto-expand row if pasting extends beyond current count
          this.service.insertRow(targetRowIdx, {}, false);
        }

        const delimiter = line.includes("\t") ? "\t" : (line.includes(",") ? "," : "\t");
        const parts = line.split(delimiter);
        parts.forEach((val, cOffset) => {
          const targetColIdx = startCol + cOffset;
          if (targetColIdx < this.columns.length) {
            changes.push({
              rowIdx: targetRowIdx,
              colKey: this.columns[targetColIdx].key,
              newValue: val.replace(/^["']|["']$/g, "").trim()
            });
          }
        });
      });

      this.service.setCellBatch(changes);
      const firstParts = lines[0].includes("\t") ? lines[0].split("\t") : (lines[0].includes(",") ? lines[0].split(",") : [lines[0]]);
      this.selectionRange = {
        startRow,
        startCol,
        endRow: startRow + lines.length - 1,
        endCol: Math.min(this.columns.length - 1, startCol + (firstParts.length - 1))
      };
      this._updateSelectionHighlight();
      if (window.showToast) window.showToast(`Pasted ${lines.length} row(s) into spreadsheet.`, "success");
    }

    openFind(prefill = "") {
      this.findState.isOpen = true;
      this.findBar.style.display = "flex";
      if (prefill) {
        this.findInput.value = prefill;
      }
      this.findInput.focus();
      this.findInput.select();
      this._executeFind();
    }

    closeFind() {
      this.findState.isOpen = false;
      this.findBar.style.display = "none";
      this.findState.matches = [];
      this.findState.currentIndex = -1;
      this._updateSelectionHighlight();
      this.wrapper.focus();
    }

    _executeFind() {
      const query = this.findInput.value;
      this.findState.query = query;

      if (!query.trim()) {
        this.findState.matches = [];
        this.findState.currentIndex = -1;
        this.findCounter.textContent = "0 of 0";
        this._updateSelectionHighlight();
        return;
      }

      this.findState.matches = this.service.findMatches(query, {
        caseSensitive: this.findState.caseSensitive
      });

      if (this.findState.matches.length > 0) {
        const closestIdx = this.findState.matches.findIndex(m => m.rowIdx >= this.selectedCell.row && m.colIdx >= this.selectedCell.col);
        this.findState.currentIndex = closestIdx >= 0 ? closestIdx : 0;
        this._applyCurrentMatch();
      } else {
        this.findState.currentIndex = -1;
        this.findCounter.textContent = "No matches";
        this._updateSelectionHighlight();
      }
    }

    findNext() {
      if (!this.findState.matches.length) return;
      this.findState.currentIndex = (this.findState.currentIndex + 1) % this.findState.matches.length;
      this._applyCurrentMatch();
    }

    findPrev() {
      if (!this.findState.matches.length) return;
      this.findState.currentIndex = (this.findState.currentIndex - 1 + this.findState.matches.length) % this.findState.matches.length;
      this._applyCurrentMatch();
    }

    _applyCurrentMatch() {
      const match = this.findState.matches[this.findState.currentIndex];
      if (!match) return;

      this.findCounter.textContent = `${this.findState.currentIndex + 1} of ${this.findState.matches.length}`;
      this.selectedCell = { row: match.rowIdx, col: match.colIdx };
      this.selectionRange = { startRow: match.rowIdx, startCol: match.colIdx, endRow: match.rowIdx, endCol: match.colIdx };
      this._updateSelectionHighlight();
      this._scrollCellIntoView(match.rowIdx, match.colIdx);
    }

    _updateSelectionHighlight() {
      const range = this._getNormalizedRange();
      const activeMatch = this.findState.isOpen && this.findState.matches.length > 0 && this.findState.currentIndex >= 0
        ? this.findState.matches[this.findState.currentIndex]
        : null;

      // Only clear previously highlighted cells rather than traversing all cells in table
      this.tbody.querySelectorAll(".is-selected, .is-active-cell, .sheet-cell-match, .sheet-cell-active-match").forEach(cell => {
        cell.classList.remove("is-selected", "is-active-cell", "sheet-cell-match", "sheet-cell-active-match");
      });

      // Highlight only cells in current selection range
      for (let r = range.minRow; r <= range.maxRow; r++) {
        for (let c = range.minCol; c <= range.maxCol; c++) {
          const cell = this.tbody.querySelector(`.sheet-cell[data-row="${r}"][data-col="${c}"]`);
          if (cell) {
            cell.classList.add("is-selected");
            if (r === this.selectedCell.row && c === this.selectedCell.col) {
              cell.classList.add("is-active-cell");
            }
          }
        }
      }

      if (this.findState.isOpen && this.findState.matches.length > 0) {
        this.findState.matches.forEach(m => {
          const cell = this.tbody.querySelector(`.sheet-cell[data-row="${m.rowIdx}"][data-col="${m.colIdx}"]`);
          if (cell) {
            const isActiveMatch = activeMatch && activeMatch.rowIdx === m.rowIdx && activeMatch.colIdx === m.colIdx;
            cell.classList.add(isActiveMatch ? "sheet-cell-active-match" : "sheet-cell-match");
          }
        });
      }
    }

    _showContextMenu(clientX, clientY, rowIdx) {
      this.contextMenu.innerHTML = `
        <div class="sheet-menu-item" data-action="insert_above">Insert Row Above</div>
        <div class="sheet-menu-item" data-action="insert_below">Insert Row Below</div>
        <div class="sheet-menu-item" data-action="insert_by_date">Insert by Date...</div>
        <div class="sheet-menu-item" data-action="reposition_date">Place Row by Date</div>
        <div class="sheet-menu-item" data-action="duplicate">Duplicate Row</div>
        <div class="sheet-menu-divider"></div>
        <div class="sheet-menu-item" data-action="copy">Copy Row</div>
        <div class="sheet-menu-divider"></div>
        <div class="sheet-menu-item text-danger" data-action="delete">Delete Row...</div>
      `;

      this.contextMenu.style.display = "block";
      this.contextMenu.style.left = `${clientX}px`;
      this.contextMenu.style.top = `${clientY}px`;

      this.contextMenu.querySelectorAll(".sheet-menu-item").forEach(item => {
        item.addEventListener("click", async (e) => {
          e.stopPropagation();
          const action = item.getAttribute("data-action");
          this.contextMenu.style.display = "none";

          switch (action) {
            case "insert_above":
              this.service.insertRow(rowIdx);
              break;
            case "insert_below":
              this.service.insertRow(rowIdx + 1);
              break;
            case "insert_by_date": {
              const rows = this.service.getRows();
              const currentDate = rows[rowIdx]?.date || new Date().toISOString().split("T")[0];
              this.service.insertRowByDate({ date: currentDate });
              break;
            }
            case "reposition_date": {
              const newPos = this.service.repositionRowByDate(rowIdx);
              if (newPos !== false && window.showToast) {
                window.showToast(`Row moved to chronological slot #${newPos + 1}.`, "info");
              }
              break;
            }
            case "duplicate":
              this.service.duplicateRow(rowIdx);
              break;
            case "copy": {
              this.selectionRange = { startRow: rowIdx, startCol: 0, endRow: rowIdx, endCol: this.columns.length - 1 };
              this._copySelection();
              break;
            }
            case "delete": {
              const rows = this.service.getRows();
              const row = rows[rowIdx];
              const name = row?.agent || row?.tl || `Row #${rowIdx + 1}`;
              const agreed = await window.appConfirm({
                title: "Delete Tracker Row?",
                message: `Are you sure you want to remove ${name} from the Live Tracker? This will synchronize with the shared Google Sheet.`,
                confirmText: "Delete Row",
                tone: "danger"
              });
              if (agreed) {
                this.service.deleteRow(rowIdx);
                if (window.showToast) window.showToast("Row deleted.", "info");
              }
              break;
            }
          }
        });
      });
    }

    _render() {
      const rows = this.service.getRows();
      if (!rows.length) {
        this.tbody.innerHTML = `
          <tr>
            <td colspan="${this.columns.length + 1}" class="sheet-empty-cell">
              No live tracker entries. Click <strong>Add Row</strong> or <strong>Paste Rows</strong> from Google Sheets/Excel.
            </td>
          </tr>
        `;
        return;
      }

      this.tbody.innerHTML = rows.map((row, rIdx) => {
        const isDirty = row._status === "unsaved";
        const isConflict = row._status === "conflict";
        const statusClass = isConflict ? "is-conflict" : (isDirty ? "is-dirty" : "");

        const cellsHtml = this.columns.map((col, cIdx) => {
          const val = row[col.key] || "";
          const isFieldDirty = row._dirtyFields && row._dirtyFields[col.key];
          let displayVal = escapeHtml(val);
          if (col.key === "noc" && val) {
            const vLower = val.toLowerCase();
            let nocClass = "badge-neutral";
            if (vLower === "yes") nocClass = "badge-success";
            else if (vLower === "no") nocClass = "badge-danger";
            else if (vLower === "pending") nocClass = "badge-warning";
            else if (vLower === "disputed") nocClass = "badge-info";
            displayVal = `<span class="badge ${nocClass}">${displayVal}</span>`;
          }

          return `
            <td class="sheet-cell ${isFieldDirty ? 'field-dirty' : ''}" 
                data-row="${rIdx}" 
                data-col="${cIdx}" 
                title="${escapeHtml(val)}">
              <div class="sheet-cell-inner">${displayVal}</div>
            </td>
          `;
        }).join("");

        return `
          <tr class="sheet-row ${statusClass}" data-row="${rIdx}" data-uid="${row._uid}">
            <td class="sheet-row-num" data-row="${rIdx}">
              <span class="row-num-text">${rIdx + 1}</span>
              <button type="button" class="sheet-row-opt-btn" data-row="${rIdx}" title="Row options">⋮</button>
              ${isDirty ? '<span class="dirty-indicator" title="Unsaved edit">●</span>' : ''}
              ${isConflict ? '<span class="conflict-indicator" title="Conflict detected with Google Sheets">⚠️</span>' : ''}
            </td>
            ${cellsHtml}
          </tr>
        `;
      }).join("");

      this._updateSelectionHighlight();
    }
  }

  return SpreadsheetGrid;
})();
