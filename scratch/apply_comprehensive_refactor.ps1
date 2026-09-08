$ErrorActionPreference = "Stop"

$indexPath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\index.html"
$stylePath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\style.css"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$indexContent = [System.IO.File]::ReadAllText($indexPath, $utf8NoBom)
$styleContent = [System.IO.File]::ReadAllText($stylePath, $utf8NoBom)

# -----------------------------------------------------------------------------
# 1. Update HTML in index.html: Theme Toggle Switch
# -----------------------------------------------------------------------------
$oldThemeToggle = @"
    <button
        id="themeToggle"
        type="button"
        onclick="toggleTheme()"
        title="Toggle Light / Dark Mode"
        class="sidebar-theme-btn theme-switch-control"
        aria-label="Toggle Light and Dark Mode">
        <span class="theme-switch-label theme-switch-light">Light</span>
        <span class="theme-switch-track" aria-hidden="true">
            <span class="theme-switch-thumb"></span>
        </span>
        <span class="theme-switch-label theme-switch-dark">Dark</span>
    </button>
"@

$newThemeToggle = @"
    <div class="theme-toggle-container">
      <label class="main-toggle" for="themeToggle" title="Toggle Light / Dark Mode">
        <input type="checkbox" id="themeToggle" class="main-checkbox" onchange="toggleTheme()" aria-label="Toggle Light and Dark Mode" />
        <div class="main-track"></div>
        <div class="main-knob"></div>
      </label>
    </div>
"@

if ($indexContent.Contains($oldThemeToggle)) {
    $indexContent = $indexContent.Replace($oldThemeToggle, $newThemeToggle)
    Write-Host "[OK] Replaced theme toggle button with Neo-Brutalist Smiley/Frowny toggle"
} else {
    Write-Host "[WARN] Old theme toggle button exact pattern not found, trying regex"
    $regex = '(?s)<button\s+id="themeToggle".*?</button>'
    if ($indexContent -match $regex) {
        $indexContent = [regex]::Replace($indexContent, $regex, $newThemeToggle, 1)
        Write-Host "[OK] Replaced theme toggle button via regex"
    } else {
        Write-Host "[SKIP] Theme toggle already updated or not matched"
    }
}

# -----------------------------------------------------------------------------
# 2. Update HTML in index.html: Cyber-Terminal Glitch Login in #authGate
# -----------------------------------------------------------------------------
$oldAuthGateRegex = '(?s)<div id="authGate" class="auth-gate.*?</section>\s*</div>'

$newAuthGate = @"
<div id="authGate" class="auth-gate glitch-form-wrapper">
  <div class="auth-gate-bg"></div>
  <section class="auth-card glitch-card">
    <div class="card-header auth-brand">
      <div class="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
        <span>CCTV OPS TERMINAL</span>
      </div>
      <div class="card-dots">
        <span></span><span></span><span></span>
      </div>
    </div>

    <div class="card-body">
      <div id="authConfigMissing" class="auth-config-missing" hidden>
        <strong>Supabase setup required.</strong>
        <span>Complete the supplied setup steps, then fill in <code>auth-config.js</code>.</span>
      </div>

      <div id="authForms">
        <div class="auth-tabs">
          <button type="button" id="authSignInTab" class="auth-tab active">Sign In</button>
          <button type="button" id="authSignUpTab" class="auth-tab">Sign Up</button>
        </div>

        <form id="authSignInForm" class="auth-form" autocomplete="on">
          <div class="form-group">
            <input type="text" id="authSignInUsername" name="username" required autocomplete="username" placeholder=" " maxlength="120">
            <label class="form-label" data-text="Username or Email">Username or Email</label>
          </div>
          <div class="form-group auth-password-wrap">
            <input type="password" id="authSignInPassword" name="password" required autocomplete="current-password" placeholder=" ">
            <label class="form-label" data-text="Password">Password</label>
            <button type="button" class="auth-password-toggle" data-target="authSignInPassword" aria-label="Show password" title="Show password">
              <svg class="auth-eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.4 12s3.5-6 9.6-6 9.6 6 9.6 6-3.5 6-9.6 6-9.6-6Z"/><circle cx="12" cy="12" r="2.6"/></svg>
              <svg class="auth-eye-closed" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 6.1A10.8 10.8 0 0 1 12 6c6.1 0 9.6 6 9.6 6a16.7 16.7 0 0 1-3.1 3.7M14.5 14.5A3.5 3.5 0 0 1 9.5 9.5M6.2 6.2C3.7 8 2.4 12 2.4 12s3.5 6 9.6 6c1.5 0 2.8-.4 4-.9"/></svg>
            </button>
          </div>
          <button type="submit" class="submit-btn auth-primary-btn" id="authSignInBtn" data-text="LOG IN">
            <span class="btn-text">LOG IN</span>
          </button>
        </form>

        <form id="authSignUpForm" class="auth-form" autocomplete="on" hidden>
          <div class="form-group">
            <input type="text" id="authSignUpName" name="name" required autocomplete="name" placeholder=" ">
            <label class="form-label" data-text="Full Name">Full Name</label>
          </div>
          <div class="form-group">
            <input type="text" id="authSignUpUsername" name="username" required autocomplete="username" placeholder=" " maxlength="60">
            <label class="form-label" data-text="Username">Username</label>
          </div>
          <div class="form-group auth-password-wrap">
            <input type="password" id="authSignUpPassword" name="password" minlength="6" required autocomplete="new-password" placeholder=" ">
            <label class="form-label" data-text="Password">Password</label>
            <button type="button" class="auth-password-toggle" data-target="authSignUpPassword" aria-label="Show password" title="Show password">
              <svg class="auth-eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.4 12s3.5-6 9.6-6 9.6 6 9.6 6-3.5 6-9.6 6-9.6-6Z"/><circle cx="12" cy="12" r="2.6"/></svg>
              <svg class="auth-eye-closed" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 6.1A10.8 10.8 0 0 1 12 6c6.1 0 9.6 6 9.6 6a16.7 16.7 0 0 1-3.1 3.7M14.5 14.5A3.5 3.5 0 0 1 9.5 9.5M6.2 6.2C3.7 8 2.4 12 2.4 12s3.5 6 9.6 6c1.5 0 2.8-.4 4-.9"/></svg>
            </button>
          </div>
          <div class="form-group auth-password-wrap">
            <input type="password" id="authSignUpConfirm" name="confirm-password" minlength="6" required autocomplete="new-password" placeholder=" ">
            <label class="form-label" data-text="Confirm Password">Confirm Password</label>
            <button type="button" class="auth-password-toggle" data-target="authSignUpConfirm" aria-label="Show password" title="Show password">
              <svg class="auth-eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.4 12s3.5-6 9.6-6 9.6 6 9.6 6-3.5 6-9.6 6-9.6-6Z"/><circle cx="12" cy="12" r="2.6"/></svg>
              <svg class="auth-eye-closed" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 6.1A10.8 10.8 0 0 1 12 6c6.1 0 9.6 6 9.6 6a16.7 16.7 0 0 1-3.1 3.7M14.5 14.5A3.5 3.5 0 0 1 9.5 9.5M6.2 6.2C3.7 8 2.4 12 2.4 12s3.5 6 9.6 6c1.5 0 2.8-.4 4-.9"/></svg>
            </button>
          </div>
          <button type="submit" class="submit-btn auth-primary-btn" id="authSignUpBtn" data-text="CREATE ACCOUNT">
            <span class="btn-text">CREATE ACCOUNT</span>
          </button>
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
  </section>
</div>
"@

if ($indexContent -match $oldAuthGateRegex) {
    $indexContent = [regex]::Replace($indexContent, $oldAuthGateRegex, $newAuthGate, 1)
    Write-Host "[OK] Integrated Cyber-Terminal Glitch Login in index.html"
} else {
    Write-Host "[WARN] authGate pattern not matched"
}

# -----------------------------------------------------------------------------
# 3. Update setThemeToggleIcon in index.html
# -----------------------------------------------------------------------------
$oldSetThemeIcon = @"
    function setThemeToggleIcon(isDark) {
        const toggle = document.getElementById('themeToggle');
        if (!toggle) return;
        toggle.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
        toggle.setAttribute('aria-label', isDark ? 'Dark Mode active. Switch to Light Mode' : 'Light Mode active. Switch to Dark Mode');
    }
"@

$newSetThemeIcon = @"
    function setThemeToggleIcon(isDark) {
        const toggle = document.getElementById('themeToggle');
        if (!toggle) return;
        if (toggle.type === 'checkbox') {
            toggle.checked = !isDark;
        }
        toggle.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
        toggle.setAttribute('aria-label', isDark ? 'Dark Mode active. Switch to Light Mode' : 'Light Mode active. Switch to Dark Mode');
    }
"@

if ($indexContent.Contains($oldSetThemeIcon)) {
    $indexContent = $indexContent.Replace($oldSetThemeIcon, $newSetThemeIcon)
    Write-Host "[OK] Updated setThemeToggleIcon to support checkbox theme toggle"
}

# -----------------------------------------------------------------------------
# 4. Master Refactoring CSS Block
# -----------------------------------------------------------------------------
$refactorCss = @"

/* ==========================================================================
   COMPREHENSIVE UI/UX ARCHITECTURAL REFACTORING
   ========================================================================== */

/* --------------------------------------------------------------------------
   PART 1: NEO-BRUTALIST SMILEY / FROWNY THEME SWITCHER
   -------------------------------------------------------------------------- */
.theme-toggle-container {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 12px 0 16px 0 !important;
  background: transparent !important;
  border: none !important;
}

.main-toggle {
  position: relative !important;
  display: block !important;
  width: 90px !important;
  height: 40px !important;
  cursor: pointer !important;
  user-select: none !important;
  -webkit-tap-highlight-color: transparent !important;
  margin: 0 auto !important;
}

.main-checkbox {
  display: none !important;
}

.main-track {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  background-color: #2ecc71 !important;
  border: 4px solid #000000 !important;
  box-sizing: border-box !important;
  box-shadow: inset 2px 2px 0 rgba(0, 0, 0, 0.1) !important;
  transition: background-color 0.3s ease !important;
}

.main-knob {
  position: absolute !important;
  top: 50% !important;
  left: 0 !important;
  transform: translate(-4px, -50%) !important;
  width: 40px !important;
  height: 46px !important;
  background: #ffffff !important;
  border: 4px solid #000000 !important;
  box-shadow: 3px 3px 0 #000000 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  z-index: 2 !important;
  box-sizing: border-box !important;
  transition: transform 0.3s cubic-bezier(0.7, -0.4, 0.4, 1.4) !important;
}

.main-toggle:active .main-knob {
  box-shadow: 1px 1px 0 #000000 !important;
  margin-top: 2px !important;
  margin-left: 2px !important;
}

.main-knob::after {
  content: ":)" !important;
  font-family: monospace, sans-serif !important;
  font-weight: 900 !important;
  font-size: 22px !important;
  color: #000000 !important;
  transform: rotate(90deg) !important;
  display: block !important;
  line-height: 1 !important;
}

.main-checkbox:checked + .main-track {
  background-color: #e74c3c !important;
}

.main-checkbox:checked ~ .main-knob {
  transform: translate(50px, -50%) !important;
}

.main-checkbox:checked ~ .main-knob::after {
  content: ":(" !important;
}

/* --------------------------------------------------------------------------
   PART 2: CYBER-TERMINAL GLITCH LOGIN TERMINAL
   -------------------------------------------------------------------------- */
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

#authGate[hidden],
.glitch-form-wrapper[hidden] {
  display: none !important;
}

.glitch-card {
  background-color: var(--bg-color) !important;
  width: 100% !important;
  max-width: 400px !important;
  border: 1px solid rgba(0, 242, 234, 0.2) !important;
  box-shadow: 0 0 20px rgba(0, 242, 234, 0.1), inset 0 0 10px rgba(0, 0, 0, 0.5) !important;
  overflow: hidden !important;
  margin: 1rem !important;
  border-radius: 0 !important;
  box-sizing: border-box !important;
}

.glitch-card .card-header {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  background-color: rgba(0, 0, 0, 0.3) !important;
  padding: 0.7em 1.2em !important;
  border-bottom: 1px solid rgba(0, 242, 234, 0.2) !important;
}

.glitch-card .card-title {
  color: var(--primary-color) !important;
  font-size: 0.85rem !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.12em !important;
  display: flex !important;
  align-items: center !important;
  gap: 0.6em !important;
  font-family: var(--font-family) !important;
}

.glitch-card .card-title svg {
  width: 1.2em !important;
  height: 1.2em !important;
  stroke: var(--primary-color) !important;
}

.glitch-card .card-dots span {
  display: inline-block !important;
  width: 8px !important;
  height: 8px !important;
  border-radius: 50% !important;
  background-color: #333 !important;
  margin-left: 5px !important;
}

.glitch-card .card-body {
  padding: 1.75rem !important;
}

.glitch-card .auth-tabs {
  display: flex !important;
  gap: 8px !important;
  margin-bottom: 1.5rem !important;
  border-bottom: 1px solid rgba(0, 242, 234, 0.15) !important;
  padding-bottom: 8px !important;
}

.glitch-card .auth-tab {
  background: transparent !important;
  border: 1px solid transparent !important;
  color: var(--text-color) !important;
  font-family: var(--font-family) !important;
  font-size: 0.8rem !important;
  letter-spacing: 0.1em !important;
  text-transform: uppercase !important;
  padding: 6px 12px !important;
  cursor: pointer !important;
  opacity: 0.6 !important;
  transition: all 0.2s ease !important;
}

.glitch-card .auth-tab.active {
  opacity: 1 !important;
  color: var(--primary-color) !important;
  border-color: rgba(0, 242, 234, 0.3) !important;
  background: rgba(0, 242, 234, 0.05) !important;
}

.glitch-card .form-group {
  position: relative !important;
  margin-bottom: 1.6rem !important;
  display: block !important;
}

.glitch-card .form-label {
  position: absolute !important;
  top: 0.75em !important;
  left: 0 !important;
  font-size: 0.9rem !important;
  color: var(--primary-color) !important;
  opacity: 0.6 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.1em !important;
  pointer-events: none !important;
  transition: all 0.3s ease !important;
  font-family: var(--font-family) !important;
  margin: 0 !important;
}

.glitch-card .form-group input {
  width: 100% !important;
  background: transparent !important;
  border: none !important;
  border-bottom: 2px solid rgba(0, 242, 234, 0.3) !important;
  border-radius: 0 !important;
  padding: 0.75em 0 !important;
  font-size: 1rem !important;
  color: var(--text-color) !important;
  font-family: var(--font-family) !important;
  outline: none !important;
  box-shadow: none !important;
  transition: border-color 0.3s ease !important;
  box-sizing: border-box !important;
  height: auto !important;
}

.glitch-card .form-group input:focus {
  border-color: var(--primary-color) !important;
}

.glitch-card .form-group input:focus + .form-label,
.glitch-card .form-group input:not(:placeholder-shown) + .form-label {
  top: -1.2em !important;
  font-size: 0.75rem !important;
  opacity: 1 !important;
}

.glitch-card .form-group input:focus + .form-label::before,
.glitch-card .form-group input:focus + .form-label::after {
  content: attr(data-text) !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  background-color: var(--bg-color) !important;
}

.glitch-card .form-group input:focus + .form-label::before {
  color: var(--secondary-color) !important;
  animation: glitch-anim var(--glitch-anim-duration) cubic-bezier(0.25, 0.46, 0.45, 0.94) both !important;
}

.glitch-card .form-group input:focus + .form-label::after {
  color: var(--primary-color) !important;
  animation: glitch-anim var(--glitch-anim-duration) cubic-bezier(0.25, 0.46, 0.45, 0.94) reverse both !important;
}

.glitch-card .auth-password-wrap {
  position: relative !important;
}

.glitch-card .auth-password-toggle {
  position: absolute !important;
  right: 0 !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  background: transparent !important;
  border: none !important;
  cursor: pointer !important;
  color: var(--primary-color) !important;
  padding: 4px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: auto !important;
  height: auto !important;
  z-index: 5 !important;
}

.glitch-card .auth-password-toggle svg {
  width: 18px !important;
  height: 18px !important;
  stroke: var(--primary-color) !important;
}

.glitch-card .submit-btn {
  width: 100% !important;
  padding: 0.85em !important;
  margin-top: 1.25rem !important;
  background-color: transparent !important;
  border: 2px solid var(--primary-color) !important;
  color: var(--primary-color) !important;
  font-family: var(--font-family) !important;
  font-size: 1rem !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.2em !important;
  cursor: pointer !important;
  position: relative !important;
  transition: all 0.3s !important;
  overflow: hidden !important;
  border-radius: 0 !important;
  box-sizing: border-box !important;
}

.glitch-card .submit-btn:hover,
.glitch-card .submit-btn:focus {
  background-color: var(--primary-color) !important;
  color: var(--bg-color) !important;
  box-shadow: 0 0 25px var(--primary-color) !important;
  outline: none !important;
}

.glitch-card .submit-btn:active {
  transform: scale(0.97) !important;
}

.glitch-card .submit-btn .btn-text {
  position: relative !important;
  z-index: 1 !important;
  transition: opacity 0.2s ease !important;
}

.glitch-card .submit-btn:hover .btn-text {
  opacity: 0 !important;
}

.glitch-card .submit-btn::before,
.glitch-card .submit-btn::after {
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

.glitch-card .submit-btn:hover::before,
.glitch-card .submit-btn:focus::before {
  opacity: 1 !important;
  color: var(--secondary-color) !important;
  animation: glitch-anim var(--glitch-anim-duration) cubic-bezier(0.25, 0.46, 0.45, 0.94) both !important;
}

.glitch-card .submit-btn:hover::after,
.glitch-card .submit-btn:focus::after {
  opacity: 1 !important;
  color: var(--bg-color) !important;
  animation: glitch-anim var(--glitch-anim-duration) cubic-bezier(0.25, 0.46, 0.45, 0.94) reverse both !important;
}

/* --------------------------------------------------------------------------
   PART 3: EDR & CCTV AUDIT FORM 3-COLUMN ALIGNMENT & INLINE BUTTON DOCKING
   -------------------------------------------------------------------------- */
.audit-form-grid,
.edr-form-grid,
#auditForm,
#edrForm,
.form-grid,
form:has(#auditDate) {
  display: grid !important;
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  gap: 16px 20px !important;
  width: 100% !important;
  align-items: flex-end !important;
}

.form-group,
.field-block {
  display: flex !important;
  flex-direction: column !important;
  justify-content: flex-end !important;
  gap: 6px !important;
  width: 100% !important;
  margin: 0 !important;
}

.form-group:has(#remarks),
.field-block:has(#remarks),
.form-group:has(textarea),
.field-full {
  grid-column: 1 / -1 !important;
}

.form-group label,
.field-block label {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  letter-spacing: 0.06em !important;
  text-transform: uppercase !important;
  color: #94a3b8 !important;
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
}

.required-mark,
.form-group label span.required,
.form-group label::after {
  color: #ef4444 !important;
  font-size: 13px !important;
  position: static !important;
  transform: none !important;
}

/* Dock '+' and '-' Buttons Inline with Selects */
.input-with-actions,
.select-action-wrapper,
.form-group .input-group,
div:has(> select + button),
div:has(> select + .add-btn),
div:has(> select + .btn-add) {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  gap: 6px !important;
  width: 100% !important;
}

.input-with-actions select,
.select-action-wrapper select,
.form-group .input-group select {
  flex: 1 1 auto !important;
  min-width: 0 !important;
}

.input-with-actions button,
.select-action-wrapper button,
.input-group .add-btn,
.input-group .remove-btn,
button.add-btn,
button.remove-btn {
  height: 40px !important;
  width: 36px !important;
  min-width: 36px !important;
  max-width: 36px !important;
  padding: 0 !important;
  border-radius: 10px !important;
  background: #141b2d !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  color: #e2e8f0 !important;
  font-size: 15px !important;
  font-weight: 700 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  cursor: pointer !important;
  flex-shrink: 0 !important;
}

.input-with-actions button:hover,
.select-action-wrapper button:hover,
.input-group .add-btn:hover,
.input-group .remove-btn:hover,
button.add-btn:hover,
button.remove-btn:hover {
  background: #1e293b !important;
  border-color: #38bdf8 !important;
  color: #ffffff !important;
}

body.light-mode .input-group .add-btn,
body.light-mode .input-group .remove-btn,
body.light-mode button.add-btn,
body.light-mode button.remove-btn,
[data-theme="light"] .input-group .add-btn,
[data-theme="light"] .input-group .remove-btn {
  background: #ffffff !important;
  border: 1px solid #cbd5e1 !important;
  color: #0f172a !important;
}

body.light-mode .input-group .add-btn:hover,
body.light-mode .input-group .remove-btn:hover,
[data-theme="light"] .input-group .add-btn:hover,
[data-theme="light"] .input-group .remove-btn:hover {
  background: #f1f5f9 !important;
  border-color: #0284c7 !important;
  color: #0284c7 !important;
}

/* --------------------------------------------------------------------------
   PART 4: PILL TEXTBOX STYLING & CLEAN FULL-WIDTH INPUTS
   -------------------------------------------------------------------------- */
.search-label,
.input-pill-wrapper,
input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not(.glitch-card input):not([type="hidden"]),
select:not(.glitch-card select) {
  height: 40px !important;
  min-height: 40px !important;
  max-height: 40px !important;
  border-radius: 12px !important;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  box-sizing: border-box !important;
  outline: none !important;
  transition: all 0.2s ease !important;
}

/* DARK MODE (#212121) */
:root .search-label,
:root .input-pill-wrapper,
body.dark-mode .search-label,
[data-theme="dark"] .search-label,
:root input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not(.glitch-card input):not([type="hidden"]),
body.dark-mode input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not(.glitch-card input):not([type="hidden"]),
[data-theme="dark"] input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not(.glitch-card input):not([type="hidden"]),
:root select:not(.glitch-card select),
body.dark-mode select:not(.glitch-card select),
[data-theme="dark"] select:not(.glitch-card select) {
  background-color: #212121 !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  color: #f1f1f1 !important;
}

/* LIGHT MODE (#d8d5d5) */
body.light-mode .search-label,
[data-theme="light"] .search-label,
body.light-mode input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not(.glitch-card input):not([type="hidden"]),
[data-theme="light"] input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not(.glitch-card input):not([type="hidden"]),
body.light-mode select:not(.glitch-card select),
[data-theme="light"] select:not(.glitch-card select) {
  background-color: #d8d5d5 !important;
  border: 1px solid rgba(0, 0, 0, 0.06) !important;
  color: #1a1a1a !important;
}

/* REMOVE SLASH ICON COMPLETELY */
.slash-icon,
.search-label .slash-icon,
.input-pill-wrapper .slash-icon {
  display: none !important;
  visibility: hidden !important;
}

.search-label input,
.input-pill-wrapper input {
  width: 100% !important;
  padding: 0 12px !important;
  transform: none !important;
  background: transparent !important;
  border: none !important;
}

/* --------------------------------------------------------------------------
   PART 5: MAINTENANCE TAB & TOOLBAR OVERHAUL
   -------------------------------------------------------------------------- */
/* Strip Outer Enclosing Card Frames in Both Modes */
.main-content,
.workspace-wrapper,
#maintenancePanel,
#maintenancePanel .card,
#maintenancePanel .panel,
#maintenancePanel div[style*="border"],
#eodPanel,
#eodPanel .card,
#eodPanel .panel,
#eodPanel div[style*="border"] {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  margin: 0 !important;
}

/* Compact Horizontal Screenshot Zone (<55px) */
#maintenancePanel .screenshot-zone,
#maintenancePanel .upload-container,
#eodPanel .eod-proof-zone,
#eodPanel .screenshot-zone,
#eodPanel .upload-container {
  min-height: 52px !important;
  height: auto !important;
  padding: 8px 14px !important;
  margin: 10px 0 !important;
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  gap: 14px !important;
  border: 1px dashed rgba(255, 255, 255, 0.18) !important;
  border-radius: 12px !important;
  background: rgba(15, 23, 42, 0.4) !important;
}

#eodPanel .add-screenshot-btn,
#eodPanel .eod-proof-label,
.add-screenshot-btn {
  height: 34px !important;
  min-height: 34px !important;
  padding: 0 14px !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  border-radius: 8px !important;
}

#maintenancePanel .screenshot-preview img,
#maintenancePanel img[src^="data:image"],
#eodPanel .eod-proof-item img,
#eodPanel img[src^="data:image"] {
  height: 42px !important;
  max-height: 42px !important;
  width: auto !important;
  border-radius: 6px !important;
}

/* Remove Horizontal Scrollbar & Fit Action Buttons */
#maintenancePanel .button-toolbar,
#maintenancePanel .toolbar,
#maintenancePanel .button-row,
#eodPanel .button-toolbar,
#eodPanel .toolbar,
#eodPanel .button-row,
#eodPanel .simple-eod-actions {
  display: flex !important;
  flex-wrap: wrap !important;
  align-items: center !important;
  gap: 6px 8px !important;
  width: 100% !important;
  overflow: visible !important;
  margin: 12px 0 18px 0 !important;
  background: transparent !important;
  border: none !important;
}

#maintenancePanel button:not(.eod-proof-remove),
#maintenancePanel .btn,
#eodPanel button:not(.eod-proof-remove),
#eodPanel .btn {
  height: 36px !important;
  min-height: 36px !important;
  max-height: 36px !important;
  padding: 0 14px !important;
  border-radius: 9999px !important;
  font-size: 11.5px !important;
  font-weight: 600 !important;
  white-space: nowrap !important;
  flex-shrink: 0 !important;
}

/* Semantic Button Colors */
#maintenancePanel button[id*="Draft"],
#maintenancePanel button[id*="Setup"],
#maintenancePanel button[id*="Preview"],
#eodPanel button[id*="Draft"],
#eodPanel button[id*="Setup"],
#eodPanel button[id*="Preview"] {
  background: #141b2d !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  color: #e2e8f0 !important;
}

#maintenancePanel button[id*="Copy"],
#maintenancePanel button[id*="Send"],
#eodPanel button[id*="Copy"],
#eodPanel button[id*="Send"] {
  background: #10b981 !important;
  border: 1px solid #059669 !important;
  color: #ffffff !important;
}

#maintenancePanel #simpleEodPdfBtn,
#maintenancePanel button[id*="Pdf"],
#eodPanel #simpleEodPdfBtn,
#eodPanel button[id*="Pdf"] {
  background: #0284c7 !important;
  border: 1px solid #0ea5e9 !important;
  color: #ffffff !important;
}

#maintenancePanel button[id*="Clear"],
#eodPanel button[id*="Clear"] {
  background: rgba(239, 68, 68, 0.1) !important;
  border: 1px solid rgba(239, 68, 68, 0.35) !important;
  color: #f87171 !important;
}

/* --------------------------------------------------------------------------
   PART 6: SIDEBAR STREAMLINING & PROMINENT CLOCK
   -------------------------------------------------------------------------- */
/* Remove 3 Sidebar Container Boxes (Brand, Profile, Clock) */
.sidebar-header,
.brand-container,
.brand-box,
.ops-sidebar-brand,
.sidebar-user,
.user-profile-card,
.auth-sidebar-account,
.clock-widget,
.time-widget,
.sidebar-live-clock,
#sidebarLiveClock,
#clockContainer {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 10px 14px !important;
}

/* Prominent Live Clock */
.clock-widget .date,
.sidebar-live-date,
#clockDate {
  font-size: 12px !important;
  font-weight: 600 !important;
  color: #94a3b8 !important;
  display: block !important;
}

.clock-widget .time,
.sidebar-live-time,
#currentTime,
#liveClock,
#Manila_z42c {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif !important;
  font-size: 22px !important;
  font-weight: 800 !important;
  color: #ffffff !important;
  line-height: 1.1 !important;
  display: block !important;
  font-variant-numeric: tabular-nums !important;
}

/* Docked Sidebar Toggle Button (<) */
#sidebarToggle,
.sidebar-toggle,
.collapse-btn,
.sidebar-collapse-toggle {
  position: absolute !important;
  top: 22px !important;
  left: 242px !important;
  z-index: 1000 !important;
  width: 26px !important;
  height: 26px !important;
  border-radius: 50% !important;
  background: #111827 !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  color: #94a3b8 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  cursor: pointer !important;
}

.sidebar.collapsed ~ #sidebarToggle,
body.sidebar-collapsed #sidebarToggle {
  left: 68px !important;
  transform: rotate(180deg) !important;
}

/* --------------------------------------------------------------------------
   PART 7: UNIFIED TYPOGRAPHY
   -------------------------------------------------------------------------- */
*,
*::before,
*::after,
html,
body,
button:not(.glitch-card button):not(.glitch-card *),
input:not(.glitch-card input):not(.glitch-card *),
select:not(.glitch-card select):not(.glitch-card *),
textarea,
table,
th,
td {
  font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif !important;
}
"@

# -----------------------------------------------------------------------------
# 5. Append refactor CSS to style.css and index.html
# -----------------------------------------------------------------------------
$trimmedStyle = $styleContent.TrimEnd()
$newStyleContent = $trimmedStyle + "`r`n" + $refactorCss + "`r`n"
[System.IO.File]::WriteAllText($stylePath, $newStyleContent, $utf8NoBom)
Write-Host "[OK] Appended refactoring CSS to style.css"

$targetIndex = "</style>`r`n`r`n</head>"
if (-not $indexContent.Contains($targetIndex)) {
    $targetIndex = "</style>`n`n</head>"
    if (-not $indexContent.Contains($targetIndex)) {
        throw "Could not find </style></head> anchor in index.html"
    }
    $indexContent = $indexContent.Replace($targetIndex, $refactorCss + "`n" + $targetIndex)
} else {
    $indexContent = $indexContent.Replace($targetIndex, $refactorCss + "`r`n" + $targetIndex)
}

# Update Google Fonts import to include Fira Code
$oldFontImport = "@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');"
$newFontImport = "@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');"
if ($indexContent.Contains($oldFontImport)) {
    $indexContent = $indexContent.Replace($oldFontImport, $newFontImport)
    Write-Host "[OK] Added Fira Code to Google Fonts in index.html"
}

[System.IO.File]::WriteAllText($indexPath, $indexContent, $utf8NoBom)
Write-Host "[OK] Updated index.html with all refactoring HTML & CSS"

# -----------------------------------------------------------------------------
# 6. Verify UTF-8 No BOM
# -----------------------------------------------------------------------------
$styleBytes = [System.IO.File]::ReadAllBytes($stylePath)
if ($styleBytes[0] -eq 0xEF -and $styleBytes[1] -eq 0xBB -and $styleBytes[2] -eq 0xBF) {
    throw "style.css has UTF-8 BOM"
}

$indexBytes = [System.IO.File]::ReadAllBytes($indexPath)
if ($indexBytes[0] -eq 0xEF -and $indexBytes[1] -eq 0xBB -and $indexBytes[2] -eq 0xBF) {
    throw "index.html has UTF-8 BOM"
}

Write-Host "Both files successfully updated with UTF-8 (No BOM)"
