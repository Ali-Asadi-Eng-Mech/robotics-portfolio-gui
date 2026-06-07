(() => {
  const DATA = window.PORTFOLIO_DATA;
  const STORAGE_KEY = 'roboticsPortfolioDashboard.v3.cleanPersian';
  const PERSIAN_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];

  const state = {
    activeView: 'dashboard',
    query: '',
    priority: 'all',
    lane: 'all',
    tasks: structuredClone(DATA.tasks),
    checks: {},
    notes: {},
    meetingChecks: {},
  };

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
    const existing = [...new Set(DATA.tasks.map(task => task.priority))];
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

  function renderAll() {
    $('#sessionDate').textContent = DATA.meta.sessionDate;
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

  loadState();
  bindEvents();
  renderAll();
  setView('dashboard');
  registerServiceWorker();
})();
