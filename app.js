(() => {
  const DEFAULT_DATA = structuredClone(window.PORTFOLIO_DATA);
  const STORAGE_KEY = 'roboticsPortfolioDashboard.v4.status';
  const CONTENT_STORAGE_KEY = 'roboticsPortfolioDashboard.v4.content';
  const TELEGRAM_STORAGE_KEY = 'roboticsPortfolioDashboard.v1.telegram';
  const PERSIAN_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];

  // رمز پیش‌فرض: CAST-Robotics-1405
  // نکته: این قفل برای GitHub Pages یک قفل سمت مرورگر است و امنیت سازمانی کامل محسوب نمی‌شود.
  const AUTH_CONFIG = {
    enabled: true,
    passwordHash: 'fb078bda1c9310a2060b16d06060d865ae8988841e983ca89e4bb5d2a3ff5bc8',
    sessionKey: 'roboticsPortfolioDashboard.v5.auth',
    sessionHours: 8,
    maxAttempts: 5,
  };
  let authAttempts = 0;

  async function sha256Hex(value) {
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(String(value)));
    return Array.from(new Uint8Array(buffer)).map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function authSessionIsValid() {
    if (!AUTH_CONFIG.enabled) return true;
    try {
      const raw = sessionStorage.getItem(AUTH_CONFIG.sessionKey);
      if (!raw) return false;
      const session = JSON.parse(raw);
      return Boolean(session?.ok) && Date.now() - Number(session.time || 0) < AUTH_CONFIG.sessionHours * 60 * 60 * 1000;
    } catch (_) {
      return false;
    }
  }

  function revealApplication() {
    document.body.classList.remove('auth-locked');
    document.body.classList.add('auth-unlocked');
    $('.app-shell')?.removeAttribute('aria-hidden');
  }

  function lockApplication() {
    sessionStorage.removeItem(AUTH_CONFIG.sessionKey);
    location.reload();
  }

  function showAuthGate(onSuccess) {
    const form = $('#authForm');
    const input = $('#authPassword');
    const error = $('#authError');
    if (!form || !input) {
      console.error('Authentication form not found.');
      return;
    }
    window.setTimeout(() => input.focus(), 100);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      error.textContent = '';
      const value = input.value.trim();
      if (!value) return;
      if (!crypto?.subtle) {
        error.textContent = 'مرورگر شما از بررسی امن رمز پشتیبانی نمی‌کند. مرورگر را به‌روزرسانی کنید.';
        return;
      }
      const enteredHash = await sha256Hex(value);
      if (enteredHash === AUTH_CONFIG.passwordHash) {
        sessionStorage.setItem(AUTH_CONFIG.sessionKey, JSON.stringify({ ok: true, time: Date.now() }));
        input.value = '';
        revealApplication();
        onSuccess();
        return;
      }
      authAttempts += 1;
      input.value = '';
      error.textContent = authAttempts >= AUTH_CONFIG.maxAttempts
        ? 'رمز چند بار اشتباه وارد شد. صفحه را دوباره بارگذاری کنید یا رمز صحیح را وارد کنید.'
        : 'رمز واردشده نادرست است.';
    });
  }

  function runAfterAuthentication(onSuccess) {
    if (!AUTH_CONFIG.enabled || authSessionIsValid()) {
      revealApplication();
      onSuccess();
      return;
    }
    showAuthGate(onSuccess);
  }

  function loadContentSnapshot() {
    try {
      const raw = localStorage.getItem(CONTENT_STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_DATA);
      const saved = JSON.parse(raw);
      if (!saved || !Array.isArray(saved.tasks)) return structuredClone(DEFAULT_DATA);
      return {
        ...structuredClone(DEFAULT_DATA),
        meta: { ...structuredClone(DEFAULT_DATA.meta), ...(saved.meta || {}) },
        summary: { ...structuredClone(DEFAULT_DATA.summary), ...(saved.summary || {}) },
        lanes: Array.isArray(saved.lanes) ? saved.lanes : structuredClone(DEFAULT_DATA.lanes),
        tasks: saved.tasks,
        decisions: Array.isArray(saved.decisions) ? saved.decisions : structuredClone(DEFAULT_DATA.decisions),
        risks: Array.isArray(saved.risks) ? saved.risks : structuredClone(DEFAULT_DATA.risks),
        actionPlan: Array.isArray(saved.actionPlan) ? saved.actionPlan : structuredClone(DEFAULT_DATA.actionPlan),
      };
    } catch (error) {
      console.warn('Could not load editable content', error);
      return structuredClone(DEFAULT_DATA);
    }
  }

  let DATA = loadContentSnapshot();

  const state = {
    activeView: 'dashboard',
    query: '',
    priority: 'all',
    lane: 'all',
    tasks: structuredClone(DATA.tasks),
    checks: {},
    notes: {},
    meetingChecks: {},
    selectedTaskId: DATA.tasks[0]?.id || null,
  };


  function loadTelegramSettings() {
    try {
      const raw = localStorage.getItem(TELEGRAM_STORAGE_KEY);
      if (!raw) return { workerUrl: '', sharedKey: '', defaultChatIds: '', appUrl: location.href.split('#')[0] };
      const saved = JSON.parse(raw);
      return {
        workerUrl: saved.workerUrl || '',
        sharedKey: saved.sharedKey || '',
        defaultChatIds: saved.defaultChatIds || '',
        appUrl: saved.appUrl || location.href.split('#')[0],
      };
    } catch (_) {
      return { workerUrl: '', sharedKey: '', defaultChatIds: '', appUrl: location.href.split('#')[0] };
    }
  }

  let telegramSettings = loadTelegramSettings();

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function toFa(value) {
    return String(value).replace(/\d/g, d => PERSIAN_DIGITS[Number(d)]);
  }

  function normalizeText(value) {
    return String(value || '')
      .replace(/[ي]/g, 'ی')
      .replace(/[ك]/g, 'ک')
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .toLowerCase();
  }

  function deadlineDay(deadline) {
    const m = String(deadline).match(/۱۴۰۵\/۰۳\/(\d{2}|[۰-۹]{2})/);
    if (!m) return 99;
    const raw = m[1].replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
    return Number(raw);
  }

  function daysFromSession(deadline) {
    const sessionDay = 17;
    const day = deadlineDay(deadline);
    if (!Number.isFinite(day)) return null;
    return day - sessionDay;
  }

  function laneTitle(id) {
    return DATA.lanes.find(l => l.id === id)?.title || id;
  }

  function priorityClass(level) {
    return `priority-${level}`;
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tasks: state.tasks.map(t => ({ id: t.id, lane: t.lane })),
      checks: state.checks,
      notes: state.notes,
      meetingChecks: state.meetingChecks,
    }));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Array.isArray(saved.tasks)) {
        saved.tasks.forEach(savedTask => {
          const task = state.tasks.find(t => t.id === savedTask.id);
          if (task && DATA.lanes.some(l => l.id === savedTask.lane)) task.lane = savedTask.lane;
        });
      }
      state.checks = saved.checks || {};
      state.notes = saved.notes || {};
      state.meetingChecks = saved.meetingChecks || {};
    } catch (error) {
      console.warn('Could not load saved dashboard state', error);
    }
  }

  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => el.classList.remove('show'), 2400);
  }

  function setView(viewId) {
    state.activeView = viewId;
    $$('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewId));
    $$('.view').forEach(view => view.classList.toggle('active', view.id === `view-${viewId}`));
    const titles = {
      dashboard: ['داشبورد مدیریتی پیگیری پروژه‌ها', 'نمای زنده از وضعیت پروژه‌ها، ددلاین‌ها، ریسک‌ها و تصمیم‌های باز.'],
      tasks: ['تسک‌ها و کارت‌های مدیریتی', 'هر پروژه باید خروجی، مالک، ددلاین و وضعیت قابل دفاع داشته باشد.'],
      kanban: ['برد Kanban پیگیری', 'نمای جلسه‌ای برای جابه‌جایی وضعیت پروژه‌ها و بستن ابهام‌ها.'],
      decisions: ['تصمیم‌های باز مدیریتی', 'گلوگاه‌هایی که بدون تصمیم روشن، پروژه را کند یا متوقف می‌کنند.'],
      risks: ['ریسک‌های مدیریتی', 'ریسک‌ها باید کنترل عملیاتی داشته باشند، نه فقط عنوان هشدار.'],
      meeting: ['برنامه اقدام تا جلسه بعد', 'جلسه بعد باید روی خروجی‌های بسته‌شده و تصمیم‌های دقیق تمرکز کند.'],
      editor: ['ویرایش محتوا و ذخیره تغییرات', 'متن کارت‌ها، مسئول‌ها، ددلاین‌ها و چک‌لیست‌ها را بدون تغییر کد اصلاح کنید.'],
    };
    $('#pageTitle').textContent = titles[viewId][0];
    $('#pageSubtitle').textContent = titles[viewId][1];
  }

  function kpiData() {
    const done = state.tasks.filter(t => t.lane === 'done').length;
    const stopped = state.tasks.filter(t => t.lane === 'stopped').length;
    const open = state.tasks.length - done - stopped;
    const waiting = state.tasks.filter(t => t.lane === 'waiting').length;
    const decision = state.tasks.filter(t => t.lane === 'decision').length;
    const critical = state.tasks.filter(t => t.priorityLevel >= 4 && t.lane !== 'done' && t.lane !== 'stopped').length;
    return [
      { label: 'محور فعال', value: open, hint: `از ${toFa(state.tasks.length)} مورد کل`, type: 'active' },
      { label: 'اولویت بالا', value: critical, hint: 'باید زودتر از بقیه بسته شوند', type: 'critical' },
      { label: 'در انتظار پاسخ', value: waiting, hint: 'ریسک توقف ارتباطی', type: 'waiting' },
      { label: 'نیازمند تصمیم', value: decision, hint: 'گلوگاه مدیریتی', type: 'decision' },
    ];
  }

  function renderKpis() {
    $('#kpiGrid').innerHTML = kpiData().map(item => `
      <article class="kpi-card ${item.type}">
        <span>${item.label}</span>
        <strong>${toFa(item.value)}</strong>
        <p>${item.hint}</p>
      </article>
    `).join('');
  }

  function renderCompletion() {
    const total = state.tasks.length;
    const closed = state.tasks.filter(t => t.lane === 'done' || t.lane === 'stopped').length;
    const percent = total ? Math.round((closed / total) * 100) : 0;
    $('#completionRing').style.setProperty('--p', `${percent}%`);
    $('#completionPercent').textContent = `${toFa(percent)}٪`;
  }

  function renderUrgentList() {
    const urgent = state.tasks
      .filter(t => t.lane !== 'done' && t.lane !== 'stopped')
      .sort((a, b) => (b.priorityLevel - a.priorityLevel) || (deadlineDay(a.deadline) - deadlineDay(b.deadline)))
      .slice(0, 5);

    $('#urgentList').innerHTML = urgent.map(task => {
      const delta = daysFromSession(task.deadline);
      const deltaText = delta === null ? task.deadline : delta <= 0 ? 'امروز یا عقب‌افتاده' : `${toFa(delta)} روز تا کنترل`;
      const cls = task.priorityLevel >= 5 ? 'critical' : task.priorityLevel >= 4 ? 'high' : '';
      return `
        <button class="urgent-item ${cls}" data-open-task="${task.id}">
          <span class="urgent-dot"></span>
          <span>
            <h4>${task.title}</h4>
            <p>${task.nextAction}</p>
          </span>
          <span class="badge priority-${task.priorityLevel}">${deltaText}</span>
        </button>
      `;
    }).join('');
  }

  function renderStatusBars() {
    const total = state.tasks.length;
    $('#statusBars').innerHTML = DATA.lanes.map(lane => {
      const count = state.tasks.filter(t => t.lane === lane.id).length;
      const percent = total ? Math.round((count / total) * 100) : 0;
      return `
        <div class="status-bar-row">
          <div class="status-label"><span>${lane.title}</span><strong>${toFa(count)} مورد</strong></div>
          <div class="status-track"><div class="status-fill" style="width:${Math.max(percent, count ? 6 : 0)}%"></div></div>
        </div>
      `;
    }).join('');
  }

  function renderLaneFilter() {
    $('#laneFilter').innerHTML = '<option value="all">همه</option>' + DATA.lanes.map(lane => `<option value="${lane.id}">${lane.title}</option>`).join('');
    $('#laneFilter').value = state.lane;
  }

  function renderPriorityFilter() {
    const order = ['بسیار بالا', 'بالا', 'نیازمند تصمیم دکتر', 'در انتظار پاسخ', 'نیازمند پیگیری قراردادی', 'متوسط رو به بالا', 'متوسط'];
    const existing = [...new Set(state.tasks.map(task => task.priority))];
    const priorities = order.filter(item => existing.includes(item)).concat(existing.filter(item => !order.includes(item)));
    $('#priorityFilter').innerHTML = '<option value="all">همه</option>' + priorities.map(priority => `<option value="${priority}">${priority}</option>`).join('');
    $('#priorityFilter').value = state.priority;
  }

  function filteredTasks() {
    const q = normalizeText(state.query);
    return state.tasks.filter(task => {
      const blob = normalizeText([task.title, task.owner, task.deadline, task.priority, task.deliverable, task.nextAction, task.risk, task.tags.join(' ')].join(' '));
      const matchQuery = !q || blob.includes(q);
      const matchPriority = state.priority === 'all' || task.priority === state.priority;
      const matchLane = state.lane === 'all' || task.lane === state.lane;
      return matchQuery && matchPriority && matchLane;
    });
  }

  function renderTasks() {
    const tasks = filteredTasks();
    $('#taskGrid').innerHTML = tasks.map(task => taskCard(task)).join('') || `<div class="panel">موردی با این فیلتر پیدا نشد.</div>`;
  }

  function taskCard(task) {
    const delta = daysFromSession(task.deadline);
    const deltaText = delta === null ? task.deadline : delta <= 0 ? 'کنترل فوری' : `${toFa(delta)} روز مانده`;
    const checkedCount = (state.checks[task.id] || []).filter(Boolean).length;
    return `
      <article class="task-card ${priorityClass(task.priorityLevel)}" data-task-id="${task.id}">
        <div class="card-top">
          <h3>${toFa(task.row)}. ${task.title}</h3>
          <span class="badge priority-${task.priorityLevel}">${task.priority}</span>
        </div>
        <div class="badges">
          <span class="badge">${laneTitle(task.lane)}</span>
          <span class="badge">${task.meetingStatus}</span>
          ${task.doctorDecision ? '<span class="badge decision">تصمیم دکتر</span>' : ''}
          <span class="badge">${deltaText}</span>
        </div>
        <div class="meta-grid">
          <div class="meta-item"><span>مسئول / پیگیر</span><strong>${task.owner}</strong></div>
          <div class="meta-item"><span>ددلاین</span><strong>${task.deadline}</strong></div>
          <div class="meta-item"><span>خروجی قابل تحویل</span><strong>${task.deliverable}</strong></div>
          <div class="meta-item"><span>چک‌لیست</span><strong>${toFa(checkedCount)} از ${toFa(task.checklist.length)}</strong></div>
        </div>
        <p class="card-text"><strong>اقدام بعدی:</strong> ${task.nextAction}</p>
        <div class="card-actions">
          <select class="status-select" data-lane-change="${task.id}">
            ${DATA.lanes.map(lane => `<option value="${lane.id}" ${lane.id === task.lane ? 'selected' : ''}>${lane.title}</option>`).join('')}
          </select>
          <button class="ghost-btn" data-open-task="${task.id}">جزئیات</button>
          <button class="primary-btn wide" data-quick-done="${task.id}">بستن به‌عنوان انجام‌شده</button>
        </div>
      </article>
    `;
  }

  function renderKanban() {
    $('#kanbanBoard').innerHTML = DATA.lanes.map(lane => {
      const items = state.tasks.filter(t => t.lane === lane.id);
      return `
        <section class="kanban-column" data-lane="${lane.id}">
          <div class="kanban-head">
            <div>
              <h3>${lane.title}</h3>
              <small>${lane.description}</small>
            </div>
            <span class="kanban-count">${toFa(items.length)}</span>
          </div>
          <div class="kanban-list">
            ${items.map(task => `
              <article class="kanban-card ${priorityClass(task.priorityLevel)}" draggable="true" data-task-id="${task.id}">
                <div class="card-top">
                  <h4>${task.title}</h4>
                  <span class="badge priority-${task.priorityLevel}">${task.priority}</span>
                </div>
                <p>${task.deliverable}</p>
                <div class="badges">
                  <span class="badge">${task.deadline}</span>
                  ${task.doctorDecision ? '<span class="badge decision">تصمیم</span>' : ''}
                </div>
              </article>
            `).join('')}
          </div>
        </section>
      `;
    }).join('');
  }

  function renderDecisions() {
    $('#decisionsTable tbody').innerHTML = DATA.decisions.map(decision => `
      <tr>
        <td><strong>${decision.subject}</strong></td>
        <td>${decision.owner}</td>
        <td>${decision.question}</td>
        <td>${decision.deadline}</td>
        <td><button class="ghost-btn small" data-open-task="${decision.linkedTaskId}">بازکردن کارت</button></td>
      </tr>
    `).join('');
  }

  function renderRisks() {
    $('#riskGrid').innerHTML = DATA.risks.map(risk => `
      <article class="risk-card level-${risk.levelScore}">
        <div class="card-top">
          <h3>${risk.title}</h3>
          <span class="badge priority-${risk.levelScore}">${risk.level}</span>
        </div>
        <div class="meta-grid">
          <div class="meta-item"><span>محور مرتبط</span><strong>${risk.axis}</strong></div>
          <div class="meta-item"><span>سطح ریسک</span><strong>${risk.level}</strong></div>
        </div>
        <p><strong>کنترل پیشنهادی:</strong> ${risk.control}</p>
        <div class="risk-meter" aria-label="سطح ریسک ${risk.level}">
          ${[1,2,3,4,5].map(i => `<span class="risk-block ${i <= risk.levelScore ? 'active' : ''}"></span>`).join('')}
        </div>
        <div class="card-actions"><button class="ghost-btn wide" data-open-task="${risk.linkedTaskId}">رفتن به کارت مرتبط</button></div>
      </article>
    `).join('');
  }

  function renderMeeting() {
    $('#actionPlan').innerHTML = DATA.actionPlan.map(item => `<li>${item}</li>`).join('');
    const checks = [
      'هیچ پروژه‌ای فقط با عبارت «در حال پیگیری» بسته نشود.',
      'هر مورد باید مسئول، تاریخ کنترل و خروجی قابل تحویل داشته باشد.',
      'موارد بی‌پاسخ بعد از یک پیگیری نهایی تعیین تکلیف شوند.',
      'تصمیم‌های وابسته به دکتر قبل از شروع نگارش، جلسه یا قرارداد قفل شوند.'
    ];
    $('#meetingChecks').innerHTML = checks.map((text, i) => `
      <label>
        <input type="checkbox" data-meeting-check="${i}" ${state.meetingChecks[i] ? 'checked' : ''} />
        <span>${text}</span>
      </label>
    `).join('');
  }


  function updateDerivedSummary() {
    DATA.summary = {
      activeAxes: state.tasks.length,
      highPriority: state.tasks.filter(task => task.priorityLevel >= 4).length,
      waitingResponse: state.tasks.filter(task => task.lane === 'waiting' || task.priority === 'در انتظار پاسخ').length,
      doctorDecisions: state.tasks.filter(task => task.doctorDecision || task.lane === 'decision').length,
    };
  }

  function saveContent() {
    updateDerivedSummary();
    DATA.tasks = structuredClone(state.tasks);
    const payload = {
      meta: DATA.meta,
      summary: DATA.summary,
      lanes: DATA.lanes,
      tasks: DATA.tasks,
      decisions: DATA.decisions,
      risks: DATA.risks,
      actionPlan: DATA.actionPlan,
      savedAt: new Date().toISOString(),
      lastUpdatedText: metaUpdatedText(),
    };
    localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(payload));
  }

  function selectedTask() {
    return state.tasks.find(task => task.id === state.selectedTaskId) || state.tasks[0] || null;
  }

  function uniqueId(base = 'task') {
    const slug = String(base || 'task')
      .trim()
      .replace(/[‌\s]+/g, '-')
      .replace(/[^\w\-؀-ۿ]/g, '')
      .slice(0, 40) || 'task';
    let id = `${slug}-${Date.now().toString(36)}`;
    let i = 1;
    while (state.tasks.some(task => task.id === id)) id = `${slug}-${Date.now().toString(36)}-${i++}`;
    return id;
  }

  function formValue(selector, root = document) {
    const el = $(selector, root);
    return el ? el.value.trim() : '';
  }

  function textareaLines(value) {
    return String(value || '')
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean);
  }

  function normalizePriorityLevel(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 3;
    return Math.max(1, Math.min(5, n));
  }


  function metaUpdatedText() {
    const date = DATA.meta.lastUpdatedDate || DATA.meta.sessionDateJalali || '';
    const time = DATA.meta.lastUpdatedTime || '';
    const by = DATA.meta.lastUpdatedBy || '';
    const parts = [];
    if (date) parts.push(`آخرین آپدیت: ${date}`);
    if (time) parts.push(`ساعت ${time}`);
    if (by) parts.push(`توسط ${by}`);
    return parts.join(' · ') || 'آخرین آپدیت ثبت نشده است.';
  }

  function renderMetaEditor() {
    const form = $('#metaEditorForm');
    if (!form) return;
    const date = $('#editLastUpdatedDate');
    const time = $('#editLastUpdatedTime');
    const by = $('#editLastUpdatedBy');
    const version = $('#editVersion');
    const note = $('#editLastUpdatedNote');
    if (date && document.activeElement !== date) date.value = DATA.meta.lastUpdatedDate || '';
    if (time && document.activeElement !== time) time.value = DATA.meta.lastUpdatedTime || '';
    if (by && document.activeElement !== by) by.value = DATA.meta.lastUpdatedBy || '';
    if (version && document.activeElement !== version) version.value = DATA.meta.version || '';
    if (note && document.activeElement !== note) note.value = DATA.meta.lastUpdatedNote || '';
    const badge = $('#metaPreviewBadge');
    if (badge) badge.textContent = metaUpdatedText();
  }

  function saveSiteMetaFromForm() {
    DATA.meta.lastUpdatedDate = formValue('#editLastUpdatedDate') || DATA.meta.lastUpdatedDate || '';
    DATA.meta.lastUpdatedTime = formValue('#editLastUpdatedTime') || DATA.meta.lastUpdatedTime || '';
    DATA.meta.lastUpdatedBy = formValue('#editLastUpdatedBy') || DATA.meta.lastUpdatedBy || '';
    DATA.meta.version = formValue('#editVersion') || DATA.meta.version || '';
    DATA.meta.lastUpdatedNote = formValue('#editLastUpdatedNote') || '';
    saveContent();
    renderAll();
    setView('editor');
    toast('تاریخ، زمان و اطلاعات نسخه سایت ذخیره شد.');
  }

  function fillMetaWithCurrentDeviceTime() {
    const now = new Date();
    const dateInput = $('#editLastUpdatedDate');
    const timeInput = $('#editLastUpdatedTime');
    if (dateInput) dateInput.value = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    if (timeInput) timeInput.value = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    toast('تاریخ و ساعت فعلی دستگاه در فرم قرار گرفت؛ برای ثبت نهایی دکمه ذخیره را بزن.');
  }


  function parseChatIds(value) {
    return String(value || '')
      .split(/[،,\n]/)
      .map(item => item.trim())
      .filter(Boolean);
  }

  function saveTelegramSettingsFromForm() {
    telegramSettings = {
      workerUrl: formValue('#telegramWorkerUrl'),
      sharedKey: formValue('#telegramSharedKey'),
      defaultChatIds: formValue('#telegramDefaultChatIds'),
      appUrl: formValue('#telegramAppUrl') || location.href.split('#')[0],
    };
    localStorage.setItem(TELEGRAM_STORAGE_KEY, JSON.stringify(telegramSettings));
    renderTelegramSettings();
    toast('تنظیمات تلگرام در همین مرورگر ذخیره شد.');
  }

  function renderTelegramSettings() {
    const workerUrl = $('#telegramWorkerUrl');
    const sharedKey = $('#telegramSharedKey');
    const defaultChatIds = $('#telegramDefaultChatIds');
    const appUrl = $('#telegramAppUrl');
    if (workerUrl && document.activeElement !== workerUrl) workerUrl.value = telegramSettings.workerUrl || '';
    if (sharedKey && document.activeElement !== sharedKey) sharedKey.value = telegramSettings.sharedKey || '';
    if (defaultChatIds && document.activeElement !== defaultChatIds) defaultChatIds.value = telegramSettings.defaultChatIds || '';
    if (appUrl && document.activeElement !== appUrl) appUrl.value = telegramSettings.appUrl || location.href.split('#')[0];
    const badge = $('#telegramStatusBadge');
    if (badge) badge.textContent = telegramSettings.workerUrl ? 'آماده ارسال' : 'غیرفعال';
  }

  function taskTelegramChatIds(task) {
    const taskIds = parseChatIds(task.telegramChatIds);
    return taskIds.length ? taskIds : parseChatIds(telegramSettings.defaultChatIds);
  }

  async function sendTelegramNotification(task, options = {}) {
    if (!telegramSettings.workerUrl) {
      toast('ابتدا آدرس Cloudflare Worker را در تنظیمات تلگرام وارد و ذخیره کن.');
      setView('editor');
      return;
    }
    const chatIds = options.chatIds || taskTelegramChatIds(task);
    if (!chatIds.length) {
      toast('برای این کارت یا تنظیمات تلگرام، Chat ID ثبت نشده است.');
      return;
    }
    const payload = {
      chatIds,
      title: task.title,
      owner: task.owner,
      deadline: task.deadline,
      priority: task.priority,
      lane: laneTitle(task.lane),
      meetingStatus: task.meetingStatus,
      deliverable: task.deliverable,
      nextAction: task.nextAction,
      risk: task.risk,
      note: options.note || task.telegramNote || '',
      appUrl: telegramSettings.appUrl || location.href.split('#')[0],
      sentAt: new Date().toISOString(),
    };

    const headers = { 'Content-Type': 'application/json' };
    if (telegramSettings.sharedKey) headers['x-portfolio-key'] = telegramSettings.sharedKey;

    try {
      const response = await fetch(telegramSettings.workerUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }
      toast('اعلان تلگرام ارسال شد.');
    } catch (error) {
      console.error(error);
      toast(`ارسال تلگرام ناموفق بود: ${error.message || 'خطای نامشخص'}`);
    }
  }

  function sendSelectedTaskTelegram(taskId) {
    const task = state.tasks.find(item => item.id === taskId);
    if (!task) return;
    sendTelegramNotification(task);
  }

  function sendTelegramTest() {
    const testTask = {
      title: 'پیام تست داشبورد پورتفولیوی رباتیک',
      owner: DATA.meta.lastUpdatedBy || 'مدیر پورتفولیو',
      deadline: DATA.meta.lastUpdatedDate || 'ثبت نشده',
      priority: 'تست اتصال',
      lane: 'open',
      meetingStatus: 'تست',
      deliverable: 'بررسی اتصال سایت به ربات تلگرام',
      nextAction: 'اگر این پیام را دریافت کردید، اتصال Worker و ربات درست است.',
      risk: 'ندارد',
      telegramChatIds: telegramSettings.defaultChatIds,
      telegramNote: 'این پیام صرفاً برای تست اتصال ارسال شده است.',
    };
    sendTelegramNotification(testTask, { note: 'این پیام صرفاً برای تست اتصال ارسال شده است.' });
  }

  function renderEditor() {
    const list = $('#editorTaskList');
    const form = $('#editorForm');
    if (!list || !form) return;
    if (!state.tasks.length) {
      list.innerHTML = '<div class="empty-editor">هنوز کارتی ثبت نشده است.</div>';
      form.innerHTML = '<div class="editor-empty-state">برای شروع، یک کارت جدید بسازید.</div>';
      return;
    }
    if (!selectedTask()) state.selectedTaskId = state.tasks[0].id;
    const task = selectedTask();
    list.innerHTML = state.tasks.map(item => `
      <button class="editor-task-row ${item.id === task.id ? 'active' : ''}" data-select-edit-task="${item.id}">
        <strong>${toFa(item.row || '')}. ${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.owner || 'بدون مسئول')} · ${escapeHtml(item.deadline || 'بدون ددلاین')}</span>
      </button>
    `).join('');

    form.innerHTML = `
      <div class="editor-form-head">
        <div>
          <span class="section-kicker">ویرایش کارت</span>
          <h3>${escapeHtml(task.title)}</h3>
        </div>
        <span class="badge">${laneTitle(task.lane)}</span>
      </div>
      <div class="form-grid two">
        <label>ردیف
          <input id="editRow" type="number" min="1" value="${Number(task.row) || 1}" />
        </label>
        <label>وضعیت کاری
          <select id="editLane">
            ${DATA.lanes.map(lane => `<option value="${lane.id}" ${lane.id === task.lane ? 'selected' : ''}>${lane.title}</option>`).join('')}
          </select>
        </label>
      </div>
      <label>عنوان پروژه / تسک
        <input id="editTitle" type="text" value="${escapeAttr(task.title)}" />
      </label>
      <div class="form-grid two">
        <label>مسئول / پیگیر
          <input id="editOwner" type="text" value="${escapeAttr(task.owner)}" />
        </label>
        <label>ددلاین
          <input id="editDeadline" type="text" value="${escapeAttr(task.deadline)}" placeholder="مثلاً ۱۴۰۵/۰۳/۲۰" />
        </label>
      </div>
      <div class="form-grid two">
        <label>اولویت
          <input id="editPriority" type="text" value="${escapeAttr(task.priority)}" />
        </label>
        <label>امتیاز اولویت
          <select id="editPriorityLevel">
            ${[1,2,3,4,5].map(n => `<option value="${n}" ${Number(task.priorityLevel) === n ? 'selected' : ''}>${toFa(n)} از ۵</option>`).join('')}
          </select>
        </label>
      </div>
      <label>وضعیت جلسه
        <input id="editMeetingStatus" type="text" value="${escapeAttr(task.meetingStatus)}" />
      </label>
      <label>خروجی قابل تحویل
        <textarea id="editDeliverable" rows="2">${escapeHtml(task.deliverable)}</textarea>
      </label>
      <label>اقدام بعدی
        <textarea id="editNextAction" rows="4">${escapeHtml(task.nextAction)}</textarea>
      </label>
      <label>ریسک مدیریتی / نکته حساس
        <textarea id="editRisk" rows="4">${escapeHtml(task.risk)}</textarea>
      </label>
      <label>چک‌لیست اجرایی؛ هر مورد در یک خط
        <textarea id="editChecklist" rows="6">${escapeHtml((task.checklist || []).join('\n'))}</textarea>
      </label>
      <label>برچسب‌ها؛ با ویرگول جدا کن
        <input id="editTags" type="text" value="${escapeAttr((task.tags || []).join('، '))}" />
      </label>
      <div class="telegram-task-box">
        <span class="section-kicker">اعلان تلگرام</span>
        <label>Chat IDهای مخصوص این کارت؛ با ویرگول جدا کن
          <input id="editTelegramChatIds" type="text" value="${escapeAttr(task.telegramChatIds || '')}" placeholder="خالی بماند، از Chat IDهای پیش‌فرض استفاده می‌شود." />
        </label>
        <label>یادداشت کوتاه پیام تلگرام
          <textarea id="editTelegramNote" rows="3" placeholder="مثلاً لطفاً وضعیت این تسک را تا پایان امروز اعلام کنید.">${escapeHtml(task.telegramNote || '')}</textarea>
        </label>
      </div>
      <label class="check-line">
        <input id="editDoctorDecision" type="checkbox" ${task.doctorDecision ? 'checked' : ''} />
        <span>این مورد نیازمند تصمیم دکتر است.</span>
      </label>
      <div class="editor-actions-row">
        <button class="primary-btn" data-save-editor-task="${task.id}">ذخیره تغییرات کارت</button>
        <button class="ghost-btn" data-send-telegram-task="${task.id}">ارسال اعلان تلگرام</button>
        <button class="ghost-btn" data-duplicate-task="${task.id}">کپی کارت</button>
        <button class="danger-btn" data-delete-task="${task.id}">حذف کارت</button>
      </div>
    `;
  }

  function applyEditorForm(taskId) {
    const task = state.tasks.find(item => item.id === taskId);
    if (!task) return;
    const title = formValue('#editTitle');
    if (!title) {
      toast('عنوان کارت نمی‌تواند خالی باشد.');
      return;
    }
    task.row = Number(formValue('#editRow')) || task.row || 1;
    task.title = title;
    task.lane = formValue('#editLane') || task.lane;
    task.owner = formValue('#editOwner');
    task.deadline = formValue('#editDeadline');
    task.priority = formValue('#editPriority') || 'متوسط';
    task.priorityLevel = normalizePriorityLevel(formValue('#editPriorityLevel'));
    task.meetingStatus = formValue('#editMeetingStatus');
    task.deliverable = formValue('#editDeliverable');
    task.nextAction = formValue('#editNextAction');
    task.risk = formValue('#editRisk');
    task.checklist = textareaLines(formValue('#editChecklist'));
    task.tags = formValue('#editTags').split(/[،,]/).map(item => item.trim()).filter(Boolean);
    task.telegramChatIds = formValue('#editTelegramChatIds');
    task.telegramNote = formValue('#editTelegramNote');
    task.doctorDecision = !!$('#editDoctorDecision')?.checked;
    state.tasks.sort((a, b) => (Number(a.row) || 999) - (Number(b.row) || 999));
    saveContent();
    saveState();
    renderAll();
    setView('editor');
    toast('کارت ویرایش و ذخیره شد.');
  }

  function createNewTask() {
    const nextRow = state.tasks.reduce((max, task) => Math.max(max, Number(task.row) || 0), 0) + 1;
    const task = {
      id: uniqueId('new-task'),
      row: nextRow,
      title: 'کارت جدید',
      meetingStatus: 'نیازمند تکمیل',
      lane: 'open',
      owner: 'نامشخص',
      deadline: '۱۴۰۵/۰۳/۲۰',
      priority: 'متوسط',
      priorityLevel: 2,
      deliverable: 'خروجی قابل تحویل را مشخص کنید.',
      nextAction: 'اقدام بعدی را بنویسید.',
      risk: 'ریسک مدیریتی را بنویسید.',
      doctorDecision: false,
      tags: [],
      checklist: ['مالک مشخص شود.', 'خروجی قابل تحویل مشخص شود.', 'ددلاین تأیید شود.'],
      telegramChatIds: '',
      telegramNote: '',
    };
    state.tasks.push(task);
    state.selectedTaskId = task.id;
    saveContent();
    saveState();
    renderAll();
    setView('editor');
    toast('کارت جدید ساخته شد.');
  }

  function duplicateTask(taskId) {
    const source = state.tasks.find(task => task.id === taskId);
    if (!source) return;
    const clone = structuredClone(source);
    clone.id = uniqueId(source.title);
    clone.row = state.tasks.reduce((max, task) => Math.max(max, Number(task.row) || 0), 0) + 1;
    clone.title = `${clone.title} - کپی`;
    state.tasks.push(clone);
    state.selectedTaskId = clone.id;
    saveContent();
    saveState();
    renderAll();
    setView('editor');
    toast('کارت کپی شد.');
  }

  function deleteTask(taskId) {
    const task = state.tasks.find(item => item.id === taskId);
    if (!task) return;
    if (!confirm(`کارت «${task.title}» حذف شود؟ این حذف فقط در داده‌های ذخیره‌شده این مرورگر اعمال می‌شود.`)) return;
    state.tasks = state.tasks.filter(item => item.id !== taskId);
    delete state.checks[taskId];
    delete state.notes[taskId];
    state.selectedTaskId = state.tasks[0]?.id || null;
    saveContent();
    saveState();
    renderAll();
    setView('editor');
    toast('کارت حذف شد.');
  }

  function exportFullBackup() {
    saveContent();
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'robotics-portfolio-dashboard',
      schema: 5,
      meta: DATA.meta,
      summary: DATA.summary,
      lanes: DATA.lanes,
      tasks: state.tasks,
      decisions: DATA.decisions,
      risks: DATA.risks,
      actionPlan: DATA.actionPlan,
      status: {
        checks: state.checks,
        notes: state.notes,
        meetingChecks: state.meetingChecks,
      },
    };
    downloadFile('robotics-portfolio-full-backup.json', JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    toast('پشتیبان کامل ساخته شد.');
  }

  function importFullBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        if (!payload || !Array.isArray(payload.tasks)) throw new Error('Invalid backup');
        DATA = {
          ...structuredClone(DEFAULT_DATA),
          meta: { ...structuredClone(DEFAULT_DATA.meta), ...(payload.meta || {}) },
          summary: { ...structuredClone(DEFAULT_DATA.summary), ...(payload.summary || {}) },
          lanes: Array.isArray(payload.lanes) ? payload.lanes : structuredClone(DEFAULT_DATA.lanes),
          tasks: payload.tasks,
          decisions: Array.isArray(payload.decisions) ? payload.decisions : structuredClone(DEFAULT_DATA.decisions),
          risks: Array.isArray(payload.risks) ? payload.risks : structuredClone(DEFAULT_DATA.risks),
          actionPlan: Array.isArray(payload.actionPlan) ? payload.actionPlan : structuredClone(DEFAULT_DATA.actionPlan),
        };
        state.tasks = structuredClone(DATA.tasks);
        state.checks = payload.status?.checks || {};
        state.notes = payload.status?.notes || {};
        state.meetingChecks = payload.status?.meetingChecks || {};
        state.selectedTaskId = state.tasks[0]?.id || null;
        saveContent();
        saveState();
        renderAll();
        setView('dashboard');
        toast('پشتیبان وارد شد و داده‌ها ذخیره شدند.');
      } catch (error) {
        console.error(error);
        toast('فایل پشتیبان معتبر نیست.');
      } finally {
        $('#importBackupInput').value = '';
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  function resetContent() {
    if (!confirm('متن‌ها و ساختار کارت‌ها به نسخه اولیه برگردد؟ یادداشت‌ها و تیک‌ها هم حذف می‌شوند.')) return;
    localStorage.removeItem(CONTENT_STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    DATA = structuredClone(DEFAULT_DATA);
    state.tasks = structuredClone(DATA.tasks);
    state.checks = {};
    state.notes = {};
    state.meetingChecks = {};
    state.selectedTaskId = state.tasks[0]?.id || null;
    renderAll();
    setView('dashboard');
    toast('محتوا به نسخه اولیه برگشت.');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
  }

  function renderAll() {
    $('#sessionDate').textContent = DATA.meta.sessionDate;
    const lastUpdatedDisplay = $('#lastUpdatedDisplay');
    if (lastUpdatedDisplay) {
      lastUpdatedDisplay.textContent = metaUpdatedText();
      lastUpdatedDisplay.title = DATA.meta.lastUpdatedNote || DATA.meta.version || 'اطلاعات آخرین به‌روزرسانی';
    }
    $('#controlRuleText').textContent = DATA.meta.controlRule;
    renderKpis();
    renderCompletion();
    renderUrgentList();
    renderStatusBars();
    renderLaneFilter();
    renderPriorityFilter();
    renderTasks();
    renderKanban();
    renderDecisions();
    renderRisks();
    renderMeeting();
    renderEditor();
    renderMetaEditor();
    renderTelegramSettings();
  }

  function updateTaskLane(taskId, lane) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    task.lane = lane;
    saveState();
    renderAll();
    toast(`وضعیت «${task.title}» به «${laneTitle(lane)}» تغییر کرد.`);
  }

  function openTask(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    const checks = state.checks[task.id] || [];
    const note = state.notes[task.id] || '';
    $('#modalContent').innerHTML = `
      <span class="section-kicker">کارت مدیریتی</span>
      <h3 id="modalTitle">${toFa(task.row)}. ${task.title}</h3>
      <div class="badges">
        <span class="badge priority-${task.priorityLevel}">${task.priority}</span>
        <span class="badge">${laneTitle(task.lane)}</span>
        <span class="badge">${task.meetingStatus}</span>
        ${task.doctorDecision ? '<span class="badge decision">نیازمند تصمیم دکتر</span>' : ''}
      </div>
      <div class="detail-grid">
        <div class="detail-box"><span>مسئول / پیگیر</span><strong>${task.owner}</strong></div>
        <div class="detail-box"><span>ددلاین پیشنهادی</span><strong>${task.deadline}</strong></div>
        <div class="detail-box"><span>خروجی قابل تحویل</span><strong>${task.deliverable}</strong></div>
        <div class="detail-box"><span>وضعیت کاری</span><strong>${laneTitle(task.lane)}</strong></div>
      </div>
      <div class="detail-box"><span>اقدام بعدی</span><strong>${task.nextAction}</strong></div>
      <div class="detail-box" style="margin-top:12px"><span>ریسک مدیریتی</span><strong>${task.risk}</strong></div>
      <h4>چک‌لیست اجرایی</h4>
      <div class="meeting-checks">
        ${task.checklist.map((item, i) => `
          <label>
            <input type="checkbox" data-task-check="${task.id}" data-check-index="${i}" ${checks[i] ? 'checked' : ''} />
            <span>${item}</span>
          </label>
        `).join('')}
      </div>
      <h4>یادداشت پیگیری</h4>
      <textarea class="notes-area" data-task-note="${task.id}" placeholder="نتیجه تماس، تصمیم جلسه یا مانع اجرایی را اینجا ثبت کنید…">${escapeHtml(note)}</textarea>
      <div class="card-actions">
        <select class="status-select" data-lane-change="${task.id}">
          ${DATA.lanes.map(lane => `<option value="${lane.id}" ${lane.id === task.lane ? 'selected' : ''}>${lane.title}</option>`).join('')}
        </select>
        <button class="primary-btn" data-save-modal="${task.id}">ذخیره</button>
      </div>
    `;
    $('#modalBackdrop').hidden = false;
  }

  function closeModal() {
    $('#modalBackdrop').hidden = true;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[ch]));
  }

  function downloadFile(filename, content, type = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    const headers = ['ردیف','پروژه','وضعیت جلسه','وضعیت کاری','مسئول','ددلاین','اولویت','اقدام بعدی','خروجی قابل تحویل','ریسک','یادداشت'];
    const rows = state.tasks.map(t => [
      t.row, t.title, t.meetingStatus, laneTitle(t.lane), t.owner, t.deadline, t.priority, t.nextAction, t.deliverable, t.risk, state.notes[t.id] || ''
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadFile('robotics-portfolio-status.csv', '\ufeff' + csv, 'text/csv;charset=utf-8');
    toast('خروجی CSV ساخته شد.');
  }

  function exportJson() {
    const payload = {
      exportedAt: new Date().toISOString(),
      source: DATA.meta.title,
      tasks: state.tasks.map(t => ({ ...t, laneTitle: laneTitle(t.lane), checks: state.checks[t.id] || [], notes: state.notes[t.id] || '' })),
      decisions: DATA.decisions,
      risks: DATA.risks,
    };
    downloadFile('robotics-portfolio-status.json', JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    toast('خروجی JSON ساخته شد.');
  }

  function resetState() {
    if (!confirm('همه وضعیت‌ها، چک‌لیست‌ها و یادداشت‌های ذخیره‌شده در این مرورگر حذف شود؟')) return;
    localStorage.removeItem(STORAGE_KEY);
    state.tasks = structuredClone(DATA.tasks);
    state.checks = {};
    state.notes = {};
    state.meetingChecks = {};
    renderAll();
    toast('وضعیت‌ها بازنشانی شد.');
  }

  function bindEvents() {
    $('#navTabs').addEventListener('click', event => {
      const btn = event.target.closest('[data-view]');
      if (btn) setView(btn.dataset.view);
    });

    document.body.addEventListener('click', event => {
      const jump = event.target.closest('[data-jump]');
      if (jump) setView(jump.dataset.jump);

      const opener = event.target.closest('[data-open-task]');
      if (opener) openTask(opener.dataset.openTask);

      const doneBtn = event.target.closest('[data-quick-done]');
      if (doneBtn) updateTaskLane(doneBtn.dataset.quickDone, 'done');

      const saveModal = event.target.closest('[data-save-modal]');
      if (saveModal) {
        const id = saveModal.dataset.saveModal;
        const notes = $(`[data-task-note="${id}"]`);
        if (notes) state.notes[id] = notes.value;
        saveState();
        closeModal();
        renderAll();
        toast('جزئیات کارت ذخیره شد.');
      }

      const editSelect = event.target.closest('[data-select-edit-task]');
      if (editSelect) {
        state.selectedTaskId = editSelect.dataset.selectEditTask;
        renderEditor();
      }

      const addTaskBtn = event.target.closest('[data-add-task]');
      if (addTaskBtn) createNewTask();

      const saveEditor = event.target.closest('[data-save-editor-task]');
      if (saveEditor) applyEditorForm(saveEditor.dataset.saveEditorTask);

      const duplicateBtn = event.target.closest('[data-duplicate-task]');
      if (duplicateBtn) duplicateTask(duplicateBtn.dataset.duplicateTask);

      const deleteBtn = event.target.closest('[data-delete-task]');
      if (deleteBtn) deleteTask(deleteBtn.dataset.deleteTask);

      const exportFullBtn = event.target.closest('[data-export-full]');
      if (exportFullBtn) exportFullBackup();

      const importFullBtn = event.target.closest('[data-import-full]');
      if (importFullBtn) $('#importBackupInput')?.click();

      const resetContentBtn = event.target.closest('[data-reset-content]');
      if (resetContentBtn) resetContent();

      const saveSiteMetaBtn = event.target.closest('[data-save-site-meta]');
      if (saveSiteMetaBtn) saveSiteMetaFromForm();

      const fillNowMetaBtn = event.target.closest('[data-fill-now-meta]');
      if (fillNowMetaBtn) fillMetaWithCurrentDeviceTime();

      const saveTelegramSettingsBtn = event.target.closest('[data-save-telegram-settings]');
      if (saveTelegramSettingsBtn) saveTelegramSettingsFromForm();

      const testTelegramBtn = event.target.closest('[data-test-telegram]');
      if (testTelegramBtn) sendTelegramTest();

      const sendTelegramTaskBtn = event.target.closest('[data-send-telegram-task]');
      if (sendTelegramTaskBtn) {
        applyEditorForm(sendTelegramTaskBtn.dataset.sendTelegramTask);
        const task = state.tasks.find(item => item.id === sendTelegramTaskBtn.dataset.sendTelegramTask);
        if (task) sendTelegramNotification(task);
      }
    });

    document.body.addEventListener('change', event => {
      const laneSelect = event.target.closest('[data-lane-change]');
      if (laneSelect) updateTaskLane(laneSelect.dataset.laneChange, laneSelect.value);

      const taskCheck = event.target.closest('[data-task-check]');
      if (taskCheck) {
        const taskId = taskCheck.dataset.taskCheck;
        const index = Number(taskCheck.dataset.checkIndex);
        if (!state.checks[taskId]) state.checks[taskId] = [];
        state.checks[taskId][index] = taskCheck.checked;
        saveState();
        renderTasks();
        renderKanban();
      }

      const meetingCheck = event.target.closest('[data-meeting-check]');
      if (meetingCheck) {
        state.meetingChecks[meetingCheck.dataset.meetingCheck] = meetingCheck.checked;
        saveState();
      }
    });

    $('#searchInput').addEventListener('input', event => {
      state.query = event.target.value;
      renderTasks();
    });
    $('#priorityFilter').addEventListener('change', event => {
      state.priority = event.target.value;
      renderTasks();
    });
    $('#laneFilter').addEventListener('change', event => {
      state.lane = event.target.value;
      renderTasks();
    });

    $('#modalClose').addEventListener('click', closeModal);
    $('#modalBackdrop').addEventListener('click', event => {
      if (event.target.id === 'modalBackdrop') closeModal();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeModal();
    });

    $('#exportCsvBtn').addEventListener('click', exportCsv);
    $('#exportJsonBtn').addEventListener('click', exportJson);
    $('#resetBtn').addEventListener('click', resetState);
    $('#printBtn').addEventListener('click', () => window.print());
    $('#lockBtn')?.addEventListener('click', lockApplication);
    $('#importBackupInput')?.addEventListener('change', event => importFullBackup(event.target.files?.[0]));

    let draggedId = null;
    document.addEventListener('dragstart', event => {
      const card = event.target.closest('.kanban-card');
      if (!card) return;
      draggedId = card.dataset.taskId;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', draggedId);
    });
    document.addEventListener('dragover', event => {
      const col = event.target.closest('.kanban-column');
      if (!col) return;
      event.preventDefault();
      col.classList.add('drag-over');
    });
    document.addEventListener('dragleave', event => {
      const col = event.target.closest('.kanban-column');
      if (col) col.classList.remove('drag-over');
    });
    document.addEventListener('drop', event => {
      const col = event.target.closest('.kanban-column');
      if (!col || !draggedId) return;
      event.preventDefault();
      $$('.kanban-column').forEach(c => c.classList.remove('drag-over'));
      updateTaskLane(draggedId, col.dataset.lane);
      draggedId = null;
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  function startApplication() {
    loadState();
    bindEvents();
    renderAll();
    setView('dashboard');
    registerServiceWorker();
  }

  runAfterAuthentication(startApplication);
})();
