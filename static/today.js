// ---------- Today: the simple home page ----------
// One screen for the daily routine: goal countdown, today's tasks and habits, Rowan's morning/evening
// buttons and shortcuts into the board. Loaded last; uses helpers from index.html, mentor.js, ideas.js and team.js.

// A short lesson from a great book for each day, in plain words
const DAILY_LESSONS = [
  ['The Psychology of Money', 'Wealth is what you do not see. Saving is the gap between your ego and your income.'],
  ['Atomic Habits', 'Get 1% better every day. Your systems matter more than your goals.'],
  ['Deep Work', 'Protect one block of focused time today. Focused work is rare and valuable.'],
  ['Essentialism', 'Less but better. If it is not a clear yes, it is a no.'],
  ['Meditations', 'Control what you can and accept what you cannot. The obstacle can become the way.'],
  ['The Richest Man in Babylon', 'Pay yourself first. Keep part of everything you earn.'],
  ['Thinking, Fast and Slow', 'Slow down for big choices. Your first feeling is not always right.'],
];

const firstWord = s => String(s || '').trim().split(/\s+/)[0];
const titleCase = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';

function showToday() {
  view = 'today';
  current = null;
  history.replaceState(null, '', location.pathname);
  toggleSidebar(false);
  renderView();
  $('#main').scrollTo({ top: 0 });
}

function todayHeader() {
  $('#headerTitle').innerHTML = `<div class="font-medium">Today</div><span class="hidden sm:inline text-[11px] text-[color:var(--muted)]">${new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</span>`;
  $('#headerActions').innerHTML = activeProject()
    ? `<button onclick="showProjectTab('ask')" class="btn-gold rounded-xl px-3 py-2 text-sm">Ask the board</button>`
    : '';
}

function renderToday() {
  const p = activeProject();
  const mp = typeof mentor !== 'undefined' && mentor ? mentor.profile : {};
  const name = titleCase(firstWord(mp.your_name));
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / DAY);
  const [book, lesson] = DAILY_LESSONS[dayOfYear % DAILY_LESSONS.length];

  $('#view').innerHTML = `
    <section class="mb-5 fade-in">
      <h1 class="font-serif text-4xl md:text-5xl leading-tight">${hello}${name ? `, ${esc(name)}` : ''} 👋</h1>
      <p class="text-[color:var(--muted)] mt-2">Here's your day. Small steps, every day.</p>
    </section>

    ${p ? goalStripHTML(p) : ''}

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
      ${todayTasksHTML(p)}
      ${todayMentorHTML()}
    </div>

    <div class="panel-2 p-4 mb-5 flex gap-3 items-start fade-in">
      <span class="text-xl">📘</span>
      <div><div class="label gold mb-1">Today's lesson · ${esc(book)}</div><p class="text-[14px] text-[#e2e4ea] leading-relaxed">${esc(lesson)}</p></div>
    </div>

    ${p ? todayBoardHTML(p) : `
    <div class="panel p-5 text-center fade-in">
      <p class="text-sm text-[#c9ccd5] mb-3">Add your business so your board of 6 advisors can help you build it.</p>
      <button class="btn-gold rounded-xl px-5 py-2.5 text-sm" onclick="openProfile()">Add my business →</button>
    </div>`}`;
}

function todayTasksHTML(p) {
  if (!p) return `<section class="panel p-5 fade-in"><div class="label mb-2">✅ Today's tasks</div><p class="text-sm text-[color:var(--muted)]">Add your business first, then your team's tasks show here.</p></section>`;
  const today = isoDay();
  const open = (p.tasks || []).filter(t => t.status === 'open').sort((a, b) => a.due.localeCompare(b.due));
  // The whole team's next tasks: urgent ones (overdue, today, next 2 days) first, then what's coming later
  const list = open.slice(0, 8);
  const urgent = list.filter(t => daysBetween(today, t.due) <= 2);
  const later = list.filter(t => daysBetween(today, t.due) > 2);
  const owners = new Set(open.map(t => t.owner || 'you')).size;
  return `
    <section class="panel p-5 fade-in">
      <div class="flex items-center justify-between mb-3">
        <div class="label">✅ Your team's next tasks</div>
        <button class="text-xs gold hover:underline" onclick="showProjectTab('tasks')">All ${open.length} tasks →</button>
      </div>
      ${open.length ? `<p class="text-[11.5px] text-[color:var(--muted)] -mt-1 mb-3">${open.length} open task${open.length === 1 ? '' : 's'} from ${owners} team member${owners === 1 ? '' : 's'}${open.length > list.length ? `, showing the next ${list.length}` : ''}.</p>` : ''}
      <div class="space-y-2">
        ${urgent.length ? `<div class="text-[11px] gold font-semibold tracking-wide">DUE NOW AND SOON</div>${urgent.map(t => todayTaskRow(t, today)).join('')}` : ''}
        ${later.length ? `<div class="text-[11px] text-[color:var(--muted)] font-semibold tracking-wide ${urgent.length ? 'pt-2' : ''}">LATER</div>${later.map(t => todayTaskRow(t, today)).join('')}` : ''}
        ${list.length ? '' : `<p class="text-sm text-[color:var(--muted)] py-3">No open tasks. Ask the board something, then add its plan to your tasks.</p>`}
      </div>
    </section>`;
}

function todayTaskRow(t, today) {
  const late = t.due < today;
  const left = daysBetween(today, t.due);
  const when = late ? `${-left}d overdue` : left === 0 ? 'Today' : left === 1 ? 'Tomorrow' : `In ${left} days`;
  return `
    <label class="panel-2 p-3 flex items-center gap-3 cursor-pointer hover:border-white/15">
      <input type="checkbox" class="check" onchange="toggleTask('${t.id}'); renderView()">
      ${t.owner ? avatar(t.owner, 24) : '<span class="h-6 w-6 rounded-full grid place-items-center text-[9px] bg-white/5 shrink-0">You</span>'}
      <span class="flex-1 min-w-0">
        <span class="block text-[13.5px] text-white">${esc(t.title)}</span>
        <span class="block text-[11px] text-[color:var(--muted)] truncate">${t.owner ? esc(`${advisorOf(t.owner).name} · ${teamRole(t.owner)}`) : 'You'}</span>
      </span>
      <span class="text-[11px] px-2 py-0.5 rounded-full shrink-0" style="${late ? 'background:#f8717122;color:#f87171' : 'background:rgba(255,255,255,.05);color:#c9ccd5'}">${when}</span>
    </label>`;
}

function todayMentorHTML() {
  const ready = typeof mentor !== 'undefined' && mentor;
  const habits = ready ? mentor.habits.list : [];
  const done = ready ? (mentor.habits.log[todayISO()] || []) : [];
  const btn = (mode, icon, label, primary) => `<button class="${primary ? 'btn-gold' : 'btn-ghost'} rounded-xl px-3 py-2.5 text-sm" onclick="todayMentor('${mode}')">${icon} ${label}</button>`;
  return `
    <section class="panel p-5 fade-in">
      <div class="flex items-center gap-3 mb-4">
        ${avatar('mentor', 44)}
        <div class="flex-1 min-w-0">
          <div class="text-[15px] text-white font-medium">${esc(typeof mentorName === 'function' ? mentorName() : 'Rowan')}</div>
          <div class="text-[12px] text-[color:var(--muted)]">Your life mentor</div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2 mb-4">
        ${btn('morning', '☀️', 'Morning plan', new Date().getHours() < 14)}
        ${btn('evening', '🌙', 'Evening review', new Date().getHours() >= 14)}
        ${btn('journal', '📓', 'Write journal')}
        ${btn('talk', '💬', 'Talk')}
      </div>
      <div class="flex items-center justify-between mb-2">
        <div class="label">Today's habits · ${done.length}/${habits.length}</div>
        <button class="text-xs gold hover:underline" onclick="todayMentor('habits')">Edit →</button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        ${habits.map(h => `
          <label class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[.03] cursor-pointer">
            <input type="checkbox" class="check" ${done.includes(h) ? 'checked' : ''} onchange='todayHabit(${JSON.stringify(h).replace(/'/g, "&#39;")}, this.checked)'>
            <span class="text-[13px] ${done.includes(h) ? 'text-white' : 'text-[#c9ccd5]'}">${esc(h)}</span>
          </label>`).join('') || `<p class="text-sm text-[color:var(--muted)]">Loading…</p>`}
      </div>
    </section>`;
}

function todayBoardHTML(p) {
  const last = lastReport(p);
  const age = projectAgeDays(p);
  const reportText = last
    ? `Last report ${Math.floor((Date.now() - last.createdAt) / DAY)} days ago · score ${last.synthesis.data.score ?? '–'}/100`
    : age < 7 ? `First weekly report in ${7 - age} day${7 - age === 1 ? '' : 's'}` : 'Your first weekly report is ready to run';
  const ask = (mode, icon, label, hint) => `
    <button class="panel-2 p-3.5 text-left hover:border-white/20" onclick="todayAsk('${mode}')">
      <div class="text-sm text-white">${icon} ${label}</div>
      <div class="text-[11.5px] text-[color:var(--muted)] mt-0.5">${hint}</div>
    </button>`;
  return `
    <section class="panel p-5 fade-in">
      <div class="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <div class="label">🏛️ Your business board · ${esc(p.name)}</div>
          <div class="text-[12px] text-[color:var(--muted)] mt-1">🗓️ ${reportText}</div>
        </div>
        <div class="flex -space-x-2">${advisors.map(a => `<div class="rounded-full" style="box-shadow:0 0 0 2px var(--panel)">${avatar(a.id, 30)}</div>`).join('')}</div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        ${ask('debate', '⚖️', 'Big decision', 'Full debate and vote')}
        ${ask('quick', '⚡', 'Quick question', 'Answer in about 30 seconds')}
        ${ask('ideas', '💡', 'New business ideas', 'Each advisor pitches 2')}
        ${ask('growth', '📈', 'Grow my business', 'Growth tests to run')}
      </div>
    </section>`;
}

// Shortcuts into Rowan's page
async function todayMentor(action) {
  if (typeof showMentor !== 'function') return;
  mentorTab = { journal: 'journal', habits: 'habits' }[action] || 'talk';
  showMentor();
  if (action === 'morning' || action === 'evening') {
    if (!mentor) await loadMentor();
    mentorTab = 'talk';
    renderView();
    mentorSend(action);
  }
}

async function todayHabit(habit, on) {
  const done = new Set(mentor.habits.log[todayISO()] || []);
  on ? done.add(habit) : done.delete(habit);
  try { mentor.habits = await api('/api/mentor/habits', { date: todayISO(), done: [...done] }); } catch (e) { toast(e.message); }
  if (view === 'today') renderView();
}

function todayAsk(mode) {
  const p = activeProject();
  p.mode = mode;
  save();
  showProjectTab('ask');
  setTimeout(() => $('#question')?.focus(), 60);
}

// Re-draw once Rowan's data (name, habits, birthday) has loaded
(function waitForMentor() {
  const started = Date.now();
  const timer = setInterval(() => {
    if ((typeof mentor !== 'undefined' && mentor && advisors.length) || Date.now() - started > 6000) {
      clearInterval(timer);
      if (view === 'today') renderView();
    }
  }, 250);
})();
