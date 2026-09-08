$ErrorActionPreference = "Stop"

$indexPath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\index.html"
$stylePath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\style.css"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$indexContent = [System.IO.File]::ReadAllText($indexPath, $utf8NoBom)
$styleContent = [System.IO.File]::ReadAllText($stylePath, $utf8NoBom)

# -----------------------------------------------------------------------------
# 1. Update HTML in index.html: Replace Login Container with SECURE_DATA
# -----------------------------------------------------------------------------
$newLoginHtml = @"
<div class="terminal-login-wrapper" id="loginModal">
  <div class="terminal-frame">
    <form class="terminal-card" id="loginForm" autocomplete="off">
      
      <!-- Card Header -->
      <div class="terminal-header">
        <div class="terminal-title">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <circle cx="12" cy="14" r="2"></circle>
            <line x1="12" y1="16" x2="12" y2="18"></line>
          </svg>
          <span>SECURE_DATA</span>
        </div>
        <div class="terminal-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>

      <!-- Card Body -->
      <div class="terminal-body">
        
        <!-- Username / Operator -->
        <div class="terminal-field">
          <label for="username" class="terminal-label" data-text="USERNAME">USERNAME</label>
          <input
            type="text"
            id="username"
            name="username"
            required
            autocomplete="off"
            spellcheck="false"
          />
        </div>

        <!-- Access Key / Password -->
        <div class="terminal-field">
          <label for="password" class="terminal-label" data-text="ACCESS_KEY">ACCESS_KEY</label>
          <input
            type="password"
            id="password"
            name="password"
            required
            autocomplete="current-password"
          />
        </div>

        <!-- Initiate Connection Button -->
        <button
          type="submit"
          class="terminal-submit-btn"
          id="loginBtn"
          data-text="INITIATE_CONNECTION"
        >
          <span class="btn-label">INITIATE_CONNECTION</span>
        </button>

      </div>
    </form>
  </div>
</div>

<!-- Hidden State & Compatibility Container for Supabase Auth -->
<div id="authGate" class="auth-gate-compat glitch-form-wrapper" hidden style="display:none !important;">
  <div id="authConfigMissing" class="auth-config-missing" hidden></div>
  <div id="authForms" class="auth-forms" hidden>
    <button type="button" id="authSignInTab" class="auth-tab" hidden></button>
    <button type="button" id="authSignUpTab" class="auth-tab" hidden></button>
    <form id="authSignInForm" class="auth-form glitch-card" hidden>
      <label for="authSignInUsername" class="form-label" data-text="USERNAME OR EMAIL" hidden></label>
      <input type="text" id="authSignInUsername" hidden>
      <label for="authSignInPassword" class="form-label" data-text="PASSWORD" hidden></label>
      <input type="password" id="authSignInPassword" hidden>
      <button type="submit" class="submit-btn auth-primary-btn" id="authSignInBtn" data-text="LOG IN" hidden><span class="btn-text">LOG IN</span></button>
    </form>
    <form id="authSignUpForm" class="auth-form" hidden>
      <input type="text" id="authSignUpName" hidden>
      <input type="text" id="authSignUpUsername" hidden>
      <input type="password" id="authSignUpPassword" hidden>
      <input type="password" id="authSignUpConfirm" hidden>
      <button type="submit" id="authSignUpBtn" hidden></button>
    </form>
  </div>
  <div id="authWaitingState" class="auth-state-card" hidden>
    <span class="auth-state-pill pending">Pending Approval</span>
    <h1>Waiting for admin</h1>
    <p>Your account is created. You cannot open the workspace until the admin approves it.</p>
    <div class="auth-state-email" id="authWaitingEmail"></div>
    <small>Status checks automatically.</small>
    <button type="button" class="auth-secondary-btn" id="authPendingLogoutBtn">Log Out</button>
  </div>
  <div id="authRejectedState" class="auth-state-card" hidden>
    <span class="auth-state-pill rejected">Disapproved</span>
    <h1>Access unavailable</h1>
    <p>This account is not approved for CCTV OPS.</p>
    <div class="auth-state-email" id="authRejectedEmail"></div>
    <button type="button" class="auth-secondary-btn" id="authRejectedLogoutBtn">Log Out</button>
  </div>
  <div id="authDisabledState" class="auth-state-card" hidden>
    <span class="auth-state-pill rejected">Account Suspended</span>
    <h1>Access suspended</h1>
    <p>This staff account has been deactivated or disabled by an administrator.</p>
    <div class="auth-state-email" id="authDisabledEmail"></div>
    <button type="button" class="auth-secondary-btn" id="authDisabledLogoutBtn">Log Out</button>
  </div>
  <div id="authMessage" class="auth-message" hidden></div>
</div>
"@

$authGateRegex = '(?s)<div id="authGate" class="auth-gate.*?</div>\s*</div>\s*</section>\s*</div>'
if ($indexContent -match $authGateRegex) {
    $indexContent = [regex]::Replace($indexContent, $authGateRegex, $newLoginHtml, 1)
    Write-Host "[OK] Replaced authGate with terminal-login-wrapper SECURE_DATA markup"
} else {
    Write-Host "[WARN] authGate regex did not match, trying alternative pattern"
    $authGateRegexAlt = '(?s)<div id="authGate".*?<!-- Hidden State'
    if ($indexContent -match 'class="terminal-login-wrapper"') {
        Write-Host "[SKIP] terminal-login-wrapper already in index.html"
    } else {
        throw "Could not find authGate in index.html to replace!"
    }
}

# -----------------------------------------------------------------------------
# 2. Update CSS in index.html & style.css
# -----------------------------------------------------------------------------
$cyberTerminalCss = @"
/* ==========================================================================
   COMPACT NEO-BRUTALIST THEME TOGGLE (DOWNSCALED ~35%)
   ========================================================================== */
.theme-toggle-container {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  padding: 0.25rem 0 !important;
}

.main-toggle {
  --toggle-width: 60px;
  --toggle-height: 26px;
  --knob-width: 26px;
  --knob-height: 32px;
  --track-bg-unchecked: #2ecc71;
  --track-bg-checked: #e74c3c;
  --knob-bg: #f5f5f5;
  --border-color: #000000;
  --shadow-color: rgba(0, 0, 0, 0.4);

  position: relative !important;
  display: inline-block !important;
  width: 60px !important;
  height: 26px !important;
  cursor: pointer !important;
  user-select: none !important;
  overflow: visible !important;
}

.main-checkbox {
  opacity: 0 !important;
  width: 0 !important;
  height: 0 !important;
  position: absolute !important;
  margin: 0 !important;
  padding: 0 !important;
  pointer-events: none !important;
}

.main-track {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  background-color: #2ecc71 !important;
  border: 2.5px solid #000000 !important;
  border-radius: 9999px !important;
  box-shadow: 2px 2px 0px rgba(0, 0, 0, 0.4) !important;
  transition: background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  box-sizing: border-box !important;
}

.main-knob {
  position: absolute !important;
  top: 50% !important;
  left: -2px !important;
  width: 26px !important;
  height: 32px !important;
  background-color: #f5f5f5 !important;
  border: 2.5px solid #000000 !important;
  border-radius: 9999px !important;
  box-shadow: 2px 2px 0px rgba(0, 0, 0, 0.4) !important;
  transform: translate(0, -50%) !important;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s ease !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  box-sizing: border-box !important;
  z-index: 2 !important;
}

.main-knob::after {
  content: ":)" !important;
  font-family: monospace, sans-serif !important;
  font-weight: 900 !important;
  font-size: 14px !important;
  color: #000000 !important;
  transform: rotate(90deg) !important;
  display: block !important;
  line-height: 1 !important;
}

.main-checkbox:checked + .main-track {
  background-color: #e74c3c !important;
}

.main-checkbox:checked ~ .main-knob {
  transform: translate(34px, -50%) !important;
}

.main-checkbox:checked ~ .main-knob::after {
  content: ":(" !important;
}

/* ==========================================================================
   CYBER-TERMINAL "SECURE_DATA" LOGIN INTERFACE
   ========================================================================== */
.terminal-login-wrapper,
.glitch-form-wrapper {
  --bg-color: #0d0d0d;
  --primary-color: #00f2ea;
  --secondary-color: #a855f7;
  --text-color: #e5e5e5;
  --font-family: "Fira Code", Consolas, "Courier New", Courier, monospace;
  --glitch-anim-duration: 0.5s;

  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  font-family: var(--font-family) !important;
  background-color: #050505 !important;
  min-height: 100vh !important;
  width: 100vw !important;
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  z-index: 99999 !important;
}

#loginModal[hidden],
#loginModal.hidden,
#authGate[hidden],
#authGate.hidden,
.terminal-login-wrapper[hidden],
.terminal-login-wrapper.hidden,
.glitch-form-wrapper[hidden],
.glitch-form-wrapper.hidden {
  display: none !important;
}

/* Outer Bounding Box with Subtle Cyan Border Framing */
.terminal-frame {
  padding: 1px !important;
  border: 1px solid rgba(0, 242, 234, 0.3) !important;
  box-shadow: 0 0 25px rgba(0, 242, 234, 0.12), inset 0 0 15px rgba(0, 0, 0, 0.6) !important;
  background: rgba(0, 242, 234, 0.03) !important;
  width: 100% !important;
  max-width: 400px !important;
  margin: 1.5rem !important;
  box-sizing: border-box !important;
}

/* Hide legacy sign-up tabs or toggle bars */
.terminal-login-wrapper .tabs,
.terminal-login-wrapper .auth-nav,
.terminal-login-wrapper .toggle-container,
.terminal-login-wrapper .auth-tabs,
.glitch-form-wrapper .tabs,
.glitch-form-wrapper .auth-nav,
.glitch-form-wrapper .toggle-container,
.glitch-form-wrapper .auth-tabs {
  display: none !important;
}

/* Terminal Card Structure */
.terminal-card,
.glitch-card {
  background-color: var(--bg-color) !important;
  width: 100% !important;
  max-width: 400px !important;
  border: 1px solid rgba(0, 242, 234, 0.2) !important;
  box-shadow:
    0 0 20px rgba(0, 242, 234, 0.1),
    inset 0 0 10px rgba(0, 0, 0, 0.5) !important;
  overflow: hidden !important;
  margin: 0 !important;
  border-radius: 0 !important;
  box-sizing: border-box !important;
}

/* Terminal Header */
.terminal-header,
.glitch-card .card-header {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  background-color: rgba(0, 0, 0, 0.3) !important;
  padding: 0.6em 1.2em !important;
  border-bottom: 1px solid rgba(0, 242, 234, 0.2) !important;
}

.terminal-title,
.glitch-card .card-title {
  color: var(--primary-color) !important;
  font-size: 0.82rem !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.12em !important;
  display: flex !important;
  align-items: center !important;
  gap: 0.5em !important;
  font-family: var(--font-family) !important;
}

.terminal-title svg,
.glitch-card .card-title svg {
  width: 18px !important;
  height: 18px !important;
  stroke: var(--primary-color) !important;
  flex-shrink: 0 !important;
}

.terminal-dots,
.glitch-card .card-dots {
  display: flex !important;
  align-items: center !important;
  gap: 5px !important;
}

.terminal-dots span,
.glitch-card .card-dots span {
  display: inline-block !important;
  width: 7px !important;
  height: 7px !important;
  border-radius: 50% !important;
  background-color: #333333 !important;
}

/* Terminal Body */
.terminal-body,
.glitch-card .card-body {
  padding: 1.5rem !important;
}

/* Distinct Fields & Labels */
.terminal-field,
.glitch-card .form-group {
  position: relative !important;
  margin-bottom: 1.8rem !important;
  padding-top: 10px !important;
  display: flex !important;
  flex-direction: column !important;
}

.terminal-label,
.glitch-card .form-label {
  font-size: 0.85rem !important;
  color: var(--primary-color) !important;
  opacity: 0.75 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.1em !important;
  pointer-events: none !important;
  font-family: var(--font-family) !important;
  z-index: 2 !important;
  margin-bottom: 4px !important;
  display: block !important;
}

/* Floating labels for legacy glitch forms */
.glitch-card .form-group {
  position: relative !important;
  margin-bottom: 1.8rem !important;
  padding-top: 10px !important;
}

.glitch-card .form-label {
  position: absolute !important;
  top: 14px !important;
  left: 0 !important;
}

.glitch-card .form-group input:focus + .form-label,
.glitch-card .form-group input:not(:placeholder-shown) + .form-label,
.glitch-card .form-group input:-webkit-autofill + .form-label {
  top: -12px !important;
  font-size: 0.72rem !important;
  opacity: 1 !important;
  color: #00f2ea !important;
}

/* Glowing Cyan Underline Inputs */
.terminal-field input,
.terminal-card input,
.glitch-card input,
.glitch-form-wrapper input,
#loginForm input,
#authSignInUsername,
#authSignInPassword,
#username,
#password {
  width: 100% !important;
  background: transparent !important;
  background-color: transparent !important;
  border: none !important;
  border-bottom: 2px solid rgba(0, 242, 234, 0.4) !important;
  border-radius: 0 !important;
  padding: 8px 0 6px 0 !important;
  font-size: 1rem !important;
  color: var(--text-color) !important;
  font-family: var(--font-family) !important;
  outline: none !important;
  box-shadow: none !important;
  height: 42px !important;
  min-height: 42px !important;
  max-height: 42px !important;
  transition: all 0.25s ease !important;
  box-sizing: border-box !important;
}

.terminal-field input:focus,
.terminal-card input:focus,
.glitch-card input:focus,
#loginForm input:focus,
#username:focus,
#password:focus,
#authSignInUsername:focus,
#authSignInPassword:focus {
  border-bottom-color: var(--primary-color) !important;
  box-shadow: 0 2px 12px rgba(0, 242, 234, 0.3) !important;
}

/* Browser Autofill Overrides */
.terminal-field input:-webkit-autofill,
.terminal-field input:-webkit-autofill:hover,
.terminal-field input:-webkit-autofill:focus,
.terminal-field input:-webkit-autofill:active,
#username:-webkit-autofill,
#username:-webkit-autofill:hover,
#username:-webkit-autofill:focus,
#username:-webkit-autofill:active,
#password:-webkit-autofill,
#password:-webkit-autofill:hover,
#password:-webkit-autofill:focus,
#password:-webkit-autofill:active,
.glitch-card input:-webkit-autofill,
.glitch-card input:-webkit-autofill:hover,
.glitch-card input:-webkit-autofill:focus,
.glitch-card input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 1000px #0d0d0d inset !important;
  -webkit-text-fill-color: #00f2ea !important;
  caret-color: #00f2ea !important;
  font-family: var(--font-family) !important;
  transition: background-color 5000s ease-in-out 0s !important;
}

/* Rectangular Submit Button (INITIATE_CONNECTION / LOG IN) with Hover Glitch & Glow */
.terminal-submit-btn,
.glitch-card .submit-btn,
#loginBtn,
#authSignInBtn {
  width: 100% !important;
  padding: 0.85em 1em !important;
  margin-top: 1.25rem !important;
  background-color: transparent !important;
  border: 2px solid var(--primary-color) !important;
  border-radius: 0 !important;
  color: var(--primary-color) !important;
  font-family: var(--font-family) !important;
  font-size: 0.95rem !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.18em !important;
  cursor: pointer !important;
  position: relative !important;
  transition: all 0.3s ease !important;
  overflow: hidden !important;
  box-shadow: none !important;
  box-sizing: border-box !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.terminal-submit-btn:hover,
.terminal-submit-btn:focus,
.glitch-card .submit-btn:hover,
.glitch-card .submit-btn:focus,
#loginBtn:hover,
#loginBtn:focus,
#authSignInBtn:hover,
#authSignInBtn:focus {
  background-color: var(--primary-color) !important;
  color: var(--bg-color) !important;
  box-shadow: 0 0 25px var(--primary-color) !important;
  outline: none !important;
}

.terminal-submit-btn:active,
.glitch-card .submit-btn:active,
#loginBtn:active,
#authSignInBtn:active {
  transform: scale(0.97) !important;
}

.terminal-submit-btn .btn-label,
.terminal-submit-btn .btn-text,
.glitch-card .submit-btn .btn-text,
#loginBtn .btn-label,
#authSignInBtn .btn-text {
  position: relative !important;
  z-index: 1 !important;
  transition: opacity 0.2s ease !important;
}

.terminal-submit-btn:hover .btn-label,
.terminal-submit-btn:hover .btn-text,
.glitch-card .submit-btn:hover .btn-text,
#loginBtn:hover .btn-label,
#authSignInBtn:hover .btn-text {
  opacity: 0 !important;
}

.terminal-submit-btn::before,
.terminal-submit-btn::after,
.glitch-card .submit-btn::before,
.glitch-card .submit-btn::after,
#loginBtn::before,
#loginBtn::after,
#authSignInBtn::before,
#authSignInBtn::after {
  content: attr(data-text) !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  opacity: 0 !important;
  background-color: var(--primary-color) !important;
  transition: opacity 0.2s ease !important;
}

.terminal-submit-btn:hover::before,
.terminal-submit-btn:focus::before,
.glitch-card .submit-btn:hover::before,
.glitch-card .submit-btn:focus::before,
#loginBtn:hover::before,
#loginBtn:focus::before,
#authSignInBtn:hover::before,
#authSignInBtn:focus::before {
  opacity: 1 !important;
  color: var(--secondary-color) !important;
  animation: glitch-anim var(--glitch-anim-duration) cubic-bezier(0.25, 0.46, 0.45, 0.94) both !important;
}

.terminal-submit-btn:hover::after,
.terminal-submit-btn:focus::after,
.glitch-card .submit-btn:hover::after,
.glitch-card .submit-btn:focus::after,
#loginBtn:hover::after,
#loginBtn:focus::after,
#authSignInBtn:hover::after,
#authSignInBtn:focus::after {
  opacity: 1 !important;
  color: var(--bg-color) !important;
  animation: glitch-anim var(--glitch-anim-duration) cubic-bezier(0.25, 0.46, 0.45, 0.94) reverse both !important;
}

@keyframes glitch-anim {
  0% { transform: translate(0); clip-path: inset(0 0 0 0); }
  20% { transform: translate(-5px, 3px); clip-path: inset(50% 0 20% 0); }
  40% { transform: translate(3px, -2px); clip-path: inset(20% 0 60% 0); }
  60% { transform: translate(-4px, 2px); clip-path: inset(80% 0 5% 0); }
  80% { transform: translate(4px, -3px); clip-path: inset(30% 0 45% 0); }
  100% { transform: translate(0); clip-path: inset(0 0 0 0); }
}

@media (prefers-reduced-motion: reduce) {
  .terminal-submit-btn:hover::before,
  .terminal-submit-btn:focus::before,
  .terminal-submit-btn:hover::after,
  .terminal-submit-btn:focus::after,
  .glitch-card .submit-btn:hover::before,
  .glitch-card .submit-btn:focus::before,
  .glitch-card .submit-btn:hover::after,
  .glitch-card .submit-btn:focus::after {
    animation: none !important;
    opacity: 0 !important;
  }

  .terminal-submit-btn:hover .btn-label,
  .glitch-card .submit-btn:hover .btn-text {
    opacity: 1 !important;
  }
}

/* Compact Horizontal Screenshot Zone (<55px) */
#maintenancePanel .screenshot-zone,
#maintenancePanel .upload-container,
#eodPanel .eod-proof-zone,
#eodPanel .screenshot-zone,
#eodPanel .upload-container {
  min-height: 48px !important;
  max-height: 56px !important;
  height: auto !important;
  padding: 6px 14px !important;
  margin: 10px 0 !important;
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  gap: 14px !important;
  border: 1px dashed rgba(255, 255, 255, 0.2) !important;
  border-radius: 12px !important;
  background: rgba(15, 23, 42, 0.4) !important;
}

#maintenancePanel .screenshot-preview img,
#maintenancePanel img[src^="data:image"],
#eodPanel .eod-proof-item img,
#eodPanel img[src^="data:image"] {
  height: 38px !important;
  max-height: 38px !important;
  width: auto !important;
  border-radius: 6px !important;
}

.terminal-card .auth-message {
  color: #ff4d4f !important;
  font-family: var(--font-family) !important;
  font-size: 0.8rem !important;
  margin-top: 1rem !important;
  text-align: center !important;
  letter-spacing: 0.05em !important;
}
"@

# Replace Part 1 & 2 styles in index.html & style.css
$part1And2Regex = '(?s)/\* -+.*?PART 1: SMILEY / FROWNY.*?/\* -+.*?PART 3: EDR & CCTV AUDIT FORM'
$replacementSection = $cyberTerminalCss + "`r`n`r`n/* --------------------------------------------------------------------------`r`n   PART 3: EDR & CCTV AUDIT FORM"

if ($styleContent -match $part1And2Regex) {
    $styleContent = [regex]::Replace($styleContent, $part1And2Regex, $replacementSection, 1)
    Write-Host "[OK] Updated style.css with SECURE_DATA styles and downscaled toggle"
} else {
    $styleContent = $styleContent + "`r`n`r`n" + $cyberTerminalCss
    Write-Host "[OK] Appended SECURE_DATA styles to style.css"
}

if ($indexContent -match $part1And2Regex) {
    $indexContent = [regex]::Replace($indexContent, $part1And2Regex, $replacementSection, 1)
    Write-Host "[OK] Updated index.html with SECURE_DATA styles and downscaled toggle"
} else {
    $targetIndex = "</style>`r`n`r`n</head>"
    if (-not $indexContent.Contains($targetIndex)) {
        $targetIndex = "</style>`n`n</head>"
    }
    if ($indexContent.Contains($targetIndex)) {
        $indexContent = $indexContent.Replace($targetIndex, $cyberTerminalCss + "`r`n" + $targetIndex)
        Write-Host "[OK] Injected SECURE_DATA styles into index.html <style>"
    }
}

# -----------------------------------------------------------------------------
# 3. Update cctvAccountAuthScript in index.html
# -----------------------------------------------------------------------------
$oldHelper = '    const $ = id => document.getElementById(id);'
$newHelper = @"
    const ID_ALIASES = {
        authGate: "loginModal",
        authSignInForm: "loginForm",
        authSignInUsername: "username",
        authSignInPassword: "password",
        authSignInBtn: "loginBtn"
    };
    const $ = id => document.getElementById(id) || (ID_ALIASES[id] ? document.getElementById(ID_ALIASES[id]) : null);
"@
if ($indexContent.Contains($oldHelper)) {
    $indexContent = $indexContent.Replace($oldHelper, $newHelper)
    Write-Host "[OK] Updated `$` helper with ID_ALIASES in index.html"
}

# Update message and busy functions
$oldMessageBusyRegex = '(?s)function message\(text, kind = "error"\)\s*\{.*?function signedOut\(\)\s*\{.*?location\.reload\(\), 0\);\s*\}\s*\}'
$newMessageBusy = @"
    function message(text, kind = "error") {
        let el = document.getElementById("authMessage");
        if (!text) {
            if (el) {
                el.hidden = true;
                el.textContent = "";
                el.className = "auth-message";
            }
            return;
        }
        if (!el || el.closest(".auth-gate-compat")) {
            let termMsg = document.querySelector(".terminal-body .auth-message");
            if (!termMsg) {
                termMsg = document.createElement("div");
                termMsg.id = "authMessage";
                termMsg.className = "auth-message";
                document.querySelector(".terminal-body")?.appendChild(termMsg);
            }
            el = termMsg;
        }
        el.hidden = false;
        el.textContent = text;
        el.className = "auth-message " + kind;
    }

    function busy(btn, on, text) {
        if (!btn) return;
        const label = btn.querySelector(".btn-label") || btn.querySelector(".btn-text");
        if (label) {
            if (on) {
                label.dataset.old = label.textContent;
                label.textContent = text || "Connecting...";
                btn.disabled = true;
            } else {
                label.textContent = label.dataset.old || label.textContent;
                btn.disabled = false;
            }
            return;
        }
        if (on) {
            btn.dataset.old = btn.textContent;
            btn.textContent = text || "Please wait...";
            btn.disabled = true;
        } else {
            btn.textContent = btn.dataset.old || btn.textContent;
            btn.disabled = false;
        }
    }

    function setAuthGateInputsDisabled(disabled) {
        const gates = [document.getElementById("loginModal"), document.getElementById("authGate")];
        gates.forEach(gate => {
            if (!gate) return;
            gate.querySelectorAll("input, button, select, textarea").forEach(el => {
                el.disabled = !!disabled;
            });
        });
    }

    function showForm(type = "signin") {
        setAuthGateInputsDisabled(false);
        $("authForms").hidden = false;
        $("authWaitingState").hidden = true;
        $("authRejectedState").hidden = true;
        $("authSignInForm").hidden = type !== "signin";
        $("authSignUpForm").hidden = type !== "signup";
        $("authSignInTab").classList.toggle("active", type === "signin");
        $("authSignUpTab").classList.toggle("active", type === "signup");
        message("");
    }

    function lockPending(u) {
        setAuthGateInputsDisabled(false);
        document.body.classList.add("auth-locked");
        const modal = document.getElementById("loginModal");
        if (modal) modal.hidden = true;
        const gate = document.getElementById("authGate");
        if (gate) {
            gate.hidden = false;
            gate.style.display = "flex";
        }
        $("authForms").hidden = true;
        $("authRejectedState").hidden = true;
        $("authWaitingState").hidden = false;
        $("authWaitingEmail").textContent = usernameLabel(profileUsername(profile, u));
        startPendingCheck();
    }

    function lockRejected(u) {
        setAuthGateInputsDisabled(false);
        document.body.classList.add("auth-locked");
        const modal = document.getElementById("loginModal");
        if (modal) modal.hidden = true;
        const gate = document.getElementById("authGate");
        if (gate) {
            gate.hidden = false;
            gate.style.display = "flex";
        }
        $("authForms").hidden = true;
        $("authWaitingState").hidden = true;
        $("authRejectedState").hidden = false;
        $("authDisabledState").hidden = true;
        $("authRejectedEmail").textContent = usernameLabel(profileUsername(profile, u));
        stopPendingCheck();
    }

    function lockDisabled(u) {
        setAuthGateInputsDisabled(false);
        document.body.classList.add("auth-locked");
        const modal = document.getElementById("loginModal");
        if (modal) modal.hidden = true;
        const gate = document.getElementById("authGate");
        if (gate) {
            gate.hidden = false;
            gate.style.display = "flex";
        }
        $("authForms").hidden = true;
        $("authWaitingState").hidden = true;
        $("authRejectedState").hidden = true;
        $("authDisabledState").hidden = false;
        $("authDisabledEmail").textContent = usernameLabel(profileUsername(profile, u));
        stopPendingCheck();
    }

    function signedOut() {
        clearRecentCredentials();
        setAuthGateInputsDisabled(false);
        const scopeNeedsReload = !!window.CCTV_DATA_SCOPE?.deactivate?.();
        user = null;
        profile = null;
        openedLoggedFor = null;
        signInLoggedFor = null;
        window.CCTV_ACCOUNT_CONTEXT = null;
        document.body.classList.remove("auth-role-admin", "auth-role-user");
        document.body.classList.add("auth-locked");
        const modal = document.getElementById("loginModal");
        if (modal) modal.hidden = false;
        const gate = document.getElementById("authGate");
        if (gate) {
            gate.hidden = true;
            gate.style.display = "none";
        }
        $("authDisabledState").hidden = true;
        $("authSidebarAccount").hidden = true;
        $("adminTabBtn").hidden = true;
        $("adminPanel").hidden = true;
        stopPendingCheck();
        stopAdminMonitor();
        showForm("signin");

        // Prevent the next account on the same browser from inheriting
        // in-memory EDR/Audit/Maintenance state from the previous account.
        if (scopeNeedsReload) {
            setTimeout(() => location.reload(), 0);
        }
    }
"@
if ($indexContent -match $oldMessageBusyRegex) {
    $indexContent = [regex]::Replace($indexContent, $oldMessageBusyRegex, $newMessageBusy, 1)
    Write-Host "[OK] Updated auth state & modal display logic in index.html"
}

# Update applySession hide logic
$oldApplySessionHide = 'setAuthGateInputsDisabled(true);' + "`r`n" + '        $("authGate").hidden = true;'
$newApplySessionHide = @"
setAuthGateInputsDisabled(true);
        const modal = document.getElementById("loginModal");
        if (modal) modal.hidden = true;
        const gate = document.getElementById("authGate");
        if (gate) {
            gate.hidden = true;
            gate.style.display = "none";
        }
"@
if ($indexContent.Contains($oldApplySessionHide)) {
    $indexContent = $indexContent.Replace($oldApplySessionHide, $newApplySessionHide)
    Write-Host "[OK] Updated applySession hide logic in index.html"
} else {
    $oldApplySessionHideLf = 'setAuthGateInputsDisabled(true);' + "`n" + '        $("authGate").hidden = true;'
    if ($indexContent.Contains($oldApplySessionHideLf)) {
        $indexContent = $indexContent.Replace($oldApplySessionHideLf, $newApplySessionHide)
        Write-Host "[OK] Updated applySession hide logic (LF) in index.html"
    }
}

# Update submit listener to handle both loginForm and authSignInForm
$oldSubmitListener = @"
    $("authSignInForm")?.addEventListener("submit", async e => {
        e.preventDefault();
        message("");
        const btn = $("authSignInBtn");
        busy(btn, true, "Signing in...");
        try {
            const loginValue = clean($("authSignInUsername").value);
            if (!loginValue) throw new Error("Enter your username or email.");
            if (!loginValue.includes("@") && !validUsername(loginValue)) {
                throw new Error("Enter a valid username or email.");
            }

            const email = await resolveLoginIdentifier(loginValue);
            if (!email) throw new Error("Incorrect username/email or password.");

            const { data, error } = await client.auth.signInWithPassword({
                email,
                password: $("authSignInPassword").value
            });
            if (error) throw error;
            await applySession(data.session, "SIGNED_IN");
        } catch (err) {
            message(err.message === "Invalid login credentials" ? "Incorrect username/email or password." : err.message);
        } finally {
            busy(btn, false);
        }
    });
"@

$newSubmitListener = @"
    const handleLoginSubmit = async e => {
        e.preventDefault();
        message("");
        const btn = $("loginBtn") || $("authSignInBtn");
        busy(btn, true, "CONNECTING...");
        try {
            const usernameInput = $("username") || $("authSignInUsername");
            const passwordInput = $("password") || $("authSignInPassword");
            const loginValue = clean(usernameInput ? usernameInput.value : "");
            if (!loginValue) throw new Error("Enter your username or access key.");
            if (!loginValue.includes("@") && !validUsername(loginValue)) {
                throw new Error("Enter a valid username or access key.");
            }

            const email = await resolveLoginIdentifier(loginValue);
            if (!email) throw new Error("Incorrect username/access key or password.");

            const passwordValue = passwordInput ? passwordInput.value : "";
            const { data, error } = await client.auth.signInWithPassword({
                email,
                password: passwordValue
            });
            if (error) throw error;
            await applySession(data.session, "SIGNED_IN");
        } catch (err) {
            message(err.message === "Invalid login credentials" ? "Incorrect username or access key." : err.message);
        } finally {
            busy(btn, false);
        }
    };

    $("loginForm")?.addEventListener("submit", handleLoginSubmit);
    $("authSignInForm")?.addEventListener("submit", handleLoginSubmit);
"@

if ($indexContent.Contains($oldSubmitListener)) {
    $indexContent = $indexContent.Replace($oldSubmitListener, $newSubmitListener)
    Write-Host "[OK] Replaced submit listener in index.html"
} else {
    $oldSubmitRegex = '(?s)\$\("authSignInForm"\)\?\.addEventListener\("submit",\s*async\s*e\s*=>\s*\{.*?\n\s*\}\);\n'
    if ($indexContent -match $oldSubmitRegex) {
        $indexContent = [regex]::Replace($indexContent, $oldSubmitRegex, $newSubmitListener, 1)
        Write-Host "[OK] Replaced submit listener via regex in index.html"
    }
}

# -----------------------------------------------------------------------------
# 4. Save files with UTF-8 No BOM
# -----------------------------------------------------------------------------
[System.IO.File]::WriteAllText($stylePath, $styleContent, $utf8NoBom)
[System.IO.File]::WriteAllText($indexPath, $indexContent, $utf8NoBom)
Write-Host "[SUCCESS] index.html and style.css updated with Cyber-Terminal SECURE_DATA login replica!"
