// ---------- Team: roles, tasks, weekly board report, goal tracker ----------
// Loaded after index.html's script, mentor.js and ideas.js. Tasks live on each project (p.tasks);
// a weekly report is a meeting with mode 'report' where every advisor reports on their own area.

const DAY = 86400000;
const isoDay = (d = new Date()) => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const addDays = n => isoDay(new Date(Date.now() + n * DAY));
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / DAY);
const teamRole = id => advisorOf(id).team_role || advisorOf(id).role || '';
const WHEN_DAYS = { today: 1, 'this week': 7, 'this month': 30 };
const SOURCE_LABEL = { report: 'from a weekly report', meeting: 'from a meeting', ideas: 'from the idea lab', you: 'added by you' };
let taskFilter = 'open';

// ---------- tasks ----------
function addTask(p, { title, owner = '', due_days = 7, source = 'you' }) {
  p.tasks ||= [];
  title = String(title || '').trim();
  if (!title || p.tasks.some(t => t.status === 'open' && t.title.toLowerCase() === title.toLowerCase())) return false;
  p.tasks.unshift({ id: uid(), title: title.slice(0, 200), owner, due: addDays(due_days || 7), status: 'open', created: isoDay(), source });
  return true;
}

function addPlanTasks(items, source) {
  const p = activeProject();
  const added = items.filter(it => addTask(p, { ...it, source })).length;
  save();
  toast(added ? `Added ${added} task${added > 1 ? 's' : ''} to your team's list.` : 'Those tasks are already on your list.');
  return added;
}

function toggleTask(id) {
  const t = activeProject().tasks.find(x => x.id === id);
  if (!t) return;
  t.status = t.status === 'done' ? 'open' : 'done';
  t.doneAt = t.status === 'done' ? isoDay() : null;
  save();
  refreshTeam();
}

function deleteTask(id) {
  const p = activeProject();
  p.tasks = p.tasks.filter(t => t.id !== id);
  save();
  refreshTeam();
}

function addTaskFromForm() {
  const p = activeProject();
  if (addTask(p, { title: $('#newTask').value, owner: $('#newTaskOwner').value, due_days: +$('#newTaskDue').value || 7 })) {
    save();
    refreshTeam();
    setTimeout(() => $('#newTask')?.focus(), 30);
  }
}

// Sent with every request (profileOf), so each advisor sees the team's tasks and follows up
function tasksSummary(p) {
  const today = isoDay();
  const tasks = p.tasks || [];
  const who = t => t.owner ? `${advisorOf(t.owner).name} (${teamRole(t.owner)})` : 'the founder';
  const open = tasks.filter(t => t.status === 'open').sort((a, b) => a.due.localeCompare(b.due)).slice(0, 15)
    .map(t => `- ${t.due < today ? `[OVERDUE ${daysBetween(t.due, today)} days]` : '[OPEN]'} ${t.title} | owner: ${who(t)} | due ${t.due}`);
  const done = tasks.filter(t => t.status === 'done' && t.doneAt && daysBetween(t.doneAt, today) <= 14).slice(0, 8)
    .map(t => `- [DONE ${t.doneAt}] ${t.title} | owner: ${who(t)}`);
  return [...open, ...done].join('\n');
}

// ---------- goal tracker ----------
function goalCountdown(p) {
  const mp = typeof mentor !== 'undefined' && mentor ? mentor.profile : {};
  const goal = p.ambition || mp.goal || '';
  const target = (goal.match(/(?:by|before)\s+(?:the\s+)?(?:age\s+(?:of\s+)?)?(\d{2})/i) || [])[1];
  if (!goal || !target) return { goal };
  const bday = mp.birthday ? new Date(mp.birthday) : null;
  if (bday && !isNaN(bday)) {
    const end = new Date(bday);
    end.setFullYear(bday.getFullYear() + +target);
    return { goal, days: Math.ceil((end - Date.now()) / DAY), date: end };
  }
  const age = parseInt(p.age || mp.age, 10);
  return age ? { goal, days: Math.round((+target - age) * 365.25) } : { goal };
}

function goalStripHTML(p) {
  const g = goalCountdown(p);
  const today = isoDay();
  const tasks = p.tasks || [];
  const doneWeek = tasks.filter(t => t.status === 'done' && t.doneAt && daysBetween(t.doneAt, today) <= 7).length;
  const overdue = tasks.filter(t => t.status === 'open' && t.due < today).length;
  const last = lastReport(p);
  const item = (icon, big, small, color = '#fff') => `
    <div class="goal-item"><div class="text-[11px] text-[color:var(--muted)]">${icon} ${small}</div><div class="text-lg font-semibold leading-tight mt-0.5" style="color:${color}">${big}</div></div>`;
  return `
    <section class="goal-strip panel p-4 mb-5 fade-in">
      <div class="flex items-center gap-2 mb-3 min-w-0"><span class="label gold shrink-0">🎯 Your goal</span><span class="text-sm text-white truncate">${esc(g.goal || 'Add your big life goal in "Edit business"')}</span></div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        ${item('⏳', g.days != null ? g.days.toLocaleString() : '–', g.date ? `days left (until ${g.date.toLocaleDateString([], { month: 'short', year: 'numeric' })})` : 'days left', g.days != null && g.days < 365 ? '#fbbf24' : '#d8b06a')}
        ${item('✅', doneWeek, 'tasks done this week', doneWeek ? '#34d399' : '#fff')}
        ${item('⚠️', overdue, 'tasks overdue', overdue ? '#f87171' : '#fff')}
        ${item('🗓️', last?.synthesis?.data?.score != null ? `${last.synthesis.data.score}/100` : '–', 'last weekly score', last ? scoreColor(last.synthesis.data.score ?? 0) : '#fff')}
      </div>
    </section>`;
}

// ---------- weekly report banner ----------
function lastReport(p) {
  return p.meetings.find(m => m.mode === 'report' && m.synthesis?.status === 'done');
}

// When the project began: saved on new projects; older ones use their first meeting
function projectStart(p) {
  return p.createdAt || Math.min(Date.now(), ...p.meetings.map(m => m.createdAt));
}
const projectAgeDays = p => Math.floor((Date.now() - projectStart(p)) / DAY);

function reportBannerHTML(p) {
  const last = lastReport(p);
  const days = last ? Math.floor((Date.now() - last.createdAt) / DAY) : null;
  const age = projectAgeDays(p);
  // The first report waits until the project is a week old, so there is a real week to look back on
  const due = last ? days >= 7 : age >= 7;
  if (!last && !due) {
    const firstOn = new Date(projectStart(p) + 7 * DAY).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
    return `
    <div class="panel-2 p-4 mb-5 flex flex-col sm:flex-row sm:items-center gap-3">
      <div class="flex-1">
        <div class="text-sm text-white">🗓️ Weekly board report</div>
        <div class="text-[12px] text-[color:var(--muted)] mt-0.5">Your project is ${age === 0 ? 'brand new (day 1)' : `${age + 1} days old`}. Your first weekly report comes on <span class="gold">${firstOn}</span>, when there's a full week to look back on.</div>
        <label class="flex items-center gap-2 mt-2 text-[12px] text-[color:var(--muted)] cursor-pointer">
          <input type="checkbox" class="check" ${p.autoReport !== false ? 'checked' : ''} onchange="activeProject().autoReport = this.checked; save()">
          Run it by itself when a week has passed and I open the app (about C$0.12)
        </label>
      </div>
      <button class="btn-ghost rounded-xl px-4 py-2.5 text-sm shrink-0" onclick="startWeeklyReport()">Run an early check-in</button>
    </div>`;
  }
  return `
    <div class="panel-2 p-4 mb-5 flex flex-col sm:flex-row sm:items-center gap-3" style="${due ? 'border-color:rgba(216,176,106,.45)' : ''}">
      <div class="flex-1">
        <div class="text-sm text-white">🗓️ Weekly board report</div>
        <div class="text-[12px] text-[color:var(--muted)] mt-0.5">
          ${last ? `Last one ${days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}` : "Your team hasn't reported yet."}
          ${due ? ' · <span class="gold">Due now</span>' : ` · next one in ${7 - days} day${7 - days === 1 ? '' : 's'}`}
        </div>
        <label class="flex items-center gap-2 mt-2 text-[12px] text-[color:var(--muted)] cursor-pointer">
          <input type="checkbox" class="check" ${p.autoReport !== false ? 'checked' : ''} onchange="activeProject().autoReport = this.checked; save()">
          Run it by itself when a week has passed and I open the app (about C$0.12)
        </label>
      </div>
      <button class="${due ? 'btn-gold' : 'btn-ghost'} rounded-xl px-4 py-2.5 text-sm shrink-0" onclick="startWeeklyReport()">${due ? 'Run my weekly report' : 'Run it now'}</button>
    </div>`;
}

// ---------- tasks panel ----------
function taskRow(t, today) {
  const late = t.status === 'open' && t.due < today;
  const left = daysBetween(today, t.due);
  const dueText = t.status === 'done' ? `Done ${t.doneAt || ''}` : late ? `${-left} day${left === -1 ? '' : 's'} overdue`
    : left === 0 ? 'Due today' : left === 1 ? 'Due tomorrow' : `Due in ${left} days`;
  const chip = late ? 'background:#f8717122;color:#f87171' : t.status === 'done' ? 'background:#34d39922;color:#34d399' : 'background:rgba(255,255,255,.05);color:#c9ccd5';
  return `
    <div class="panel-2 p-3 flex items-center gap-3 ${t.status === 'done' ? 'opacity-60' : ''}">
      <input type="checkbox" class="check" ${t.status === 'done' ? 'checked' : ''} onchange="toggleTask('${t.id}')" aria-label="Mark done">
      ${t.owner ? avatar(t.owner, 28) : '<span class="h-7 w-7 rounded-full grid place-items-center text-[10px] bg-white/5 shrink-0">You</span>'}
      <div class="flex-1 min-w-0">
        <div class="text-[13.5px] text-white ${t.status === 'done' ? 'line-through' : ''}">${esc(t.title)}</div>
        <div class="text-[11px] text-[color:var(--muted)] truncate">${t.owner ? esc(`${advisorOf(t.owner).name} · ${teamRole(t.owner)}`) : 'You'} · ${SOURCE_LABEL[t.source] || ''}</div>
      </div>
      <span class="text-[11px] px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap" style="${chip}">${dueText}</span>
      <button class="text-[color:var(--muted)] hover:text-red-300 text-sm px-1" onclick="deleteTask('${t.id}')" aria-label="Delete task">×</button>
    </div>`;
}

function tasksPanelHTML(p) {
  const tasks = p.tasks || [];
  const today = isoDay();
  const open = tasks.filter(t => t.status === 'open').sort((a, b) => a.due.localeCompare(b.due));
  const done = tasks.filter(t => t.status === 'done').sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
  const list = taskFilter === 'open' ? open : done.slice(0, 30);
  return `
    <section class="panel p-5 md:p-6 mb-6 fade-in">
      <div class="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <div class="label">Your team's tasks</div>
          <div class="text-[12px] text-[color:var(--muted)] mt-1">Each advisor owns an area and follows up on their tasks in every meeting.</div>
        </div>
        <div class="seg">
          <button type="button" aria-pressed="${taskFilter === 'open'}" onclick="taskFilter='open'; refreshTeam()">Open (${open.length})</button>
          <button type="button" aria-pressed="${taskFilter === 'done'}" onclick="taskFilter='done'; refreshTeam()">Done (${done.length})</button>
        </div>
      </div>
      <div class="space-y-2 mb-4">
        ${list.length ? list.map(t => taskRow(t, today)).join('') : `<p class="text-sm text-[color:var(--muted)] text-center py-4">${taskFilter === 'open' ? 'No open tasks yet. Run a meeting or your weekly report, then add its action plan here.' : 'Nothing finished yet.'}</p>`}
      </div>
      <div class="flex flex-col sm:flex-row gap-2">
        <input id="newTask" class="field !py-2 flex-1" placeholder="Add a task, e.g. Call 10 restaurant owners" onkeydown="if(event.key==='Enter')addTaskFromForm()">
        <select id="newTaskOwner" class="field !py-2 sm:!w-56" aria-label="Owner">
          <option value="">Owner: me</option>
          ${advisors.map(a => `<option value="${a.id}">${esc(a.name)} · ${esc(a.team_role || a.role)}</option>`).join('')}
        </select>
        <select id="newTaskDue" class="field !py-2 sm:!w-36" aria-label="Due">
          <option value="1">Due tomorrow</option><option value="3">In 3 days</option><option value="7" selected>In a week</option><option value="30">In a month</option>
        </select>
        <button class="btn-ghost rounded-xl px-4 py-2 text-sm" onclick="addTaskFromForm()">Add</button>
      </div>
      <div class="mt-5">
        <div class="label mb-2">The team</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          ${advisors.map(a => {
            const n = open.filter(t => t.owner === a.id).length;
            const late = open.filter(t => t.owner === a.id && t.due < today).length;
            return `
            <div class="panel-2 p-2.5 flex items-center gap-2.5">
              ${avatar(a.id, 36)}
              <div class="min-w-0">
                <div class="text-[12.5px] text-white truncate">${esc(a.name)}</div>
                <div class="text-[11px] truncate" style="color:${colorOf(a.id)}">${esc(a.team_role || a.role)}</div>
                <div class="text-[10.5px] ${late ? 'text-red-300' : 'text-[color:var(--muted)]'}">${n} open${late ? ` · ${late} overdue` : ''}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </section>`;
}

function teamInner(p) { return goalStripHTML(p) + reportBannerHTML(p) + tasksPanelHTML(p); }
function teamHTML(p) { return `<div id="teamWrap">${teamInner(p)}</div>`; }
function refreshTeam() {
  const el = $('#teamWrap');
  if (el && activeProject()) el.innerHTML = teamInner(activeProject());
}

// ---------- weekly report ----------
// What the team reviews: this week's meetings, tasks, and Rowan's habit and journal log
function weekSummary(p) {
  const today = isoDay();
  const since = Date.now() - 7 * DAY;
  const tasks = p.tasks || [];
  const who = t => t.owner ? advisorOf(t.owner).name : 'founder';
  const meetings = p.meetings.filter(m => m.createdAt >= since && m.mode !== 'report');
  const done = tasks.filter(t => t.status === 'done' && t.doneAt && daysBetween(t.doneAt, today) <= 7);
  const overdue = tasks.filter(t => t.status === 'open' && t.due < today);
  const age = projectAgeDays(p) + 1;  // day 1 = the day the project was created
  const covered = Math.min(age, 7);
  const lines = [
    `Project age: day ${age} (started ${new Date(projectStart(p)).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}). This review covers the last ${covered} day${covered === 1 ? '' : 's'} only.`,
    ...(age < 7 ? [`NOTE: the project is brand new. Judge only these ${covered} day${covered === 1 ? '' : 's'}, not a full week.`] : []),
    `Meetings held in this period: ${meetings.length}`,
  ];
  meetings.slice(0, 8).forEach(m => lines.push(`- ${m.mode}: "${m.question}"${m.synthesis?.data?.headline ? ` -> ${m.synthesis.data.headline}` : ''}`));
  lines.push(`Tasks finished this week: ${done.length}`);
  done.forEach(t => lines.push(`- DONE: ${t.title} (${who(t)})`));
  lines.push(`Tasks overdue: ${overdue.length}`);
  overdue.forEach(t => lines.push(`- OVERDUE ${daysBetween(t.due, today)} days: ${t.title} (${who(t)})`));
  lines.push(`Other open tasks: ${tasks.filter(t => t.status === 'open' && t.due >= today).length}`);
  if (typeof mentor !== 'undefined' && mentor?.habits) {
    const days = [0, 1, 2, 3, 4, 5, 6].map(dayISO);
    const checks = days.reduce((n, d) => n + (mentor.habits.log[d] || []).length, 0);
    lines.push(checks ? `Personal habits (tracked with Rowan): ${checks} of ${mentor.habits.list.length * 7} habit check-ins done` : 'Personal habits: not tracked this week');
    lines.push(`Journal entries this week: ${mentor.journal.filter(j => daysBetween(j.date, today) <= 7).length}`);
  }
  return lines.join('\n');
}

async function startWeeklyReport() {
  const p = activeProject();
  if (!p || !advisors.length) return;
  if (live.m && live.m.phase && live.m.phase !== 'done') { toast('Wait until the current meeting finishes.'); return; }
  const seats = advisors.map(a => a.id);  // the whole team reports, not just the seated advisors
  const m = {
    id: uid(), question: `${projectAgeDays(p) < 7 ? `Early check-in · day ${projectAgeDays(p) + 1}` : 'Weekly board report'} · ${new Date().toLocaleDateString([], { day: 'numeric', month: 'long' })}`,
    createdAt: Date.now(), mode: 'report', seats, attachments: [], phase: 'reports', week: weekSummary(p),
    opinions: {}, debate: {}, votes: {}, pitches: {}, reports: {}, motion: null, threads: {}, synthesis: { status: 'waiting' }, done: {},
  };
  seats.forEach(id => { m.threads[id] = []; });
  p.meetings.unshift(m);
  current = m;
  view = 'board';
  live = { m, speaker: null, mode: null, reactions: {}, typed: 0 };
  save();
  renderView();
  $('#main').scrollTo({ top: 0, behavior: 'smooth' });

  await playRound(m, 'reports', m.reports, seats, id => ['/api/report/advisor', { advisor_id: id, project: profileOf(p), week: m.week, memory: memoryOf(p, m) }]);
  // Reports double as each advisor's "opinion", so follow-up questions work as usual
  seats.forEach(id => { const r = m.reports[id]; if (r?.status === 'done') m.opinions[id] = { status: 'done', shown: true, content: r.update }; });
  await summarizeReport(p, m);
  finishReport(m);
}

async function summarizeReport(p, m) {
  const updates = Object.fromEntries(m.seats.filter(id => m.reports[id]?.status === 'done').map(id => [id, { update: m.reports[id].update, grade: m.reports[id].grade }]));
  if (!Object.keys(updates).length) { m.synthesis = { status: 'error', error: 'Nobody on the team could report. Try again.' }; return; }
  m.phase = 'summary';
  m.synthesis = { status: 'pending' };
  setLive(m, { speaker: 'chair' });
  try {
    const data = await api('/api/report/summary', { project: profileOf(p), week: m.week, updates, memory: memoryOf(p, m) });
    m.synthesis = { status: 'done', data };
    // The report's tasks and each advisor's new task go straight onto the team's list
    let added = 0;
    (data.tasks || []).forEach(t => { if (addTask(p, { ...t, source: 'report' })) added++; });
    m.seats.forEach(id => {
      const nt = m.reports[id]?.new_task;
      if (nt?.title && addTask(p, { title: nt.title, owner: id, due_days: nt.due_days, source: 'report' })) added++;
    });
    m.tasksAdded = added;
  } catch (e) {
    m.synthesis = { status: 'error', error: e.message };
  }
}

function finishReport(m) {
  m.phase = 'done';
  save();
  setLive(m, { speaker: null });
  renderSidebar();
  if (current === m && m.synthesis.status === 'done') document.getElementById('synthesis')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function rerunReportSummary() {
  const p = activeProject(), m = current;
  live = { m, speaker: null, mode: null, reactions: {}, typed: 0 };
  await summarizeReport(p, m);
  finishReport(m);
}

const GRADE_COLOR = { A: '#34d399', B: '#a3e635', C: '#fbbf24', D: '#fb923c', F: '#f87171' };
function gradeBadge(g) {
  const c = GRADE_COLOR[g] || '#a1a1aa';
  return `<span class="vote-tag" style="background:${c}22;color:${c}">GRADE ${esc(g || '?')}</span>`;
}

function reportExtraHTML(r) {
  return `
    <div class="flex flex-wrap items-center gap-2 mt-3">
      ${gradeBadge(r.grade)}
      ${r.new_task?.title ? `<span class="text-[12px] text-[#c9ccd5]"><span class="gold">New task:</span> ${esc(r.new_task.title)} <span class="text-[color:var(--muted)]">(due in ${r.new_task.due_days} days)</span></span>` : ''}
    </div>`;
}

function reportHTML(m) {
  const s = m.synthesis || { status: 'waiting' };
  const shell = inner => `<div class="panel p-5 md:p-7 relative overflow-hidden" style="border-color:rgba(216,176,106,.3)">
    <div class="absolute inset-x-0 top-0 h-px" style="background:linear-gradient(90deg,transparent,var(--gold),transparent)"></div>
    <div class="flex items-center gap-2 mb-4"><span>🗓️</span><span class="label gold">Weekly board report</span></div>
    ${inner}</div>`;
  if (s.status === 'waiting' || s.status === 'pending') {
    return shell(`<div class="space-y-3"><div class="text-sm gold">${s.status === 'pending' ? 'The host is writing your weekly report…' : 'Each head of department is reporting on their area.'}</div><div class="h-4 shimmer w-11/12"></div><div class="h-4 shimmer w-8/12"></div></div>`);
  }
  if (s.status === 'error') {
    return shell(`<p class="text-sm text-red-300 mb-4">${esc(s.error)}</p><button onclick="rerunReportSummary()" class="btn-ghost rounded-lg px-3 py-1.5 text-sm">Try again</button>`);
  }
  const d = s.data;
  const list = (title, items, dot) => items?.length ? `
    <div class="panel-2 p-4">
      <div class="label mb-2">${title}</div>
      <ul class="space-y-2">${items.map(x => `<li class="flex gap-2.5 text-[13.5px] text-[#d4d7de] leading-relaxed"><span class="mt-[9px] h-1.5 w-1.5 rounded-full shrink-0" style="background:${dot}"></span><span>${esc(x)}</span></li>`).join('')}</ul>
    </div>` : '';
  return shell(`
    <div class="flex flex-col sm:flex-row sm:items-center gap-5">
      ${typeof d.score === 'number' ? ring(d.score) : ''}
      <div>
        <div class="label mb-1.5">Progress toward your goal this week</div>
        <p class="font-serif text-2xl md:text-[28px] leading-snug">${esc(d.headline)}</p>
      </div>
    </div>
    <div class="flex flex-wrap gap-2 mt-5">
      ${m.seats.filter(id => m.reports?.[id]?.status === 'done').map(id => `
        <div class="panel-2 pl-1.5 pr-3 py-1.5 flex items-center gap-2 !rounded-full">${avatar(id, 26)}<span class="text-[12px] text-[#c9ccd5]">${esc(teamRole(id))}</span>${gradeBadge(m.reports[id].grade)}</div>`).join('')}
    </div>
    ${d.focus ? `<div class="panel-2 p-4 mt-5" style="border-color:rgba(216,176,106,.45)"><div class="label gold mb-1.5">🎯 Your one focus for next week</div><p class="text-[15px] text-white leading-relaxed">${esc(d.focus)}</p></div>` : ''}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
      ${list('Wins', d.wins, '#34d399')}
      ${list('What slipped', d.misses, '#f87171')}
      ${list('Opportunities for next week', d.opportunities, '#38bdf8')}
      ${list('Warnings', d.warnings, '#fbbf24')}
    </div>
    <div class="panel-2 p-4 mt-4 flex items-center justify-between gap-3 flex-wrap">
      <span class="text-sm text-[#d4d7de]">✅ ${m.tasksAdded || 0} new task${m.tasksAdded === 1 ? '' : 's'} added to your team's list, each with an owner.</span>
      <button class="btn-ghost rounded-lg px-3 py-1.5 text-sm" onclick="showProjectTab('tasks')">See my tasks</button>
    </div>`);
}

function copyReport(m) {
  const d = m.synthesis?.data;
  let out = `# ${m.question}\n\n`;
  if (d) {
    out += `## ${d.headline}${typeof d.score === 'number' ? ` (${d.score}/100)` : ''}\n\n`;
    if (d.focus) out += `**Focus next week:** ${d.focus}\n\n`;
    for (const [title, items] of [['Wins', d.wins], ['What slipped', d.misses], ['Opportunities', d.opportunities], ['Warnings', d.warnings]]) {
      if (items?.length) out += `## ${title}\n${items.map(x => `- ${x}`).join('\n')}\n\n`;
    }
  }
  m.seats.forEach(id => { const r = m.reports?.[id]; if (r?.status === 'done') out += `### ${advisorOf(id).name}, ${teamRole(id)} (grade ${r.grade})\n${r.update}\n\n`; });
  navigator.clipboard.writeText(out).then(() => toast('Report copied'), () => toast('Could not copy'));
}

// Run the weekly report by itself when a week has passed (once advisors and Rowan's data have loaded)
function maybeAutoReport() {
  const p = activeProject();
  if (!p || p.autoReport === false || current || view === 'mentor') return;
  if (!p.meetings.length && !(p.tasks || []).length) return;  // nothing to report on yet
  const last = p.meetings.find(m => m.mode === 'report');
  if (last && Date.now() - last.createdAt < 7 * DAY) return;
  if (!last && projectAgeDays(p) < 7) return;  // the first report waits for a full week
  toast('🗓️ A week has passed. Your team is giving their weekly report.');
  startWeeklyReport();
}

(function waitThenStart() {
  const started = Date.now();
  const timer = setInterval(() => {
    const ready = advisors.length && typeof mentor !== 'undefined' && mentor;
    if (!ready && Date.now() - started < 6000) return;
    clearInterval(timer);
    if (view !== 'mentor' && !current && activeProject() && $('#teamWrap')) refreshTeam();  // goal countdown needs Rowan's birthday
    if (advisors.length) setTimeout(maybeAutoReport, 1200);
  }, 300);
})();
