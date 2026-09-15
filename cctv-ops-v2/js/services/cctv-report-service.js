/**
 * CCTV OPS V2 - CCTV Report Service
 * Ready-to-send CCTV incident/report message composer for Microsoft Teams
 * Integrated with the complete SixEleven Code of Conduct Policy Reference & Multi-MIME clipboard.
 */

window.CCTV_REPORT_SERVICE = (function () {
  "use strict";

  const STORAGE_KEY = "cctv_ops_v2_incident_report_draft_v2";

  // Disciplinary Penalty Matrix
  const PENALTY_MATRIX = {
    MINOR: {
      label: "Minor Infraction",
      color: "#38bdf8",
      schedule: [
        { offense: "1st offense", action: "Written Warning" },
        { offense: "2nd offense", action: "1 day suspension" },
        { offense: "3rd offense", action: "2–3 days suspension" },
        { offense: "4th offense", action: "Termination" }
      ]
    },
    MAJOR: {
      label: "Major Infraction",
      color: "#f59e0b",
      schedule: [
        { offense: "1st offense", action: "1 day suspension" },
        { offense: "2nd offense", action: "2–3 days suspension" },
        { offense: "3rd offense", action: "Termination" }
      ]
    },
    GRAVE: {
      label: "Grave Infraction",
      color: "#ef4444",
      schedule: [
        { offense: "1st offense", action: "Termination" }
      ]
    }
  };

  // SixEleven Authoritative Code of Conduct Reference Database
  // Faithfully transcribed with authentic policy numbers, titles, descriptions, and intentional gaps.
  const CODE_OF_CONDUCT = [
    {
      category: "1. Rules on Attendance, Punctuality, Working Hours and Work Assign",
      policies: [
        {
          num: "1.01",
          title: "Habitual Tardiness / Late Arrival",
          description: "Reporting to work after the scheduled shift start without valid authorization.",
          severity: "MINOR",
          isCctvMonitored: false
        },
        {
          num: "1.02",
          title: "Failure to Clock In/Out (Biometric / Attendance Punch)",
          description: "Neglecting to log official shift start or end times via biometric or electronic timekeeping systems.",
          severity: "MINOR",
          isCctvMonitored: false
        },
        {
          num: "1.03",
          title: "Leaving Assigned Workstation Without Proper Relief or Permission",
          description: "Stepping away from production line or queue without supervisor acknowledgment or scheduled relief.",
          severity: "MINOR",
          isCctvMonitored: true,
          cctvTag: "Station Abandonment"
        },
        {
          num: "1.04",
          title: "Failure to Notify Immediate Supervisor of Inability to Report for Work",
          description: "Failing to notify TL/OM within the prescribed notification window before shift start.",
          severity: "MINOR",
          isCctvMonitored: false
        },
        {
          num: "1.05",
          title: "Unauthorized Absence / Abandonment of Post (AWOL)",
          description: "Absence from scheduled shift without filing an approved leave or informing immediate supervisor.",
          severity: "MAJOR",
          isCctvMonitored: false
        },
        {
          num: "1.07",
          title: "Over-break / Exceeding Allotted Meal or Rest Break Duration",
          description: "Taking more than allotted 15-minute bio breaks or 1-hour lunch break without supervisor consent.",
          severity: "MINOR",
          isCctvMonitored: true,
          cctvTag: "Overbreak"
        },
        {
          num: "1.08",
          title: "Taking Breaks at Unscheduled Times Without Prior Approval",
          description: "Taking breaks outside assigned WFM interval schedule without TL concurrence.",
          severity: "MINOR",
          isCctvMonitored: true,
          cctvTag: "Unscheduled Break"
        },
        {
          num: "1.10",
          title: "Leaving Assigned Work Station without Authorization",
          description: "Leaving workstation or operations floor without prior notice or TL approval during production hours.",
          severity: "MINOR",
          isCctvMonitored: true,
          cctvTag: "Loitering"
        },
        {
          num: "1.13",
          title: "Sleeping or Idling in Training Rooms, Sleeping Quarters, or Lounges During Working Hours",
          description: "Using company rest quarters, vacant training rooms, or couches during scheduled work hours.",
          severity: "MAJOR",
          isCctvMonitored: true,
          cctvTag: "Sleeping / Lounge"
        },
        {
          num: "1.18",
          title: "Logging In as Available While Not at Workstation (Ghost Log)",
          description: "Setting station as Available or Working while physically away from workstation.",
          severity: "MAJOR",
          isCctvMonitored: true,
          cctvTag: "Ghost Logging"
        },
        {
          num: "1.23",
          title: "Leaving Company Premises During Shift Without Pass Slip or Gate Authorization",
          description: "Exiting company building during work hours without security gate pass or supervisor slip.",
          severity: "MAJOR",
          isCctvMonitored: true,
          cctvTag: "Unauthorized Exit"
        },
        {
          num: "1.28",
          title: "Sleeping While on Duty or During Work Hours",
          description: "Sleeping, dozing off, or assuming a reclining posture indicative of sleeping during work hours, shift schedule, or while on assigned station.",
          severity: "MAJOR",
          isCctvMonitored: true,
          cctvTag: "Sleeping"
        },
        {
          num: "1.34",
          title: "Unscheduled Stepping Out to Smoking or Vaping Areas Outside Permitted Windows",
          description: "Leaving production area to smoke or vape outside designated official break periods.",
          severity: "MINOR",
          isCctvMonitored: true,
          cctvTag: "Smoking Break"
        },
        {
          num: "1.42",
          title: "Prolonged Congregating at Time Clocks or Entrances Prior to Shift End",
          description: "Crowding at biometric terminals or exit turnstiles well before shift end to clock out early.",
          severity: "MINOR",
          isCctvMonitored: true,
          cctvTag: "Loitering at Exit"
        },
        {
          num: "1.57",
          title: "Refusal of Lawful Work Assignment, Shift Schedule, or Rotation from Management",
          description: "Declining assigned campaign, seat allocation, or shift rotation mandated by operations leadership.",
          severity: "MAJOR",
          isCctvMonitored: false
        }
      ]
    },
    {
      category: "2. Infractions Against Rules on Office Attire",
      policies: [
        {
          num: "2.01",
          title: "Wearing Prohibited Footwear or Slippers",
          description: "Wearing beach slippers, flip-flops, or prohibited casual slippers inside company production facilities.",
          severity: "MINOR",
          isCctvMonitored: true,
          cctvTag: "Dress Code",
          remindOnly: true
        },
        {
          num: "2.02",
          title: "Unauthorized Usage of Hoods, Caps, or Headwear",
          description: "Wearing hoods, caps, beanies, or head coverings on the production floor (Hijabs, Turbans, and verified religious headwear strictly excluded).",
          severity: "MINOR",
          isCctvMonitored: true,
          cctvTag: "Hoods/Caps",
          remindOnly: true
        },
        {
          num: "2.03",
          title: "Failure or Refusal to Comply with Prescribed Office Attire or Dress Code",
          description: "Failure to follow the company dress code policy, including sleeveless shirts, short pants, ripped garments, or missing company ID badge.",
          severity: "MINOR",
          isCctvMonitored: true,
          cctvTag: "Dress Code",
          remindOnly: true
        },
        {
          num: "2.04",
          title: "Bringing Prohibited Personal Grooming & Gadget Items to Operations Floor",
          description: "Bringing in mirrors, cosmetic/makeup products, nail cutters, personal cables, or unauthorized chargers to production desks.",
          severity: "MINOR",
          isCctvMonitored: true,
          cctvTag: "Personal Items",
          remindOnly: true
        },
        {
          num: "2.05",
          title: "Failure to Display or Wear Company Identification Badge (No ID)",
          description: "Entering or remaining on company production floors without visibly displaying company issued ID badge.",
          severity: "MINOR",
          isCctvMonitored: true,
          cctvTag: "No ID",
          remindOnly: true
        },
        {
          num: "2.06",
          title: "Wearing Sleeveless Attire, Tank Tops, Spaghetti Straps, or Revealing Clothes",
          description: "Wearing clothing items that violate professional business casual expectations.",
          severity: "MINOR",
          isCctvMonitored: true,
          cctvTag: "Dress Code",
          remindOnly: true
        },
        {
          num: "2.07",
          title: "Wearing Athletic Jerseys, Gym Shorts, or Pajama Pants on Operations Floor",
          description: "Wearing sports gym wear, basketball jerseys, or sleepwear inside company work premises.",
          severity: "MINOR",
          isCctvMonitored: true,
          cctvTag: "Dress Code",
          remindOnly: true
        },
        {
          num: "2.08",
          title: "Wearing Torn, Ripped, or Distressed Clothing",
          description: "Wearing pants or shirts with excessive fraying, intentional tears, or unkempt appearance.",
          severity: "MINOR",
          isCctvMonitored: true,
          cctvTag: "Dress Code",
          remindOnly: true
        }
      ]
    },
    {
      category: "3. Infractions Against Rules on Care of Company Property, Information and Premises",
      policies: [
        {
          num: "3.01",
          title: "Creating or Contributing to Unclean or Unsanitary Conditions",
          description: "Leaving trash, wrappers, clutter, or messy conditions in workstations, production aisles, or common areas.",
          severity: "MINOR",
          isCctvMonitored: true,
          cctvTag: "Unclean Conditions"
        },
        {
          num: "3.02",
          title: "Bringing Beverages Not in Spill-Preventive Containers",
          description: "Bringing cups, open glasses, or drinks without secure, spill-proof lids/tumblers into workstation areas.",
          severity: "MINOR",
          isCctvMonitored: true,
          cctvTag: "Open Beverages",
          remindOnly: true
        },
        {
          num: "3.03",
          title: "Eating in No-Eating Areas / Production Floor",
          description: "Consuming meals, snacks, or food in production lanes, computer desks, or unauthorized office areas.",
          severity: "MINOR",
          isCctvMonitored: true,
          cctvTag: "Eating in No-Eating Area"
        },
        {
          num: "3.04",
          title: "Unauthorized Entry to Specified or Restricted Areas",
          description: "Entering server rooms, comms cabinets, executive suites, or restricted operations sections without security clearance.",
          severity: "MAJOR",
          isCctvMonitored: true,
          cctvTag: "Unauthorized Entry"
        },
        {
          num: "3.05",
          title: "Unauthorized Bringing Out of Company Equipment",
          description: "Taking company-owned hardware, monitors, keyboards, headsets, or office assets outside company premises without gate pass.",
          severity: "GRAVE",
          isCctvMonitored: true,
          cctvTag: "Equipment Removal"
        },
        {
          num: "3.08",
          title: "Unauthorized Use of the Internet for Non-Business Related Activities",
          description: "Browsing social media, video streaming platforms, gaming sites, or personal websites during work hours on company workstations.",
          severity: "MAJOR",
          isCctvMonitored: true,
          cctvTag: "Internet Misuse"
        },
        {
          num: "3.14",
          title: "Leaving Confidential Documents, Customer Records, or Paper Slips Unattended on Desk (Clean Desk Policy)",
          description: "Violating clean-desk protocol by leaving client details, account numbers, or passwords written on paper.",
          severity: "MAJOR",
          isCctvMonitored: true,
          cctvTag: "Clean Desk Policy"
        },
        {
          num: "3.19",
          title: "Unauthorized Swapping of Computer Hardware or Peripherals",
          description: "Swapping keyboards, mice, cables, or company equipment without formal IT clearance or authorization.",
          severity: "MAJOR",
          isCctvMonitored: true,
          cctvTag: "Peripheral Swapping"
        },
        {
          num: "3.25",
          title: "Vandalizing Company Property or Defacing Equipment",
          description: "Writing on walls, scratching desks, tampering with security tags, or intentionally defacing company property.",
          severity: "MAJOR",
          isCctvMonitored: true,
          cctvTag: "Vandalism"
        },
        {
          num: "3.33",
          title: "Careless Handling or Negligent Damage to Company Property",
          description: "Dropping, pulling cables forcefully, slamming equipment, or damaging company peripherals through negligence.",
          severity: "MINOR",
          isCctvMonitored: true,
          cctvTag: "Negligent Handling"
        }
      ]
    },
    {
      category: "4. Infractions Against Rules on Accurate Reporting of Information",
      policies: [
        {
          num: "4.02",
          title: "Concealing Errors or Misrepresenting Operational Information",
          description: "Falsifying tracker entries, withholding critical incident details, or altering operational metrics.",
          severity: "MAJOR",
          isCctvMonitored: false
        },
        {
          num: "4.05",
          title: "Providing Misleading or False Statements During Company Investigation or Incident Audit",
          description: "Misleading CCTV investigators, HR representatives, or leadership during official inquiries.",
          severity: "GRAVE",
          isCctvMonitored: false
        },
        {
          num: "4.07",
          title: "Forging Manager or Supervisor Signature on Leave, Gate Pass, or Shift Authorizations",
          description: "Signing another leader's name on physical or digital clearance documents.",
          severity: "GRAVE",
          isCctvMonitored: false
        },
        {
          num: "4.09",
          title: "Clocking In or Swiping for Another Employee (Buddy Punching)",
          description: "Using another employee's biometric credentials, RFID badge, or PIN to register attendance.",
          severity: "GRAVE",
          isCctvMonitored: true,
          cctvTag: "Buddy Punching"
        },
        {
          num: "4.11",
          title: "Falsification of Time Records, Biometric Entries, or Shift Logs",
          description: "Clocking in or out dishonestly or intentionally misrepresenting shift attendance and break logs.",
          severity: "GRAVE",
          isCctvMonitored: true,
          cctvTag: "Attendance Falsification"
        },
        {
          num: "4.14",
          title: "Deliberate Failure to Report Known Operational Violations or Equipment Damage",
          description: "Concealing known damage to company property or shielding ongoing serious policy breaches.",
          severity: "MINOR",
          isCctvMonitored: false
        }
      ]
    },
    {
      category: "5. Infractions Against Rules on Conflict of Interest",
      policies: [
        {
          num: "5.01",
          title: "Unauthorized Use of Company Resources for Personal Business",
          description: "Using company PCs, internet, or facilities for personal commercial enterprise, freelancing, or secondary employment.",
          severity: "MAJOR",
          isCctvMonitored: true,
          cctvTag: "Personal Business"
        },
        {
          num: "5.03",
          title: "Soliciting Personal Loans, Commercial Sales, or Lending Business Inside Operations",
          description: "Promoting lending businesses, selling merchandise, or soliciting money among agents on company floor.",
          severity: "MAJOR",
          isCctvMonitored: true,
          cctvTag: "Commercial Solicitation"
        },
        {
          num: "5.07",
          title: "Conducting Unauthorized Financial or Commercial Transactions on Office Floor",
          description: "Trading currency, engaging in unregistered moneylending, or collecting bets inside office premises.",
          severity: "MAJOR",
          isCctvMonitored: true,
          cctvTag: "Financial Transactions"
        },
        {
          num: "5.12",
          title: "Engaging in Competing Business or Moonlighting During Shift",
          description: "Performing work for outside competing clients or entities during company working hours.",
          severity: "GRAVE",
          isCctvMonitored: false
        },
        {
          num: "5.18",
          title: "Utilizing Proprietary Customer Contact Lists for Private or External Use",
          description: "Extracting client contact databases or leads for personal marketing or external exploitation.",
          severity: "GRAVE",
          isCctvMonitored: false
        },
        {
          num: "5.27",
          title: "Undisclosed Secondary Employment Disrupting Scheduled Shift",
          description: "Holding conflicting jobs that cause fatigue, sleepiness on duty, or chronic scheduling issues.",
          severity: "MAJOR",
          isCctvMonitored: false
        }
      ]
    },
    {
      category: "6. Infractions Against Rules on General Behavior",
      policies: [
        {
          num: "6.01",
          title: "Disorderly Conduct, Roughness, or Horseplaying",
          description: "Engaging in physical roughness, wrestling, horseplaying, or disruptive pranks in operations or office corridors.",
          severity: "MAJOR",
          isCctvMonitored: true,
          cctvTag: "Horseplaying"
        },
        {
          num: "6.02",
          title: "Excessive Noise Levels Disrupting Operations",
          description: "Shouting, screaming, using speakerphones loudly, or making excessive noise that disrupts call center operations.",
          severity: "MINOR",
          isCctvMonitored: true,
          cctvTag: "Noise Levels"
        },
        {
          num: "6.03",
          title: "Non-Business Related Chitchatting During Shift",
          description: "Engaging in prolonged personal conversations or idle group chatter while active queues or tickets require handling.",
          severity: "MINOR",
          isCctvMonitored: true,
          cctvTag: "Chitchatting"
        },
        {
          num: "6.04",
          title: "Insubordination or Refusal to Comply with Lawful Instructions",
          description: "Direct refusal to follow reasonable directives from Team Leaders, Operations Managers, or Security personnel.",
          severity: "GRAVE",
          isCctvMonitored: false
        },
        {
          num: "6.05",
          title: "Bringing, Possessing, or Consuming Intoxicating Alcohol on Premises",
          description: "Possessing alcoholic drinks or consuming liquor anywhere inside company buildings or parking lots.",
          severity: "GRAVE",
          isCctvMonitored: true,
          cctvTag: "Alcohol"
        },
        {
          num: "6.07",
          title: "Physical Assault, Fighting, or Attempting to Inflict Bodily Harm",
          description: "Initiating or participating in fistfights, battery, or violent physical altercations on premises.",
          severity: "GRAVE",
          isCctvMonitored: true,
          cctvTag: "Physical Altercation"
        },
        {
          num: "6.09",
          title: "Sexual Harassment, Lewd Behavior, or Inappropriate Physical Contact",
          description: "Engaging in unwelcome advances, suggestive comments, or inappropriate touching in workplace.",
          severity: "GRAVE",
          isCctvMonitored: true,
          cctvTag: "Lewd Conduct"
        },
        {
          num: "6.10",
          title: "Gambling, Betting, or Playing Games of Chance on Company Premises",
          description: "Participating in card games for money, dice games, or sports betting pools inside the facility.",
          severity: "MAJOR",
          isCctvMonitored: true,
          cctvTag: "Gambling"
        },
        {
          num: "6.11",
          title: "Possessing Prohibited Weapons, Firearms, or Explosives on Premises",
          description: "Carrying blades, knives, firearms, or incendiary devices inside company buildings.",
          severity: "GRAVE",
          isCctvMonitored: true,
          cctvTag: "Weapons"
        },
        {
          num: "6.12",
          title: "Theft, Pilferage, or Unauthorized Possession of Property",
          description: "Taking personal belongings, headsets, wallets, or company assets without consent.",
          severity: "GRAVE",
          isCctvMonitored: true,
          cctvTag: "Theft"
        },
        {
          num: "6.13",
          title: "Smoking or Vaping in Non-Designated or Prohibited Areas",
          description: "Smoking cigarettes or using electronic vapes in stairwells, restrooms, or production floors.",
          severity: "MINOR",
          isCctvMonitored: true,
          cctvTag: "Smoking / Vaping"
        },
        {
          num: "6.17",
          title: "Using Mobile Phones or Personal Recording Devices on Operations Floor",
          description: "Bringing or actively using personal cellular phones, smartwatches with cameras, or cameras on the production floor.",
          severity: "MAJOR",
          isCctvMonitored: true,
          cctvTag: "Mobile Phone"
        },
        {
          num: "6.22",
          title: "Loitering or Idling Away from Assigned Station During Shift",
          description: "Wandering away from assigned station, gathering in hallways, locker areas, or unassigned production rows during work hours.",
          severity: "MINOR",
          isCctvMonitored: true,
          cctvTag: "Loitering"
        },
        {
          num: "6.28",
          title: "Instigating, Inciting, or Participating in Work Stoppage, Walkout, or Boycott",
          description: "Attempting to halt company customer support operations through concerted work stoppages.",
          severity: "GRAVE",
          isCctvMonitored: false
        }
      ]
    }
  ];

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

  function getDefaultDraft() {
    return {
      greeting: "Good morning TLs,",
      observation: "Observed an agent sleeping from 5:34:44 AM to 5:40:20 AM, with a total duration of approximately 5 minutes. Kindly file an NOC in accordance with the company COD. Thank you.",
      personInvolved: "",
      site: "Mabini Site A – Ground Floor",
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
        return { ...getDefaultDraft(), ...parsed };
      }
    } catch (e) {
      console.warn("Could not load CCTV report draft:", e);
    }
    return getDefaultDraft();
  }

  function saveDraft(draft) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
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

  function getCodeOfConduct() {
    return CODE_OF_CONDUCT;
  }

  function getCodeOfConductCount() {
    let total = 0;
    CODE_OF_CONDUCT.forEach(cat => {
      total += cat.policies ? cat.policies.length : 0;
    });
    return total;
  }

  function getPenaltyMatrix() {
    return PENALTY_MATRIX;
  }

  function searchCodeOfConduct(query = "", filterCategory = "all", filterSeverity = "all", monitoredOnly = false) {
    const q = String(query || "").trim().toLowerCase();
    const results = [];

    CODE_OF_CONDUCT.forEach((catGroup, catIdx) => {
      if (filterCategory !== "all" && String(catIdx) !== String(filterCategory)) {
        return;
      }

      const matchingPolicies = catGroup.policies.filter(pol => {
        if (filterSeverity !== "all" && pol.severity !== filterSeverity) {
          return false;
        }
        if (monitoredOnly && !pol.isCctvMonitored) {
          return false;
        }
        if (!q) return true;

        return (
          pol.num.toLowerCase().includes(q) ||
          pol.title.toLowerCase().includes(q) ||
          pol.description.toLowerCase().includes(q) ||
          pol.severity.toLowerCase().includes(q) ||
          (pol.cctvTag && pol.cctvTag.toLowerCase().includes(q))
        );
      });

      if (matchingPolicies.length > 0) {
        results.push({
          category: catGroup.category,
          categoryIndex: catIdx,
          policies: matchingPolicies
        });
      }
    });

    return results;
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
    if (diffSec < 0 || isOvernight) {
      diffSec += 24 * 3600;
    }

    // Round to whole minutes only (integer division, e.g. 5m 36s -> approximately 5 minutes)
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

    // 1. Extract CCTV Clip URLs
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const detectedUrls = [];
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
      detectedUrls.push(match[1]);
    }
    // Remove detected URLs from body text for clean parsing
    text = text.replace(urlRegex, " ").replace(/\s+/g, " ").trim();

    // 2. Extract Location
    let detectedLocation = "";
    const sitePatterns = [
      /\b(Mabini\s+Site\s+[AB])(?:\s*[–-]\s*|\s+)(Ground|1st|2nd|3rd|4th|5th|6th)?\s*(Floor)?\b/i,
      /\b(MAA)(?:\s*[–-]\s*|\s+)(5th|6th)?\s*(Floor)?\b/i,
      /\b(Ecoland(?:\s+Site)?)\b/i,
      /\b(Gensan(?:\s+Site)?)\b/i
    ];

    for (const pattern of sitePatterns) {
      const sMatch = text.match(pattern);
      if (sMatch) {
        if (sMatch[1].toLowerCase().includes("mabini")) {
          const site = sMatch[1].replace(/\s+/g, " ");
          const floor = sMatch[2] ? `${sMatch[2]} Floor` : "Ground Floor";
          detectedLocation = `${site} \u2013 ${floor}`;
        } else if (sMatch[1].toUpperCase() === "MAA") {
          const floor = sMatch[2] ? `${sMatch[2]} Floor` : "5th Floor";
          detectedLocation = `MAA \u2013 ${floor}`;
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
    const overnightDateTimePattern = /(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM))\s+(?:on\s+)?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|October|November|December)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s*(?:until|to|-|–)\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM))\s+(?:on\s+)?(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|October|November|December)[a-z]*\.?\s+)?(\d{1,2})(?:st|nd|rd|th)?(?!\s*:),?\s*(\d{4})?/i;
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
        detectedDate = `${monthFullName1} ${d1}\u2013${d2}, ${year}`;
      } else {
        detectedDate = `${monthFullName1} ${d1} \u2013 ${monthFullName2} ${d2}, ${year}`;
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
      const overnightPattern = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|October|November|December)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s*(?:-|–|to|until)\s*(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|October|November|December)[a-z]*\.?\s+)?(\d{1,2})(?:st|nd|rd|th)?(?!\s*:),?\s*(\d{4})?\b/i;
      const overMatch = text.match(overnightPattern);
      if (overMatch) {
        const m1 = overMatch[1];
        const d1 = overMatch[2];
        const d2 = overMatch[4];
        const year = overMatch[5] || "2026";
        const mIdx = MONTH_ABBR[m1.toLowerCase().replace(".", "")];
        const monthFullName = mIdx !== undefined ? MONTH_NAMES[mIdx] : m1;
        detectedDate = `${monthFullName} ${d1}\u2013${d2}, ${year}`;
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
      const intervalPattern = /(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM))\s*(?:to|until|-|–)\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM))/gi;
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
      actionRequest = `Kindly verify and file an NOC accordingly. Thank you.`;

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
      actionRequest = `Kindly verify and remind the agent to consume food only in designated dining areas in accordance with company COD. Thank you.`;

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
      actionRequest = `Kindly verify and inspect the workstation visibility accordingly. Thank you.`;

    } else {
      // General Objective Fallback
      let desc = parsed.cleanNotes || "an incident";
      if (desc.startsWith("Observed an agent")) {
        incidentNarrative = `${desc} ${timePhrase}.`.replace(/\.\.+$/, ".");
      } else {
        incidentNarrative = `Observed an agent ${desc} ${timePhrase}.`.replace(/\.\.+$/, ".");
      }
      actionRequest = `Kindly verify and take appropriate action in accordance with company COD. Thank you.`;
    }

    // Combine incident narrative and action request
    const fullObservation = `${incidentNarrative} ${actionRequest}`.trim();

    // Final Location
    const finalLocation = parsed.detectedLocation || existingDraft.site || "Mabini Site A – Ground Floor";

    // Final Date
    const finalDate = parsed.detectedDate || existingDraft.dateRange || "September 10, 2026";

    // Final Clip URLs
    let finalClip = existingDraft.clipUrl || "";
    if (parsed.detectedUrls.length > 0) {
      finalClip = parsed.detectedUrls.join("\n");
    }

    return {
      greeting: "Good morning TLs,",
      observation: fullObservation,
      personInvolved: existingDraft.personInvolved || "",
      site: finalLocation,
      dateRange: finalDate,
      clipUrl: finalClip,
      screenshots: existingDraft.screenshots || [],
      referencedPolicy: existingDraft.referencedPolicy || null,
      rawInput: rawInput
    };
  }

  // --- REPORT TEXT BUILDERS ---

  function parseClipUrls(clipUrlInput) {
    if (!clipUrlInput) return [];
    return String(clipUrlInput)
      .split(/[\n,]+/)
      .map(u => u.trim())
      .filter(u => !!u);
  }

  function buildReportPlainText(draft) {
    const d = draft || getDefaultDraft();
    const parts = [];

    if (d.greeting) {
      parts.push(d.greeting);
      parts.push("");
    }

    if (d.observation) {
      parts.push(d.observation);
      parts.push("");
    }

    const metaLines = [];
    if (d.personInvolved && d.personInvolved.trim()) {
      metaLines.push(`Person/Agent Involved: ${d.personInvolved.trim()}`);
    }
    if (d.site && d.site.trim()) {
      metaLines.push(`Location: ${d.site.trim()}`);
    }
    if (d.dateRange && d.dateRange.trim()) {
      metaLines.push(`Date: ${d.dateRange.trim()}`);
    }

    if (metaLines.length) {
      parts.push(metaLines.join("\n"));
      parts.push("");
    }

    const clips = parseClipUrls(d.clipUrl);
    if (clips.length === 1) {
      parts.push(`CCTV Clip: Click here! (${clips[0]})`);
    } else if (clips.length > 1) {
      clips.forEach((c, idx) => {
        parts.push(`CCTV Clip ${idx + 1}: Click here! (${c})`);
      });
    } else {
      parts.push("CCTV Clip: Click here!");
    }

    return parts.join("\n").trim();
  }

  function buildReportHtml(draft) {
    const d = draft || getDefaultDraft();
    const esc = (val) => String(val == null ? "" : val)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const htmlParts = [];

    // Greeting
    if (d.greeting) {
      htmlParts.push(`<div>${esc(d.greeting)}</div><br>`);
    }

    // Body / Observation
    if (d.observation) {
      const formattedBody = esc(d.observation).replace(/\r?\n/g, "<br>");
      htmlParts.push(`<div>${formattedBody}</div><br>`);
    }

    // Location & Date metadata
    if (d.personInvolved && d.personInvolved.trim()) {
      htmlParts.push(`<div><strong>Person/Agent Involved:</strong> ${esc(d.personInvolved.trim())}</div>`);
    }
    if (d.site && d.site.trim()) {
      htmlParts.push(`<div><strong>Location:</strong> ${esc(d.site.trim())}</div>`);
    }
    if (d.dateRange && d.dateRange.trim()) {
      htmlParts.push(`<div><strong>Date:</strong> ${esc(d.dateRange.trim())}</div>`);
    }

    if (d.personInvolved || d.site || d.dateRange) {
      htmlParts.push("<br>");
    }

    // Screenshots container
    if (Array.isArray(d.screenshots) && d.screenshots.length > 0) {
      d.screenshots.forEach((shot, i) => {
        const src = typeof shot === "string" ? shot : (shot.data || shot.url || "");
        if (src) {
          htmlParts.push(`<div style="margin: 8px 0;"><img src="${src}" alt="CCTV Screenshot ${i + 1}" style="max-width: 620px; width: 100%; height: auto; border: 1px solid #cbd5e1; border-radius: 4px; display: block;" /></div>`);
        }
      });
      htmlParts.push("<br>");
    }

    // CCTV Clip hyperlinks
    const clips = parseClipUrls(d.clipUrl);
    if (clips.length === 1) {
      htmlParts.push(`<div><strong>CCTV Clip:</strong> <a href="${esc(clips[0])}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: underline; font-weight: 600;">Click here!</a></div>`);
    } else if (clips.length > 1) {
      clips.forEach((c, idx) => {
        htmlParts.push(`<div><strong>CCTV Clip ${idx + 1}:</strong> <a href="${esc(c)}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: underline; font-weight: 600;">Click here!</a></div>`);
      });
    } else {
      htmlParts.push(`<div><strong>CCTV Clip:</strong> <span style="color: #94a3b8; font-style: italic;">Click here!</span></div>`);
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

  return {
    getDraft,
    saveDraft,
    resetDraft,
    getCodeOfConduct,
    getCodeOfConductCount,
    getPenaltyMatrix,
    searchCodeOfConduct,
    parseQuickCompose,
    generateReport,
    buildReportPlainText,
    buildReportHtml,
    copyAll
  };
})();

window.CctvReportService = window.CCTV_REPORT_SERVICE;
