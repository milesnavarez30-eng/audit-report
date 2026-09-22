/**
 * CCTV OPS V2 - CCTV Report Service
 * Ready-to-send CCTV incident/report message composer for Microsoft Teams
 * Integrated with the complete SixEleven Code of Conduct Policy Reference & Multi-MIME clipboard.
 */

window.CCTV_REPORT_SERVICE = (function () {
  "use strict";

  const STORAGE_KEY = "cctv_ops_v2_incident_report_draft_v2";

  // Code of Conduct dataset & matrix are owned by window.CCTV_CONDUCT (code-of-conduct-service.js)
  function getCodeOfConduct() {
    return window.CCTV_CONDUCT ? window.CCTV_CONDUCT.getCodeOfConduct() : [];
  }

  function getCodeOfConductCount() {
    return window.CCTV_CONDUCT ? window.CCTV_CONDUCT.getCodeOfConductCount() : 0;
  }

  function getPenaltyMatrix() {
    return window.CCTV_CONDUCT ? window.CCTV_CONDUCT.getPenaltyMatrix() : {};
  }
  // Raw Bisaya-English dictionary substitutions
  const BISAYA_ENGLISH_MAP = [
    { regex: /\bhantod\s+nakatulog\b/gi, replacement: "dozing off and eventually falling asleep" },
    { regex: /\bgatan-?aw\s+ug\s+video\b/gi, replacement: "watching a video" },
    { regex: /\bgina\s+hide\b/gi, replacement: "hiding the window at times" },
    { regex: /\bgipaandar\s+ang\s+pc\b/gi, replacement: "using and turning on the PC" },
    { regex: /\bwala\s+gi-?shutdown\b/gi, replacement: "without shutting it down" },
    { regex: /\bgipasagdan\s+lang\s+andar\b/gi, replacement: "left it powered on and running" },
    { regex: /\bga\s+pop\s+up\b/gi, replacement: "popping up on the screen" },
    { regex: /\bga\s+chitchat\b/gi, replacement: "engaging in non-work-related conversation" },
    { regex: /\bchitchatting\b/gi, replacement: "engaging in non-work-related conversation" }
  ];

  // --- NORMALIZATION & MIGRATION UTILITIES ---
  function normalizeCctvReportText(value) {
    if (typeof value !== "string") return value;
    let text = value;
    // Safely replace known broken dash sequences (mojibake) and Unicode dashes with standard ASCII hyphen:
    // Handles Windows-1252/ISO-8859-1 en-dash/em-dash mojibake, double mojibake, and Unicode dashes
    text = text.replace(/(?:\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u20ac[\u0153\u009d]|\u00e2\u20ac[\u201c\u201d\u02dc\u2122\u0093\u0094]|\u00e2\u0080[\u0093\u0094]|\u00c2[\u0096\u0097\u2013\u2014]|[\u2013\u2014\u2015\u2212])/g, "-");
    // Normalize spacing around hyphens: "Site A   -   Ground Floor" -> "Site A - Ground Floor"
    text = text.replace(/[ \t]+-[ \t]+/g, " - ");
    // Clean up multiple spaces/tabs without disrupting newlines
    text = text.replace(/[ \t]{2,}/g, " ");
    return text.trim();
  }

  function normalizeCctvReportDraft(draft) {
    if (!draft || typeof draft !== "object") return draft;
    const normalized = { ...draft };
    const textFields = ["site", "location", "dateRange", "date", "observation", "body", "greeting", "personInvolved", "rawInput"];
    for (const field of textFields) {
      if (typeof normalized[field] === "string") {
        normalized[field] = normalizeCctvReportText(normalized[field]);
      }
    }
    return normalized;
  }

  function getDefaultDraft() {
    return {
      greeting: "Good morning TLs,",
      observation: "Observed an agent sleeping from 5:34:44 AM to 5:40:20 AM, with a total duration of approximately 5 minutes. Kindly file an NOC in accordance with the company COD. Thank you.",
      personInvolved: "",
      site: "Mabini Site A - Ground Floor",
      dateRange: "September 10, 2026",
      clipUrl: "",
      screenshots: [],
      referencedPolicy: null,
      rawInput: ""
    };
  }

  function getDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const merged = { ...getDefaultDraft(), ...parsed };
        const normalized = normalizeCctvReportDraft(merged);
        const normalizedJson = JSON.stringify(normalized);
        if (raw !== normalizedJson) {
          try {
            localStorage.setItem(STORAGE_KEY, normalizedJson);
          } catch (persistErr) {
            console.warn("Could not persist migrated CCTV report draft:", persistErr);
          }
        }
        return normalized;
      }
    } catch (e) {
      console.warn("Could not load CCTV report draft:", e);
    }
    return getDefaultDraft();
  }

  function saveDraft(draft) {
    try {
      const normalized = normalizeCctvReportDraft(draft);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (e) {
      console.warn("Could not save CCTV report draft:", e);
    }
  }

  function resetDraft() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    return getDefaultDraft();
  }

  function computePolicyRelevance(pol, catCategory, rawQuery) {
    if (window.CCTV_CONDUCT && typeof window.CCTV_CONDUCT.computePolicyRelevance === "function") {
      return window.CCTV_CONDUCT.computePolicyRelevance(pol, catCategory, rawQuery);
    }
    return 1;
  }

  function searchCodeOfConduct(query, filterCategory, filterSeverity, monitoredOnly) {
    if (window.CCTV_CONDUCT && typeof window.CCTV_CONDUCT.searchCodeOfConduct === "function") {
      return window.CCTV_CONDUCT.searchCodeOfConduct(query, filterCategory, filterSeverity, monitoredOnly);
    }
    return [];
  }
  // --- TIME & DURATION UTILITIES ---

  function parseTimeSeconds(timeStr) {
    if (!timeStr) return null;
    const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (!m) return null;
    let hours = parseInt(m[1], 10);
    const minutes = parseInt(m[2], 10);
    const seconds = m[3] ? parseInt(m[3], 10) : 0;
    const ampm = m[4].toUpperCase();

    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;

    return hours * 3600 + minutes * 60 + seconds;
  }

  function calculateDurationWholeMinutes(startTimeStr, endTimeStr, isOvernight = false) {
    const sSec = parseTimeSeconds(startTimeStr);
    const eSec = parseTimeSeconds(endTimeStr);
    if (sSec === null || eSec === null) return null;

    let diffSec = eSec - sSec;
    if (diffSec < 0) {
      diffSec += 24 * 3600;
    } else if (isOvernight && diffSec === 0) {
      diffSec += 24 * 3600;
    }

    // Truncate fractional minutes to completed whole minutes (e.g. 5m 36s -> approximately 5 minutes)
    let mins = Math.floor(diffSec / 60);
    if (mins < 1 && diffSec > 0) mins = 1;
    return mins;
  }

  function formatWholeMinuteDuration(mins) {
    if (mins === null || mins === undefined) return "";
    if (mins < 60) {
      return `approximately ${mins} minute${mins === 1 ? "" : "s"}`;
    }
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    if (rem === 0) {
      return `approximately ${hrs} hour${hrs > 1 ? "s" : ""}`;
    }
    return `approximately ${hrs} hour${hrs > 1 ? "s" : ""} and ${rem} minute${rem > 1 ? "s" : ""}`;
  }

  // Month names for date formatting
  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const MONTH_ABBR = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11
  };

  // --- PARSER ENGINE ---

  function parseQuickCompose(rawText) {
    if (!rawText || !rawText.trim()) {
      return null;
    }

    let text = rawText.trim();

    // 0. Strip greetings and headers to avoid duplicate greetings
    text = text.replace(/^\s*good\s+(?:morning|afternoon|evening)\s+(?:tls?|team\s*leaders?|all)[\s,:]*/im, " ");
    text = text.replace(/^(?:CCTV\s+REPORT|INCIDENT\s+REPORT)[\s,:]*/im, " ");
    text = text.replace(/\b(?:Location|Site|Date|Person(?:\/Agent)?\s*Involved)\s*:\s*/gi, " ");

    // 1. Extract CCTV Clip URLs
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const detectedUrls = [];
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
      detectedUrls.push(match[1]);
    }
    // Remove detected URLs and any leftover clip labels from body text
    text = text.replace(urlRegex, " ").replace(/\s+/g, " ").trim();
    text = text.replace(/\bCCTV\s*Clip(?:\s*\d+)?\s*:\s*(?:Click\s*here!?)?/gi, " ");

    // 2. Extract Location
    let detectedLocation = "";
    const sitePatterns = [
      /\b(Mabini\s+Site\s+[AB])(?:\s*[\u2013\u2014-]\s*|\s+)(Ground|1st|2nd|3rd|4th|5th|6th)?\s*(Floor)?\b/i,
      /\b(MAA)(?:\s*[\u2013\u2014-]\s*|\s+)(4th|5th|6th)?\s*(Floor)?\b/i,
      /\b(Ecoland(?:\s+Site)?)\b/i,
      /\b(Gensan(?:\s+Site)?)\b/i
    ];

    for (const pattern of sitePatterns) {
      const sMatch = text.match(pattern);
      if (sMatch) {
        if (sMatch[1].toLowerCase().includes("mabini")) {
          const site = sMatch[1].replace(/\s+/g, " ");
          const floor = sMatch[2] ? `${sMatch[2]} Floor` : "Ground Floor";
          detectedLocation = `${site} - ${floor}`;
        } else if (sMatch[1].toUpperCase() === "MAA") {
          const floor = sMatch[2] ? `${sMatch[2]} Floor` : "5th Floor";
          detectedLocation = `MAA - ${floor}`;
        } else if (sMatch[1].toLowerCase().includes("ecoland")) {
          detectedLocation = "Ecoland Site";
        } else if (sMatch[1].toLowerCase().includes("gensan")) {
          detectedLocation = "Gensan Site";
        }
        text = text.replace(sMatch[0], " ");
        break;
      }
    }

    // 3. Extract Dates & Overnight Time Ranges
    let detectedDate = "";
    let isOvernightDate = false;
    const intervals = [];

    // Special Pattern 0: Time + Date until Time + Date
    // e.g. "2:39:12 PM Sept 12 until 7:47:17 AM Sept 13"
    const overnightDateTimePattern = /(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM))\s+(?:on\s+)?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|October|November|December)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s*(?:until|to|[\u2013\u2014-])\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM))\s+(?:on\s+)?(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|October|November|December)[a-z]*\.?\s+)?(\d{1,2})(?:st|nd|rd|th)?(?!\s*:),?\s*(\d{4})?/i;
    const odtMatch = text.match(overnightDateTimePattern);
    if (odtMatch) {
      const startTime = odtMatch[1].trim();
      const m1 = odtMatch[2];
      const d1 = odtMatch[3];
      const endTime = odtMatch[4].trim();
      const m2 = odtMatch[5] || m1;
      const d2 = odtMatch[6];
      const year = odtMatch[7] || "2026";

      const mIdx1 = MONTH_ABBR[m1.toLowerCase().replace(".", "")];
      const monthFullName1 = mIdx1 !== undefined ? MONTH_NAMES[mIdx1] : m1;
      const mIdx2 = MONTH_ABBR[m2.toLowerCase().replace(".", "")];
      const monthFullName2 = mIdx2 !== undefined ? MONTH_NAMES[mIdx2] : m2;

      if (monthFullName1 === monthFullName2) {
        detectedDate = `${monthFullName1} ${d1}-${d2}, ${year}`;
      } else {
        detectedDate = `${monthFullName1} ${d1} - ${monthFullName2} ${d2}, ${year}`;
      }
      isOvernightDate = true;

      intervals.push({
        start: startTime,
        end: endTime,
        overnightPhrase: `from ${startTime} on ${monthFullName1} ${d1}, ${year}, until ${endTime} on ${monthFullName2} ${d2}, ${year}`
      });

      text = text.replace(odtMatch[0], " ");
    }

    // Pattern A: Overnight Sept 12-13, 2026 or Sept 12 until Sept 13
    if (!detectedDate) {
      const overnightPattern = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|October|November|December)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s*(?:[\u2013\u2014-]|to|until)\s*(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|October|November|December)[a-z]*\.?\s+)?(\d{1,2})(?:st|nd|rd|th)?(?!\s*:),?\s*(\d{4})?\b/i;
      const overMatch = text.match(overnightPattern);
      if (overMatch) {
        const m1 = overMatch[1];
        const d1 = overMatch[2];
        const d2 = overMatch[4];
        const year = overMatch[5] || "2026";
        const mIdx = MONTH_ABBR[m1.toLowerCase().replace(".", "")];
        const monthFullName = mIdx !== undefined ? MONTH_NAMES[mIdx] : m1;
        detectedDate = `${monthFullName} ${d1}-${d2}, ${year}`;
        isOvernightDate = true;
        text = text.replace(overMatch[0], " ");
      }
    }

    // Pattern B: Numeric date MM-DD-YY or MM/DD/YYYY or MM-DD-YYYY
    if (!detectedDate) {
      const numDatePattern = /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/;
      const numMatch = text.match(numDatePattern);
      if (numMatch) {
        const monthNum = parseInt(numMatch[1], 10);
        const dayNum = parseInt(numMatch[2], 10);
        let yearNum = parseInt(numMatch[3], 10);
        if (yearNum < 100) yearNum += 2000;
        if (monthNum >= 1 && monthNum <= 12) {
          detectedDate = `${MONTH_NAMES[monthNum - 1]} ${dayNum}, ${yearNum}`;
        } else {
          detectedDate = numMatch[0];
        }
        text = text.replace(numMatch[0], " ");
      }
    }

    // Pattern C: Standard Single readable date Sept 10, 2026
    if (!detectedDate) {
      const singleDatePattern = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|October|November|December)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?!\s*:),?\s*(\d{4})?\b/i;
      const singleMatch = text.match(singleDatePattern);
      if (singleMatch) {
        const m1 = singleMatch[1];
        const d1 = singleMatch[2];
        const year = singleMatch[3] || "2026";
        const mIdx = MONTH_ABBR[m1.toLowerCase().replace(".", "")];
        const monthFullName = mIdx !== undefined ? MONTH_NAMES[mIdx] : m1;
        detectedDate = `${monthFullName} ${d1}, ${year}`;
        text = text.replace(singleMatch[0], " ");
      }
    }

    // 4. Extract Time Intervals or Single Timestamps
    const timeRegex = /(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM))/gi;
    const rawTimes = [];
    let tMatch;
    while ((tMatch = timeRegex.exec(text)) !== null) {
      rawTimes.push(tMatch[1].trim());
    }

    // Check for intervals (pairs of start & end) if not already found
    if (intervals.length === 0) {
      const intervalPattern = /(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM))\s*(?:to|until|[\u2013\u2014-])\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM))/gi;
      let iMatch;
      while ((iMatch = intervalPattern.exec(rawText)) !== null) {
        intervals.push({
          start: iMatch[1].trim(),
          end: iMatch[2].trim()
        });
      }
    }

    // If no explicit "to/until" pair found, but 2 times exist, treat as interval
    if (intervals.length === 0 && rawTimes.length >= 2) {
      intervals.push({
        start: rawTimes[0],
        end: rawTimes[1]
      });
    }

    // 5. Clean remaining observation text & Bisaya substitutions
    let cleanNotes = text;
    for (const item of BISAYA_ENGLISH_MAP) {
      cleanNotes = cleanNotes.replace(item.regex, item.replacement);
    }
    // Remove isolated time strings from cleanNotes
    cleanNotes = cleanNotes.replace(timeRegex, " ").replace(/\s+/g, " ").trim();
    // Strip redundant leading "Observed an agent" / "Observed" so it does not duplicate
    cleanNotes = cleanNotes.replace(/^observed\s+(?:an?\s+)?(?:agent|person)?\s*/i, "").trim();
    // Strip trailing action requests if present in raw input
    cleanNotes = cleanNotes.replace(/\bkindly\s+(?:file\s+an\s+noc|remind\s+the\s+agent)[^.\n]*\.?(?:\s*thank\s+you\.?)?/gi, "").trim();

    return {
      cleanNotes,
      detectedLocation,
      detectedDate,
      isOvernightDate,
      intervals,
      singleTime: intervals.length === 0 && rawTimes.length === 1 ? rawTimes[0] : null,
      detectedUrls
    };
  }

  // --- REPORT GENERATION ENGINE ---

  function generateReport(rawInput, existingDraft = {}) {
    const parsed = parseQuickCompose(rawInput) || {
      cleanNotes: rawInput || "",
      detectedLocation: "",
      detectedDate: "",
      isOvernightDate: false,
      intervals: [],
      singleTime: null,
      detectedUrls: []
    };

    const notesLower = (rawInput + " " + parsed.cleanNotes).toLowerCase();

    // Violation Classification
    const isSleeping = /sleep|nakatulog|tulog|doz/i.test(notesLower);
    const isDozingToSleep = /doz|hantod\s+nakatulog|eventually\s+fall/i.test(notesLower);
    const isDressCode = /dress\s*code|no\s*id|sleeveless|open-?toe|slippers|jersey|piercing|hoodie|cap\b/i.test(notesLower);
    const isLoitering = /loiter|wasting\s+time|idling|wandering/i.test(notesLower);
    const isChitchat = /chitchat|conversation|noise|shout/i.test(notesLower);
    const isUnassignedPc = /unassigned\s*pc|pc\s+(?:that\s+)?is\s+not\s+(?:his|hers|theirs|assigned)|not\s+assigned/i.test(notesLower);
    const isPcLeftOn = /shut\s*down|left\s+(?:it\s+)?(?:running|on|powered\s+on)|powered\s+on|pc\s+left\s+on/i.test(notesLower);
    const isFoodDrink = /eat|eating|candy|food|drink|consume/i.test(notesLower);
    const isCleanliness = /clean|dusty|dirty|unclean|housekeeping|wiped|chair\s+not\s+tucked/i.test(notesLower);
    const isInternetVideo = /video|youtube|browsing|minimized|window|google\s+images|movie/i.test(notesLower);
    const isMonitorObstruct = /obstruct|cover\s+(?:the\s+)?monitor|covering\s+monitor/i.test(notesLower);
    const isCameraAdjust = /camera|blind\s*spot|tilt/i.test(notesLower);

    // Build Time Description
    let timePhrase = "";
    let durationText = "";
    let totalMinutes = 0;

    if (parsed.intervals.length === 1) {
      const inv = parsed.intervals[0];
      const mins = calculateDurationWholeMinutes(inv.start, inv.end, parsed.isOvernightDate);
      if (mins !== null) {
        totalMinutes = mins;
        durationText = formatWholeMinuteDuration(mins);
      }
      if (inv.overnightPhrase) {
        timePhrase = inv.overnightPhrase;
      } else if (parsed.isOvernightDate) {
        timePhrase = `from ${inv.start} until ${inv.end}`;
      } else {
        timePhrase = `from ${inv.start} to ${inv.end}`;
      }
    } else if (parsed.intervals.length > 1) {
      // Multiple intervals
      const intervalDescriptions = [];
      let combinedMins = 0;
      parsed.intervals.forEach(inv => {
        const m = calculateDurationWholeMinutes(inv.start, inv.end, false);
        if (m !== null) combinedMins += m;
        intervalDescriptions.push(`from ${inv.start} to ${inv.end} (${formatWholeMinuteDuration(m || 0)})`);
      });
      totalMinutes = combinedMins;
      timePhrase = intervalDescriptions.join(" and ");
      durationText = formatWholeMinuteDuration(combinedMins);
    } else if (parsed.singleTime) {
      timePhrase = `at ${parsed.singleTime} during scheduled work hours`;
    }

    // Build Objective Narrative & Requested Action
    let incidentNarrative = "";
    let actionRequest = "";

    if (isSleeping) {
      if (isDozingToSleep) {
        incidentNarrative = `Observed an agent dozing off and eventually falling asleep ${timePhrase}`;
      } else {
        incidentNarrative = `Observed an agent sleeping ${timePhrase}`;
      }
      if (durationText) {
        incidentNarrative += `, with a total duration of ${durationText}.`;
      } else {
        incidentNarrative += `.`;
      }
      actionRequest = `Kindly file an NOC in accordance with the company COD. Thank you.`;

    } else if (isUnassignedPc && isPcLeftOn) {
      incidentNarrative = `Observed an agent using a PC that was not assigned to the agent and leaving it powered on without shutting it down ${timePhrase}.`;
      actionRequest = `Kindly file an NOC and remind the agent to properly shut down the PC after use and avoid using an unassigned PC. Thank you.`;

    } else if (isUnassignedPc) {
      incidentNarrative = `Observed an agent using a PC that was not assigned to the agent ${timePhrase}.`;
      actionRequest = `Kindly file an NOC and remind the agent to avoid using an unassigned PC. Thank you.`;

    } else if (isPcLeftOn) {
      incidentNarrative = `Observed an agent leaving the PC powered on without properly shutting it down ${timePhrase}.`;
      actionRequest = `Kindly remind the agent to properly shut down the PC after use in accordance with company policy. Thank you.`;

    } else if (isDressCode) {
      let dressDetail = "violating prescribed office attire";
      if (/no\s*id/i.test(notesLower)) dressDetail = "not visibly wearing the company ID badge";
      else if (/sleeveless/i.test(notesLower)) dressDetail = "wearing sleeveless attire";
      else if (/open-?toe|slippers/i.test(notesLower)) dressDetail = "wearing prohibited footwear/slippers";
      else if (/jersey/i.test(notesLower)) dressDetail = "wearing an athletic jersey";
      else if (/hoodie|cap/i.test(notesLower)) dressDetail = "wearing an unauthorized hood/cap";

      incidentNarrative = `Observed an agent ${dressDetail} ${timePhrase}.`;
      actionRequest = `Kindly remind the agent to adhere to the company dress code policy in accordance with the company COD. Thank you.`;

    } else if (isInternetVideo) {
      if (/hide|hidden|reappear/i.test(notesLower)) {
        incidentNarrative = `As seen in the CCTV clips, the agent was observed hiding the window at times and watching the video at other times ${timePhrase}.`;
      } else if (/minimized/i.test(notesLower)) {
        incidentNarrative = `Observed an agent watching a video/browsing in a minimized window ${timePhrase}.`;
      } else {
        incidentNarrative = `Observed an agent browsing non-work-related websites/video ${timePhrase}.`;
      }
      actionRequest = `Kindly file an NOC in accordance with the company COD. Thank you.`;

    } else if (isLoitering) {
      const pcOff = /(?:pc|computer)\s+(?:was\s+|is\s+|already\s+)*(?:turned\s+off|shutdown|off)|(?:turned\s+off|shutdown|off|power(?:ed)?\s+off)/i.test(notesLower);
      if (pcOff) {
        incidentNarrative = `Observed an agent wasting time/loitering while the PC was already turned off ${timePhrase}.`;
      } else {
        incidentNarrative = `Observed an agent wasting time/loitering ${timePhrase}. The agent appeared to be idling during shift hours.`;
      }
      actionRequest = `Kindly remind the agent to remain focused at the assigned workstation and file an NOC accordingly. Thank you.`;

    } else if (isChitchat) {
      incidentNarrative = `Observed an agent engaging in non-work-related conversation ${timePhrase}.`;
      actionRequest = `Kindly remind the agent to minimize non-work-related conversations during shift hours. Thank you.`;

    } else if (isFoodDrink) {
      incidentNarrative = `Observed an agent who appeared to consume an item/food on the operations floor ${timePhrase}.`;
      actionRequest = `Kindly file an NOC in accordance with the company COD. Thank you.`;

    } else if (isCleanliness) {
      let detail = "an improperly arranged workstation";
      if (/dusty|dirty/i.test(notesLower)) detail = "a dusty/dirty workstation";
      if (/chair\s+not\s+tucked/i.test(notesLower)) detail = "a workstation chair not properly tucked in";
      incidentNarrative = `Observed ${detail} ${timePhrase}.`;
      actionRequest = `Kindly remind the agent to maintain clean and orderly workstation conditions in accordance with company policy. Thank you.`;

    } else if (isMonitorObstruct) {
      incidentNarrative = `Observed an agent obstructing/covering the computer monitor ${timePhrase}.`;
      actionRequest = `Kindly remind the agent not to place or use any objects to cover or obstruct the monitor. Thank you.`;

    } else if (isCameraAdjust) {
      incidentNarrative = `Observed an incident involving camera visibility/angle near the workstation ${timePhrase}.`;
      actionRequest = `Kindly inspect the workstation visibility accordingly. Thank you.`;

    } else {
      // General Objective Fallback
      let desc = parsed.cleanNotes || "an incident";
      if (desc.startsWith("Observed an agent")) {
        incidentNarrative = `${desc} ${timePhrase}.`.replace(/\.\.+$/, ".");
      } else {
        incidentNarrative = `Observed an agent ${desc} ${timePhrase}.`.replace(/\.\.+$/, ".");
      }
      actionRequest = `Kindly take appropriate action in accordance with the company COD. Thank you.`;
    }

    // Combine incident narrative and action request
    const fullObservation = `${incidentNarrative} ${actionRequest}`.trim();

    // Final Location: Keep existing operator-entered location if already provided.
    // If empty, populate from detected Location. Never invent fictitious locations.
    let finalLocation = "";
    if (parsed.detectedLocation) {
      finalLocation = normalizeCctvReportText(parsed.detectedLocation);
    } else if (existingDraft.site && String(existingDraft.site).trim()) {
      finalLocation = normalizeCctvReportText(String(existingDraft.site).trim());
    }

    // Final Date: Keep existing operator-entered date if already provided.
    // If empty, populate from detected Date. Never invent fictitious dates.
    let finalDate = "";
    if (parsed.detectedDate) {
      finalDate = normalizeCctvReportText(parsed.detectedDate);
    } else if (existingDraft.dateRange && String(existingDraft.dateRange).trim()) {
      finalDate = normalizeCctvReportText(String(existingDraft.dateRange).trim());
    }

    // Final Clip URLs
    let finalClip = existingDraft.clipUrl || "";
    if (parsed.detectedUrls.length > 0) {
      finalClip = parsed.detectedUrls.join("\n");
    }

    return normalizeCctvReportDraft({
      greeting: existingDraft.greeting || "Good morning TLs,",
      observation: fullObservation,
      personInvolved: existingDraft.personInvolved || "",
      site: finalLocation,
      dateRange: finalDate,
      clipUrl: finalClip,
      screenshots: existingDraft.screenshots || [],
      referencedPolicy: existingDraft.referencedPolicy || null,
      rawInput: rawInput,
      durationText: durationText,
      totalMinutes: totalMinutes,
      classification: isSleeping ? "SLEEPING" : (isInternetVideo ? "BROWSING" : (isDressCode ? "DRESS CODE" : ""))
    });
  }

  // --- REPORT TEXT BUILDERS ---

  function parseClipUrls(clipUrlInput) {
    if (!clipUrlInput) return [];
    const seen = new Set();
    return String(clipUrlInput)
      .split(/[\r\n,]+/)
      .map(u => u.trim())
      .map(u => {
        if (!u) return "";
        if (typeof window.safeUrl === "function") return window.safeUrl(u);
        try {
          const parsed = new URL(u, window.location.origin);
          if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
        } catch (_) {}
        return "";
      })
      .filter(u => {
        if (!u) return false;
        if (seen.has(u)) return false;
        seen.add(u);
        return true;
      });
  }

  function buildReportPlainText(draft) {
    const d = draft || getDefaultDraft();
    const parts = [];

    const greeting = (d.greeting || "Good morning TLs,").trim();
    const observation = (d.observation || d.body || "").trim();
    const person = (d.personInvolved || "").trim();
    const location = (d.site || d.location || "").trim();
    const date = (d.dateRange || d.date || "").trim();
    const clipUrl = d.clipUrl || "";

    const startsWithGreeting = /^\s*good\s+(?:morning|afternoon|evening)/i.test(observation);
    if (!startsWithGreeting && greeting) {
      parts.push(greeting);
      parts.push("");
    }

    if (observation) {
      parts.push(observation);
      parts.push("");
    }

    const hasLocationInObs = /\bLocation\s*:/i.test(observation);
    const hasDateInObs = /\bDate\s*:/i.test(observation);

    const metaLines = [];
    if (person && !observation.includes(person)) {
      metaLines.push(`Person/Agent Involved: ${person}`);
    }
    if (location && !hasLocationInObs) {
      metaLines.push(`Location: ${location}`);
    }
    if (date && !hasDateInObs) {
      metaLines.push(`Date: ${date}`);
    }

    if (metaLines.length) {
      parts.push(metaLines.join("\n"));
      parts.push("");
    }

    const clips = parseClipUrls(clipUrl);
    if (clips.length === 1) {
      parts.push(`CCTV Clip: ${clips[0]}`);
    } else if (clips.length > 1) {
      clips.forEach((c, idx) => {
        parts.push(`CCTV Clip ${idx + 1}: ${c}`);
      });
    }

    return parts.join("\n").trim();
  }

  function buildReportHtml(draft) {
    const d = draft || getDefaultDraft();
    const esc = (val) => String(val == null ? "" : val)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const greeting = (d.greeting || "Good morning TLs,").trim();
    const observation = (d.observation || d.body || "").trim();
    const person = (d.personInvolved || "").trim();
    const location = (d.site || d.location || "").trim();
    const date = (d.dateRange || d.date || "").trim();
    const clipUrl = d.clipUrl || "";

    const htmlParts = [];

    const startsWithGreeting = /^\s*good\s+(?:morning|afternoon|evening)/i.test(observation);
    if (!startsWithGreeting && greeting) {
      htmlParts.push(`<div style="margin:0 0 6px 0;">${esc(greeting)}</div>`);
    }

    if (observation) {
      const formattedBody = esc(observation).replace(/\r?\n/g, "<br>");
      htmlParts.push(`<div style="margin:0 0 6px 0;">${formattedBody}</div>`);
    }

    const hasLocationInObs = /\bLocation\s*:/i.test(observation);
    const hasDateInObs = /\bDate\s*:/i.test(observation);

    if (person && !observation.includes(person)) {
      htmlParts.push(`<div style="margin:0 0 2px 0;"><strong>Person/Agent Involved:</strong> ${esc(person)}</div>`);
    }
    if (location && !hasLocationInObs) {
      htmlParts.push(`<div style="margin:0 0 2px 0;"><strong>Location:</strong> ${esc(location)}</div>`);
    }
    if (date && !hasDateInObs) {
      htmlParts.push(`<div style="margin:0 0 2px 0;"><strong>Date:</strong> ${esc(date)}</div>`);
    }

    // Screenshots container: compact wrapping layout
    if (Array.isArray(d.screenshots) && d.screenshots.length > 0) {
      const shotsHtml = d.screenshots.map((shot, i) => {
        const src = typeof shot === "string" ? shot : (shot.data || shot.url || "");
        return src ? `<img src="${src}" alt="CCTV Screenshot ${i + 1}" style="max-width:260px; max-height:180px; width:auto; height:auto; object-fit:contain; border:1px solid #cbd5e1; border-radius:4px; display:inline-block; margin:2px;" />` : "";
      }).filter(Boolean).join("");
      if (shotsHtml) {
        htmlParts.push(`<div style="display:flex; flex-wrap:wrap; gap:6px; margin:6px 0;">${shotsHtml}</div>`);
      }
    }

    // CCTV Clip hyperlinks
    const clips = parseClipUrls(clipUrl);
    if (clips.length === 1) {
      htmlParts.push(`<div style="margin:6px 0 0 0;"><strong>CCTV Clip:</strong> <a href="${esc(clips[0])}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: underline; font-weight: 600;">Click here!</a></div>`);
    } else if (clips.length > 1) {
      clips.forEach((c, idx) => {
        htmlParts.push(`<div style="margin:4px 0 0 0;"><strong>CCTV Clip ${idx + 1}:</strong> <a href="${esc(c)}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: underline; font-weight: 600;">Click here!</a></div>`);
      });
    }

    return htmlParts.join("");
  }

  async function copyAll(draft) {
    const plainText = buildReportPlainText(draft);
    const richHtml = buildReportHtml(draft);

    let wroteSuccessfully = false;
    let fallbackUsed = false;

    // 1. Preferred Multi-MIME standard write (text/html + text/plain)
    if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      try {
        const clipboardData = {
          "text/plain": new Blob([plainText], { type: "text/plain" }),
          "text/html": new Blob([richHtml], { type: "text/html" })
        };
        await navigator.clipboard.write([new ClipboardItem(clipboardData)]);
        wroteSuccessfully = true;
      } catch (err) {
        console.warn("ClipboardItem write failed, attempting HTML execCommand fallback:", err);
      }
    }

    // 2. Rich copy event fallback
    if (!wroteSuccessfully) {
      try {
        const onCopy = (e) => {
          e.preventDefault();
          e.clipboardData.setData("text/plain", plainText);
          e.clipboardData.setData("text/html", richHtml);
        };
        document.addEventListener("copy", onCopy, { once: true });
        wroteSuccessfully = document.execCommand("copy");
        if (wroteSuccessfully) fallbackUsed = true;
      } catch (_) {}
    }

    // 3. Plain-text fallback
    if (!wroteSuccessfully && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(plainText);
        wroteSuccessfully = true;
        fallbackUsed = true;
      } catch (_) {}
    }

    // 4. Hidden textarea execCommand fallback
    if (!wroteSuccessfully) {
      try {
        const ta = document.createElement("textarea");
        ta.value = plainText;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        wroteSuccessfully = document.execCommand("copy");
        ta.remove();
        if (wroteSuccessfully) fallbackUsed = true;
      } catch (_) {}
    }

    if (!wroteSuccessfully) {
      throw new Error("Unable to access clipboard. Please check browser permissions.");
    }

    const screenshotCount = Array.isArray(draft.screenshots) ? draft.screenshots.length : 0;
    const clips = parseClipUrls(draft.clipUrl);
    return {
      success: true,
      fallbackUsed,
      screenshotCount,
      hasClipLink: clips.length > 0,
      clipCount: clips.length
    };
  }


  function getAiQuickComposeApiUrl() {
    try {
      return String(
        (
          window.masterlistService &&
          window.masterlistService.apiUrl
        ) ||
        (
          window.CCTV_V2_CONFIG &&
          window.CCTV_V2_CONFIG.MASTERLIST_API_URL
        ) ||
        localStorage.getItem("cctv_masterlist_api_url") ||
        "https://script.google.com/macros/s/AKfycbw2-7ERz3psAaUfsceoFHV6leNmqFf5HxgasRYORMHU8bbnte7DLbDIfX_YzjRrzMZh/exec"
      ).trim();
    } catch (_) {
      return "https://script.google.com/macros/s/AKfycbw2-7ERz3psAaUfsceoFHV6leNmqFf5HxgasRYORMHU8bbnte7DLbDIfX_YzjRrzMZh/exec";
    }
  }


  function splitQuickComposeObservation(fullObservation) {
    const text = String(fullObservation || "").trim();

    if (!text) {
      return {
        narrative: "",
        actionRequest: ""
      };
    }

    const marker = " Kindly ";
    const index = text.lastIndexOf(marker);

    if (index < 0) {
      return {
        narrative: text,
        actionRequest: ""
      };
    }

    return {
      narrative: text.slice(0, index).trim(),
      actionRequest: text.slice(index + 1).trim()
    };
  }


  async function generateReportAI(rawInput, existingDraft = {}) {
    // Always generate the existing rule-based report first.
    // This remains the authoritative fallback and keeps COD action wording controlled
    // by CCTV OPS rather than by AI hallucination.
    const fallback = generateReport(rawInput, existingDraft);
    const parts = splitQuickComposeObservation(fallback.observation);

    const apiUrl = getAiQuickComposeApiUrl();
    if (!apiUrl) {
      return {
        ...fallback,
        aiUsed: false,
        aiError: "Masterlist API URL is not configured."
      };
    }

    const durationDirective = fallback.durationText
      ? `4. State the duration using the phrase: ', with a total duration of ${fallback.durationText}.'`
      : "4. If a duration is calculated or present in the notes, preserve it accurately.";

    const aiPrompt = [
      "You are a professional CCTV operations reporting assistant. Generate only the objective factual observation narrative for a CCTV incident report.",
      "Requirements:",
      "1. Start with 'Observed an agent' (or 'Observed' if referring to an unattended PC or hardware condition).",
      "2. State the observed activity concisely, objectively, and professionally.",
      "3. Preserve exact timestamps if provided in the notes.",
      durationDirective,
      "5. Do NOT include Location, Date, or action requests (such as NOC or reminder requests) in this observation body.",
      "6. Do NOT invent facts, names, violations, or timestamps not present in the notes.",
      "",
      "Raw Notes:",
      String(rawInput || "").trim()
    ].filter(Boolean).join("\n");

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 12000) : null;

    try {
      const fetchOptions = {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action: "aiQuickCompose",
          rawNotes: aiPrompt,
          fallbackNarrative: parts.narrative,
          classification: fallback.classification || ""
        })
      };
      if (controller) {
        fetchOptions.signal = controller.signal;
      }

      const response = await fetch(apiUrl, fetchOptions);
      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`AI request failed (${response.status}).`);
      }

      const result = await response.json();

      if (!result || result.success !== true || !String(result.observation || "").trim()) {
        throw new Error(result?.error || "AI returned no observation.");
      }

      let aiNarrative = String(result.observation).trim();

      // Sanitize AI observation: strip markdown formatting, quotes, or markdown headers
      aiNarrative = aiNarrative.replace(/^\s*["']|["']\s*$/g, "");
      aiNarrative = aiNarrative.replace(/\*\*/g, "");
      aiNarrative = aiNarrative.replace(/^\s*#+\s*/gm, "");

      // Remove accidental greetings or action requests emitted by AI
      aiNarrative = aiNarrative.replace(/^\s*good\s+(?:morning|afternoon|evening)[^.\n]*[.,]?\s*/i, "");
      aiNarrative = aiNarrative.replace(/\bkindly\s+(?:file\s+an\s+noc|remind\s+the\s+agent)[^.\n]*\.?(?:\s*thank\s+you\.?)?/gi, "").trim();

      // Ensure proper standard starter
      if (!/^observed\b/i.test(aiNarrative)) {
        aiNarrative = `Observed an agent ${aiNarrative}`;
      }

      // Verify duration preservation: if fallback computed a duration and AI dropped it, attach it cleanly
      if (fallback.durationText && !/\b(?:duration|approximately|lasting|spanning)\b/i.test(aiNarrative)) {
        aiNarrative = aiNarrative.replace(/\.+$/, "");
        aiNarrative += `, with a total duration of ${fallback.durationText}.`;
      }

      // Ensure single trailing period
      aiNarrative = aiNarrative.replace(/\.+$/, ".");

      // Combine factual AI narrative with the standard COD action request
      const finalObservation = [aiNarrative, parts.actionRequest].filter(Boolean).join(" ").trim();

      return {
        ...fallback,
        observation: finalObservation,
        aiUsed: true,
        aiProvider: result.provider || "gemini",
        aiModel: result.model || "gemini-3.5-flash-lite"
      };

    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      const isTimeout = error?.name === "AbortError" || /abort|timeout|timed out/i.test(error?.message || "");
      const errorMsg = isTimeout
        ? "AI request timed out. Standard report generation was used."
        : (error?.message || "AI generation unavailable.");

      console.warn("[CCTV Quick Compose AI] Falling back to standard composer:", errorMsg);

      return {
        ...fallback,
        aiUsed: false,
        aiError: errorMsg
      };
    }
  }

  return {
    getDraft,
    saveDraft,
    resetDraft,
    normalizeCctvReportText,
    normalizeCctvReportDraft,
    getCodeOfConduct,
    getCodeOfConductCount,
    getPenaltyMatrix,
    searchCodeOfConduct,
    parseQuickCompose,
    parseClipUrls,
    generateReport,
    generateReportAI,
    buildReportPlainText,
    buildReportHtml,
    copyAll
  };
})();

window.CctvReportService = window.CCTV_REPORT_SERVICE;
