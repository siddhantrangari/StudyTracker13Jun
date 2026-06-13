/**
 * StudyTrack - Core Application Script with Supabase Cloud Sync
 * Built for UPSC, JEE, and NEET aspirants.
 */

// ==========================================
// SUPABASE CONFIGURATION
// ==========================================
// Paste your Supabase credentials here to sync to the database
const SUPABASE_URL = 'https://qoxchejkzofmertijutx.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Replace with your actual anon public key from Supabase settings

let supabaseClient = null;
const isSupabaseConfigured = SUPABASE_ANON_KEY && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';

if (isSupabaseConfigured && window.supabase) {
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client initialized successfully.');
  } catch (e) {
    console.error('Error initializing Supabase client:', e);
  }
}

// ==========================================
// 1. OFFLINE LOCAL STORAGE FALLBACK
// ==========================================
const LocalDB = {
  _get(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Error reading localStorage', e);
      return null;
    }
  },

  _set(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.error('Error writing localStorage', e);
    }
  },

  getUsers() {
    return this._get('studytrack_users') || [];
  },

  saveUser(user) {
    const users = this.getUsers();
    users.push(user);
    this._set('studytrack_users', users);
  },

  getUserByEmail(email) {
    return this.getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  getCurrentUser() {
    return this._get('studytrack_active_user');
  },

  setCurrentUser(email) {
    this._set('studytrack_active_user', email);
  },

  clearCurrentUser() {
    localStorage.removeItem('studytrack_active_user');
  },

  getSubjects(email) {
    const allSubjects = this._get('studytrack_subjects') || [];
    return allSubjects.filter(s => s.userEmail.toLowerCase() === email.toLowerCase());
  },

  addSubject(email, subject) {
    const allSubjects = this._get('studytrack_subjects') || [];
    allSubjects.push({
      id: 'sub_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      userEmail: email.toLowerCase(),
      name: subject.name,
      color: subject.color,
      createdAt: new Date().toISOString()
    });
    this._set('studytrack_subjects', allSubjects);
  },

  deleteSubject(email, id) {
    const allSubjects = this._get('studytrack_subjects') || [];
    const filteredSubjects = allSubjects.filter(s => !(s.userEmail.toLowerCase() === email.toLowerCase() && s.id === id));
    this._set('studytrack_subjects', filteredSubjects);

    const allSessions = this._get('studytrack_sessions') || [];
    const filteredSessions = allSessions.filter(s => !(s.userEmail.toLowerCase() === email.toLowerCase() && s.subjectId === id));
    this._set('studytrack_sessions', filteredSessions);
    
    const activeTimer = this.getActiveTimer(email);
    if (activeTimer && activeTimer.subjectId === id) {
      this.clearActiveTimer(email);
    }
  },

  getStudySessions(email) {
    const allSessions = this._get('studytrack_sessions') || [];
    return allSessions.filter(s => s.userEmail.toLowerCase() === email.toLowerCase());
  },

  addStudySession(email, session) {
    const allSessions = this._get('studytrack_sessions') || [];
    allSessions.push({
      id: 'sess_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      userEmail: email.toLowerCase(),
      subjectId: session.subjectId,
      startTime: session.startTime,
      endTime: session.endTime,
      durationSeconds: session.durationSeconds,
      date: session.date
    });
    this._set('studytrack_sessions', allSessions);
  },

  deleteStudySession(email, id) {
    const allSessions = this._get('studytrack_sessions') || [];
    const filteredSessions = allSessions.filter(s => !(s.userEmail.toLowerCase() === email.toLowerCase() && s.id === id));
    this._set('studytrack_sessions', filteredSessions);
  },

  getActiveTimer(email) {
    const timers = this._get('studytrack_active_timers') || {};
    return timers[email.toLowerCase()] || null;
  },

  setActiveTimer(email, timer) {
    const timers = this._get('studytrack_active_timers') || {};
    timers[email.toLowerCase()] = timer;
    this._set('studytrack_active_timers', timers);
  },

  clearActiveTimer(email) {
    const timers = this._get('studytrack_active_timers') || {};
    delete timers[email.toLowerCase()];
    this._set('studytrack_active_timers', timers);
  }
};

// ==========================================
// 2. UNIFIED DATABASE ADAPTER (SUPABASE / LOCAL FALLBACK)
// ==========================================
const DB = {
  isCloud() {
    return isSupabaseConfigured && supabaseClient !== null;
  },

  async getCurrentUser() {
    if (this.isCloud()) {
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (error) {
        console.error('Supabase getSession failed:', error);
        return null;
      }
      return session ? session.user : null;
    } else {
      const email = LocalDB.getCurrentUser();
      return email ? { email, id: email } : null;
    }
  },

  async getSubjects(userId) {
    if (this.isCloud()) {
      const { data, error } = await supabaseClient
        .from('subjects')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) {
        console.error('Supabase select subjects failed:', error);
        throw error;
      }
      return data.map(s => ({
        id: s.id,
        userEmail: s.user_id,
        name: s.name,
        color: s.color,
        createdAt: s.created_at
      }));
    } else {
      return LocalDB.getSubjects(userId);
    }
  },

  async addSubject(userId, subject) {
    if (this.isCloud()) {
      const { data, error } = await supabaseClient
        .from('subjects')
        .insert([{
          user_id: userId,
          name: subject.name,
          color: subject.color
        }])
        .select();
      if (error) {
        console.error('Supabase insert subject failed:', error);
        throw error;
      }
      return data[0];
    } else {
      return LocalDB.addSubject(userId, subject);
    }
  },

  async deleteSubject(userId, id) {
    if (this.isCloud()) {
      const { error } = await supabaseClient
        .from('subjects')
        .delete()
        .eq('id', id);
      if (error) {
        console.error('Supabase delete subject failed:', error);
        throw error;
      }
    } else {
      return LocalDB.deleteSubject(userId, id);
    }
  },

  async getStudySessions(userId) {
    if (this.isCloud()) {
      const { data, error } = await supabaseClient
        .from('study_sessions')
        .select('*')
        .order('start_time', { ascending: false });
      if (error) {
        console.error('Supabase select sessions failed:', error);
        throw error;
      }
      return data.map(s => ({
        id: s.id,
        userEmail: s.user_id,
        subjectId: s.subject_id,
        startTime: parseInt(s.start_time),
        endTime: parseInt(s.end_time),
        durationSeconds: s.duration_seconds,
        date: s.date
      }));
    } else {
      return LocalDB.getStudySessions(userId);
    }
  },

  async addStudySession(userId, session) {
    if (this.isCloud()) {
      const { data, error } = await supabaseClient
        .from('study_sessions')
        .insert([{
          user_id: userId,
          subject_id: session.subjectId,
          start_time: session.startTime,
          end_time: session.endTime,
          duration_seconds: session.durationSeconds,
          date: session.date
        }])
        .select();
      if (error) {
        console.error('Supabase insert session failed:', error);
        throw error;
      }
      return data[0];
    } else {
      return LocalDB.addStudySession(userId, session);
    }
  },

  async deleteStudySession(userId, id) {
    if (this.isCloud()) {
      const { error } = await supabaseClient
        .from('study_sessions')
        .delete()
        .eq('id', id);
      if (error) {
        console.error('Supabase delete session failed:', error);
        throw error;
      }
    } else {
      return LocalDB.deleteStudySession(userId, id);
    }
  },

  // Transient Timer persistence is kept in localStorage, keyed by unique userId
  getActiveTimer(userId) {
    return LocalDB.getActiveTimer(userId);
  },

  setActiveTimer(userId, timer) {
    return LocalDB.setActiveTimer(userId, timer);
  },

  clearActiveTimer(userId) {
    return LocalDB.clearActiveTimer(userId);
  }
};

// ==========================================
// 3. HELPER UTILITIES
// ==========================================
const Utils = {
  formatDuration(totalSeconds) {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  },

  formatDurationShort(totalSeconds) {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
  },

  formatLocalDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  },

  toLocalISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },

  presetColors: [
    '#6366f1', // Indigo
    '#ec4899', // Pink
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#06b6d4', // Cyan
    '#a855f7'  // Purple
  ]
};

// ==========================================
// 4. MAIN APPLICATION
// ==========================================
const App = {
  currentUser: null, // Stores user.id (cloud) or userEmail (local)
  activeTimerInterval: null,
  activeTimerData: null,

  async init() {
    this.cacheDOM();
    this.bindEvents();
    this.initColorPicker();
    await this.checkSession();
    this.handleRouting();
  },

  cacheDOM() {
    // Layout Wrappers
    this.views = {
      landing: document.getElementById('landing-view'),
      auth: document.getElementById('auth-view'),
      app: document.getElementById('app-view')
    };
    
    this.panels = {
      dashboard: document.getElementById('dashboard-panel'),
      report: document.getElementById('report-panel')
    };

    // Navigation menus
    this.navPublic = document.getElementById('public-nav');
    this.navPrivate = document.getElementById('private-nav');
    
    // Auth Components
    this.authTabs = {
      login: document.getElementById('tab-login'),
      register: document.getElementById('tab-register')
    };
    this.authForms = {
      loginWrapper: document.getElementById('form-login-wrapper'),
      registerWrapper: document.getElementById('form-register-wrapper'),
      login: document.getElementById('login-form'),
      register: document.getElementById('register-form')
    };

    // Dashboard Items
    this.subjectsGrid = document.getElementById('subjects-grid');
    this.subjectsEmptyState = document.getElementById('subjects-empty-state');
    
    // Timer Displays
    this.timerContainer = document.getElementById('study-timer-container');
    this.timerClock = document.getElementById('timer-clock-display');
    this.timerSubject = document.getElementById('timer-subject-display');
    this.timerStatusText = document.getElementById('timer-status-text');
    this.timerProgressRing = document.getElementById('timer-progress-ring');
    this.timerStopBtn = document.getElementById('timer-stop-btn');

    // Dialog Elements
    this.addSubjectDialog = document.getElementById('add-subject-dialog');
    this.addSubjectForm = document.getElementById('add-subject-form');
    this.colorPickerGrid = document.getElementById('color-picker-grid');
    this.colorInput = document.getElementById('subject-color-input');
    this.subjectNameInput = document.getElementById('subject-name-input');
  },

  bindEvents() {
    // Nav Routing Bindings
    window.addEventListener('hashchange', () => this.handleRouting());

    // Public header clicks
    document.getElementById('logo-link').addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = this.currentUser ? '#dashboard' : '#home';
    });
    
    document.getElementById('nav-home').addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = '#home';
    });

    document.getElementById('nav-login-btn').addEventListener('click', () => {
      this.switchAuthTab('login');
      window.location.hash = '#auth';
    });

    document.getElementById('nav-register-btn').addEventListener('click', () => {
      this.switchAuthTab('register');
      window.location.hash = '#auth';
    });

    document.getElementById('hero-get-started').addEventListener('click', () => {
      this.switchAuthTab('register');
      window.location.hash = '#auth';
    });

    // Logout actions
    const logoutAction = () => {
      this.logout();
    };
    document.getElementById('top-logout-btn').addEventListener('click', logoutAction);
    document.getElementById('side-logout-btn').addEventListener('click', logoutAction);

    // Sidebar navigation clicks
    document.getElementById('side-dashboard').addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = '#dashboard';
    });
    document.getElementById('side-report').addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = '#report';
    });

    // Auth forms tab switching
    this.authTabs.login.addEventListener('click', () => this.switchAuthTab('login'));
    this.authTabs.register.addEventListener('click', () => this.switchAuthTab('register'));

    // Auth forms submissions
    this.authForms.login.addEventListener('submit', (e) => this.handleLogin(e));
    this.authForms.register.addEventListener('submit', (e) => this.handleRegister(e));

    // Timer control buttons
    this.timerStopBtn.addEventListener('click', () => this.stopTimer());

    // Dialog form submissions
    this.addSubjectForm.addEventListener('submit', (e) => this.handleAddSubjectSubmit(e));

    // Handle Native Modals dismissal (backdrop click closing)
    this.addSubjectDialog.addEventListener('click', (e) => {
      if (e.target === this.addSubjectDialog) {
        this.addSubjectDialog.close();
      }
    });

    // Listen for custom trigger attributes
    document.addEventListener('click', (e) => {
      const button = e.target.closest('button[commandfor]');
      if (!button) return;

      const dialogId = button.getAttribute('commandfor');
      const command = button.getAttribute('command');
      const dialog = document.getElementById(dialogId);

      if (dialog && dialog.tagName === 'DIALOG') {
        if (command === 'show-modal') {
          this.subjectNameInput.value = '';
          document.getElementById('subject-name-error').style.display = 'none';
          this.resetColorSelection();
          dialog.showModal();
        } else if (command === 'close') {
          dialog.close();
        }
      }
    });
  },

  initColorPicker() {
    this.colorPickerGrid.innerHTML = '';
    Utils.presetColors.forEach((color, index) => {
      const opt = document.createElement('div');
      opt.className = 'color-option';
      opt.style.backgroundColor = color;
      if (index === 0) {
        opt.classList.add('selected');
        this.colorInput.value = color;
      }
      opt.addEventListener('click', () => {
        document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
        opt.classList.add('selected');
        this.colorInput.value = color;
      });
      this.colorPickerGrid.appendChild(opt);
    });
  },

  resetColorSelection() {
    const opts = document.querySelectorAll('.color-option');
    if (opts.length > 0) {
      opts.forEach(el => el.classList.remove('selected'));
      opts[0].classList.add('selected');
      this.colorInput.value = Utils.presetColors[0];
    }
  },

  async checkSession() {
    const user = await DB.getCurrentUser();
    if (user) {
      this.currentUser = DB.isCloud() ? user.id : user.email;
      document.getElementById('user-display-email').textContent = user.email;
    } else {
      this.currentUser = null;
    }
  },

  handleRouting() {
    const hash = window.location.hash || '#home';
    
    if ((hash === '#dashboard' || hash === '#report') && !this.currentUser) {
      window.location.hash = '#auth';
      return;
    }

    if ((hash === '#home' || hash === '#auth') && this.currentUser) {
      window.location.hash = '#dashboard';
      return;
    }

    Object.values(this.views).forEach(v => v.classList.remove('active'));
    document.getElementById('nav-home').classList.remove('active');

    if (hash === '#home') {
      this.views.landing.classList.add('active');
      document.getElementById('nav-home').classList.add('active');
      this.navPublic.classList.remove('hidden');
      this.navPrivate.classList.add('hidden');
    } else if (hash === '#auth') {
      this.views.auth.classList.add('active');
      this.navPublic.classList.remove('hidden');
      this.navPrivate.classList.add('hidden');
      this.showAuthWarningIfOffline();
    } else if (hash === '#dashboard' || hash === '#report') {
      this.views.app.classList.add('active');
      this.navPublic.classList.add('hidden');
      this.navPrivate.classList.remove('hidden');

      Object.values(this.panels).forEach(p => p.classList.add('hidden'));
      document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('active'));
      
      this.updateConnectionBadge();

      if (hash === '#dashboard') {
        this.panels.dashboard.classList.remove('hidden');
        document.getElementById('side-dashboard').classList.add('active');
        this.initDashboard();
      } else {
        this.panels.report.classList.remove('hidden');
        document.getElementById('side-report').classList.add('active');
        this.initWeeklyReport();
      }
    }
  },

  switchAuthTab(tab) {
    this.authTabs.login.classList.remove('active');
    this.authTabs.register.classList.remove('active');
    this.authForms.loginWrapper.classList.remove('active');
    this.authForms.registerWrapper.classList.remove('active');

    document.getElementById('login-general-error').style.display = 'none';
    document.getElementById('register-general-error').style.display = 'none';
    document.querySelectorAll('.form-error').forEach(e => e.style.display = 'none');

    if (tab === 'login') {
      this.authTabs.login.classList.add('active');
      this.authForms.loginWrapper.classList.add('active');
    } else {
      this.authTabs.register.classList.add('active');
      this.authForms.registerWrapper.classList.add('active');
    }
  },

  updateConnectionBadge() {
    const badge = document.getElementById('connection-mode-badge') || (() => {
      const parent = document.querySelector('.user-info');
      if (!parent) return null;
      const el = document.createElement('span');
      el.id = 'connection-mode-badge';
      el.className = 'user-role';
      el.style.marginTop = '0.25rem';
      el.style.display = 'inline-flex';
      el.style.alignItems = 'center';
      el.style.gap = '0.25rem';
      parent.appendChild(el);
      return el;
    })();

    if (!badge) return;

    if (DB.isCloud()) {
      badge.innerHTML = `<span style="color: var(--success); font-weight:600;"><i class="fa-solid fa-cloud"></i> Cloud Sync (Supabase)</span>`;
    } else {
      badge.innerHTML = `<span style="color: var(--text-muted); font-weight:500;"><i class="fa-solid fa-hard-drive"></i> Offline Demo Mode</span>`;
    }
  },

  showAuthWarningIfOffline() {
    const authCard = document.querySelector('.auth-card');
    if (!authCard) return;

    let warning = document.getElementById('offline-warning-banner');
    if (warning) {
      if (DB.isCloud()) {
        warning.remove();
      }
      return;
    }

    if (!DB.isCloud()) {
      warning = document.createElement('div');
      warning.id = 'offline-warning-banner';
      warning.style.background = 'rgba(245, 158, 11, 0.1)';
      warning.style.border = '1px solid rgba(245, 158, 11, 0.25)';
      warning.style.borderRadius = '8px';
      warning.style.padding = '0.75rem';
      warning.style.marginBottom = '1.5rem';
      warning.style.fontSize = '0.8rem';
      warning.style.color = '#f59e0b';
      warning.style.lineHeight = '1.4';
      warning.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation"></i> 
        <strong>Offline Demo Mode Active.</strong> Data is stored locally in this browser. 
        To sync with Supabase, open <code style="background:rgba(255,255,255,0.05); padding:2px 4px; border-radius:4px;">app.js</code> and paste your <strong>Anon Key</strong>.
      `;
      authCard.insertBefore(warning, authCard.firstChild);
    }
  },

  // ==========================================
  // 5. AUTHENTICATION CONTROLLER
  // ==========================================
  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    let isValid = true;
    
    if (!Utils.validateEmail(email)) {
      document.getElementById('login-email-error').style.display = 'block';
      isValid = false;
    } else {
      document.getElementById('login-email-error').style.display = 'none';
    }

    if (password.length < 6) {
      document.getElementById('login-password-error').style.display = 'block';
      isValid = false;
    } else {
      document.getElementById('login-password-error').style.display = 'none';
    }

    if (!isValid) return;

    if (DB.isCloud()) {
      const loginBtn = e.target.querySelector('button[type="submit"]');
      const originalText = loginBtn.innerHTML;
      loginBtn.disabled = true;
      loginBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Logging in...';

      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          throw error;
        }

        this.currentUser = data.user.id;
        document.getElementById('user-display-email').textContent = data.user.email;
        this.authForms.login.reset();
        window.location.hash = '#dashboard';
      } catch (err) {
        console.error('Supabase login error:', err);
        const errEl = document.getElementById('login-general-error');
        errEl.textContent = err.message || "Invalid credentials. Please try again.";
        errEl.style.display = 'block';
      } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = originalText;
      }
    } else {
      // Local Auth Fallback
      const user = LocalDB.getUserByEmail(email);
      if (user && user.password === password) {
        LocalDB.setCurrentUser(email);
        this.currentUser = email;
        document.getElementById('user-display-email').textContent = email;
        this.authForms.login.reset();
        window.location.hash = '#dashboard';
      } else {
        const err = document.getElementById('login-general-error');
        err.textContent = "Incorrect email address or password. Please try again.";
        err.style.display = 'block';
      }
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    let isValid = true;

    if (!Utils.validateEmail(email)) {
      document.getElementById('register-email-error').style.display = 'block';
      isValid = false;
    } else {
      document.getElementById('register-email-error').style.display = 'none';
    }

    if (password.length < 6) {
      document.getElementById('register-password-error').style.display = 'block';
      isValid = false;
    } else {
      document.getElementById('register-password-error').style.display = 'none';
    }

    if (password !== confirmPassword) {
      document.getElementById('register-confirm-password-error').style.display = 'block';
      isValid = false;
    } else {
      document.getElementById('register-confirm-password-error').style.display = 'none';
    }

    if (!isValid) return;

    if (DB.isCloud()) {
      const regBtn = e.target.querySelector('button[type="submit"]');
      const originalText = regBtn.innerHTML;
      regBtn.disabled = true;
      regBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Creating...';

      try {
        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password
        });

        if (error) throw error;

        // Auto login on successful register if session is active
        if (data.session) {
          this.currentUser = data.user.id;
          document.getElementById('user-display-email').textContent = data.user.email;
          this.authForms.register.reset();
          window.location.hash = '#dashboard';
        } else {
          // Email verification enabled
          alert("Account registered successfully! Please check your email inbox to verify your account, then log in.");
          this.authForms.register.reset();
          this.switchAuthTab('login');
          window.location.hash = '#auth';
        }
      } catch (err) {
        console.error('Supabase registration error:', err);
        const errEl = document.getElementById('register-general-error');
        errEl.textContent = err.message || "Failed to create account. Email may already be registered.";
        errEl.style.display = 'block';
      } finally {
        regBtn.disabled = false;
        regBtn.innerHTML = originalText;
      }
    } else {
      // Local Auth Fallback
      const existing = LocalDB.getUserByEmail(email);
      if (existing) {
        const err = document.getElementById('register-general-error');
        err.textContent = "Email address already registered. Please log in.";
        err.style.display = 'block';
        return;
      }

      LocalDB.saveUser({
        email,
        password,
        createdAt: new Date().toISOString()
      });

      LocalDB.setCurrentUser(email);
      this.currentUser = email;
      document.getElementById('user-display-email').textContent = email;
      this.authForms.register.reset();
      window.location.hash = '#dashboard';
    }
  },

  async logout() {
    if (this.activeTimerInterval) {
      clearInterval(this.activeTimerInterval);
      this.activeTimerInterval = null;
    }
    this.activeTimerData = null;

    if (DB.isCloud()) {
      await supabaseClient.auth.signOut();
    } else {
      LocalDB.clearCurrentUser();
    }
    this.currentUser = null;
    window.location.hash = '#home';
  },

  // ==========================================
  // 6. SUBJECT MANAGEMENT
  // ==========================================
  async handleAddSubjectSubmit(e) {
    e.preventDefault();
    const name = this.subjectNameInput.value.trim();
    const color = this.colorInput.value;

    if (!name) {
      document.getElementById('subject-name-error').style.display = 'block';
      return;
    }

    try {
      await DB.addSubject(this.currentUser, { name, color });
      this.addSubjectDialog.close();
      this.addSubjectForm.reset();
      await this.initDashboard();
    } catch (err) {
      alert("Error adding subject: " + err.message);
    }
  },

  // ==========================================
  // 7. DASHBOARD & STREAK CONTROLLER
  // ==========================================
  async initDashboard() {
    const user = await DB.getCurrentUser();
    if (!user) return;

    const namePart = user.email.split('@')[0];
    document.getElementById('dashboard-greeting').textContent = `Welcome back, ${namePart.charAt(0).toUpperCase() + namePart.slice(1)}!`;
    document.getElementById('dashboard-date').textContent = Utils.formatLocalDate(new Date().toISOString());

    try {
      const subjects = await DB.getSubjects(this.currentUser);
      const sessions = await DB.getStudySessions(this.currentUser);

      document.getElementById('subjects-count-value').textContent = subjects.length;

      // Total Study today
      const todayStr = Utils.toLocalISODate(new Date());
      const todaySessions = sessions.filter(s => s.date === todayStr);
      const todayTotalSeconds = todaySessions.reduce((acc, curr) => acc + curr.durationSeconds, 0);
      document.getElementById('total-today-value').textContent = Utils.formatDurationShort(todayTotalSeconds);

      // Render Streak Metric & Dot Tracker
      const streak = this.calculateStreak(sessions);
      document.getElementById('streak-value').textContent = `${streak} Day${streak === 1 ? '' : 's'}`;
      
      const streakIconContainer = document.getElementById('streak-icon-container');
      const streakFireIcon = document.getElementById('streak-fire-icon');
      if (streak > 0) {
        streakIconContainer.classList.add('streak-active');
        streakFireIcon.style.color = 'var(--accent)';
      } else {
        streakIconContainer.classList.remove('streak-active');
        streakFireIcon.style.color = 'var(--text-muted)';
      }

      this.renderStreakDots(sessions);
      this.renderSubjectsGrid(subjects, todaySessions);
      this.checkAndResumeTimer(subjects);
    } catch (err) {
      console.error('Error initializing dashboard data:', err);
    }
  },

  renderSubjectsGrid(subjects, todaySessions) {
    this.subjectsGrid.innerHTML = '';
    
    if (subjects.length === 0) {
      this.subjectsGrid.appendChild(this.subjectsEmptyState);
      this.subjectsEmptyState.classList.remove('hidden');
      return;
    }

    this.subjectsEmptyState.classList.add('hidden');

    subjects.forEach(subject => {
      const subTodaySessions = todaySessions.filter(s => s.subjectId === subject.id);
      const subTodaySeconds = subTodaySessions.reduce((acc, curr) => acc + curr.durationSeconds, 0);

      const card = document.createElement('div');
      card.className = 'card subject-card';
      card.style.setProperty('--subject-color-glow', `${subject.color}15`);
      card.style.borderLeftColor = subject.color;

      const isThisRunning = this.activeTimerData && this.activeTimerData.subjectId === subject.id;

      card.innerHTML = `
        <div class="subject-info">
          <div class="subject-header">
            <h4 class="subject-title" title="${subject.name}">${subject.name}</h4>
            <button class="modal-close delete-subject-btn" data-id="${subject.id}" title="Delete Subject">
              <i class="fa-solid fa-trash-can" style="font-size: 0.9rem; color: var(--text-muted);"></i>
            </button>
          </div>
          <div class="subject-time-badge">
            Today: <span id="sub-time-${subject.id}">${Utils.formatDurationShort(subTodaySeconds)}</span>
          </div>
        </div>
        <div class="subject-actions">
          <button class="btn btn-sm ${isThisRunning ? 'btn-danger' : 'btn-secondary'} timer-toggle-btn" 
                  data-id="${subject.id}" 
                  data-name="${subject.name}">
            <i class="fa-solid ${isThisRunning ? 'fa-square' : 'fa-play'}"></i> 
            ${isThisRunning ? 'Stop Study' : 'Start Timer'}
          </button>
        </div>
      `;

      card.querySelector('.delete-subject-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete "${subject.name}"? This will also wipe out all study logs for this subject.`)) {
          try {
            await DB.deleteSubject(this.currentUser, subject.id);
            await this.initDashboard();
          } catch (err) {
            alert("Error deleting subject: " + err.message);
          }
        }
      });

      card.querySelector('.timer-toggle-btn').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const subId = btn.getAttribute('data-id');
        const subName = btn.getAttribute('data-name');
        
        if (this.activeTimerData && this.activeTimerData.subjectId === subId) {
          await this.stopTimer();
        } else {
          this.startTimer(subId, subName);
        }
      });

      this.subjectsGrid.appendChild(card);
    });
  },

  calculateStreak(sessions) {
    if (sessions.length === 0) return 0;

    const dailyDurations = {};
    sessions.forEach(sess => {
      dailyDurations[sess.date] = (dailyDurations[sess.date] || 0) + sess.durationSeconds;
    });

    const targetSeconds = 3600; // 1 hour threshold
    let streakCount = 0;
    
    let checkDate = new Date();
    const todayStr = Utils.toLocalISODate(checkDate);

    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = Utils.toLocalISODate(yesterdayDate);

    let startStr = null;
    if ((dailyDurations[todayStr] || 0) >= targetSeconds) {
      startStr = todayStr;
    } else if ((dailyDurations[yesterdayStr] || 0) >= targetSeconds) {
      startStr = yesterdayStr;
    } else {
      return 0;
    }

    let currentCheckDate = new Date(startStr);
    
    for (let i = 0; i < 365; i++) {
      const dateStr = Utils.toLocalISODate(currentCheckDate);
      const secondsStudied = dailyDurations[dateStr] || 0;
      
      if (secondsStudied >= targetSeconds) {
        streakCount++;
        currentCheckDate.setDate(currentCheckDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streakCount;
  },

  renderStreakDots(sessions) {
    const grid = document.getElementById('streak-days-grid');
    grid.innerHTML = '';

    const dailyDurations = {};
    sessions.forEach(sess => {
      dailyDurations[sess.date] = (dailyDurations[sess.date] || 0) + sess.durationSeconds;
    });

    const targetSeconds = 3600; // 1 hour threshold
    const days = [];
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        dateStr: Utils.toLocalISODate(d),
        dayName: weekdayNames[d.getDay()],
        isToday: i === 0
      });
    }

    days.forEach(day => {
      const duration = dailyDurations[day.dateStr] || 0;
      const isCompleted = duration >= targetSeconds;
      
      const cell = document.createElement('div');
      cell.className = `streak-day-cell ${isCompleted ? 'completed' : ''} ${day.isToday ? 'today' : ''}`;
      cell.title = `${day.dateStr}: ${Utils.formatDurationShort(duration)} studied`;

      cell.innerHTML = `
        <span class="streak-day-name">${day.isToday ? 'Today' : day.dayName}</span>
        <div class="streak-day-dot">
          <i class="fa-solid ${isCompleted ? 'fa-check' : 'fa-minus'}"></i>
        </div>
      `;

      grid.appendChild(cell);
    });
  },

  // ==========================================
  // 8. PERSISTENT FOCUS TIMER CONTROLLER
  // ==========================================
  checkAndResumeTimer(subjectsList = null) {
    const activeTimer = DB.getActiveTimer(this.currentUser);
    if (activeTimer) {
      const loadTimer = async () => {
        const subjects = subjectsList || await DB.getSubjects(this.currentUser);
        const subject = subjects.find(s => s.id === activeTimer.subjectId);
        if (subject) {
          this.activeTimerData = activeTimer;
          this.startTimerTicker(subject.id, subject.name, activeTimer.startTime);
        } else {
          DB.clearActiveTimer(this.currentUser);
        }
      };
      loadTimer();
    } else {
      this.resetTimerUI();
    }
  },

  startTimer(subjectId, subjectName) {
    if (this.activeTimerData) {
      this.stopTimer(false);
    }

    const startTime = Date.now();
    const timerData = {
      subjectId,
      startTime
    };

    DB.setActiveTimer(this.currentUser, timerData);
    this.activeTimerData = timerData;

    this.startTimerTicker(subjectId, subjectName, startTime);
    
    // Refresh grid state
    const refreshGrid = async () => {
      const subjects = await DB.getSubjects(this.currentUser);
      const sessions = await DB.getStudySessions(this.currentUser);
      const todayStr = Utils.toLocalISODate(new Date());
      const todaySessions = sessions.filter(s => s.date === todayStr);
      this.renderSubjectsGrid(subjects, todaySessions);
    };
    refreshGrid();
  },

  startTimerTicker(subjectId, subjectName, startTime) {
    if (this.activeTimerInterval) {
      clearInterval(this.activeTimerInterval);
    }

    this.timerContainer.classList.add('running');
    this.timerSubject.textContent = subjectName;
    this.timerStatusText.textContent = 'Stay Focused - Session Active';
    this.timerStopBtn.classList.remove('hidden');

    const updateTick = () => {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      this.timerClock.textContent = Utils.formatDuration(elapsedSeconds);

      const circleSeconds = 3600;
      const progressPercent = (elapsedSeconds % circleSeconds) / circleSeconds;
      const circumference = 502;
      const strokeOffset = circumference - (progressPercent * circumference);
      this.timerProgressRing.style.strokeDashoffset = strokeOffset;
    };

    updateTick();
    this.activeTimerInterval = setInterval(updateTick, 1000);
  },

  async stopTimer(shouldRefreshDashboard = true) {
    if (!this.activeTimerInterval || !this.activeTimerData) return;

    clearInterval(this.activeTimerInterval);
    this.activeTimerInterval = null;

    const endTime = Date.now();
    const elapsedSeconds = Math.floor((endTime - this.activeTimerData.startTime) / 1000);

    if (elapsedSeconds >= 1) {
      const session = {
        subjectId: this.activeTimerData.subjectId,
        startTime: this.activeTimerData.startTime,
        endTime: endTime,
        durationSeconds: elapsedSeconds,
        date: Utils.toLocalISODate(new Date(this.activeTimerData.startTime))
      };
      
      try {
        await DB.addStudySession(this.currentUser, session);
      } catch (err) {
        alert("Error saving session: " + err.message);
      }
    }

    DB.clearActiveTimer(this.currentUser);
    this.activeTimerData = null;
    this.resetTimerUI();

    if (shouldRefreshDashboard) {
      await this.initDashboard();
    }
  },

  resetTimerUI() {
    this.timerContainer.classList.remove('running');
    this.timerClock.textContent = '00:00:00';
    this.timerSubject.textContent = 'No Subject';
    this.timerStatusText.textContent = 'Select a subject below to start a timer';
    this.timerProgressRing.style.strokeDashoffset = 502;
    this.timerStopBtn.classList.add('hidden');
  },

  // ==========================================
  // 9. WEEKLY REPORT & CUSTOM SVG CHARTING
  // ==========================================
  async initWeeklyReport() {
    try {
      const subjects = await DB.getSubjects(this.currentUser);
      const sessions = await DB.getStudySessions(this.currentUser);

      this.renderWeeklySVGChart(subjects, sessions);
      this.renderWeeklyInsights(subjects, sessions);
      this.renderSessionHistory(subjects, sessions);
    } catch (err) {
      console.error('Error loading weekly report:', err);
    }
  },

  renderWeeklySVGChart(subjects, sessions) {
    const chartSvg = document.getElementById('weekly-svg-chart');
    const legendContainer = document.getElementById('chart-legend');
    
    chartSvg.innerHTML = '';
    legendContainer.innerHTML = '';

    if (sessions.length === 0 || subjects.length === 0) {
      chartSvg.innerHTML = `
        <text x="300" y="150" fill="var(--text-muted)" font-family="var(--font-heading)" font-size="16" text-anchor="middle">
          No study sessions logged for weekly chart.
        </text>
      `;
      return;
    }

    const dates = [];
    const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push({
        dateStr: Utils.toLocalISODate(d),
        label: `${shortDays[d.getDay()]} ${d.getDate()}`
      });
    }

    const chartData = {};
    dates.forEach(d => {
      chartData[d.dateStr] = {};
      subjects.forEach(s => {
        chartData[d.dateStr][s.id] = 0;
      });
    });

    sessions.forEach(sess => {
      if (chartData[sess.date] && chartData[sess.date][sess.subjectId] !== undefined) {
        chartData[sess.date][sess.subjectId] += sess.durationSeconds;
      }
    });

    let maxDailyHours = 0;
    dates.forEach(d => {
      let dailySeconds = 0;
      subjects.forEach(s => {
        dailySeconds += chartData[d.dateStr][s.id];
      });
      const hours = dailySeconds / 3600;
      if (hours > maxDailyHours) {
        maxDailyHours = hours;
      }
    });

    let yMax = 4;
    if (maxDailyHours > 4) {
      yMax = Math.ceil(maxDailyHours / 2) * 2;
    }

    const width = 600;
    const height = 300;
    const paddingLeft = 45;
    const paddingRight = 20;
    const paddingTop = 25;
    const paddingBottom = 45;
    
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    const gridCount = 4;
    for (let i = 0; i <= gridCount; i++) {
      const yVal = (yMax / gridCount) * i;
      const yPos = paddingTop + plotHeight - (plotHeight * (i / gridCount));

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', paddingLeft);
      line.setAttribute('y1', yPos);
      line.setAttribute('x2', width - paddingRight);
      line.setAttribute('y2', yPos);
      line.setAttribute('stroke', 'var(--border-color)');
      line.setAttribute('stroke-width', '1');
      if (i > 0) line.setAttribute('stroke-dasharray', '4 4');
      chartSvg.appendChild(line);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', paddingLeft - 10);
      text.setAttribute('y', yPos + 4);
      text.setAttribute('fill', 'var(--text-secondary)');
      text.setAttribute('font-family', 'var(--font-body)');
      text.setAttribute('font-size', '10px');
      text.setAttribute('text-anchor', 'end');
      text.textContent = `${yVal.toFixed(1)}h`;
      chartSvg.appendChild(text);
    }

    const colCount = dates.length;
    const colWidth = 28;
    const spacing = plotWidth / colCount;

    dates.forEach((day, index) => {
      const xCenter = paddingLeft + (spacing * index) + (spacing / 2);
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', xCenter);
      text.setAttribute('y', height - paddingBottom + 18);
      text.setAttribute('fill', 'var(--text-secondary)');
      text.setAttribute('font-family', 'var(--font-body)');
      text.setAttribute('font-size', '10px');
      text.setAttribute('text-anchor', 'middle');
      text.textContent = day.label;
      chartSvg.appendChild(text);

      let runningYOffset = 0;
      const subStackDetails = [];

      subjects.forEach(subject => {
        const sec = chartData[day.dateStr][subject.id] || 0;
        if (sec <= 0) return;

        const subHours = sec / 3600;
        const rectHeight = (subHours / yMax) * plotHeight;
        const xPos = xCenter - (colWidth / 2);
        const yPos = paddingTop + plotHeight - rectHeight - runningYOffset;

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', xPos);
        rect.setAttribute('y', yPos);
        rect.setAttribute('width', colWidth);
        rect.setAttribute('height', rectHeight);
        rect.setAttribute('fill', subject.color);
        rect.setAttribute('rx', '3');
        rect.style.transition = 'opacity 0.2s';
        rect.style.cursor = 'pointer';
        
        rect.addEventListener('mouseover', (e) => {
          this.showTooltip(e, day.dateStr, subStackDetails);
          rect.style.opacity = '0.8';
        });
        
        rect.addEventListener('mouseout', () => {
          this.hideTooltip();
          rect.style.opacity = '1';
        });

        chartSvg.appendChild(rect);

        subStackDetails.push({
          name: subject.name,
          color: subject.color,
          hours: subHours
        });

        runningYOffset += rectHeight;
      });

      const hoverArea = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      hoverArea.setAttribute('x', xCenter - (spacing / 2));
      hoverArea.setAttribute('y', paddingTop);
      hoverArea.setAttribute('width', spacing);
      hoverArea.setAttribute('height', plotHeight);
      hoverArea.setAttribute('fill', 'transparent');
      hoverArea.style.cursor = 'pointer';
      
      hoverArea.addEventListener('mouseover', (e) => {
        this.showTooltip(e, day.dateStr, subStackDetails);
      });
      hoverArea.addEventListener('mousemove', (e) => {
        this.showTooltip(e, day.dateStr, subStackDetails);
      });
      hoverArea.addEventListener('mouseout', () => {
        this.hideTooltip();
      });

      chartSvg.appendChild(hoverArea);
    });

    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', paddingLeft);
    xAxis.setAttribute('y1', height - paddingBottom);
    xAxis.setAttribute('x2', width - paddingRight);
    xAxis.setAttribute('y2', height - paddingBottom);
    xAxis.setAttribute('stroke', 'var(--border-color)');
    xAxis.setAttribute('stroke-width', '1.5');
    chartSvg.appendChild(xAxis);

    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', paddingLeft);
    yAxis.setAttribute('y1', paddingTop);
    yAxis.setAttribute('x2', paddingLeft);
    yAxis.setAttribute('y2', height - paddingBottom);
    yAxis.setAttribute('stroke', 'var(--border-color)');
    yAxis.setAttribute('stroke-width', '1.5');
    chartSvg.appendChild(yAxis);

    subjects.forEach(subject => {
      const legend = document.createElement('div');
      legend.className = 'legend-item';
      legend.innerHTML = `
        <div class="legend-dot" style="background-color: ${subject.color}"></div>
        <span>${subject.name}</span>
      `;
      legendContainer.appendChild(legend);
    });
  },

  showTooltip(e, dateStr, stackDetails) {
    const tooltip = document.getElementById('chart-tooltip');
    const dateEl = document.getElementById('tooltip-date');
    const subjectsEl = document.getElementById('tooltip-subjects');
    
    const formattedDate = new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    dateEl.textContent = formattedDate;
    
    subjectsEl.innerHTML = '';
    if (stackDetails.length === 0) {
      subjectsEl.innerHTML = '<div style="color:var(--text-muted); font-size: 0.75rem;">No study sessions</div>';
    } else {
      [...stackDetails].sort((a,b) => b.hours - a.hours).forEach(item => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '0.5rem';
        row.style.fontSize = '0.75rem';
        row.style.color = 'var(--text-secondary)';
        
        row.innerHTML = `
          <div style="width: 6px; height: 6px; border-radius: 50%; background-color: ${item.color}"></div>
          <span style="color:#fff; font-weight:500;">${item.name}:</span>
          <span>${item.hours.toFixed(2)} hrs</span>
        `;
        subjectsEl.appendChild(row);
      });
    }

    const rect = document.getElementById('weekly-chart-box').getBoundingClientRect();
    const tooltipWidth = 140;
    const tooltipHeight = 60 + (stackDetails.length * 16);

    let x = e.clientX - rect.left + 15;
    let y = e.clientY - rect.top - tooltipHeight - 15;

    if (x + tooltipWidth > rect.width) x = e.clientX - rect.left - tooltipWidth - 15;
    if (y < 0) y = e.clientY - rect.top + 15;

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    tooltip.style.display = 'block';
  },

  hideTooltip() {
    document.getElementById('chart-tooltip').style.display = 'none';
  },

  renderWeeklyInsights(subjects, sessions) {
    const topSubjectEl = document.getElementById('insight-top-subject');
    const totalHoursEl = document.getElementById('insight-total-hours');
    const streakDaysEl = document.getElementById('insight-streak-days');

    if (sessions.length === 0 || subjects.length === 0) {
      topSubjectEl.textContent = 'No study logged yet';
      totalHoursEl.textContent = '0 hours study time total';
      streakDaysEl.textContent = 'Study for 1 hr in a day to build a streak.';
      return;
    }

    const subjectTimes = {};
    let totalSeconds = 0;
    const past7Days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      past7Days.push(Utils.toLocalISODate(d));
    }

    sessions.forEach(sess => {
      if (past7Days.includes(sess.date)) {
        subjectTimes[sess.subjectId] = (subjectTimes[sess.subjectId] || 0) + sess.durationSeconds;
        totalSeconds += sess.durationSeconds;
      }
    });

    const totalWeeklyHours = totalSeconds / 3600;
    totalHoursEl.innerHTML = `You completed <strong>${totalWeeklyHours.toFixed(1)} hours</strong> of study this week.`;

    let topSubId = null;
    let maxSeconds = 0;
    Object.keys(subjectTimes).forEach(subId => {
      if (subjectTimes[subId] > maxSeconds) {
        maxSeconds = subjectTimes[subId];
        topSubId = subId;
      }
    });

    if (topSubId) {
      const subObj = subjects.find(s => s.id === topSubId);
      if (subObj) {
        const hr = maxSeconds / 3600;
        topSubjectEl.innerHTML = `<span style="color:${subObj.color}; font-weight:600;">${subObj.name}</span> (${hr.toFixed(1)} hrs study time)`;
      } else {
        topSubjectEl.textContent = 'No session logged yet';
      }
    } else {
      topSubjectEl.textContent = 'No session logged yet';
    }

    const streak = this.calculateStreak(sessions);
    if (streak > 0) {
      streakDaysEl.innerHTML = `Awesome! You have kept a <strong>${streak} day streak</strong> alive. Keep it up!`;
    } else {
      streakDaysEl.textContent = 'Complete at least 1 hour of study today to launch your daily streak!';
    }
  },

  renderSessionHistory(subjects, sessions) {
    const tbody = document.getElementById('session-history-body');
    tbody.innerHTML = '';

    if (sessions.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center" style="padding: 2.5rem 1rem; color: var(--text-muted);">
            No study sessions logged yet.
          </td>
        </tr>
      `;
      return;
    }

    const sorted = [...sessions].sort((a,b) => b.startTime - a.startTime);

    sorted.forEach(sess => {
      const subject = subjects.find(s => s.id === sess.subjectId);
      const subName = subject ? subject.name : 'Deleted Subject';
      const subColor = subject ? subject.color : '#9ca3af';

      const row = document.createElement('tr');
      
      const sessDate = new Date(sess.startTime);
      const dateLabel = sessDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const timeLabel = sessDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      
      row.innerHTML = `
        <td>${dateLabel}</td>
        <td>
          <div class="history-subject-badge">
            <div class="history-subject-dot" style="background-color: ${subColor}"></div>
            <span>${subName}</span>
          </div>
        </td>
        <td>${timeLabel}</td>
        <td>${Utils.formatDurationShort(sess.durationSeconds)}</td>
        <td>
          <button class="btn btn-danger btn-icon btn-sm delete-session-btn" data-id="${sess.id}" title="Delete session log">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      `;

      row.querySelector('.delete-session-btn').addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this study session record? This cannot be undone.')) {
          try {
            await DB.deleteStudySession(this.currentUser, sess.id);
            await this.initWeeklyReport();
          } catch (err) {
            alert("Error deleting session: " + err.message);
          }
        }
      });

      tbody.appendChild(row);
    });
  }
};

// Start application
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
