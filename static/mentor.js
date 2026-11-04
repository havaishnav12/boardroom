// ---------- Personal life mentor ----------
// Loaded after the main script in index.html; uses its helpers (api, esc, md, toast, bust, avatar, $).

let mentor = null;          // everything the mentor knows, from /api/mentor
let mentorTab = 'talk';
let mentorBusy = false;     // waiting for a reply
let mentorTyping = null;    // { index, shown } while a reply types out
let mentorTypeTimer = null;
let mentorDraft = '';       // text waiting in the message box (e.g. sent over from the idea lab)
let mentorWeb = false;      // search the web before replying (costs a little extra)

COLORS.mentor = '#d8b06a';
LOOKS.mentor = { skin: '#d9a47e', eye: '#3b2f28', hair: '#4a4a50', style: 'short', brow: '#4a4a50', stubble: true, shirt: '#57481c', outfit: 'turtleneck' };

const MENTOR_MODES = [
  ['morning', '☀️', 'Morning plan', 'Good morning. Help me plan my day.'],
  ['evening', '🌙', 'Evening review', "Let's review my day."],
  ['weekly', '📅', 'Weekly check-in', "Let's do my weekly check-in."],
  ['decision', '⚖️', 'Help me decide', 'I need help with a decision.'],
  ['money', '💰', 'Money check', 'Can you check my money situation and coach me?'],
  ['lesson', '📚', 'Teach me a lesson', 'Teach me one lesson I need right now.'],
  ['strategy', '♟️', 'Strategy & people', 'I need help with a situation with people, power or negotiation.'],
  ['low', '💙', 'I feel low', "I'm not feeling good today."],
  ['board', '🏛️', 'Ask my board', 'I want to ask my business board something. Help me frame the question.'],
];
const MENTOR_TABS = [['talk', 'Talk'], ['journal', 'Journal'], ['habits', 'Habits'], ['roadmap', 'Roadmap'], ['memory', 'Memory'], ['about', 'About you']];

const mentorName = () => mentor?.profile?.mentor_name || 'Rowan';
function mentorMeta() {
  return { id: 'mentor', name: mentorName(), role: 'Life mentor', initials: mentorName()[0] || 'D', portrait: mentor?.portrait || null };
}
const todayISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const dayISO = offset => { const d = new Date(Date.now() - offset * 86400000); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

async function loadMentor() {
  mentor = await api('/api/mentor');
}

function showMentor() {
  view = 'mentor';
  history.replaceState(null, '', '#mentor');
  current = null;
  toggleSidebar(false);
  renderView();
  $('#main').scrollTo({ top: 0 });
  loadMentor().then(() => { if (view === 'mentor') renderView(); }).catch(e => toast(e.message));
}

function showBoard() {
  view = 'board';
  history.replaceState(null, '', location.pathname);
  toggleSidebar(false);
  renderView();
}

function mentorHeader() {
  $('#headerTitle').innerHTML = `
    <div class="min-w-0"><div class="font-medium truncate">${esc(mentorName())}</div></div>
    <span class="hidden sm:inline text-[11px] px-2 py-0.5 rounded-full" style="background:var(--gold-soft);color:var(--gold)">Your life mentor</span>`;
  $('#headerActions').innerHTML = `<button onclick="showBoard()" class="btn-ghost rounded-xl px-3 py-2 text-sm">🏛️ Business board</button>`;
}

// ---------- page ----------
function renderMentor() {
  if (!mentor) {
    $('#view').innerHTML = `<div class="min-h-[50vh] grid place-items-center text-[color:var(--muted)]"><span class="dots" style="color:var(--gold)"><i></i><i></i><i></i></span></div>`;
    return;
  }
  const streak = bestStreak();
  $('#view').innerHTML = `
    <section class="fade-in">
      <div class="panel mentor-hero p-5 md:p-6 mb-5 flex flex-col sm:flex-row items-center gap-5">
        <div id="mentorFace" class="mentor-face ${mentorTyping ? 'talking' : ''}">${bust('mentor', { size: 150 })}</div>
        <div class="flex-1 text-center sm:text-left">
          <div class="label gold mb-1">Your life mentor</div>
          <h1 class="font-serif text-4xl md:text-5xl leading-tight">${esc(mentorName())}</h1>
          <p class="text-sm text-[color:var(--muted)] mt-2 max-w-xl">Your friend and guide, drawing on great books about money, strategy and life. Your mentor remembers your story and helps you through every up and down.</p>
          <div class="flex flex-wrap gap-2 mt-4 justify-center sm:justify-start">
            <span class="stat-pill">🧠 ${mentor.memories.length} memories</span>
            <span class="stat-pill">📓 ${mentor.journal.length} journal entries</span>
            <span class="stat-pill">🔥 ${streak} day best streak</span>
            ${mentor.profile.goal ? `<span class="stat-pill" style="color:var(--gold)">🎯 ${esc(mentor.profile.goal)}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="mentor-tabs mb-4" role="tablist">
        ${MENTOR_TABS.map(([k, label]) => `<button role="tab" aria-selected="${mentorTab === k}" onclick="mentorTab='${k}';renderMentorTab()">${label}</button>`).join('')}
      </div>
      <div id="mentorTab"></div>
    </section>`;
  renderMentorTab();
}

function renderMentorTab() {
  document.querySelectorAll('.mentor-tabs button').forEach(b => b.setAttribute('aria-selected', b.textContent === (MENTOR_TABS.find(t => t[0] === mentorTab) || [])[1]));
  const el = $('#mentorTab');
  if (!el) return;
  el.innerHTML = { talk: talkHTML, journal: journalHTML, habits: habitsHTML, roadmap: roadmapHTML, memory: memoryHTML, about: aboutHTML }[mentorTab]();
  if (mentorTab === 'talk') scrollChat();
}

function setFace(state) {
  const f = $('#mentorFace');
  if (!f) return;
  f.classList.toggle('talking', state === 'talking');
  f.classList.toggle('thinking', state === 'thinking');
}

// ---------- talk ----------
function talkHTML() {
  const chat = mentor.chat;
  return `
    <div class="flex flex-wrap gap-2 mb-4">
      ${MENTOR_MODES.map(([k, icon, label]) => `<button type="button" class="chip" onclick="mentorSend('${k}')" ${mentorBusy ? 'disabled' : ''}>${icon} ${label}</button>`).join('')}
    </div>
    <div id="mentorChat" class="panel p-4 md:p-5 space-y-4 max-h-[62vh] overflow-y-auto scroll-thin">
      ${chat.length ? chat.map((c, i) => chatBubble(c, i)).join('') : welcomeBubble()}
      ${mentorBusy ? `<div class="msg">${avatar('mentor', 38)}<div class="bubble" style="--c:var(--gold)"><span class="dots" style="color:var(--gold)"><i></i><i></i><i></i></span> <span class="text-[13px] text-[color:var(--muted)] ml-1">${esc(mentorName())} is ${mentorWeb ? 'searching the web' : 'thinking'}</span></div></div>` : ''}
    </div>
    <div class="panel p-3 mt-3 flex gap-2 items-end">
      <button type="button" class="rounded-xl px-3 py-3 text-sm shrink-0 border ${mentorWeb ? 'border-[color:var(--gold)] bg-[color:var(--gold-soft)]' : 'border-white/10 opacity-70 hover:opacity-100'}"
        aria-pressed="${mentorWeb}" title="Search the web before answering (about C$0.03 per message)" onclick="mentorWeb = !mentorWeb; renderMentorTab()">🌐</button>
      <textarea id="mentorInput" rows="2" class="field resize-none text-[14.5px]" placeholder="Talk to ${esc(mentorName())} about anything: money, work, family, fears, plans… (or tap a button above first)"
        oninput="mentorDraft=this.value"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();mentorSend('chat')}">${esc(mentorDraft)}</textarea>
      <button class="btn-gold rounded-xl px-5 py-3 text-sm shrink-0" onclick="mentorSend('chat')" ${mentorBusy ? 'disabled' : ''}>Send</button>
    </div>
    <div class="flex justify-between gap-3 mt-2 text-[11px] text-[color:var(--muted)]">
      <span>${mentorWeb ? '<span class="gold">🌐 Web search is on: your mentor checks the internet first (about C$0.03 per message)</span>' : 'Enter to send · Shift + Enter for a new line · Tap 🌐 to allow web search'}</span>
      ${chat.length ? `<button class="hover:text-white shrink-0" onclick="mentorClearChat()">Clear chat</button>` : ''}
    </div>`;
}

function welcomeBubble() {
  const p = mentor.profile;
  return `
    <div class="msg">${avatar('mentor', 38)}<div class="bubble" style="--c:var(--gold)">
      <div class="prose-board">
        <p>Hello${p.your_name ? `, ${esc(p.your_name)}` : ', my friend'}! I am ${esc(mentorName())}, your mentor.</p>
        <p>You are ${esc(p.age || 'young')} and you dream of <strong>${esc(p.goal || 'something big')}</strong>. Big goals always come with doubt. Do your work with your whole heart, and don't be shaken by winning or losing.</p>
        <p>Talk to me about anything: money, work, people, fears, plans. Tap <strong>☀️ Morning plan</strong> to start your day with me, or tell me a little about yourself first.</p>
      </div>
    </div></div>`;
}

function chatBubble(c, i) {
  if (c.role === 'user') {
    const mode = MENTOR_MODES.find(m => m[0] === c.mode);
    return `<div class="flex justify-end"><div class="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-[14px] whitespace-pre-wrap" style="background:var(--gold-soft);color:#f1e3c6">${mode && c.mode !== 'chat' ? `<span class="opacity-70 text-[12px]">${mode[1]} ${mode[2]} · </span>` : ''}${esc(c.content)}</div></div>`;
  }
  const typing = mentorTyping && mentorTyping.index === i;
  const prevUser = mentor.chat[i - 1]?.role === 'user' ? mentor.chat[i - 1].content : '';
  const boardQ = (c.content.match(/Question for the board:\s*(.+)/i) || [])[1];
  return `
    <div class="msg">${avatar('mentor', 38)}<div class="bubble" style="--c:var(--gold)">
      ${typing ? `<div class="prose-board whitespace-pre-wrap"><span id="mentorTypeText">${esc(c.content.slice(0, mentorTyping.shown))}</span><span class="cursor"></span></div>`
               : `<div class="prose-board">${md(c.content)}</div>${sourcesHTML(c.sources)}`}
      ${!typing && (boardQ || prevUser) ? `<button class="text-[11.5px] gold hover:underline mt-3" onclick='mentorToBoard(${JSON.stringify(boardQ || prevUser).replace(/'/g, "&#39;")})'>🏛️ Ask my business board about this</button>` : ''}
    </div></div>`;
}

function scrollChat() {
  const c = $('#mentorChat');
  if (c) c.scrollTop = c.scrollHeight;
}

async function mentorSend(mode) {
  if (mentorBusy || mentorTyping) return;
  const input = $('#mentorInput');
  const typed = input?.value.trim() || '';
  if (mode === 'chat' && !typed) { input?.focus(); return; }
  const text = typed || MENTOR_MODES.find(m => m[0] === mode)[3];
  mentorDraft = '';
  mentor.chat.push({ role: 'user', content: text, mode });
  mentorBusy = true;
  renderMentorTab();
  setFace('thinking');
  try {
    const r = await api('/api/mentor/chat', { message: text, mode, web: mentorWeb });
    mentor.chat.push({ role: 'assistant', content: r.reply, mode, sources: r.sources || [] });
    mentorBusy = false;
    typeMentorReply(mentor.chat.length - 1);
  } catch (e) {
    mentorBusy = false;
    mentor.chat.pop();
    renderMentorTab();
    setFace(null);
    if (input) { const i2 = $('#mentorInput'); if (i2) i2.value = typed; }
    toast(e.message);
  }
  // New memories are saved in the background a few seconds after each reply
  setTimeout(() => api('/api/mentor').then(s => { mentor.memories = s.memories; }).catch(() => {}), 9000);
}

// The mentor "speaks": the reply types out while the mouth moves
function typeMentorReply(index) {
  const text = mentor.chat[index].content;
  mentorTyping = { index, shown: 0 };
  renderMentorTab();
  setFace('talking');
  clearInterval(mentorTypeTimer);
  mentorTypeTimer = setInterval(() => {
    mentorTyping.shown = document.hidden ? text.length : Math.min(text.length, mentorTyping.shown + 4);
    const el = $('#mentorTypeText');
    if (el) { el.textContent = text.slice(0, mentorTyping.shown); scrollChat(); }
    if (mentorTyping.shown >= text.length) {
      clearInterval(mentorTypeTimer);
      mentorTyping = null;
      setFace(null);
      if (view === 'mentor' && mentorTab === 'talk') renderMentorTab();
    }
  }, 16);
}

async function mentorClearChat() {
  if (!confirm(`Clear your chat with ${mentorName()}? Your memories, journal and everything else are kept.`)) return;
  await api('/api/mentor/chat/clear', {});
  mentor.chat = [];
  renderMentorTab();
}

function mentorToBoard(question) {
  showBoard();
  if (!activeProject()) { toast('Create a business project first, then ask your board.'); return; }
  newMeeting();
  setTimeout(() => { const q = $('#question'); if (q) { q.value = question; q.focus(); } }, 80);
}

// ---------- journal ----------
function journalHTML() {
  return `
    <div class="panel p-4 md:p-5 mb-5">
      <label for="journalInput" class="label block mb-2">Today's journal · ${new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</label>
      <textarea id="journalInput" rows="6" class="field resize-y text-[14.5px] leading-relaxed" placeholder="What happened today? What did you feel, learn, win or lose? Write freely. Only you and ${esc(mentorName())} read this."></textarea>
      <div class="flex justify-end mt-3"><button id="journalBtn" class="btn-gold rounded-xl px-5 py-2.5 text-sm" onclick="saveJournal()">Save and get ${esc(mentorName())}'s reply</button></div>
    </div>
    <div class="space-y-4">
      ${mentor.journal.length ? [...mentor.journal].reverse().map(j => `
        <article class="panel p-4 md:p-5">
          <div class="flex items-center justify-between mb-2">
            <div class="label">${new Date(j.date + 'T12:00').toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
            <button class="text-[color:var(--muted)] hover:text-red-300 text-sm" onclick="deleteJournal('${j.id}')" aria-label="Delete entry">×</button>
          </div>
          <p class="text-[14px] text-[#d4d7de] whitespace-pre-wrap leading-relaxed">${esc(j.text)}</p>
          ${j.reply ? `<div class="msg mt-4">${avatar('mentor', 34)}<div class="bubble" style="--c:var(--gold)"><div class="prose-board">${md(j.reply)}</div></div></div>` : ''}
        </article>`).join('') : `<p class="text-sm text-[color:var(--muted)] text-center py-6">No entries yet. Writing a few lines each night is one of the most powerful habits there is.</p>`}
    </div>`;
}

async function saveJournal() {
  const text = $('#journalInput').value.trim();
  if (!text) { toast('Write a few lines first.'); return; }
  const btn = $('#journalBtn');
  btn.disabled = true;
  btn.textContent = `${mentorName()} is reading…`;
  try {
    const entry = await api('/api/mentor/journal', { text });
    mentor.journal.push(entry);
    renderMentorTab();
  } catch (e) {
    toast(e.message);
    btn.disabled = false;
    btn.textContent = `Save and get ${mentorName()}'s reply`;
  }
}

async function deleteJournal(id) {
  if (!confirm('Delete this journal entry?')) return;
  await api('/api/mentor/journal/delete', { id });
  mentor.journal = mentor.journal.filter(j => j.id !== id);
  renderMentorTab();
}

// ---------- habits ----------
function habitStreak(habit) {
  const log = mentor.habits.log;
  let n = 0;
  for (let i = (log[todayISO()] || []).includes(habit) ? 0 : 1; i < 400; i++) {
    if ((log[dayISO(i)] || []).includes(habit)) n++; else break;
  }
  return n;
}
function bestStreak() { return Math.max(0, ...mentor.habits.list.map(habitStreak)); }

function habitsHTML() {
  const h = mentor.habits, today = h.log[todayISO()] || [];
  const days = [6, 5, 4, 3, 2, 1, 0].map(dayISO);
  return `
    <div class="panel p-4 md:p-5 mb-5">
      <div class="flex items-center justify-between mb-4"><div class="label">Today · ${today.length} of ${h.list.length} done</div><div class="text-xs text-[color:var(--muted)]">Small habits, done daily, build a big life.</div></div>
      <div class="space-y-2">
        ${h.list.map(x => `
          <label class="panel-2 p-3.5 flex items-center gap-3 cursor-pointer hover:border-white/15">
            <input type="checkbox" class="check" ${today.includes(x) ? 'checked' : ''} onchange="toggleHabit(${JSON.stringify(x).replace(/"/g, '&quot;')}, this.checked)">
            <span class="flex-1 text-sm ${today.includes(x) ? 'text-white' : 'text-[#c9ccd5]'}">${esc(x)}</span>
            <span class="text-xs ${habitStreak(x) ? 'gold' : 'text-[color:var(--muted)]'}">🔥 ${habitStreak(x)}</span>
          </label>`).join('')}
      </div>
    </div>
    <div class="panel p-4 md:p-5 mb-5 overflow-x-auto">
      <div class="label mb-3">Last 7 days</div>
      <table class="w-full text-xs">
        <thead><tr><th></th>${days.map(d => `<th class="font-normal text-[color:var(--muted)] pb-2">${new Date(d + 'T12:00').toLocaleDateString([], { weekday: 'short' })}</th>`).join('')}</tr></thead>
        <tbody>${h.list.map(x => `<tr><td class="pr-3 py-1.5 text-[#c9ccd5] whitespace-nowrap">${esc(x)}</td>${days.map(d => `<td class="text-center"><span class="inline-block h-3.5 w-3.5 rounded-full" style="background:${(h.log[d] || []).includes(x) ? 'var(--gold)' : 'rgba(255,255,255,.08)'}"></span></td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>
    <div class="panel p-4 md:p-5">
      <div class="label mb-3">Edit your habits</div>
      <div class="flex flex-wrap gap-2 mb-3">${h.list.map((x, i) => `<span class="chip !py-1.5">${esc(x)} <button class="ml-1 hover:text-red-300" onclick="removeHabit(${i})" aria-label="Remove ${esc(x)}">×</button></span>`).join('')}</div>
      <div class="flex gap-2"><input id="newHabit" class="field !py-2" placeholder="Add a habit, e.g. No phone in the first hour" onkeydown="if(event.key==='Enter')addHabit()"><button class="btn-ghost rounded-xl px-4 text-sm" onclick="addHabit()">Add</button></div>
    </div>`;
}

async function saveHabits(body) {
  try { mentor.habits = await api('/api/mentor/habits', body); } catch (e) { toast(e.message); }
  renderMentorTab();
}
function toggleHabit(habit, on) {
  const done = new Set(mentor.habits.log[todayISO()] || []);
  on ? done.add(habit) : done.delete(habit);
  saveHabits({ date: todayISO(), done: [...done] });
}
function addHabit() {
  const v = $('#newHabit').value.trim();
  if (v) saveHabits({ habits: [...mentor.habits.list, v] });
}
function removeHabit(i) {
  saveHabits({ habits: mentor.habits.list.filter((_, k) => k !== i) });
}

// ---------- roadmap ----------
function roadmapHTML() {
  const r = mentor.roadmap, ms = r.milestones || [];
  const done = ms.filter(m => m.done).length;
  return `
    <div class="panel p-4 md:p-5 mb-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div class="flex-1">
        <div class="label mb-1">Your roadmap</div>
        <p class="text-sm text-[#c9ccd5]">${esc(mentor.profile.goal || 'Add your big goal in "About you" first.')}${mentor.profile.age ? ` · You are ${esc(mentor.profile.age)}` : ''}</p>
      </div>
      <button id="roadmapBtn" class="${ms.length ? 'btn-ghost' : 'btn-gold'} rounded-xl px-5 py-2.5 text-sm" onclick="makeRoadmap()">${ms.length ? 'Remake roadmap' : `Ask ${esc(mentorName())} for my roadmap`}</button>
    </div>
    ${r.reality_check ? `<div class="panel-2 p-4 mb-5" style="border-color:rgba(216,176,106,.3)"><div class="label gold mb-1.5">Honest reality check</div><p class="text-[14px] text-[#e2e4ea] leading-relaxed">${esc(r.reality_check)}</p></div>` : ''}
    ${ms.length ? `
      <div class="flex items-center justify-between mb-2"><div class="label">Milestones</div><div class="text-xs text-[color:var(--muted)]">${done} / ${ms.length} done</div></div>
      <div class="h-1 rounded-full bg-white/5 mb-4 overflow-hidden"><div class="h-full rounded-full" style="width:${done / ms.length * 100}%;background:var(--gold)"></div></div>
      <ol class="roadmap">
        ${ms.map(m => `
          <li class="panel-2 p-4 flex gap-3 ${m.done ? 'opacity-60' : ''}">
            <input type="checkbox" class="check" ${m.done ? 'checked' : ''} onchange="toggleMilestone('${m.id}')">
            <div class="flex-1 min-w-0">
              <div class="flex items-baseline gap-2 flex-wrap"><span class="gold text-xs font-semibold">Age ${esc(m.age)} · ${esc(m.year)}</span><span class="text-[15px] text-white font-medium ${m.done ? 'line-through' : ''}">${esc(m.title)}</span></div>
              <p class="text-[13px] text-[color:var(--muted)] mt-1 leading-relaxed">${esc(m.detail)}</p>
            </div>
          </li>`).join('')}
      </ol>` : `<p class="text-sm text-[color:var(--muted)] text-center py-6">${esc(mentorName())} will break your big goal into a year-by-year plan, and tell you honestly what it takes.</p>`}`;
}

async function makeRoadmap() {
  if (mentor.roadmap.milestones?.length && !confirm('Make a new roadmap? Your ticks on the old one will be lost.')) return;
  const btn = $('#roadmapBtn');
  btn.disabled = true;
  btn.textContent = `${mentorName()} is thinking about your life…`;
  try { mentor.roadmap = await api('/api/mentor/roadmap', {}); } catch (e) { toast(e.message); }
  renderMentorTab();
}

async function toggleMilestone(id) {
  try { mentor.roadmap = await api('/api/mentor/roadmap/toggle', { id }); } catch (e) { toast(e.message); }
  renderMentorTab();
}

// ---------- memory ----------
function memoryHTML() {
  const mem = [...mentor.memories].reverse();
  return `
    <div class="panel p-4 md:p-5 mb-5">
      <div class="label mb-1">What ${esc(mentorName())} remembers about you</div>
      <p class="text-[13px] text-[color:var(--muted)] mb-3">Your mentor learns these from your talks and journal. Remove anything wrong, or add something important.</p>
      <div class="flex gap-2"><input id="newMemory" class="field !py-2" placeholder="e.g. My father runs a small shop and I help there on weekends" onkeydown="if(event.key==='Enter')addMemory()"><button class="btn-ghost rounded-xl px-4 text-sm" onclick="addMemory()">Remember</button></div>
    </div>
    <div class="space-y-2">
      ${mem.length ? mem.map(m => `
        <div class="panel-2 p-3.5 flex items-start gap-3">
          <span class="text-sm">${m.source === 'you' ? '✍️' : '🧠'}</span>
          <span class="flex-1 text-[13.5px] text-[#d4d7de] leading-relaxed">${esc(m.text)}</span>
          <button class="text-[color:var(--muted)] hover:text-red-300" onclick="deleteMemory('${m.id}')" aria-label="Forget this">×</button>
        </div>`).join('') : `<p class="text-sm text-[color:var(--muted)] text-center py-6">Nothing yet. Talk to ${esc(mentorName())} and your mentor will start remembering.</p>`}
    </div>`;
}

async function addMemory() {
  const text = $('#newMemory').value.trim();
  if (!text) return;
  try { mentor.memories = await api('/api/mentor/memory/add', { text }); } catch (e) { toast(e.message); }
  renderMentorTab();
}
async function deleteMemory(id) {
  try { mentor.memories = await api('/api/mentor/memory/delete', { id }); } catch (e) { toast(e.message); }
  renderMentorTab();
}

// ---------- about you ----------
const ABOUT_FIELDS = [
  ['your_name', 'Your name', 'e.g. Rahul', 1], ['mentor_name', "Mentor's name", 'Rowan', 1],
  ['age', 'Age', 'e.g. 25', 1], ['birthday', 'Birthday', 'e.g. 1 Jan 2000', 1], ['city', 'City', 'e.g. Toronto', 1],
  ['work', 'What you do now', 'e.g. Final-year student, building a delivery startup', 2],
  ['goal', 'Your big life goal', 'e.g. Run a profitable business by age 30', 2],
  ['values', 'What matters most to you', 'e.g. Family, honesty, freedom, health', 2],
  ['income', 'Monthly income', 'e.g. C$3,500', 1], ['savings', 'Savings', 'e.g. C$5,000', 1], ['debt', 'Debt', 'e.g. C$12,000 student loan', 1],
  ['people', 'Important people in your life', 'e.g. Parents, younger sister, co-founder Aman', 2],
  ['notes', 'Anything else your mentor should know', 'Health, fears, dreams, situation at home…', 2],
];

function aboutHTML() {
  const p = mentor.profile;
  return `
    <form class="panel p-4 md:p-6 mb-5" onsubmit="saveAbout(event)">
      <div class="label mb-1">About you</div>
      <p class="text-[13px] text-[color:var(--muted)] mb-5">The more ${esc(mentorName())} knows, the better the guidance. This stays on your computer.</p>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${ABOUT_FIELDS.map(([k, label, ph, span]) => `
          <label class="block ${span === 2 ? 'md:col-span-2' : ''}"><span class="label block mb-1.5">${label}</span>
            ${span === 2 ? `<textarea name="${k}" rows="2" class="field resize-none" placeholder="${esc(ph)}">${esc(p[k] || '')}</textarea>`
                         : `<input name="${k}" class="field" placeholder="${esc(ph)}" value="${esc(p[k] || '')}">`}
          </label>`).join('')}
      </div>
      <div class="flex justify-end mt-5"><button class="btn-gold rounded-xl px-5 py-2.5 text-sm">Save</button></div>
    </form>
    <div class="panel p-4 md:p-6">
      <div class="label mb-1">Net worth log</div>
      <p class="text-[13px] text-[color:var(--muted)] mb-4">Everything you own minus everything you owe. Add it once a month and watch it grow.</p>
      <div class="flex flex-col sm:flex-row gap-2 mb-4">
        <input id="nwAmount" class="field !py-2 sm:w-48" placeholder="e.g. C$8,500">
        <input id="nwNote" class="field !py-2" placeholder="Note (optional), e.g. after paying the laptop EMI">
        <button class="btn-ghost rounded-xl px-4 py-2 text-sm" onclick="addNetWorth()">Add</button>
      </div>
      <div class="space-y-2">${[...mentor.networth].reverse().map(n => `
        <div class="panel-2 px-3.5 py-2.5 flex items-center gap-3 text-sm">
          <span class="text-[color:var(--muted)] w-24 shrink-0">${esc(n.date)}</span>
          <span class="text-white font-medium">${esc(n.amount)}</span>
          <span class="flex-1 text-[color:var(--muted)] truncate">${esc(n.note || '')}</span>
          <button class="text-[color:var(--muted)] hover:text-red-300" onclick="deleteNetWorth('${n.id}')" aria-label="Delete">×</button>
        </div>`).join('') || '<p class="text-sm text-[color:var(--muted)]">No entries yet.</p>'}</div>
    </div>`;
}

async function saveAbout(e) {
  e.preventDefault();
  const fields = Object.fromEntries(new FormData(e.target).entries());
  if (!fields.mentor_name.trim()) fields.mentor_name = 'Rowan';
  try {
    mentor.profile = await api('/api/mentor/profile', fields);
    toast(`Saved. ${mentorName()} knows you better now.`);
    renderView();
  } catch (err) { toast(err.message); }
}

async function addNetWorth() {
  const amount = $('#nwAmount').value.trim();
  if (!amount) { toast('Enter an amount.'); return; }
  try { mentor.networth = await api('/api/mentor/networth', { amount, note: $('#nwNote').value }); } catch (e) { toast(e.message); }
  renderMentorTab();
}
async function deleteNetWorth(id) {
  try { mentor.networth = await api('/api/mentor/networth/delete', { id }); } catch (e) { toast(e.message); }
  renderMentorTab();
}

// Load the mentor state early so the sidebar can show the avatar; "#mentor" in the address opens the page
if (location.hash === '#mentor') view = 'mentor';
loadMentor().then(() => { renderSidebar(); if (view === 'mentor') renderView(); }).catch(() => {});
