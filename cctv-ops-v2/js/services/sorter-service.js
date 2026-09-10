/**
 * CCTV OPS V2 - AI Sorter Service
 * Authoritative 1:1 Functional Parity with V1 Maintenance AI Sorter
 * Multi-format parser (TSV, CSV, Markdown, raw paste), floor recognition,
 * reference matching, override persistence, and spreadsheet data operations.
 */
(function (root) {
  "use strict";

  const FLOOR = {
    GROUND: "Ground Floor",
    FIRST: "1st Floor",
    SECOND: "2nd Floor",
    REVIEW: "Review Needed"
  };

  const floorOrder = {
    [FLOOR.GROUND]: 0,
    [FLOOR.FIRST]: 1,
    [FLOOR.SECOND]: 2,
    [FLOOR.REVIEW]: 3
  };

  const STORAGE_KEY = "maintenance_tl_floor_overrides_v1";
  const TL_NAME_EDIT_KEY = "maintenance_tl_name_edits_v1";
  const TL_HIDDEN_KEY = "maintenance_hidden_tl_assignments_v1";

  // Site A floor references supplied by the user (Authoritative V1).
  const OFFICIAL_TL_FLOOR_REFERENCE = [
    // ---------- SITE A 1ST FLOOR ----------
    { floor: FLOOR.FIRST, aliases: ["allan albert sadili", "allan"], campaigns: ["mapua", "speakup"] },
    { floor: FLOOR.FIRST, aliases: ["glaithe"], campaigns: ["jethro mobile"] },
    { floor: FLOOR.FIRST, aliases: ["jovert monticayan", "jovert"], campaigns: ["hbw insurance"] },
    { floor: FLOOR.FIRST, aliases: ["kevin omiping", "kevin"], campaigns: ["hbw insurance"] },
    { floor: FLOOR.FIRST, aliases: ["recy pagangpang", "recy"], campaigns: ["clear insights", "clear"] },
    { floor: FLOOR.FIRST, aliases: ["ken brylle gonzales", "ken"], campaigns: ["clear insights", "clear"] },
    { floor: FLOOR.FIRST, aliases: ["kristine"], campaigns: ["bigo"] },
    { floor: FLOOR.FIRST, aliases: ["dareen mhyvie caliguid", "dareen"], campaigns: ["clear insights", "clear"] },
    { floor: FLOOR.FIRST, aliases: ["edylyn tallorin", "edylyn"], campaigns: ["bigo"] },
    { floor: FLOOR.FIRST, aliases: ["melvinson laguting", "melvinson"], campaigns: ["bigo"] },
    { floor: FLOOR.FIRST, aliases: ["juniper arquisola", "juniper"], campaigns: ["bigo"] },
    { floor: FLOOR.FIRST, aliases: ["samantha"], campaigns: ["bigo"] },
    { floor: FLOOR.FIRST, aliases: ["dianne sombilon", "dianne"], campaigns: ["superdial"] },
    { floor: FLOOR.FIRST, aliases: ["shekinah grace javar", "shekinah"], campaigns: ["superdial"] },
    { floor: FLOOR.FIRST, aliases: ["mirah paris macaorao", "mirah"], campaigns: ["clear insights", "clear"] },

    // ---------- SITE A 2ND FLOOR ----------
    { floor: FLOOR.SECOND, aliases: ["andrea kyle herrero", "andrea"], campaigns: ["bigo"] },
    { floor: FLOOR.SECOND, aliases: ["pauline"], campaigns: ["bigo"] },
    { floor: FLOOR.SECOND, aliases: ["samantha"], campaigns: ["bigo"] },
    { floor: FLOOR.SECOND, aliases: ["ivy balandan", "ivy"], campaigns: ["bigo"] },
    { floor: FLOOR.SECOND, aliases: ["christian"], campaigns: ["bigo"] },
    { floor: FLOOR.SECOND, aliases: ["albert samsico", "albert"], campaigns: ["bigo"] },
    { floor: FLOOR.SECOND, aliases: ["ivana"], campaigns: ["bigo"] },
    { floor: FLOOR.SECOND, aliases: ["jeremiah"], campaigns: ["bigo"] },
    { floor: FLOOR.SECOND, aliases: ["juddy"], campaigns: ["superdial"] },
    { floor: FLOOR.SECOND, aliases: ["cris arandilla", "cris"], campaigns: ["herb joy", "herbjoy", "nationgraph"] },
    { floor: FLOOR.SECOND, aliases: ["janice jugarap"], campaigns: ["sss"] },
    { floor: FLOOR.SECOND, aliases: ["janice salubre"], campaigns: ["greenfoot", "green foot"] },
    { floor: FLOOR.SECOND, aliases: ["recci george crodua", "recci"], campaigns: ["dg dial"] },
    { floor: FLOOR.SECOND, aliases: ["dames alfred veloso", "dames"], campaigns: ["listsimple", "list simple", "tcm"] },
    { floor: FLOOR.SECOND, aliases: ["nomar"], campaigns: [] }
  ];

  // Campaign-level fallback for NEW / UNKNOWN Team Leader names.
  const CAMPAIGN_FLOOR_REFERENCE = [
    // ---------- SITE A 1ST FLOOR ----------
    { floor: FLOOR.FIRST, keywords: ["hbw insurance", "hbw"] },
    { floor: FLOOR.FIRST, keywords: ["clear insights", "clear insights davao", "clear"] },
    { floor: FLOOR.FIRST, keywords: ["mapua"] },
    { floor: FLOOR.FIRST, keywords: ["jethro mobile", "jethro"] },
    { floor: FLOOR.FIRST, keywords: ["all pro pay", "allpro", "all pro"] },
    { floor: FLOOR.FIRST, keywords: ["spypoint ob", "spypoint"] },

    // ---------- SITE A 2ND FLOOR ----------
    { floor: FLOOR.SECOND, keywords: ["herb joy", "herbjoy"] },
    { floor: FLOOR.SECOND, keywords: ["nationgraph"] },
    { floor: FLOOR.SECOND, keywords: ["greenfoot", "green foot"] },
    { floor: FLOOR.SECOND, keywords: ["dg dial"] },
    { floor: FLOOR.SECOND, keywords: ["listsimple", "list simple"] },
    { floor: FLOOR.SECOND, keywords: ["clinicp", "clinic p"] },
    { floor: FLOOR.SECOND, keywords: ["sss alliance", "sss"] },
    { floor: FLOOR.SECOND, keywords: ["glo"] },
    { floor: FLOOR.SECOND, keywords: ["auxgp"] },
    { floor: FLOOR.SECOND, keywords: ["nox"] },
    { floor: FLOOR.SECOND, keywords: ["123 echo mortgage", "echo mortgage"] }
  ];

  const MINI_SHEET_FIELDS = [
    "timestamp",
    "date",
    "tl",
    "account",
    "site",
    "station",
    "issue"
  ];

  function cleanCell(value) {
    return String(value == null ? "" : value)
      .replace(/^\s*\*\*|\*\*\s*$/g, "")
      .trim();
  }

  function splitMarkdownLine(line) {
    let s = line.trim();
    if (s.startsWith("|")) s = s.slice(1);
    if (s.endsWith("|")) s = s.slice(0, -1);
    return s.split("|").map(cleanCell);
  }

  function parseDelimitedLine(line, delimiter) {
    if (delimiter === "\t") return line.split("\t").map(cleanCell);

    const out = [];
    let current = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (ch === delimiter && !quoted) {
        out.push(cleanCell(current));
        current = "";
      } else {
        current += ch;
      }
    }
    out.push(cleanCell(current));
    return out;
  }

  function isMarkdownSeparator(cells) {
    return cells.length > 1 && cells.every(cell => /^:?-{2,}:?$/.test(cell.replace(/\s/g, "")));
  }

  function parseReport(raw) {
    const lines = String(raw || "")
      .replace(/\r/g, "")
      .split("\n")
      .map(line => line.trimEnd())
      .filter(line => line.trim() !== "");

    if (!lines.length) {
      throw new Error("Paste maintenance rows first.");
    }

    let rows;
    const looksMarkdown = lines.some(line => line.includes("|"));

    if (looksMarkdown) {
      rows = lines
        .map(splitMarkdownLine)
        .filter(cells => !isMarkdownSeparator(cells));
    } else {
      const firstUsefulLine = lines.find(line => line.trim()) || "";
      const tabCount = (firstUsefulLine.match(/\t/g) || []).length;
      const delimiter = tabCount >= 1 ? "\t" : ",";
      rows = lines.map(line => parseDelimitedLine(line, delimiter));
    }

    rows = rows
      .map(row => row.map(cleanCell))
      .filter(row => row.some(cell => cleanCell(cell) !== ""));

    if (!rows.length) {
      throw new Error("I could not detect any maintenance rows.");
    }

    const normalizeHeaderCell = value =>
      String(value || "")
        .toLowerCase()
        .replace(/\*\*/g, "")
        .replace(/[._/\\-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const headerGroups = {
      timestamp: ["timestamp", "time stamp", "time"],
      date: ["date"],
      tl: ["tl", "team leader", "team leaders", "tl name"],
      account: ["account", "campaign", "account campaign"],
      site: ["site"],
      station: ["station no", "station number", "station"],
      issue: ["station issue", "issues", "issue"]
    };

    function findHeaderIndex(headers, names) {
      for (const name of names) {
        const exact = headers.indexOf(name);
        if (exact !== -1) return exact;
      }
      for (let i = 0; i < headers.length; i++) {
        if (names.some(name => headers[i] === name || headers[i].includes(name))) {
          return i;
        }
      }
      return -1;
    }

    function headerConfidence(row) {
      const headers = row.map(normalizeHeaderCell);
      let hits = 0;
      Object.values(headerGroups).forEach(names => {
        if (findHeaderIndex(headers, names) !== -1) hits++;
      });
      return hits;
    }

    function isFloorValue(value) {
      const v = String(value || "").toLowerCase().trim();
      return /^(ground|gf|1st|first|2nd|second)\s*(floor|flr)?$/.test(v) ||
             v === "review needed";
    }

    function looksLikeDateOnly(value) {
      return /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(String(value || "").trim());
    }

    function looksLikeTimestamp(value) {
      return /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s+\d{1,2}:\d{2}/.test(
        String(value || "").trim()
      );
    }

    let dataRows = rows.slice();
    let idx = null;

    const firstRowHeaderScore = headerConfidence(rows[0]);
    if (firstRowHeaderScore >= 4) {
      const headers = rows[0].map(normalizeHeaderCell);
      idx = {
        timestamp: findHeaderIndex(headers, headerGroups.timestamp),
        date: findHeaderIndex(headers, headerGroups.date),
        tl: findHeaderIndex(headers, headerGroups.tl),
        account: findHeaderIndex(headers, headerGroups.account),
        site: findHeaderIndex(headers, headerGroups.site),
        station: findHeaderIndex(headers, headerGroups.station),
        issue: findHeaderIndex(headers, headerGroups.issue)
      };
      dataRows = rows.slice(1);
    }

    return dataRows
      .filter(row => row.some(cell => cleanCell(cell) !== ""))
      .map((sourceRow, i) => {
        let row = sourceRow.slice();

        if (row.length >= 8 && isFloorValue(row[0])) {
          row = row.slice(1);
        }

        if (idx) {
          return {
            originalIndex: i,
            timestamp: idx.timestamp >= 0 ? cleanCell(row[idx.timestamp]) : "",
            date: idx.date >= 0 ? cleanCell(row[idx.date]) : "",
            tl: idx.tl >= 0 ? cleanCell(row[idx.tl]) : "",
            account: idx.account >= 0 ? cleanCell(row[idx.account]) : "",
            site: idx.site >= 0 ? cleanCell(row[idx.site]) : "",
            station: idx.station >= 0 ? cleanCell(row[idx.station]) : "",
            issue: idx.issue >= 0 ? cleanCell(row[idx.issue]) : ""
          };
        }

        if (row.length >= 7) {
          return {
            originalIndex: i,
            timestamp: cleanCell(row[0]),
            date: cleanCell(row[1]),
            tl: cleanCell(row[2]),
            account: cleanCell(row[3]),
            site: cleanCell(row[4]),
            station: cleanCell(row[5]),
            issue: row.slice(6).map(cleanCell).filter(Boolean).join(" ")
          };
        }

        if (row.length === 6 && looksLikeDateOnly(row[0])) {
          return {
            originalIndex: i,
            timestamp: "",
            date: cleanCell(row[0]),
            tl: cleanCell(row[1]),
            account: cleanCell(row[2]),
            site: cleanCell(row[3]),
            station: cleanCell(row[4]),
            issue: cleanCell(row[5])
          };
        }

        if (row.length === 6 && looksLikeTimestamp(row[0])) {
          const timestamp = cleanCell(row[0]);
          const date = timestamp.split(/\s+/)[0] || "";
          return {
            originalIndex: i,
            timestamp,
            date,
            tl: cleanCell(row[1]),
            account: cleanCell(row[2]),
            site: cleanCell(row[3]),
            station: cleanCell(row[4]),
            issue: cleanCell(row[5])
          };
        }

        while (row.length < 7) row.push("");

        return {
          originalIndex: i,
          timestamp: cleanCell(row[0]),
          date: cleanCell(row[1]),
          tl: cleanCell(row[2]),
          account: cleanCell(row[3]),
          site: cleanCell(row[4]),
          station: cleanCell(row[5]),
          issue: row.slice(6).map(cleanCell).filter(Boolean).join(" ")
        };
      })
      .filter(row =>
        row.timestamp ||
        row.date ||
        row.tl ||
        row.account ||
        row.site ||
        row.station ||
        row.issue
      );
  }

  function normalizeTLName(name) {
    return String(name || "")
      .replace(/\(.*?team leader.*?\)/gi, "")
      .replace(/\(.*?oic.*?\)/gi, "")
      .replace(/^\s*OM\s+/i, "")
      .replace(/\s*-\s*TL\s*$/i, "")
      .replace(/\s*TL\s*$/i, "")
      .replace(/\s*-\s*$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractTLNames(value) {
    return String(value || "")
      .split(/\s*,\s*/)
      .map(normalizeTLName)
      .filter(Boolean);
  }

  function normalizeReferenceText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tlAliasMatches(tlName, alias) {
    const name = normalizeReferenceText(tlName);
    const a = normalizeReferenceText(alias);
    if (!name || !a) return false;
    if (name === a) return true;
    if (!a.includes(" ") && name.split(" ").includes(a)) return true;
    return false;
  }

  function getReferenceHints(tlName, account) {
    const accountNorm = normalizeReferenceText(account);
    const matches = [];

    OFFICIAL_TL_FLOOR_REFERENCE.forEach(ref => {
      if (!ref.aliases.some(alias => tlAliasMatches(tlName, alias))) return;

      const campaignMatched = ref.campaigns.length === 0 ||
        ref.campaigns.some(keyword => accountNorm.includes(normalizeReferenceText(keyword)));

      matches.push({
        floor: ref.floor,
        score: campaignMatched ? 8 : 3,
        campaignMatched
      });
    });

    return matches;
  }

  function detectCampaignFloor(account) {
    const accountNorm = normalizeReferenceText(account);
    if (!accountNorm) {
      return { floor: null, reason: "No campaign" };
    }

    const matches = CAMPAIGN_FLOOR_REFERENCE.filter(ref =>
      ref.keywords.some(keyword => accountNorm.includes(normalizeReferenceText(keyword)))
    );

    const floors = [...new Set(matches.map(match => match.floor))];

    if (floors.length === 1) {
      return {
        floor: floors[0],
        reason: "Campaign floor reference"
      };
    }

    if (floors.length > 1) {
      return {
        floor: null,
        reason: "Campaign appears on multiple floors"
      };
    }

    return {
      floor: null,
      reason: "No campaign floor reference"
    };
  }

  function detectStationFloor(station) {
    const raw = String(station || "").trim();
    const s = raw
      .toUpperCase()
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, " ")
      .trim();

    if (!s) return { floor: null, confidence: 0, reason: "No station" };

    if (/\bGROUND\s*FLOOR\b/.test(s) || /\bG\s*\/\s*F\b/.test(s) || /\bGF\b/.test(s)) {
      return { floor: FLOOR.GROUND, confidence: 1, reason: "GF / Ground Floor in station" };
    }

    if (/\bSECOND\s*FLOOR\b/.test(s) || /\b2ND\s*FLOOR\b/.test(s) || /\b2\s*F\b/.test(s) || /\b2F\b/.test(s)) {
      return { floor: FLOOR.SECOND, confidence: 1, reason: "2F / Second Floor in station" };
    }

    if (/\bFIRST\s*FLOOR\b/.test(s) || /\b1ST\s*FLOOR\b/.test(s) || /\b1\s*F\b/.test(s) || /\b1F\b/.test(s) || /\bF1\b/.test(s)) {
      return { floor: FLOOR.FIRST, confidence: 1, reason: "1F / First Floor in station" };
    }

    if (/^2[A-Z](?:\s*[-#\/]|\d)/.test(s)) {
      return { floor: FLOOR.SECOND, confidence: 0.92, reason: "Station begins with 2 + bay code" };
    }

    if (/^1[A-Z](?:\s*[-#\/]|\d)/.test(s)) {
      return { floor: FLOOR.FIRST, confidence: 0.92, reason: "Station begins with 1 + bay code" };
    }

    return { floor: null, confidence: 0, reason: "No explicit floor pattern" };
  }

  function loadOverrides() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function saveOverrides(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function loadTLNameEdits() {
    try {
      const data = JSON.parse(localStorage.getItem(TL_NAME_EDIT_KEY) || "{}");
      return data && typeof data === "object" ? data : {};
    } catch (e) {
      return {};
    }
  }

  function saveTLNameEdits(data) {
    localStorage.setItem(TL_NAME_EDIT_KEY, JSON.stringify(data || {}));
  }

  function loadHiddenTLs() {
    try {
      const data = JSON.parse(localStorage.getItem(TL_HIDDEN_KEY) || "[]");
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  function saveHiddenTLs(data) {
    localStorage.setItem(TL_HIDDEN_KEY, JSON.stringify(Array.isArray(data) ? data : []));
  }

  function getEditedTLName(originalName) {
    const edits = loadTLNameEdits();
    const norm = normalizeTLName(originalName);
    return String(edits[originalName] || edits[norm] || originalName || "").trim();
  }

  function displayTLValue(rawValue) {
    const edits = loadTLNameEdits();
    return String(rawValue || "")
      .split(/\s*,\s*/)
      .map(part => {
        const trimmed = part.trim();
        const normalized = normalizeTLName(part);
        return edits[normalized] || edits[trimmed] || trimmed;
      })
      .filter(Boolean)
      .join(", ");
  }

  function buildAssignments(rows) {
    const evidence = new Map();

    function ensureEvidence(name) {
      if (!evidence.has(name)) {
        evidence.set(name, {
          [FLOOR.GROUND]: 0,
          [FLOOR.FIRST]: 0,
          [FLOOR.SECOND]: 0,
          total: 0,
          stationHits: 0,
          referenceHits: 0
        });
      }
      return evidence.get(name);
    }

    rows.forEach(row => {
      const direct = detectStationFloor(row.station);
      const campaignHint = detectCampaignFloor(row.account);

      row.directFloor = direct.floor;
      row.directFloorReason = direct.reason;
      row.campaignFloor = campaignHint.floor;
      row.campaignFloorReason = campaignHint.reason;
      row.tlNames = extractTLNames(row.tl);
      row.referenceHints = [];

      row.tlNames.forEach(name => {
        const item = ensureEvidence(name);

        if (direct.floor) {
          const stationWeight = 10 * direct.confidence;
          item[direct.floor] += stationWeight;
          item.total += stationWeight;
          item.stationHits += 1;
        }

        const hints = getReferenceHints(name, row.account);
        hints.forEach(hint => {
          item[hint.floor] += hint.score;
          item.total += hint.score;
          item.referenceHits += 1;
          row.referenceHints.push({
            tl: name,
            floor: hint.floor,
            campaignMatched: hint.campaignMatched
          });
        });

        if (!hints.length && campaignHint.floor) {
          const campaignWeight = 5;
          item[campaignHint.floor] += campaignWeight;
          item.total += campaignWeight;
          item.referenceHits += 1;
          row.referenceHints.push({
            tl: name,
            floor: campaignHint.floor,
            campaignMatched: true,
            campaignFallback: true
          });
        }
      });
    });

    const overrides = loadOverrides();
    const allNames = new Set();
    rows.forEach(row => row.tlNames.forEach(name => allNames.add(name)));
    Object.keys(overrides).forEach(name => allNames.add(name));

    const assignments = new Map();

    allNames.forEach(name => {
      const ev = evidence.get(name) || {
        [FLOOR.GROUND]: 0,
        [FLOOR.FIRST]: 0,
        [FLOOR.SECOND]: 0,
        total: 0,
        stationHits: 0,
        referenceHits: 0
      };

      if ([FLOOR.GROUND, FLOOR.FIRST, FLOOR.SECOND].includes(overrides[name])) {
        assignments.set(name, {
          floor: overrides[name],
          source: "Saved manual assignment",
          confidence: 1,
          evidence: ev
        });
        return;
      }

      const candidates = [FLOOR.GROUND, FLOOR.FIRST, FLOOR.SECOND]
        .map(floor => ({ floor, score: ev[floor] || 0 }))
        .sort((a, b) => b.score - a.score);

      const best = candidates[0];
      const second = candidates[1];

      if (best.score <= 0) {
        assignments.set(name, {
          floor: null,
          source: "Not enough evidence",
          confidence: 0,
          evidence: ev
        });
        return;
      }

      const ratio = ev.total ? best.score / ev.total : 0;
      const hasTie = Math.abs(best.score - second.score) < 0.001;

      if (hasTie || ratio < 0.55) {
        assignments.set(name, {
          floor: null,
          source: ev.referenceHits ? "Conflicting floor reference / evidence" : "Mixed floor evidence",
          confidence: ratio,
          evidence: ev
        });
      } else {
        let source = "Auto-learned from report";
        if (ev.referenceHits && ev.stationHits) source = "Official floor reference + Station No.";
        else if (ev.referenceHits) source = "Official floor reference";
        else if (ev.stationHits) source = "Station No. evidence";

        assignments.set(name, {
          floor: best.floor,
          source,
          confidence: ratio,
          evidence: ev
        });
      }
    });

    return assignments;
  }

  function assignRows(rows, assignments) {
    return rows.map(row => {
      const tlItems = (row.tlNames || [])
        .map(name => assignments.get(name))
        .filter(Boolean);

      const tlFloors = tlItems
        .map(item => item.floor)
        .filter(Boolean);

      const uniqueTLFloors = [...new Set(tlFloors)];
      let floor = FLOOR.REVIEW;
      let source = "Needs review";

      if (row.directFloor) {
        floor = row.directFloor;
        source = row.directFloorReason || "Station No. pattern";
      } else if (uniqueTLFloors.length === 1) {
        floor = uniqueTLFloors[0];
        const knownOfficial = tlItems.some(item =>
          item.source && (
            item.source.includes("Official") ||
            item.source.includes("Saved manual")
          )
        );
        const onlyCampaignEvidence = tlItems.every(item =>
          item.source && item.source.includes("Official floor reference")
        );

        if (knownOfficial) {
          source = "Official TL/campaign floor reference";
        } else if (onlyCampaignEvidence) {
          source = "Campaign floor fallback";
        } else {
          source = "TL floor assignment";
        }
      } else if (uniqueTLFloors.length > 1) {
        floor = FLOOR.REVIEW;
        source = "TLs map to different floors";
      } else if (row.campaignFloor) {
        floor = row.campaignFloor;
        source = "New TL — sorted by campaign";
      } else if (row.referenceHints && row.referenceHints.length) {
        const hintFloors = [...new Set(row.referenceHints.map(h => h.floor))];
        if (hintFloors.length === 1) {
          floor = hintFloors[0];
          source = row.referenceHints.some(h => h.campaignFallback)
            ? "New TL — sorted by campaign"
            : "Official TL/campaign floor reference";
        } else {
          floor = FLOOR.REVIEW;
          source = "Conflicting official floor references";
        }
      }

      return { ...row, floor, sortSource: source };
    }).sort((a, b) => {
      const floorDiff = floorOrder[a.floor] - floorOrder[b.floor];
      if (floorDiff !== 0) return floorDiff;

      const accountDiff = String(a.account).localeCompare(
        String(b.account),
        undefined,
        { numeric: true, sensitivity: "base" }
      );
      if (accountDiff !== 0) return accountDiff;

      const tlA = normalizeTLName(a.tl).toLowerCase();
      const tlB = normalizeTLName(b.tl).toLowerCase();
      const tlDiff = tlA.localeCompare(
        tlB,
        undefined,
        { numeric: true, sensitivity: "base" }
      );
      if (tlDiff !== 0) return tlDiff;

      return String(a.station).localeCompare(
        String(b.station),
        undefined,
        { numeric: true, sensitivity: "base" }
      );
    });
  }

  function rowToMiniSheetValues(row) {
    return [
      row.timestamp || "",
      row.date || "",
      displayTLValue(row.tl),
      row.account || "",
      row.site || "",
      row.station || "",
      row.issue || ""
    ];
  }

  function rowsToTSV(rows) {
    const headers = [
      "TIMESTAMP",
      "DATE",
      "TL",
      "ACCOUNT",
      "SITE",
      "STATION NO.",
      "STATION ISSUE"
    ];

    const body = rows.map(row => [
      row.timestamp || "",
      row.date || "",
      displayTLValue(row.tl),
      row.account,
      row.site,
      row.station,
      row.issue
    ]);

    return [headers, ...body]
      .map(cols => cols
        .map(value => String(value == null ? "" : value).replace(/\t/g, " "))
        .join("\t"))
      .join("\n");
  }

  function selectedMiniSheetTsv(rows, indexes, includeHeader = false) {
    if (!indexes || !indexes.length) return "";

    const lines = indexes.map(index =>
      rowToMiniSheetValues(rows[index])
        .map(value => String(value == null ? "" : value)
          .replace(/\t/g, " ")
          .replace(/\r?\n/g, " "))
        .join("\t")
    );

    if (includeHeader) {
      lines.unshift([
        "TIMESTAMP",
        "DATE",
        "TL",
        "ACCOUNT",
        "SITE",
        "STATION NO.",
        "STATION ISSUE"
      ].join("\t"));
    }

    return lines.join("\n");
  }

  function selectedMiniSheetCellTsv(rows, selection) {
    if (!selection) return "";
    const { startRow, endRow, startCol, endCol } = selection;
    const lines = [];

    for (let rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
      const row = rows[rowIndex];
      if (!row) continue;

      const values = rowToMiniSheetValues(row)
        .slice(startCol, endCol + 1)
        .map(value =>
          String(value == null ? "" : value)
            .replace(/\t/g, " ")
            .replace(/\r?\n/g, " ")
        );

      lines.push(values.join("\t"));
    }

    return lines.join("\n");
  }

  function parseMiniSheetClipboardRows(text) {
    const raw = String(text || "").replace(/\r/g, "").trim();
    if (!raw) return [];

    const lines = raw.split("\n").filter(line => line.trim() !== "");

    const rows = lines.map(line => {
      const cells = line.includes("\t")
        ? line.split("\t")
        : line.split(",").map(value => value.trim());

      while (cells.length < 7) cells.push("");

      return {
        timestamp: String(cells[0] || "").trim(),
        date: String(cells[1] || "").trim(),
        tl: String(cells[2] || "").trim(),
        account: String(cells[3] || "").trim(),
        site: String(cells[4] || "").trim(),
        station: String(cells[5] || "").trim(),
        issue: cells.slice(6).join(" ").trim(),
        floor: FLOOR.REVIEW,
        sortSource: "Pasted into Mini Sheet",
        tlNames: extractTLNames(cells[2] || "")
      };
    });

    if (rows.length) {
      const first = rows[0];
      const headerText = [
        first.timestamp,
        first.date,
        first.tl,
        first.account,
        first.site,
        first.station,
        first.issue
      ].join(" ").toUpperCase();

      if (
        headerText.includes("TIMESTAMP") &&
        headerText.includes("DATE") &&
        headerText.includes("STATION")
      ) {
        rows.shift();
      }
    }

    return rows.filter(row =>
      [
        row.timestamp,
        row.date,
        row.tl,
        row.account,
        row.site,
        row.station,
        row.issue
      ].some(value => String(value || "").trim())
    );
  }

  function resetAssignments() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TL_NAME_EDIT_KEY);
    localStorage.removeItem(TL_HIDDEN_KEY);
  }

  const sorterService = {
    FLOOR,
    floorOrder,
    MINI_SHEET_FIELDS,
    OFFICIAL_TL_FLOOR_REFERENCE,
    CAMPAIGN_FLOOR_REFERENCE,
    parseReport,
    normalizeTLName,
    extractTLNames,
    normalizeReferenceText,
    tlAliasMatches,
    getReferenceHints,
    detectCampaignFloor,
    detectStationFloor,
    loadOverrides,
    saveOverrides,
    loadTLNameEdits,
    saveTLNameEdits,
    loadHiddenTLs,
    saveHiddenTLs,
    getEditedTLName,
    displayTLValue,
    buildAssignments,
    assignRows,
    rowToMiniSheetValues,
    rowsToTSV,
    selectedMiniSheetTsv,
    selectedMiniSheetCellTsv,
    parseMiniSheetClipboardRows,
    resetAssignments
  };

  root.sorterService = sorterService;
})(window);
