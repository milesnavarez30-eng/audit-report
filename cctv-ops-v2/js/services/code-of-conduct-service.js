/**
 * CCTV OPS V2 - Code of Conduct Rule Book Service
 * Authoritative 165-policy dataset, disciplinary matrix, smart relevance search & section filters.
 */

window.CCTV_CONDUCT = (function () {
  "use strict";

  // Authoritative Disciplinary Penalty Matrix
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

  const CODE_OF_CONDUCT = [
    {
      category: "1. Rules on Attendance, Punctuality, Working Hours and Work Assign",
      policies: [
        {
          num: "1.01",
          title: "Frequent Tardiness",
          description: "Reporting late three (3) times within one calendar month.",
          severity: "MINOR"
        },
        {
          num: "1.02",
          title: "Deviation from Approved Leave dates",
          description: "Failure to follow the dates indicated on an approved leave of absence.",
          severity: "MINOR"
        },
        {
          num: "1.03",
          title: "Wasting Time During Official Working Hours",
          description: "Engaging in non-work activities such as unnecessary loitering, excessive chatting, stretching break periods, playing computer games, or entertaining visitors for prolonged periods, whether inside company premises or at any assigned workplace.",
          severity: "MINOR"
        },
        {
          num: "1.04",
          title: "Deviation from Approved Itinerary",
          description: "Changing or deviating from pre-approved itinerary without prior notice to and from a higher authority.",
          severity: "MINOR"
        },
        {
          num: "1.05",
          title: "Failure to Perform Assigned Task or Obey Official Instructions",
          description: "Refusing or failing to do assigned task, official instructions, or orders, or to follow established policies, rules and procedures. (For security guards: This includes failure to do body frisking and/or inspection duties within the area of responsibility.)",
          severity: "MINOR"
        },
        {
          num: "1.06",
          title: "Failure to Cooperate with Team Members",
          description: "Not cooperating with colleagues in the completion of assigned work/project.",
          severity: "MINOR"
        },
        {
          num: "1.07",
          title: "Driving or Riding Motorcycle Without Using a Helmet",
          description: "Operating or riding a motorcycle without the required motorcycle helmet.",
          severity: "MINOR"
        },
        {
          num: "1.08",
          title: "Tardiness In Attending Mandatory Meetings and/or Company Activities",
          description: "Arriving late to compulsory meetings or officially scheduled Company activities.",
          severity: "MINOR"
        },
        {
          num: "1.09",
          title: "Failure to Follow or Enforce the English Only Policy (EOP)",
          description: "Not complying with, implementing, or enforcing the English Only Policy (EOP) within the call center work area.",
          severity: "MINOR"
        },
        {
          num: "1.10",
          title: "Failure to Conduct Daily Pre-Shift or Post-Shift Meetings",
          description: "Failure to Conduct Daily Pre-Shift or Post-Shift Meetings",
          severity: "MINOR"
        },
        {
          num: "1.11",
          title: "Failure to Return to Work After Approved Undertime or Break Without Notice or Valid Reason",
          description: "Not returning to duty after an approved undertime or break period without prior notice, permission, or a justifiable reason.",
          severity: "MINOR"
        },
        {
          num: "1.12",
          title: "Inclusion in the Internal Business Review (IBR) watchlist",
          description: "Inclusion in the Internal Business Review (IBR) watchlist",
          severity: "MINOR"
        },
        {
          num: "1.14",
          title: "Failure to Prepare for A Call Conference, Virtual Meeting Or Face To Face Meeting.",
          description: "Not completing necessary preparations or requirements to a scheduled call conference, virtual meeting, or in-person meeting.",
          severity: "MINOR"
        },
        {
          num: "1.15",
          title: "Failure to Observe Inter-Departmental Regulations or Procedures",
          description: "Not adhering to established rules, procedures, or protocols governing coordination between departments.",
          severity: "MINOR"
        },
        {
          num: "1.16",
          title: "Failure in Workforce Certification",
          description: "Failure in Workforce Certification",
          severity: "MINOR"
        },
        {
          num: "1.17",
          title: "Non-Compliance or Non-Submission of Required Reports and Certifications",
          description: "Failure to comply with required procedures, formats, or certifications, or failure to submit required reports, including: Daily End-of-Day (EOD) reports Eight transaction audits per day",
          severity: "MINOR"
        },
        {
          num: "1.18",
          title: "Absence Without Official Leave (AWOL)",
          description: "Absence from work without official notice, authorization, or approval.",
          severity: "MAJOR"
        },
        {
          num: "1.19",
          title: "Abandonment of Post",
          description: "Not returning to duty after an approved undertime or break period without prior notice, permission, or a justifiable reason.",
          severity: "MAJOR"
        },
        {
          num: "1.20",
          title: "Refusal to Prepare for A Call Conference, Virtual Meeting Or Face To Face Meeting with Clients, Associates, Stakeholders and Visitors.",
          description: "Not completing necessary preparations or requirements to a scheduled call conference, virtual meeting, or in-person meeting.",
          severity: "MAJOR"
        },
        {
          num: "1.21",
          title: "Refusal to Conduct Daily Pre-Shift or Post-Shift Meetings",
          description: "Refusal to Conduct Daily Pre-Shift or Post-Shift Meetings",
          severity: "MAJOR"
        },
        {
          num: "1.22",
          title: "Refusal to Return to Work After Approved Undertime or Break Without Notice or Valid Reason",
          description: "Not returning to duty after an approved undertime or break period without prior notice, permission, or a justifiable reason.",
          severity: "MAJOR"
        },
        {
          num: "1.23",
          title: "Excessive Unapproved Absences",
          description: "Accumulating six (6) unapproved absences, whether notified or not, within a 90-day period or three (3) calendar months.",
          severity: "MAJOR"
        },
        {
          num: "1.24",
          title: "Failure to Assign a Reliever During Absence or Leave",
          description: "Not designating or arranging for a reliever during a scheduled absence or approved leave, as required.",
          severity: "MAJOR"
        },
        {
          num: "1.25",
          title: "Undertime Without Prior Approval",
          description: "Leaving the work area or work assignment without prior permission during work hours or before scheduled end of shift.",
          severity: "MAJOR"
        },
        {
          num: "1.26",
          title: "Unjustified Refusal to Report for Work or to Render Scheduled Overtime",
          description: "Failing or refusing to report for duty, or to render pre-arranged and agreed-upon overtime work without valid reason.",
          severity: "MAJOR"
        },
        {
          num: "1.27",
          title: "Refusal to Comply with an Official Order of Transfer or Rotation",
          description: "Deliberately refusing or failing to accept or comply with an official order to transfer or rotate to another job, work station or workplace.",
          severity: "MAJOR"
        },
        {
          num: "1.28",
          title: "Sleeping While on Duty or During Work Hours",
          description: "Sleeping or dozing off while on duty or during official working hours.",
          severity: "MAJOR"
        },
        {
          num: "1.29",
          title: "Gambling During Work Hours",
          description: "Engaging in gambling activities such as collecting or placing bets or participating in any game of chance during working hours, or within company premises or any area under the company's jurisdiction.",
          severity: "MAJOR"
        },
        {
          num: "1.30",
          title: "Unauthorized or Unofficial Activity/Work",
          description: "Performing unauthorized work or activities within company premises or during working hours, including personal tasks, loafing, loitering, or engaging in activities that disrupt others' work.",
          severity: "MAJOR"
        },
        {
          num: "1.31",
          title: "Unauthorized Entry or Use of Restricted Area",
          description: "Entering restricted areas or using such areas without authorization, or assisting another person in doing so. Restricted areas include departmental offices, inventory rooms, and any room with designated or limited access.",
          severity: "MAJOR"
        },
        {
          num: "1.32",
          title: "Malingering or Feigning Illness",
          description: "Providing false excuse(s) for a leave of absence or pretending to be sick to avoid work responsibilities.",
          severity: "MAJOR"
        },
        {
          num: "1.33",
          title: "Habitual Negligence of duty",
          description: "Repeated lapses in the practice of diligence or consistent failure to perform duties and responsibilities.",
          severity: "MAJOR"
        },
        {
          num: "1.34",
          title: "Refusal to Comply with Security Requirements",
          description: "Deliberate failure or refusal to comply with security procedures of the company including mandatory body frisking by security personnel when entering or exiting of the Company premises.",
          severity: "MAJOR"
        },
        {
          num: "1.35",
          title: "Refusal to Cooperate with Team Members",
          description: "Not cooperating with colleagues in the completion of assigned work/project.",
          severity: "MAJOR"
        },
        {
          num: "1.36",
          title: "Failure to Prepare for A Call Conference, Virtual Meeting Or Face To Face Meeting.",
          description: "Not completing necessary preparations or requirements to a scheduled call conference, virtual meeting, or in-person meeting.",
          severity: "MAJOR"
        },
        {
          num: "1.37",
          title: "Failure To Attend Mandatory Meetings and/or Company Activities",
          description: "Being absent from compulsory meetings or officially scheduled Company activities without valid reason.",
          severity: "MAJOR"
        },
        {
          num: "1.38",
          title: "Malingering or Feigning Illness",
          description: "Providing false excuse(s) for a leave of absence or pretending to be sick to avoid work responsibilities.",
          severity: "MAJOR"
        },
        {
          num: "1.39",
          title: "Habitual Negligence of duty",
          description: "Repeated lapses in the practice of diligence or consistent failure to perform duties and responsibilities.",
          severity: "MAJOR"
        },
        {
          num: "1.40",
          title: "Refusal to Comply with Security Requirements",
          description: "Deliberate failure or refusal to comply with security procedures of the company including mandatory body frisking by security personnel when entering or exiting of the Company premises.",
          severity: "MAJOR"
        },
        {
          num: "1.41",
          title: "Refusal to Cooperate with Team Members",
          description: "Not cooperating with colleagues in the completion of assigned work/project.",
          severity: "MAJOR"
        },
        {
          num: "1.42",
          title: "Failure to Prepare for A Call Conference, Virtual Meeting Or Face To Face Meeting.",
          description: "Not completing necessary preparations or requirements to a scheduled call conference, virtual meeting, or in-person meeting.",
          severity: "MAJOR"
        },
        {
          num: "1.43",
          title: "Failure To Attend Mandatory Meetings and/or Company Activities",
          description: "Being absent from compulsory meetings or officially scheduled Company activities without valid reason.",
          severity: "MAJOR"
        },
        {
          num: "1.44",
          title: "Failure to Promptly Advise (Within 24 Hours) on Payroll or Benefits Updates",
          description: "Includes failing to notify concerned departments regarding exclusion from payroll or removal of benefits for resigned, AWOL, or terminated employees.",
          severity: "MAJOR"
        },
        {
          num: "1.45",
          title: "Failure to Report Security Incidents",
          description: "Failure to report incidents such as theft or other security breaches affecting the building; must be reported within one hour after the incident.",
          severity: "MAJOR"
        },
        {
          num: "1.46",
          title: "Submission of an Inaccurate Cycle Report",
          description: "Submission of an Inaccurate Cycle Report",
          severity: "MAJOR"
        },
        {
          num: "1.47",
          title: "Failure To Update the White List or Black List with The IT Department Every Six (6) Months",
          description: "Failure To Update the White List or Black List with The IT Department Every Six (6) Months",
          severity: "MAJOR"
        },
        {
          num: "1.48",
          title: "Non-Compliance In the Daily Submission of Call Recordings or Audio Files To Sixeleven QA Department.",
          description: "Non-Compliance In the Daily Submission of Call Recordings or Audio Files To Sixeleven QA Department.",
          severity: "MAJOR"
        },
        {
          num: "1.49",
          title: "Failure to Notify HR About Subordinate Absences Within The Duration Of The Shift",
          description: "Failure to Notify HR About Subordinate Absences Within The Duration Of The Shift",
          severity: "MAJOR"
        },
        {
          num: "1.50",
          title: "Failure to Promptly Advise (Within 24 Hours) on Payroll or Benefits Updates",
          description: "Includes failing to notify concerned departments regarding exclusion from payroll or removal of benefits for resigned, AWOL, or terminated employees.",
          severity: "MAJOR"
        },
        {
          num: "1.51",
          title: "Acts of Insubordination",
          description: "Refusing to obey lawful and reasonable orders or instructions given by immediate supervisor or authorized Company officers.",
          severity: "GRAVE"
        },
        {
          num: "1.52",
          title: "Refusal to Submit to Mandatory Drug Testing",
          description: "Failure or refusal to undergo a drug test when chosen in a mandatory random sampling.",
          severity: "GRAVE"
        },
        {
          num: "1.53",
          title: "Abandonment of Work",
          description: "Absence from work without notice, authorization, or approval for four (4) or more consecutive working days, without official explanation received to one's immediate superior.",
          severity: "GRAVE"
        },
        {
          num: "1.54",
          title: "Non-Usage of the Biometrics System",
          description: "Failing or refusing to use the biometrics system for entry or exit of company premises.",
          severity: "GRAVE"
        },
        {
          num: "1.55",
          title: "Borrowing or Lending of Biometrics Log-ins",
          description: "Borrowing, lending, or sharing biometrics credentials or log-in information with another employee for unauthorized use.",
          severity: "GRAVE"
        },
        {
          num: "1.56",
          title: "Manipulation or Alteration of Attendance Records",
          description: "Entering or leaving Company premises or work assignment without punching in/out via biometrics system, or altering attendance records without prior approval from the immediate superior.",
          severity: "GRAVE"
        },
        {
          num: "1.57",
          title: "Improper, Unauthorized, or Fraudulent Use of Biometrics",
          description: "Including, but not limited to: Punching in or out on behalf of another employee Requesting another employee to punch in or out on one's behalf Tampering with or altering one's own time record or another employee's time record",
          severity: "GRAVE"
        }
      ]
    },
    {
      category: "2. Infractions Against Rules on Office Attire",
      policies: [
        {
          num: "2.01",
          title: "Alteration or Improper Wearing of Prescribed Company Uniform",
          description: "Modifying, altering, or wearing the prescribed company uniform improperly.",
          severity: "MINOR"
        },
        {
          num: "2.02",
          title: "Failure or Refusal to Wear Company Uniform, I.D., Shoes, or Prescribed Safety/Security Gear",
          description: "Not wearing any item of the required uniform or designated safety/security equipment while on duty.",
          severity: "MINOR"
        },
        {
          num: "2.03",
          title: "Failure or Refusal to Comply with Prescribed Office Attire or Dress Code",
          description: "Failure or Refusal to Comply with Prescribed Office Attire or Dress Code",
          severity: "MINOR"
        },
        {
          num: "2.04",
          title: "Wearing Sun Glasses Inside Operations Beyond the Guard Biometrics Area",
          description: "Wearing Sun Glasses Inside Operations Beyond the Guard Biometrics Area",
          severity: "MINOR"
        },
        {
          num: "2.05",
          title: "Wearing of Hats, Caps, Bonnets and Similar Headgear Beyond the Guard Biometrics Area",
          description: "Using unauthorized head coverings in operational areas past the guard check or biometrics point.",
          severity: "MINOR"
        },
        {
          num: "2.06",
          title: "Failure to Update Company ID, Wearing Outdated or Damaged Company ID",
          description: "Using an outdated, expired, torn, broken, or otherwise damaged company ID within the workplace.",
          severity: "MAJOR"
        },
        {
          num: "2.07",
          title: "Improper Display or Wearing of ID",
          description: "Wearing or displaying the company ID improperly, such as covering it with keys, stuffed toys, stickers, or similar items that obstruct identification.",
          severity: "MAJOR"
        },
        {
          num: "2.08",
          title: "Unauthorized Use of Head-Covering Apparel on the Production Floor",
          description: "Wearing hoods, caps, wigs, bandanas, balaclavas, tinted or colored eyewear, sports eyewear, colored goggles, costume masks, or similar items that cover the head or face while on shift in the production area. Note: Hijabs and turbans are permitted and not included in this restriction.",
          severity: "MAJOR"
        }
      ]
    },
    {
      category: "3. Infractions Against Rules on Care of Company Property, Information and Premises",
      policies: [
        {
          num: "3.01",
          title: "Creating or Contributing to Unclean or Unsanitary Conditions",
          description: "Engaging in any act that causes or contributes to disorderly, messy, or unhygienic conditions within company premises.",
          severity: "MINOR"
        },
        {
          num: "3.02",
          title: "Failure to Immediately Report Defective Equipment or Facilities",
          description: "Not promptly reporting defects, malfunctions, or damages in company equipment or facilities, whether operated by the employee or noticed during work.",
          severity: "MINOR"
        },
        {
          num: "3.03",
          title: "Failure To Report Any Wastage, Breakage, Loss or Damage Within Twenty-Four (24) Hours",
          description: "Not reporting any instance of wastage, breakage, loss or damage within twenty-four (24) hours of its occurrence or discovery. Note: Disciplinary action may vary depending on the value of the item and the severity of consequences.",
          severity: "MINOR"
        },
        {
          num: "3.04",
          title: "Failure To Observe Housekeeping and Sanitary Rules",
          description: "Not complying with established cleanliness and sanitation standards within Company premises or its immediate vicinity, including: a.) spitting or littering b.) unsanitary handling of service utensils or equipment c.) urinating within company premises other than designated toilets d.) improper or unhygienic use of toilets and lavatories, including improper disposal of litter, waste, refuse, garbage or trash",
          severity: "MINOR"
        },
        {
          num: "3.05",
          title: "Failure to Turn Off Office Equipment After Use",
          description: "Not turning off computers, projectors, air-conditioning units, lights, speakers, CPUs, or other office equipment after use or before leaving the work area when required.",
          severity: "MINOR"
        },
        {
          num: "3.06",
          title: "Using A Locker Without a Personal Padlock",
          description: "Using A Locker Without a Personal Padlock",
          severity: "MINOR"
        },
        {
          num: "3.07",
          title: "Unauthorized Reservation of Lockers",
          description: "Reserving, holding, or occupying lockers without proper approval or assignment.",
          severity: "MINOR"
        },
        {
          num: "3.08",
          title: "Unauthorized Use of the Internet",
          description: "Using company internet access for non-business-related activities.",
          severity: "MINOR"
        },
        {
          num: "3.09",
          title: "Bringing or Consuming Food in Unauthorized Areas",
          description: "Eating or bringing food especially those with strong odors (e.g., cup noodles, rice meals) or liquid drinks not in spill-preventive containers into areas where eating is prohibited, including High Security Areas and other restricted zones.",
          severity: "MAJOR"
        },
        {
          num: "3.10",
          title: "Sending Trivial or Personal Messages (Spam / Group Email / Junk Mail)",
          description: "Sending trivial, personal, spam, \"for-profit,\" or chain messages; subscribing to nonbusiness-related email groups or newsletters (i.e. Slack, MS Teams and other platforms).",
          severity: "MAJOR"
        },
        {
          num: "3.11",
          title: "Sending Emails with Illegal or Pornographic Attachments",
          description: "Transmitting or forwarding emails that contain illegal, pornographic, or otherwise prohibited attachments or materials.",
          severity: "MAJOR"
        },
        {
          num: "3.12",
          title: "Importing or Copying Unauthorized Files or Software",
          description: "Importing, downloading, copying, or forwarding non-text filesâ€”such as applications, utilities, images, music, or internet pagesâ€”through unauthorized storage devices or without proper approval.",
          severity: "MAJOR"
        },
        {
          num: "3.13",
          title: "Playing Computer Games on Company-Owned Equipment",
          description: "Playing computer games using company PCs or devices, including those that come with the Operating Systems package.",
          severity: "MAJOR"
        },
        {
          num: "3.14",
          title: "Abuse or Misuse of AUX Status",
          description: "Using AUX beyond the approved time, entering incorrect AUX codes to avoid calls or delay work, or going on AUX without authorization.",
          severity: "MAJOR"
        },
        {
          num: "3.15",
          title: "Vandalism or Damage to Company Property",
          description: "Disfiguring, mutilating, vandalizing, removing, painting, marking, or causing unauthorized changes to company property, buildings, structures, or equipment.",
          severity: "MAJOR"
        },
        {
          num: "3.16",
          title: "Smoking in Prohibited Areas",
          description: "Smoking in \"no-smoking\" areas within company premises or during official functions where smoking is restricted.",
          severity: "MAJOR"
        },
        {
          num: "3.17",
          title: "Negligence Resulting in Loss, Damage, or Harm",
          description: "Acts of carelessness or failure to follow procedures that result in loss, damage to company property, reputational harm, or negative impact on clients or third parties.",
          severity: "MAJOR"
        },
        {
          num: "3.18",
          title: "Violation of Safety Rules and Regulations",
          description: "Failing to follow established company safety policies, rules, or procedures.",
          severity: "MAJOR"
        },
        {
          num: "3.19",
          title: "Unauthorized Removal of Safety Signs or Devices",
          description: "Removing, altering, or disabling safety signs, barriers, labels, or safety devices without management approval.",
          severity: "MAJOR"
        },
        {
          num: "3.20",
          title: "Failure to Secure High Security Area Entrances",
          description: "Not closing or locking entry points to High Security Areas, resulting in unnecessary security exposure.",
          severity: "MAJOR"
        },
        {
          num: "3.21",
          title: "Failure to Maintain Cleanliness in Technical Rooms",
          description: "Not maintaining cleanliness or proper organization in IT Rooms, Server Rooms, or UPS Rooms.",
          severity: "MAJOR"
        },
        {
          num: "3.22",
          title: "Refusal to Immediately Report Defective Equipment or Facilities",
          description: "Not promptly reporting defects, malfunctions, or damages in company equipment or facilities, whether operated by the employee or noticed during work.",
          severity: "MAJOR"
        },
        {
          num: "3.23",
          title: "Carrying Out Fraudulent Transactions Using Company Systems",
          description: "Performing or attempting to perform fraudulent transactions using company computers, systems, networks, or data, whether conducted inside or outside the company network.",
          severity: "GRAVE"
        },
        {
          num: "3.24",
          title: "Unauthorized Disclosure of Login Credentials",
          description: "Disclosing or sharing personal or client login IDs, passwords, or authentication details with any individual without proper authorization.",
          severity: "GRAVE"
        },
        {
          num: "3.25",
          title: "Unauthorized Use of Another Person's Account or Credentials",
          description: "Using or attempting to use another person's computer account, network account, ID, password, or system authorization.",
          severity: "GRAVE"
        },
        {
          num: "3.26",
          title: "Tampering With Computer System Settings or Configurations",
          description: "Tampering with, altering, or improperly modifying computer configuration files, system settings, or security setups (e.g., autoexec.bat, config.sys, OS desktop settings, client program configurations, security configurations).",
          severity: "GRAVE"
        },
        {
          num: "3.27",
          title: "Information Hacking or Unauthorized Data Access/Modification",
          description: "Hacking, accessing, copying, creating, renaming, modifying, deleting, or otherwise interfering with any company or client system, directory, file, utility, or software application without authorization.",
          severity: "GRAVE"
        },
        {
          num: "3.28",
          title: "Allowing Unauthorized Individuals to Access Company Areas or Systems",
          description: "Allowing, inviting, encouraging, or giving tacit consent for outsiders or unauthorized persons to gain access to company premises, systems, or equipment, resulting in or potentially leading to damage or security risks.",
          severity: "GRAVE"
        },
        {
          num: "3.29",
          title: "Unauthorized Removal, Copying, or Destruction of Company Records or Equipment",
          description: "Removing, copying, reproducing, taking, or destroying official company records, files, information, or equipment without proper authorization.",
          severity: "GRAVE"
        },
        {
          num: "3.30",
          title: "Unauthorized Disclosure of Confidential or Proprietary Information",
          description: "Disclosing, leaking, exposing, or revealing company trade secrets, confidential information, proprietary records, documents, or data to unauthorized individuals or external parties.",
          severity: "GRAVE"
        },
        {
          num: "3.31",
          title: "Unauthorized Removal of Company Property",
          description: "Bringing out company equipment, files, records, documents, or any company-owned property without proper authorization.",
          severity: "GRAVE"
        },
        {
          num: "3.32",
          title: "Concealing or Covering Up Work-Related Errors",
          description: "Concealing, hiding, or covering up mistakes in workâ€”whether one's own or a co-worker'sâ€”that result in loss, damage, or harm to the company.",
          severity: "GRAVE"
        },
        {
          num: "3.33",
          title: "Omni Channel Avoidance / Queue Avoidance",
          description: "Avoiding, delaying, or refusing calls or queue assignments without authorization. (i.e. call, chats, emails, social media, tickets and all verticals)",
          severity: "GRAVE"
        }
      ]
    },
    {
      category: "4. Infractions Against Rules on Accurate Reporting of Information",
      policies: [
        {
          num: "4.01",
          title: "Failure To Notify Supervisor Or HRD",
          description: "Failure to notify supervisor or HRD of changes in personal data within seven (7) working days from said changes.",
          severity: "MINOR"
        },
        {
          num: "4.02",
          title: "Failure in Providing Required Information",
          description: "Failure in providing known and necessary information or failing to give due notification to the concerned person(s), resulting in loss or damage to Company property or harm to the Company's name and reputation.",
          severity: "MINOR"
        },
        {
          num: "4.03",
          title: "Failure to reply or acknowledge an email, chat or notification within 24 hours to client and stakeholders.",
          description: "Failure to reply or acknowledge an email, chat or notification within 24 hours to client and stakeholders.",
          severity: "MINOR"
        },
        {
          num: "4.04",
          title: "Refusal to Disclose Affliction",
          description: "Refusal to disclose within five (5) days from discovery of affliction, any infectious or contagious ailment.",
          severity: "MAJOR"
        },
        {
          num: "4.05",
          title: "Furnishing False or Misleading Information",
          description: "Furnishing the Company and/or its employees with false information; or knowingly providing false, misleading, or grossly inaccurate data due to neglect or failure to conduct proper research or verification.",
          severity: "MAJOR"
        },
        {
          num: "4.06",
          title: "Refusal in Providing Required Information",
          description: "Refusal in providing known and necessary information or failing to give due notification to the concerned person(s), resulting in loss or damage to Company property or harm to the Company's name and reputation.",
          severity: "MAJOR"
        },
        {
          num: "4.07",
          title: "Putting Unauthorized Materials",
          description: "Putting up and/or writing unauthorized posters, messages, propaganda or graffiti on walls, halls corridors, bulletin boards and other area within Company premises.",
          severity: "MAJOR"
        },
        {
          num: "4.08",
          title: "Defacing Company Materials",
          description: "Defacing or removing company posters, signs, notices, memoranda, or announcements from bulletin boards or other designated areas.",
          severity: "MAJOR"
        },
        {
          num: "4.09",
          title: "Failure to circulate Client Memos/Updates (within 48 hours)",
          description: "Failure to circulate Client Memos/Updates (within 48 hours)",
          severity: "MAJOR"
        },
        {
          num: "4.10",
          title: "Failure to Report Security-Related Incidents",
          description: "Failure to report incidents such as theft or similar events that may affect building security within one (1) hour from occurrence.",
          severity: "MAJOR"
        },
        {
          num: "4.11",
          title: "Giving False Testimony During an Official Investigation Authorized by the Company.",
          description: "Giving False Testimony During an Official Investigation Authorized by the Company.",
          severity: "GRAVE"
        },
        {
          num: "4.12",
          title: "Spreading Rumors or Derogatory Statements",
          description: "Spreading rumors or derogatory, malicious, or libelous statementsâ€”whether spoken, written, or posted on social media that criticize, discredit, damage, or undermine the honor, integrity, reputation, or good name of the Company, its management, stockholders, or employees.",
          severity: "GRAVE"
        },
        {
          num: "4.13",
          title: "Making Defamatory or False Statements or Comments About the Company",
          description: "Making nasty, malicious or false statements or comments about the Company and/or its products and/or services, including but not limited to posting on social media like Facebook, Twitter, and similar sites.",
          severity: "GRAVE"
        },
        {
          num: "4.14",
          title: "Falsification of Documents",
          description: "Falsification of documents, including those committed during pre-employment or pre-regular physical examination, as well as falsification of any reports or documents submitted at any time during the course of employment with the Company.",
          severity: "GRAVE"
        }
      ]
    },
    {
      category: "5. Infractions Against Rules on Conflict of Interest",
      policies: [
        {
          num: "5.01",
          title: "UNAUTHORIZED USE OF OFFICE SUPPLIES",
          description: "Unauthorized use of stocks, inventory, office supplies, materials, food, or leftovers that are the property of the Company. This includes taking office supplies, equipment, materials, or products home without proper authorization.",
          severity: "MINOR"
        },
        {
          num: "5.02",
          title: "Failure to Report or Surrender Found Items",
          description: "Failure to immediately report and surrender to management any articles found on Company premises, regardless of their value.",
          severity: "MINOR"
        },
        {
          num: "5.03",
          title: "Unauthorized Retention of Sales Documents",
          description: "Keeping sales documents, including duplicate copies of sales invoices, order slips, or similar materials, without proper permission or authority.",
          severity: "MINOR"
        },
        {
          num: "5.04",
          title: "Failure to follow liquidation process",
          description: "Failure to comply with liquidation protocols within 5 days after the activity.",
          severity: "MINOR"
        },
        {
          num: "5.05",
          title: "Unauthorized Solicitations or Collection",
          description: "Engaging in unauthorized solicitation or collection activities during work hours or within Company premises, including entertaining personal solicitations without proper approval. This includes asking for or borrowing money from co-workers or soliciting any form of contribution without authorization.",
          severity: "MAJOR"
        },
        {
          num: "5.06",
          title: "Failure of Supervisor to Report Infractions",
          description: "Failure of a supervisor or manager to take action or report, any employee violation against the Code of Conduct or Company policies.",
          severity: "MAJOR"
        },
        {
          num: "5.07",
          title: "Holding Unauthorized Meeting",
          description: "Holding unauthorized meeting or any gathering, or assembly within Company premises or any area within its jurisdiction; or conducting unauthorized or unofficial activity during working hours.",
          severity: "MAJOR"
        },
        {
          num: "5.08",
          title: "Abuse of Authority",
          description: "Use of one's authority to compel subordinates to perform acts not official in nature, or in doing so using Company time and/or Company authority.",
          severity: "MAJOR"
        },
        {
          num: "5.09",
          title: "Unauthorized Use of Company Property, Vehicles, or Equipment",
          description: "Operating, using, interfering with, or allowing unauthorized persons to use Company materials, vehicles, tools, supplies, equipment, facilities or premises resulting in loss, damage, or misuse, or using items which the employee is not assigned or is authorized to use.",
          severity: "MAJOR"
        },
        {
          num: "5.10",
          title: "Failure to Report Erroneous Payments",
          description: "Failure to report within 48 hours after an employee has received an erroneous payment or overpayment of commission, allowance, salary, reimbursement or any other form of remuneration.",
          severity: "MAJOR"
        },
        {
          num: "5.11",
          title: "Unauthorized Substitution or Misplacement of Company Property",
          description: "Unauthorized substitution of any Company materials, tools, equipment or facilities, or unauthorized use, possession, removal, concealment, or deliberate misplacement of any Company property.",
          severity: "MAJOR"
        },
        {
          num: "5.12",
          title: "Disclosure of Confidential Salary Information",
          description: "Disclosing, leaking, or revealing salaries, salary movement or any confidential compensation information to co-employees or unauthorized persons, except through authorized management channels and procedures.",
          severity: "MAJOR"
        },
        {
          num: "5.13",
          title: "Failure to Secure Required Activity Waivers",
          description: "Failure to issue, secure, or furnish participants with an official SixEleven Activity Waiver for outings, team-building events, field trips, or any Company-related activities held outside the office.",
          severity: "MAJOR"
        },
        {
          num: "5.14",
          title: "Participation In Other Business Engagements Without Prior Consent",
          description: "Participation in other business engagements or outside employments without prior consent of the Company.",
          severity: "GRAVE"
        },
        {
          num: "5.15",
          title: "Participation In Similar Trade or Business Without Prior Consent",
          description: "Participation in a similar trade or business holding any position or employment, with or without compensation in any firm, which is engaged in a similar line of business or in competition with the Company without prior consent.",
          severity: "GRAVE"
        },
        {
          num: "5.16",
          title: "Obtaining Company Supplies or Materials Through Fraudulent Orders",
          description: "Obtaining Company supplies or materials through fraudulent orders or connection and/or collusion with principals or suppliers.",
          severity: "GRAVE"
        },
        {
          num: "5.17",
          title: "Unauthorized Commission, Overpricing or Receipt of Gifts from Suppliers and Partners",
          description: "Accepting directly or indirectly any sum of money, gift, benefit, unauthorized commission, offer, or promise, in consideration of any act, contract, decision or service connected with the employee's official duties; or offering to grant unauthorized commissions to a co-employee or any third party.",
          severity: "GRAVE"
        },
        {
          num: "5.18",
          title: "Acts of Dishonesty",
          description: "Any act of dishonesty or attempt to commit dishonesty, including falsifying an expense, reimbursement report, receipt or any other financial documents.",
          severity: "GRAVE"
        },
        {
          num: "5.19",
          title: "Fraudulent, Deceitful or Unlawful Withdrawal or Acquisition of Company Property",
          description: "Fraudulent, deceitful or unlawful withdrawal or acquisition or release Company funds and/or property to oneself or to others.",
          severity: "GRAVE"
        },
        {
          num: "5.20",
          title: "Causing Loss and/or Damage to Company Property",
          description: "Causing loss of, or damage to, Company property through negligence, misconduct, or willful intent.",
          severity: "GRAVE"
        },
        {
          num: "5.21",
          title: "Theft And Robbery",
          description: "Any act constituting qualified theft or robbery or any attempt to commit qualified theft or robbery of any property within or outside Company premises.",
          severity: "GRAVE"
        },
        {
          num: "5.22",
          title: "Breach of Trust",
          description: "Breach of the trust vested in the employee by Management, an officer, or any Company representative.",
          severity: "GRAVE"
        },
        {
          num: "5.23",
          title: "Acceptance or Offer of Anything of Value to Influence Decisions",
          description: "Accepting or offering money, gifts, favors, or anything of valueâ€”whether from applicants, employees, clients, suppliers, contractors, or principals in order to obtain or grant a job, promotion, favorable employment condition, or to influence any act, decision, or service that the employee is duty-bound to perform.",
          severity: "GRAVE"
        },
        {
          num: "5.24",
          title: "Borrowing Money or Articles of Value from Subordinates",
          description: "Borrowing money or items of value from subordinates, or asking subordinates to guarantee or co-sign a personal loan, including doing so to obtain or guarantee favor in work assignments, evaluations, or employment conditions.",
          severity: "GRAVE"
        },
        {
          num: "5.25",
          title: "Unauthorized Use of Company Name, Branding, or Business Materials",
          description: "Using the name of the Company, Company partners, letterheads, logos, trademarks or business forms for activities not connected with assigned duties or not related to official Company business.",
          severity: "GRAVE"
        },
        {
          num: "5.26",
          title: "Unauthorized Removal or Handling of Company Funds or PCF",
          description: "Unauthorized removal, use, or handling of Company funds or petty cash funds (PCF), including failing to properly record, remit, or turn over the full amount of any payment received from the sale or disposal of old Company items or property.",
          severity: "GRAVE"
        },
        {
          num: "5.27",
          title: "Bribing Employees to Violate Policies",
          description: "Inducing, bribing, or coercing co-employee(s) to violate Company policies, rules and regulations.",
          severity: "GRAVE"
        }
      ]
    },
    {
      category: "6. Infractions Against Rules on General Behavior",
      policies: [
        {
          num: "6.01",
          title: "Disorderly Conduct or Horseplay",
          description: "Engaging in disorderly conduct, horseplay, or any behavior that disrupts the workplace during working hours or within Company premises.",
          severity: "MINOR"
        },
        {
          num: "6.02",
          title: "Failure to Comply with Required Medical Check-Ups or Treatment",
          description: "Failure to submit promptly to required annual medical check-up, or to report promptly to a doctor or hospital for medical consultation or treatment, despite instruction by management.",
          severity: "MINOR"
        },
        {
          num: "6.03",
          title: "Showing or Exhibiting Pornographic Materials",
          description: "Showing, displaying, or distributing pornographic materials at any time within Company premises or areas under Company jurisdiction.",
          severity: "MAJOR"
        },
        {
          num: "6.04",
          title: "Being Under the Influence of Alcohol or Drugs",
          description: "Entering Company premises, or any of its places of jurisdiction, while influence of alcohol or intoxicating substances, or consuming alcohol within Company premises or any area under Company jurisdiction.",
          severity: "MAJOR"
        },
        {
          num: "6.05",
          title: "Participating in Heated or Disruptive Arguments",
          description: "Participating in heated, loud, or disruptive arguments, discussions or debates during working hours and/or within Company premises or any place within its jurisdiction.",
          severity: "MAJOR"
        },
        {
          num: "6.06",
          title: "Violation of Non-Fraternization Policy",
          description: "Violating the Company's Non-Fraternization Policy without consent from the management, including: Romantic or dating relationships between a manager and a reporting staff member. Dating relationships between employees regardless of reporting lines or departments. Romantic involvement, sexual relations, or close friendships in a reporting relationship. Note: Continued non-compliance may be treated as a terminal offense if it causes ethical or sensational issues for the Company.",
          severity: "MAJOR"
        },
        {
          num: "6.07",
          title: "Unauthorized bringing of Mobile, Electronic, Computer Device without prior approval from the Company.",
          description: "Unauthorized bringing of Mobile, Electronic, Computer Device without prior approval from the Company.",
          severity: "MAJOR"
        },
        {
          num: "6.08",
          title: "Participating in Malicious or Non-Approved Campaigns",
          description: "Maintaining, introducing, or participating in non-approved, malicious signature campaigns or similar activities that may harm the Company or its personnel.",
          severity: "MAJOR"
        },
        {
          num: "6.09",
          title: "Acts of Discourtesy",
          description: "Acts of discourtesy to stockholders, company officers, business associates, customers or visitors or superiors.",
          severity: "GRAVE"
        },
        {
          num: "6.10",
          title: "Entering Company Premises Under the Influence of Drugs",
          description: "Entering Company premises, or any area under Company jurisdiction, under the influence of illegal drugs.",
          severity: "GRAVE"
        },
        {
          num: "6.12",
          title: "Allowing an Employee Under the Influence to Work",
          description: "Knowingly allowing an employee who is under the influence of alcohol or drugs to be relieved, assigned, or perform work.",
          severity: "GRAVE"
        },
        {
          num: "6.13",
          title: "Immoral Acts or Illicit Relationships",
          description: "Committing immoral acts within Company premises or areas under Company jurisdiction, or engaging in illicit or immoral relationships with co-employees, clients, suppliers, or any business associate of the Company.",
          severity: "GRAVE"
        },
        {
          num: "6.14",
          title: "Threats, Verbal Assault, Harassment, or Intimidation",
          description: "Any act constituting threat, verbal assault, provocation, intimidation, coercion or harassment against any employee, or in a manner unduly interfering with or obstructing Company operations or other employees from performing their work.",
          severity: "GRAVE"
        },
        {
          num: "6.15",
          title: "Using Or Uttering Lewd, Rude or Insulting Language During Office Hours",
          description: "Using or uttering lewd, rude or insulting language during office hours and/or within Company premises, or engaging or offering to engage in immoral or unethical practices, including offering goods and services to employees within Company premises.",
          severity: "GRAVE"
        },
        {
          num: "6.16",
          title: "Rumor-Mongering, or Disclosure of Co-Employee's Personal Affairs",
          description: "Engaging in rumor-mongering, or disclosing of co-employee's personal affairs to others, distortion of fact(s) in a way that would discredit or embarrass another employee in all forms and media of communication including social media.",
          severity: "GRAVE"
        },
        {
          num: "6.17",
          title: "Assisting or Encouraging Third Parties to Harm Employees",
          description: "Assisting and/or encouraging non-employee (third party) to harm, threaten, and/or physically attack a co-employee for reasons which are work-related.",
          severity: "GRAVE"
        },
        {
          num: "6.18",
          title: "Unauthorized Discharge of Work",
          description: "Performing work outside of assigned duties or tasks without authorization.",
          severity: "GRAVE"
        },
        {
          num: "6.19",
          title: "Bringing Firearms, Explosives or Deadly Weapons",
          description: "Bringing in or carrying firearms, explosives, flammable materials and other deadly weapons, such as bolos, ice picks, etc., inside company premises.",
          severity: "GRAVE"
        },
        {
          num: "6.20",
          title: "Prohibited Drugs",
          description: "Pushing, selling, using, or possessing prohibited drugs or paraphernalia and substitutes within Company premises.",
          severity: "GRAVE"
        },
        {
          num: "6.21",
          title: "Conviction of Crime",
          description: "Conviction of a crime involving moral turpitude and crimes, which, by its nature and consequences, adversely affects the employee's performance or qualifications to remain an employee.",
          severity: "GRAVE"
        },
        {
          num: "6.22",
          title: "Deliberate Hindrance or Disruption of Work",
          description: "Deliberately hindering, holding back, limiting, or slowing down work and/or production and/or sales activity; participating in mass leave, sit-down, riot, or similar disruptive activities, or inciting, intimidating, threatening, inducing, convincing or coercing other employee(s) to do so.",
          severity: "GRAVE"
        },
        {
          num: "6.23",
          title: "Extortion or Unauthorized Extraction of Value",
          description: "Extorting or attempting to extract money, goods, or any form of value from co-employees, Company guests, suppliers, clients, or principals.",
          severity: "GRAVE"
        },
        {
          num: "6.24",
          title: "Committing Other Acts of Dishonesty or Anomaly",
          description: "Committing other acts of dishonesty or anomaly not embraced by any provision which may or have caused damage to Company property.",
          severity: "GRAVE"
        },
        {
          num: "6.25",
          title: "Gross Inefficiency or Unsatisfactory Performance",
          description: "Continuing gross inefficiency or unsatisfactory performance despite prior notice or guidance.",
          severity: "GRAVE"
        },
        {
          num: "6.26",
          title: "Deliberate Negligence by Immediate Superior",
          description: "On the part of an immediate superior, deliberately condoning, ignoring, tolerating, or participating in an offense committed by a subordinate.",
          severity: "GRAVE"
        },
        {
          num: "6.27",
          title: "Acts Prejudicing a Superior's Duties",
          description: "Committing acts directly related to a superior's discharge of official duties which prejudice the superior's interests.",
          severity: "GRAVE"
        },
        {
          num: "6.28",
          title: "Malicious Chat Groups or Email Threads",
          description: "Maintaining, hosting, or participating in non-approved, malicious chat groups, email threads, or other communication on official Company platforms.",
          severity: "GRAVE"
        }
      ]
    }
  ];

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

  function getSections() {
    return CODE_OF_CONDUCT.map((cat, idx) => ({
      index: idx,
      name: cat.category,
      count: cat.policies ? cat.policies.length : 0
    }));
  }

  function getPolicyByNum(policyNum) {
    if (!policyNum) return null;
    const cleanNum = String(policyNum).trim();
    for (const group of CODE_OF_CONDUCT) {
      const found = group.policies.find(p => p.num === cleanNum);
      if (found) {
        return { ...found, sectionName: group.category };
      }
    }
    return null;
  }

  const COC_SYNONYM_MAP = {
    sleep: ["sleep", "sleeping", "doze", "dozing", "nap", "slumber"],
    sleepi: ["sleep", "sleeping", "doze", "dozing", "nap"],
    sleeping: ["sleep", "sleeping", "doze", "dozing", "nap"],
    late: ["late", "tardy", "tardiness", "punctual", "punctuality", "grace period", "punch", "delay", "tardiness rules"],
    tardy: ["late", "tardy", "tardiness", "punctual"],
    tardiness: ["late", "tardy", "tardiness", "punctual"],
    dress: ["dress", "attire", "clothing", "uniform", "outfit", "wear", "slippers", "shoes", "sandals", "headgear", "hat"],
    attire: ["dress", "attire", "clothing", "uniform", "outfit", "wear"],
    internet: ["internet", "web", "browsing", "social media", "youtube", "network", "bandwidth", "online", "wifi"],
    biometrics: ["biometrics", "biometric", "fingerprint", "time record", "time-recording", "timecard", "time card", "punching", "clock in", "clocking", "buddy punching"],
    biometric: ["biometrics", "biometric", "fingerprint", "time record", "time-recording", "timecard", "time card", "punching", "clock in", "clocking"],
    password: ["password", "credential", "credentials", "login", "account", "passcode", "authentication", "unauthorized access"],
    cleanliness: ["cleanliness", "clean", "unclean", "unsanitary", "housekeeping", "mess", "messy", "dirty", "trash", "hygiene", "sanitary", "drinks", "food", "beverage"],
    clean: ["cleanliness", "clean", "unclean", "unsanitary", "housekeeping"],
    unclean: ["cleanliness", "clean", "unclean", "unsanitary", "housekeeping", "mess"],
    chat: ["chat", "chatting", "conversation", "talking", "socializing", "personal message"],
    cellphone: ["cellphone", "phone", "mobile", "gadget", "device"],
    phone: ["cellphone", "phone", "mobile", "gadget", "device"]
  };

  function computePolicyRelevance(pol, catCategory, rawQuery) {
    const q = rawQuery.trim().toLowerCase();
    if (!q) return 1;

    let score = 0;
    const numLower = pol.num.toLowerCase();
    const titleLower = pol.title.toLowerCase();
    const descLower = pol.description.toLowerCase();
    const catLower = catCategory.toLowerCase();
    const tagLower = (pol.cctvTag || "").toLowerCase();

    const hasWord = (text, word) => {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(text);
    };

    // 1. Exact Policy Number match (Highest Priority)
    if (numLower === q) return 3000;
    if (numLower.startsWith(q)) score += 1500;

    // 2. Full Query exact whole-word or substring matches
    if (hasWord(titleLower, q)) score += 700;
    else if (titleLower.includes(q)) score += 80;

    if (hasWord(descLower, q)) score += 200;
    else if (descLower.includes(q)) score += 30;

    if (hasWord(tagLower, q)) score += 150;
    if (hasWord(catLower, q)) score += 40;

    // 3. Synonym & Concept Expansion
    const qWords = q.split(/\s+/).filter(Boolean);
    qWords.forEach(w => {
      // Direct word match
      if (hasWord(titleLower, w)) score += 300;
      else if (titleLower.includes(w)) score += 50;

      if (hasWord(descLower, w)) score += 100;
      else if (descLower.includes(w)) score += 20;

      // Expand through synonym map
      const synonyms = COC_SYNONYM_MAP[w] || [];
      synonyms.forEach(syn => {
        if (hasWord(titleLower, syn)) score += 500;
        else if (titleLower.includes(syn)) score += 150;

        if (hasWord(descLower, syn)) score += 150;
        else if (descLower.includes(syn)) score += 40;
      });

      // 4. Fuzzy / Partial Prefix Stemming (e.g. "sleepi" matches "sleeping" / "sleep")
      if (w.length >= 4) {
        const titleTokens = titleLower.split(/[\s,.-]+/);
        titleTokens.forEach(tok => {
          if (tok.length >= 4) {
            if (tok.startsWith(w) || w.startsWith(tok)) score += 250;
            else if (tok.slice(0, 4) === w.slice(0, 4)) score += 120;
          }
        });

        const descTokens = descLower.split(/[\s,.-]+/);
        descTokens.forEach(tok => {
          if (tok.length >= 4) {
            if (tok.startsWith(w) || w.startsWith(tok)) score += 80;
            else if (tok.slice(0, 4) === w.slice(0, 4)) score += 40;
          }
        });

        Object.keys(COC_SYNONYM_MAP).forEach(synKey => {
          if (synKey.startsWith(w) || w.startsWith(synKey) || synKey.slice(0, 4) === w.slice(0, 4)) {
            COC_SYNONYM_MAP[synKey].forEach(syn => {
              if (hasWord(titleLower, syn)) score += 200;
              else if (titleLower.includes(syn)) score += 80;
              if (hasWord(descLower, syn)) score += 60;
            });
          }
        });
      }
    });

    return score;
  }

  function searchCodeOfConduct(query = "", filterCategory = "all", filterSeverity = "all", monitoredOnly = false) {
    const q = String(query || "").trim().toLowerCase();
    const results = [];

    CODE_OF_CONDUCT.forEach((catGroup, catIdx) => {
      if (filterCategory !== "all" && String(catIdx) !== String(filterCategory)) {
        return;
      }

      const scoredPolicies = [];
      catGroup.policies.forEach(pol => {
        if (filterSeverity !== "all" && pol.severity !== filterSeverity) {
          return;
        }
        if (monitoredOnly && !pol.isCctvMonitored) {
          return;
        }

        const score = q ? computePolicyRelevance(pol, catGroup.category, q) : 1;
        if (score > 0) {
          scoredPolicies.push({
            ...pol,
            _relevanceScore: score,
            category: catGroup.category,
            categoryIndex: catIdx
          });
        }
      });

      if (scoredPolicies.length > 0) {
        if (q) {
          scoredPolicies.sort((a, b) => b._relevanceScore - a._relevanceScore);
        }
        results.push({
          category: catGroup.category,
          categoryIndex: catIdx,
          topScore: scoredPolicies[0]?._relevanceScore || 0,
          policies: scoredPolicies
        });
      }
    });

    if (q) {
      results.sort((a, b) => b.topScore - a.topScore);
    }

    return results;
  }

  return {
    getCodeOfConduct,
    getCodeOfConductCount,
    getPenaltyMatrix,
    getSections,
    getPolicyByNum,
    computePolicyRelevance,
    filterPolicies: searchCodeOfConduct,
    searchCodeOfConduct,
    getSynonymMap: () => COC_SYNONYM_MAP
  };
})();

window.codeOfConductService = window.CCTV_CONDUCT;