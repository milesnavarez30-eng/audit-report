/**
 * CCTV OPS V2 - Global Configuration & Constants
 */

window.CCTV_V2_CONFIG = {
  // Public Supabase Configuration
  SUPABASE_URL: (window.CCTV_AUTH_CONFIG && window.CCTV_AUTH_CONFIG.SUPABASE_URL) || "https://afxgfyuudqujueeooplj.supabase.co",
  SUPABASE_PUBLIC_KEY: (window.CCTV_AUTH_CONFIG && window.CCTV_AUTH_CONFIG.SUPABASE_PUBLIC_KEY) || "sb_publishable_JGUCURJkbOw-KypucxXNSQ_magKTFPd",

  // Storage & Receiver Keys
  KEYS: {
    EDR_DOCS_URL: "edr_google_docs_web_app_url_v1",
    MAINTENANCE_SHEETS_URL: "maintenance_google_sheets_web_app_url_v1",
    ENTRY_LIST: "cctv_entry_list",
    THEME: "cctv_theme",
    DROPDOWN_SITE: "cctv_dropdown_site",
    DROPDOWN_OM: "cctv_dropdown_omName",
    DROPDOWN_ACCOUNT: "cctv_dropdown_account",
    DROPDOWN_REASON: "cctv_dropdown_reasonCode",
    MASTER_HR: "cctv_master_hr_local_crud_v1",
    EDR_CUSTOM_OPTIONS: "cctv_master_edr_custom_options_v1"
  },

  // IndexedDB Databases
  DATABASES: {
    EDR: "cctv_edr_workspace_v2",
    PENDING_REPORTS: "cctv_pending_reports_v1",
    AUDIT_TRACKER: "cctv_tracker_guard_v1",
    MAINTENANCE: "maintenance_report_db",
    FOLLOWUP: "cctv_followup_reports_v1",
    HISTORY: "cctv_global_workspace_history_v1"
  },

  // Default Dropdown Collections (Exact Authoritative V1 Data)
  DEFAULTS: {
    SITES: [
      "Mabini Site A - 1st Floor",
      "Mabini Site A - 2nd Floor",
      "Mabini Site B1 - 2nd Floor",
      "Mabini Site B2 - 3rd Floor",
      "Mabini Site B2 - 4th Floor",
      "Ecoland Site",
      "MAA 4th Floor",
      "MAA 5th Floor",
      "MAA 6th Floor",
      "Gensan Site",
      "CDO Site",
      "Digos Site"
    ],
    REASON_CODES: [
      "SLEEPING",
      "DRESS CODE",
      "BROWSING",
      "WASTING TIME",
      "BRINGING NON-WOF",
      "EATING",
      "IMPROPER HOUSE KEEPING",
      "EQUIPMENT TAMPERING",
      "PDA",
      "DISORDERLY CONDUCT",
      "USING SMARTPHONE",
      "THEFT",
      "SELLING"
    ],
    OMS: ["Abby", "Beth", "BIGO - Thirdy", "CFC", "Cherry", "Crystal", "Derline", "Freda", "Gerramie", "Irene", "Marc Jardenico", "McJordan", "Michelle", "Mirah", "Mogan", "Norman", "Renato", "Rhelford", "Ruth", "Shayne", "Sheila", "Shey", "SP - James", "SP - Marc", "SP - MJ", "SP - Ryan", "Willy"],
    TLS: ["Abegail Llena", "Abigail Calo", "Adana Salaveria", "Adrian Balbuena", "Adrian Crisht Lontiong", "Adrian Paolo Tangonan", "Aiza Pearl Sablas", "Al Joven Malda", "Albert Samsico", "Albert Tumilap", "Alexis Fe Ginez", "Allan Albert Sadili", "Alliana Melgarejo Suaner", "Allysa San Luis", "Almar Bongcac", "Alyssa Jane Gainsan", "Amethyst Jeanne Patani", "Amilyn Vicente", "Analou Madanlo", "Andrea Agudera", "Andrea Kyle Herrero", "Andro Agad", "Angel Omas-as", "Angelica Lantic", "Angelie Ceballos", "Angeline Melgo", "Angelito Carsano", "Angelo Trazona", "Angie Cabaluna", "Angiely Soriano", "Anna Lou Pedregosa", "Annalie Manmano", "Annalou Gonzales", "Anthony Autentico", "Antonette Noran", "Apple Grace Terec", "April Jay Sitoy", "April Ranulo", "April Rose Rabor", "Ara Shaine Villegas", "Archel Cole", "Arianne Agao-Agao", "Ariel Facturan", "Arnel Vicente", "Arrah Mae Sanchez", "Ashley Kim Esplagera", "Aura Rey Velasco", "Ayra Porras", "Bai Indera Diocolano", "Beethoven Diaz", "Benign Borral", "Benjie Cabalhin", "Beverly Origenes", "Bless Dian Buga-as", "Bryan Rey Tabares", "Carl Anthony Galvez", "Carlo Rubia", "Carmena Dagaraga", "Cedric Michael Gianan", "Celestino Bravo", "Chady Flores", "Charisse Romasanta", "Charlene Mae Ruiz", "Charles Ethan Arcilla", "Charles Vincent Vidanes", "Charlotte Danica Dauz", "Charyl Diatras", "Cherry Mae Astorga", "Christian Arcilla", "Christian Estrera", "Christian Jay Corsiga", "Christian Nicko Rosales", "Christine Monique Labastida", "Christine Olasiman", "Christine Urdaneta", "Claire Charl Belover-Cabanas", "Clarissa Cyrine Aguanta", "Connie Fe Villanueva", "Crea Amorte", "Cresil Fe Duhig", "Cris Arandilla", "Cristine Olasiman", "Cristoper Cavan", "Crystal Paulene Delmo", "Cyfer Marie Diapolet", "Dames Alfred Veloso", "Dan Ric Abendaño", "Daniel Algario", "Daniel Gabriel Roda", "Dannevy Salvador", "Dante Tahuran", "Dar Benjie Limikid", "Darben Esperanza", "Dareen Mhyvie Caliguid", "Darhyl John Bauyot", "Dariel Cardiente", "Dariel John Duco", "Darlene Barcelo", "Darlene Grace Sornido", "Darryl De Guzman", "Datun Mamasainged", "Dave Leezer Sodusta", "David Gabut", "Dether Languido", "Dianne Sombilon", "Dinah Grace Rio", "Divi Ann Alcontin", "Divi Anne Alcontin", "Dorrisse Jane De Vera", "Edelaido Roble Jr.", "Edgie Clarin Alcarion", "Edrianne Delos Santos", "Edylyn Tallorin", "EJ Oribe", "Ejjie Madjire", "Elijah Felipe", "Elisha Bayona", "Ellame Pantojan", "Emmaruel James Alao", "Ephraim June Vismanos", "Erik Jan Martillan", "Erika Gerado", "Erika Jane Almerez", "Erika Sabdullah", "Erly Jade Jadap", "Ethel Grace Paberan Habanes", "Exequiel Edorosas", "Ezel Jean Sebandal Mahinay", "Flora May Maño", "Floramae Palma", "Francis Alta", "Francis Brylle Cane", "Francis Lian Ramos", "Freda Apuda", "Frederick Jopia", "Fritz Cales", "Garyll Castillo", "Geharchelle Fuentes", "Gemark Cardanio", "Genibie Trasmonte", "Gerramie Mendoza-Racoma", "Gilbert Murillo", "Ginalyn Mariano", "Glaithe Hienze Perero", "Gliza Mae Samelin", "Glyze Morgado", "Grazelle Tagadiad", "Hani Precious Serna", "Hani Serna", "Hanz Rosetham Tolentino", "Hanzel Umpad", "Harlene Candel", "Hazel Gorgoya", "Henie Alvarez", "Hiezel Heart Bariquit", "Honey Glaze Pialago", "Honey-lyn Dalos", "Ian Greg Mandalupe", "Ian Lauroza", "Irene Fuentes", "Ivan Strauss Castillon", "Ivan Taala", "Ivy Balandan", "Ivy Decenilla", "Jade Rocacorba", "Jaime Arisgado", "Jake Dimpas", "Jake Maghanoy", "Jake Montajes", "James Matthew Quintana", "Jamiel Leyson", "Jan Andes Noel", "Jan Gabriel Pariolan", "Jan Laurence Amacanim", "Jan Noel Andes", "Jan Sield Molinas", "Janice Jugarap", "Janice Salubre", "Jastine Ann Casayas", "Jastine Karl Pracueles", "Jave Mamontayao", "Jay Besedor", "Jay Catito", "Jayboi Tuling", "Jaycee Zabate", "Je Ann Jy Ramos", "Jefferson Egoy", "Jeffrey Juan", "Jeiryld Abella", "Jenesis Mabasa", "Jenessa Subteniente", "Jenette Hisola", "Jennifer Toroba", "Jenny Rose Aquino", "Jeremiah Quesada", "Jerome Uyanguren", "Jerrylyn Guinto", "Jesbonnin Sudaria", "Jessa Lopez", "Jessa Mae Amihan", "Jessa Mae Bacus", "Jethro Gerali", "Jexeer Khent Trinidad", "Jhon Carlos Santos", "Jhon Kenan Baran", "Jhon Rex Mantilla", "Jhuly Basmayor", "Jhun Carlo San", "Jim Fernandez", "Jinelyn Ligtas", "Joecel Villegas", "Joevinyll Palabrica", "John Alvin Despogado", "John Dave Barzo", "John Eric Momo", "John Joshua Bahinting", "John Karl Butaslac", "John Lloyd Pogoy", "John Peter Ano-os", "John Raphael Toledo", "John Rel Lagura", "John Rey Salise", "John Vincent Sotto", "Jollie Berjes", "Jomar Linaza", "Jomar Manla Daie", "Jomira Aquino", "Jonalyn Mamaba", "Jonas Haguyahay", "Jonel Delgado", "Jonell Bisnar", "Joneza Gementiza", "Jose Manila", "Jose Rino Hontiveros", "Joseph Dagatan", "Joshua Bahinting", "Joshua Bañez", "Joshua Salva", "Jovert Monticayan", "Juan Miguel Aleos", "Juddy Ann Tumazar", "Judel Gabunilas", "Judy Ann Ero", "Juliah Monte", "Julina Flores", "Juniper Arquisola", "Jupel Hemolatan", "Juren Davies Buhawe", "Justine Aninion", "Justine Karl Pracueles", "Justine Magandam", "Justine Pleños", "Kathleen Joy Sulaiman", "Kathlyn Yuba", "Kathrine Mae Arce", "Kehn Angelo Egdamin", "Kerjean Labi", "Kevin John Oroc", "Kevin Kyle Omiping", "Khemyajaira Paquit", "Kimberly Quirabo", "Kin Batomalaque", "Kirk Daniel Ripley", "Kristine Bulonos", "Kristine Jay Salvadora", "Kristine Laarnee Lucariza", "Krizzna Berang", "Krystyl Jean Daclag", "Kurt Calvin Cajeles", "Kyle Ryan Gaviola", "Kylene Cabanada", "Kyzer Bacle", "Larry Lloyd Rodriguez", "Laurence Dave Sindol", "Lemuel Rosalejos", "Leo Jones Sayago", "Leslie Deparene", "Lezmar Teh", "Lhoyd Mondinido", "Liezl Joy Lodonia", "Lloyd Vincent Orquina", "Lorence Gucor", "Lorenz Calm Fabellar", "Louie Roy Casang", "Louise Anne Litao", "Lovelle Famorcan", "Luke Zedric Jun Lopez", "Luz Dela Peña", "Ma. Czalthea Obed", "Madelyn Mahinay", "Mae Ann Espina", "Maia Isla", "Maica Estafia", "Maica Mambaling", "Marc Jardenico", "Marco Paolo Salazar", "Marecar Suerte", "Margie Gracia", "Marianette Aradilla", "Maribeth Georpe", "Maricel Sungkip", "Maridel Salon", "Marie Fe Palen", "Marie Mogan", "Marie Rose Mutia", "Mark Anthony Arellano", "Mark Clint Encallado", "Mark Conrad Pinton", "Mark Cortez", "Mark Edejer", "Mark Gervacio", "Mark Glendel Embudo", "Mark Lloyd Pielago", "Mark Loeh Salaysay", "Mark Nelcone Grullo", "Marwen Diel", "Mary Abegail Gabrielle Amora", "Mary Ann De Leon", "Mary Grace Ybañez", "Maxx De Vera", "Maxy Jodelle Alota", "May Jean Romaguera", "Mc Jordan Costan", "Mc Reden De Vera", "Meilah Deocares", "Mel Jan Cole", "Melissa Liceralde", "Melvin Balaba", "Melvinson Laguting", "Michael Angelo Rosauro", "Michael James Macabingkil", "Michael Jan Bangoy", "Michael Mogan", "Michael Ocampo", "Michael Ralph Montejo", "Michelle Pantujan", "Mickie Jhon Absin", "Mina Joy Ramirez", "Mirah Paris Macaorao", "Moktar Ibrahim", "Nasrudin Sailila", "Neil Jarencio", "Nelboy Campaner", "Neña May Barientos", "Noel Ulalan", "Nomar Dagmil", "Norjahid Akmad", "Norman Lindo", "Noronisa Mante", "Odesa Lacadwe", "Oliver Dela Cruz", "Omar Langco", "Omar Mallari", "Pablito Janeo", "Pam Cuizon", "Pamela Villanueva", "Patricia Paula Therese Martinez", "Patrick James Mariano", "Patrick Jhon Misagal", "Patrick Llamasarez", "Paul Angelo Maguad", "Paul Anthony Rica", "Pauline Grace Genon", "Philip Baaria Lomada", "Prince Borras", "Princess Angel Barinque", "Princess Catabay", "Princess Jay Cadungog", "Princess Robles", "Queendolyn Pama", "Rachel Joyce Carillo", "Raena Rosos", "Ralph Raul Montero", "Ramil Ramos", "Raphael Montiague", "Ray Allen Baracao", "Raymund Ordinario", "Reah Mae Manangca", "Recci George Crodua", "Recy Pagangpang", "Remer Tancontian", "Renato Feria", "Rene Fernandez", "Resamy Crausos", "Rex Mantilla", "Rey Adrian Candilada", "Rey Mark Ibañez", "Reyland Sumael", "Reynaldo Arreza", "Reynaldo Ligad", "Reynan Arellano", "Rhea Elises", "Rhea Liezyl Naol", "Rhea Mae Manangca", "Rhelford Allawan", "Rhocky Resma", "Rhusty Lascuña", "Rica Gingone", "Rica Micaella Suan", "Ricardo Traya Jr.", "Richell Saavedra", "Rieven John Catipay", "Rigel Conejar", "Rio Ubaldo", "Risaldo Castellon Jr.", "Risha May Memoracion", "Ritchie Crispe", "Rizel Abanes", "Robina Tai", "Rogelyn Boligao", "Rojon Rosales", "Roleen Joy Juntong", "Rolly Acaso Lasala", "Romel Biliran", "Romelyn Samar", "Ron Jay Socia", "Ronnel Ragas", "Rosalia Mandawe", "Rosalinda Erellana", "Rosalyn Darang", "Rosanna Bergavera", "Roselle Novecio", "Rowaida Faisal", "Rowena Lamatan", "Rubie Ramos", "Ryan Patrick Balicog", "Samantha Gen Cruz", "Shaira Mae Olasiman", "Shaira May Divinagracia", "Shayne Erasmo", "Sheila Emmanuelle Nueza", "Sheila Mae Cuison", "Shekinah Grace Javar", "Shella Caangay", "Shella Mae Caangay", "Sherlak Culanag", "Sherwin James Solier", "Shiela Sales Sarmiento", "Shiella Marie Miñoza", "Simforiano Gerongco", "Stacey Verdeflor", "Stanley Rojas", "Stephanie Pombo", "Suzette Rose Dayaday", "Switzel Condor", "TBA", "Thea Tanya Bete", "Thirdie Galedo", "Val Sandingay", "Venus Cua", "Vicente Sumagabac", "Vincent Lapasigue", "Vinette Sanchez", "Vowin Cordova", "Walter Jay Carrasca", "Warren Mansueto", "Willy Mark Callao", "Xyzel Saludares", "Yancy Camingue", "Zady Daguat", "Zaila Faye Soreño", "Zaldy John Garcia", "Zheenab Datu-dacula", "Zoe Cordova", "Zyrie Christian Wasil"],
    ACCOUNTS: ["123 Employee", "123 Employee - Echo Mortgage", "123 Employee - Hallandale Pharmacy", "123 Employee - Mercantile Property", "123 Robotics", "123Employee | HUB International", "212 Dental Care", "611 VA", "ACB", "Adams International", "Advocacy Refund Group", "Aeroex Technology Inc.", "AFP", "Ahabi", "Airbills", "Alibaba", "All Pro Pay", "Allen Institute Mouse", "Allied Pain and Spine Institute", "AMG", "AMR", "AMR CSR", "Angel Oak Mortgage Solution", "Another Star", "ARS", "AU Store", "AU Tax", "AUXGP", "BathroomX", "Bayou Braces", "Bentino", "BIGO - DIGOS", "BIGO - ECOLAND", "BIGO - Mabini", "Brianna Thaxton LLC", "BrightDelivery", "CapLink Group", "CFC", "CFC OB", "CGP", "CIG", "CITUS HR SOLUTIONS", "Clear Insights Group", "Clinic P", "COD Logistics", "Commercial Enterprise", "Commercial Merchant Acquisition", "Content Quality Assurance", "Corazon Company LLC", "CORE LOGIX", "Cupshe", "DASCO", "DASCO BACK OFFICE", "DASCO CSR", "DAVI", "Dental Back Office Admin", "DG Dial", "DIAL EXPRESS", "DLG", "DLPC", "DNE", "DNO L1", "DNO L2", "Duque Immigration", "EDJ DATA", "EIMS", "EIMS - Data Validator/QA", "eJam", "eJam Inside Sales", "ENC", "Envera", "EOR Project: Future Proof", "ESIM", "Everlife", "EVMS", "EWC", "Eyesurf", "FBB", "FBB QA", "Flexscale Next-Level Recruitment", "Flexscale Truth Finance", "Flexscale Truth Financial", "Flywire", "Franklin Hamilton", "FWC", "GARDENS", "Gardens Alive & Shared", "Glamcor", "GLO", "Globalcom - Mountain Valley", "Globalcom RTA", "GRAB", "GRAB - Commercial Enterprise", "GRAB - MPH", "Grab - MY", "GRAB - PH", "GRAB - Quality Assurance", "GRAB - SG", "GrabRentals Voice and Digital Support", "Green Health Docs", "Greenfoot", "HBW", "Herb joy", "Hotel Revel", "IADU/IAVU PH", "IAVU/IADU SG Support", "IDENT", "iMarketing", "iMarketing Frontline", "iMile Logistics", "Industry Rock Star", "Insight Financial Associates Ltd. (SixEleven Project)", "Integrity Financial Solutions", "J&T Express", "Jethro Mobile", "JJILL", "Justlife", "KCDO", "KCDO - Billing", "KCDO - Inbound", "KCDO - Outbound", "KCDO - RCM", "Kombea Fivestrata", "Kombea Kingkong", "KOMBEA MPI", "Kombea Pro Speaking", "Kraven Bahamas", "LEADMINER", "LedUp", "Legal Solutions 4U", "Leisure-tec", "LifeMD", "List Simple", "LM Consulting", "LOGISTICS", "LSM", "Luxor Eye Institute", "Mallory Headset", "MAPUA", "MBC Consulting Group Inc.", "Mehboob Law Firm", "Mi Care", "MMG", "MoneyHero Group", "Moon River Therapy", "Mousewire", "NationGraph", "Neiline", "NetworX", "NextgenID", "NextgenID SRIP", "NISSAN PH", "NLR", "Nomad eSIM", "NOX", "NVT", "OBRB MY", "Origin", "PB&J TV", "Pearl Source", "Phoenix Direct", "Pinnacle Ozone Solutions", "Pivot", "POINT CO", "QA OJR", "QC", "Quick Contractors", "Reflex Media", "Renogy", "Revel Hotel", "RPI (1voiceSolution)", "SBI", "Seesaw", "SFP", "SHARED", "Shopee", "Shopee - Buybox", "Shopee - Buybox - Smart UI", "Shopee - Buyer Chat and Email", "Shopee - Buyer CS", "Shopee - Buyer Logistics", "Shopee - Buyer Non-Logistics", "Shopee - CB-SCS", "Shopee - CCS", "Shopee - CS", "Shopee - CS and Non-CS", "Shopee - Data Labelling - Buybox", "Shopee - Data Labelling - Non SPU", "Shopee - Data Labelling - SPU", "Shopee - Email", "Shopee - FBS", "Shopee - Keywords", "Shopee - L1 Buyer - Email", "Shopee - Listing Pages", "Shopee - Listings Data Labelling - LLM", "Shopee - Listings Data Labelling - SQE", "Shopee - Listings Data Labelling - Task Center", "Shopee - Listings QC", "Shopee - Live Stream Marketing", "Shopee - LiveStream", "Shopee - Lovito", "Shopee - Non-CS", "Shopee - PH - Chat Bot", "Shopee - PIC", "Shopee - QA", "Shopee - QAC Department", "Shopee - RTA", "Shopee - SBS", "Shopee - SCS", "Shopee - Seller Chats and Email", "Shopee - Seller Log x RR", "Shopee - SIP AME", "Shopee - SIP BR & LATAM", "Shopee - SIP Global", "Shopee - SIP Global - PH", "Shopee - SIP L2", "Shopee - SIP Malaysia", "Shopee - SIP Singapore", "Shopee - SIP Taiwan", "Shopee - SIP Thailand", "Shopee - SIP Vietnam", "Shopee - SPU Listings", "Shopee - SPX", "Shopee - SPX NSS Outbound", "Shopee - SPX SSC and NSS", "Shopee - Trainee", "Shopee - Training", "Shopee - Video", "Shopee - Video QC", "Shopee - WFM", "Shopee - WFM/RTA", "SLEEPDYNAMICS", "Smart Circle", "Smart Staffing Support - Renters", "Solution That Matter", "SPEAK UP", "Spectee", "Spyfly", "Spypoint", "Spypoint Outbound", "SRIP L2 Support", "Superdial", "Talixo", "Talixo Dispatch", "TelMDFirst", "TEMU - 1404", "TEMU - 140X (RSL)", "TEMU - 4029", "TEMU - BATCH 6", "TEMU - BATCH 7", "TEMU - BATCH 8", "TEMU - CPC", "TEMU - LOB-1", "TEMU - LOB-2", "TEMU - LOB-3", "TEN28", "The James Group, LLC", "Ticket Management System SL", "TMS", "Together Network", "TOP MOVING SOLUTIONS", "Triple B", "TV COMMERCIAL TRAFFIC", "Two Birds Supplements", "TWV", "Uplift Healthcare LLC", "Veritas", "ViewQwest CSR", "ViewQwest Telesales", "Virtual Staffing", "WanderJoy", "Wiz AI", "Zetta"]
  },

  // Authoritative External Links
  EDR_DOCS_DEFAULT_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbzwpNfdCCEWySxVa6-DkwFBizVrLSiB-5okhD4mJo-tu-bRQ9tD4GID_4QO1FHtxKYy/exec",
  EDR_TEMPLATE_URL: "https://docs.google.com/document/d/1-i54dxMosFgiNcdEO7fHqvN15yIsicdOjmsW0XTYbUw/edit?tab=t.ob2cyz0wou1"
};

// V1 Options Load / Helpers
function loadCustomEdrOptions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(window.CCTV_V2_CONFIG.KEYS.EDR_CUSTOM_OPTIONS) || "{}");
    return {
      tls: Array.isArray(parsed?.tls) ? parsed.tls : [],
      oms: Array.isArray(parsed?.oms) ? parsed.oms : [],
      accounts: Array.isArray(parsed?.accounts) ? parsed.accounts : []
    };
  } catch (_) {
    return { tls: [], oms: [], accounts: [] };
  }
}

function saveCustomEdrOptions(custom) {
  try {
    localStorage.setItem(window.CCTV_V2_CONFIG.KEYS.EDR_CUSTOM_OPTIONS, JSON.stringify(custom));
  } catch (_) {}
}

window.addCustomOption = function(field, value) {
  const v = String(value || "").replace(/\s+/g, " ").trim();
  if (!v) return false;
  const custom = loadCustomEdrOptions();
  const list = field === "OM" ? custom.oms : (field === "TL" ? custom.tls : custom.accounts);
  if (!list.some(item => item.localeCompare(v, undefined, { sensitivity: "base" }) === 0)) {
    list.push(v);
    list.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
    saveCustomEdrOptions(custom);
    return true;
  }
  return false;
};

window.removeCustomOption = function(field, value) {
  const v = String(value || "").replace(/\s+/g, " ").trim();
  if (!v) return false;
  const custom = loadCustomEdrOptions();
  let list = field === "OM" ? custom.oms : (field === "TL" ? custom.tls : custom.accounts);
  const beforeLen = list.length;
  list = list.filter(item => item.localeCompare(v, undefined, { sensitivity: "base" }) !== 0);
  if (list.length !== beforeLen) {
    if (field === "OM") custom.oms = list;
    else if (field === "TL") custom.tls = list;
    else custom.accounts = list;
    saveCustomEdrOptions(custom);
    return true;
  }
  return false;
};

// Default Google Docs migration check
if (!localStorage.getItem("edr_google_docs_receiver_font_fix_v1")) {
  if (!localStorage.getItem("edr_google_docs_web_app_url_v1")) {
    localStorage.setItem("edr_google_docs_web_app_url_v1", window.CCTV_V2_CONFIG.EDR_DOCS_DEFAULT_WEB_APP_URL);
  }
  localStorage.setItem("edr_google_docs_receiver_font_fix_v1", "done");
}

window.getTeamLeaderNames = function() {
  const custom = loadCustomEdrOptions().tls;
  const base = (window.CCTV_AUDIT_MASTER_TLS && window.CCTV_AUDIT_MASTER_TLS.length)
    ? window.CCTV_AUDIT_MASTER_TLS
    : (window.CCTV_V2_CONFIG.DEFAULTS.TLS || []);
  const merged = Array.from(new Set([...base, ...custom])).filter(Boolean);
  return merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
};

window.getOmNames = function() {
  const custom = loadCustomEdrOptions().oms;
  const base = (window.CCTV_AUDIT_MASTER_OMS && window.CCTV_AUDIT_MASTER_OMS.length)
    ? window.CCTV_AUDIT_MASTER_OMS
    : (window.CCTV_V2_CONFIG.DEFAULTS.OMS || []);
  const merged = Array.from(new Set([...base, ...custom])).filter(Boolean);
  return merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
};

window.getAccountNames = function() {
  const custom = loadCustomEdrOptions().accounts;
  const base = (window.CCTV_AUDIT_MASTER_ACCOUNTS && window.CCTV_AUDIT_MASTER_ACCOUNTS.length)
    ? window.CCTV_AUDIT_MASTER_ACCOUNTS
    : (window.CCTV_V2_CONFIG.DEFAULTS.ACCOUNTS || []);
  const merged = Array.from(new Set([...base, ...custom])).filter(Boolean);
  return merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
};

// Global Site Normalizer
window.normalizeTrackerSite = function(raw) {
  const text = String(raw || "").trim().toLowerCase();
  if (
    text.includes("mabini site b") ||
    text.includes("site b") ||
    text === "mabini_b" ||
    (text.includes("mabini") && (text.includes("3rd") || text.includes("4th")))
  ) {
    return "Mabini Site B";
  }
  if (
    text.includes("mabini site a") ||
    text.includes("site a") ||
    text === "mabini_a" ||
    text.includes("mabini a") ||
    (text.includes("mabini") && (text.includes("1st") || text.includes("2nd") || text.includes("1f") || text.includes("2f")))
  ) {
    return "Mabini Site A";
  }
  if (text.includes("maa") || text.startsWith("maa_")) return "Maa";
  if (text.includes("gensan")) return "Gensan";
  if (text.includes("ecoland")) return "Ecoland";
  if (text.includes("digos")) return "Digos";
  if (text.includes("cdo")) return "CDO";
  return raw ? raw.trim() : "Mabini Site A";
};

// Global Auditor Normalizer
window.normalizeAuditorName = function(raw) {
  if (raw && typeof raw === "object") {
    raw = raw.name || raw.display_name || raw.username || raw.full_name || "";
  }
  const text = String(raw || "").trim().toLowerCase();
  if (text.includes("miles") || text.includes("mico")) return "Miles";
  if (text.includes("wendie") || text.includes("amor")) return "Wendie";
  if (text.includes("seth")) return "Seth";
  if (text.includes("john ric") || text === "jr" || text.includes("john")) return "John Ric";
  if (text.includes("kenneth")) return "Kenneth";
  return raw ? String(raw).trim().split(/\s+/)[0] : "Miles";
};