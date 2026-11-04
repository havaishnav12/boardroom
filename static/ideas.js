// ---------- Idea lab & growth ideas ----------
// Loaded after index.html's script and mentor.js; meetings with mode 'ideas' or 'growth' run here.
// Each seated advisor pitches 2 ideas on stage, then the host scores and ranks them all.

const isIdeaMode = m => !!m && (m.mode === 'ideas' || m.mode === 'growth');
const SCORE_LABELS = { size: 'Size', speed: 'Speed', cost: 'Cheap to start', fit: 'Fits you', risk: 'Low risk', impact: 'Impact', confidence: 'Confidence', ease: 'Ease' };
const FOUNDER_FIELDS = [
  ['skills', 'Your skills', 'e.g. coding, sales, video editing, speaking Gujarati and English'],
  ['money', 'Money you can put in', 'e.g. C$5,000'],
  ['hours', 'Time per week', 'e.g. 25 hours'],
  ['interests', 'Interests', 'e.g. food, fitness, AI, travel'],
];
const scoreBar = n => n >= 8 ? '#34d399' : n >= 5 ? '#fbbf24' : '#f87171';
const jsArg = s => JSON.stringify(String(s || '')).replace(/'/g, '&#39;');

// What the advisors know about the founder for fitting ideas: the idea-lab fields plus Rowan's "About you"
function founderOf(p) {
  const f = { ...(p.founder || {}) };
  const mp = typeof mentor !== 'undefined' && mentor ? mentor.profile : null;
  if (mp) for (const k of ['city', 'work', 'savings', 'income']) if (mp[k] && !f[k]) f[k] = mp[k];
  return f;
}

function saveFounder(el) {
  const p = activeProject();
  p.founder ||= {};
  p.founder[el.dataset.founder] = el.value.trim();
  save();
}

function founderFieldsHTML(p) {
  return `
    <div class="panel-2 p-4 mb-4">
      <div class="label mb-1">About you, for better ideas</div>
      <p class="text-[12px] text-[color:var(--muted)] mb-3">Saved for next time. Your city, work and savings also come from ${esc(typeof mentorName === 'function' ? mentorName() : 'your mentor')}'s "About you".</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        ${FOUNDER_FIELDS.map(([k, label, ph]) => `
          <label class="block"><span class="label block mb-1.5">${label}</span>
            <input class="field !py-2" data-founder="${k}" value="${esc(p.founder?.[k] || '')}" placeholder="${esc(ph)}" onchange="saveFounder(this)"></label>`).join('')}
      </div>
    </div>`;
}

function ideasText(ideas) {
  return (ideas || []).map((i, n) => `${n + 1}. ${i.title}: ${i.pitch} Why: ${i.why} Cost: ${i.cost}. First step: ${i.first_step}. ${i.extra}`).join('\n\n');
}

function ideaCardsHTML(ideas, mode) {
  return `<div class="grid grid-cols-1 md:grid-cols-2 gap-3">${(ideas || []).map(i => `
    <div class="panel-2 p-4">
      <div class="text-[15px] font-semibold text-white mb-1.5">${mode === 'ideas' ? '💡' : '📈'} ${esc(i.title)}</div>
      <p class="text-[13.5px] text-[#d4d7de] leading-relaxed">${esc(i.pitch)}</p>
      ${i.why ? `<p class="text-[12.5px] text-[color:var(--muted)] mt-2"><span class="text-white/70">Why:</span> ${esc(i.why)}</p>` : ''}
      ${i.cost ? `<div class="mt-3"><span class="stat-pill">💰 ${esc(i.cost)}</span></div>` : ''}
      ${i.first_step ? `<p class="text-[12.5px] mt-2"><span class="gold">This week:</span> ${esc(i.first_step)}</p>` : ''}
      ${i.extra ? `<p class="text-[12.5px] mt-1 text-[color:var(--muted)]"><span class="text-white/70">${mode === 'ideas' ? 'Could become huge:' : 'Measure:'}</span> ${esc(i.extra)}</p>` : ''}
    </div>`).join('')}</div>`;
}

async function runIdeaLab(p, m) {
  const base = () => ({ project: profileOf(p), memory: memoryOf(p, m), documents: docsOf(p, m) });
  const founder = founderOf(p);
  m.pitches ||= {};
  m.phase = 'pitch';
  await playRound(m, 'pitch', m.pitches, m.seats, id => ['/api/ideas/pitch', { ...base(), advisor_id: id, kind: m.mode, direction: m.question, founder, web: !!m.web }]);
  // Their pitches double as their "opinion", so follow-up questions to each advisor work as usual
  m.seats.forEach(id => {
    const e = m.pitches[id];
    if (e?.status === 'done') m.opinions[id] = { status: 'done', shown: true, content: ideasText(e.ideas) };
  });
  await rankIdeas(p, m, founder);
  m.phase = 'done';
  save();
  setLive(m, { speaker: null });
  renderSidebar();
  if (current === m && m.synthesis.status === 'done') document.getElementById('synthesis')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function rankIdeas(p, m, founder = founderOf(p)) {
  const pitches = Object.fromEntries(m.seats.filter(id => m.pitches?.[id]?.status === 'done').map(id => [id, m.pitches[id].ideas]));
  if (!Object.keys(pitches).length) {
    m.synthesis = { status: 'error', error: 'None of the advisors could pitch ideas. Try again.' };
    save();
    refreshMeeting(m);
    return;
  }
  m.phase = 'ranking';
  m.synthesis = { status: 'pending' };
  setLive(m, { speaker: 'chair' });
  try {
    const data = await api('/api/ideas/rank', {
      project: profileOf(p), kind: m.mode, direction: m.question, founder, pitches, memory: memoryOf(p, m), documents: docsOf(p, m),
    });
    m.synthesis = { status: 'done', data };
  } catch (e) {
    m.synthesis = { status: 'error', error: e.message };
  }
  save();
  setLive(m, { speaker: null });
}

async function rerankIdeas() {
  const p = activeProject(), m = current;
  live = { m, speaker: null, mode: null, reactions: {}, typed: 0 };
  await rankIdeas(p, m);
  m.phase = 'done';
  save();
  refreshMeeting(m);
  renderSidebar();
}

function rankingHTML(m) {
  const s = m.synthesis || { status: 'waiting' };
  const shell = inner => `<div class="panel p-5 md:p-7 relative overflow-hidden" style="border-color:rgba(216,176,106,.3)">
    <div class="absolute inset-x-0 top-0 h-px" style="background:linear-gradient(90deg,transparent,var(--gold),transparent)"></div>
    <div class="flex items-center gap-2 mb-4"><span>${m.mode === 'ideas' ? '💡' : '📈'}</span><span class="label gold">${m.mode === 'ideas' ? 'Idea board' : 'Growth plan'}</span></div>
    ${inner}</div>`;

  if (s.status === 'waiting' || s.status === 'pending') {
    return shell(`<div class="space-y-3"><div class="text-sm gold">${s.status === 'pending' ? 'The host is scoring every idea…' : 'Your advisors are pitching. The ranked ideas will show here.'}</div><div class="h-4 shimmer w-11/12"></div><div class="h-4 shimmer w-8/12"></div></div>`);
  }
  if (s.status === 'error') {
    return shell(`<p class="text-sm text-red-300 mb-4">${esc(s.error)}</p><button onclick="rerankIdeas()" class="btn-ghost rounded-lg px-3 py-1.5 text-sm">Try again</button>`);
  }

  const d = s.data;
  const keys = m.mode === 'ideas' ? ['size', 'speed', 'cost', 'fit', 'risk'] : ['impact', 'confidence', 'ease'];
  const top = d.ranked.find(r => r.title === d.top_pick) || d.ranked[0];
  const steps = d.next_steps || [];
  const doneCount = steps.filter((_, i) => m.done[i]).length;
  const mentorLabel = typeof mentorName === 'function' ? mentorName() : 'Rowan';

  return shell(`
    <p class="font-serif text-2xl md:text-[28px] leading-snug">${esc(d.headline)}</p>
    ${d.why_top?.length ? `<ol class="mt-4 space-y-2">${d.why_top.map((x, i) => `
      <li class="flex gap-3 text-[14px] text-[#e2e4ea] leading-relaxed"><span class="h-6 w-6 rounded-full grid place-items-center text-[11px] font-semibold shrink-0" style="background:var(--gold-soft);color:var(--gold)">${i + 1}</span><span>${esc(x)}</span></li>`).join('')}</ol>` : ''}

    <div class="label mt-7 mb-3">All ideas, ranked</div>
    <div class="space-y-2.5">${d.ranked.map((r, i) => {
      const isTop = r === top;
      return `
      <div class="panel-2 p-4" style="${isTop ? 'border-color:rgba(216,176,106,.55);box-shadow:0 0 0 1px rgba(216,176,106,.25)' : ''}">
        <div class="flex items-start gap-3">
          <div class="text-lg font-semibold w-6 text-center ${isTop ? 'gold' : 'text-[color:var(--muted)]'}">${i + 1}</div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              ${advisors.find(a => a.id === r.by) ? avatar(r.by, 22) : ''}
              <span class="text-[15px] text-white font-medium">${esc(r.title)}</span>
              ${isTop ? '<span class="vote-tag" style="background:#d8b06a26;color:#d8b06a">TOP PICK</span>' : ''}
            </div>
            <p class="text-[13px] text-[color:var(--muted)] mt-1 leading-relaxed">${esc(r.one_line)}</p>
            <div class="grid gap-2 mt-3" style="grid-template-columns:repeat(${keys.length},minmax(0,1fr))">${keys.map(k => `
              <div><div class="text-[10px] text-[color:var(--muted)] mb-1 truncate">${SCORE_LABELS[k]}</div>
                <div class="h-1.5 rounded-full bg-white/5 overflow-hidden"><div class="h-full rounded-full" style="width:${(r.scores[k] || 0) * 10}%;background:${scoreBar(r.scores[k] || 0)}"></div></div>
                <div class="text-[11px] mt-0.5 text-[#c9ccd5]">${r.scores[k] || 0}/10</div></div>`).join('')}</div>
            <div class="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[12px]">
              <button class="gold hover:underline" onclick='ideaToBoard(${jsArg(r.title)}, ${jsArg(r.one_line)})'>⚖️ Debate this with the board</button>
              <button class="gold hover:underline" onclick='ideaToMentor(${jsArg(r.title)})'>🪈 Ask ${esc(mentorLabel)} about this</button>
            </div>
          </div>
          <div class="text-right shrink-0"><div class="text-xl font-semibold ${isTop ? 'gold' : 'text-white'}">${r.total}</div><div class="text-[10px] text-[color:var(--muted)]">/ ${keys.length * 10}</div></div>
        </div>
      </div>`;
    }).join('')}</div>

    ${d.focus_guard ? `<div class="panel-2 p-4 mt-5" style="border-color:rgba(251,191,36,.35)"><div class="label mb-1.5" style="color:#fbbf24">🎯 Focus guard</div><p class="text-[13.5px] text-[#e2e4ea] leading-relaxed">${esc(d.focus_guard)}</p></div>` : ''}

    ${steps.length ? `
    <div class="mt-6">
      <div class="flex justify-between gap-3 mb-3 flex-wrap"><div class="label">This week</div>
        <div class="flex items-center gap-3">
          <button class="text-xs gold hover:underline" onclick="addIdeaSteps()">➕ Add to my team's tasks</button>
          <div class="text-xs text-[color:var(--muted)]">${doneCount} / ${steps.length} done</div>
        </div>
      </div>
      <div class="space-y-2">${steps.map((x, i) => `
        <label class="panel-2 p-3.5 flex gap-3 cursor-pointer ${m.done[i] ? 'opacity-55' : ''}">
          <input type="checkbox" class="check" ${m.done[i] ? 'checked' : ''} onchange="toggleDone(${i}, this.checked)">
          <span class="text-sm text-white ${m.done[i] ? 'line-through' : ''}">${esc(x)}</span>
        </label>`).join('')}</div>
    </div>` : ''}`);
}

// This week's steps become tasks owned by whoever pitched the top idea (static/team.js)
function addIdeaSteps() {
  const d = current?.synthesis?.data;
  if (!d) return;
  const top = d.ranked.find(r => r.title === d.top_pick) || d.ranked[0];
  addPlanTasks((d.next_steps || []).map(t => ({ title: t, owner: top?.by || '', due_days: 7 })), 'ideas');
}

function ideaToBoard(title, line) {
  const p = activeProject();
  p.mode = 'debate';
  save();
  newMeeting();
  setTimeout(() => { const q = $('#question'); if (q) { q.value = `Should I go all in on this idea: "${title}"? ${line}`; q.focus(); } }, 80);
}

function ideaToMentor(title) {
  if (typeof showMentor !== 'function') return;
  mentorDraft = `My board's idea lab picked "${title}". Is this right for me and my goal? What do the books say?`;
  mentorTab = 'talk';
  showMentor();
}

function copyIdeas(m) {
  const d = m.synthesis?.data;
  let out = `# ${m.mode === 'ideas' ? 'Idea lab' : 'Growth ideas'}: ${m.question}\n${new Date(m.createdAt).toLocaleString()}\n\n`;
  if (d) {
    out += `## Top pick\n${d.headline}\n\n## All ideas, ranked\n` + d.ranked.map((r, i) => `${i + 1}. ${r.title} (${r.total}) - ${r.one_line}`).join('\n') + '\n\n';
    if (d.focus_guard) out += `## Focus guard\n${d.focus_guard}\n\n`;
    if (d.next_steps?.length) out += `## This week\n${d.next_steps.map((x, i) => `- [${m.done[i] ? 'x' : ' '}] ${x}`).join('\n')}\n\n`;
  }
  out += '## All pitches\n\n' + m.seats.filter(id => m.pitches?.[id]?.status === 'done')
    .map(id => `### ${advisorOf(id).name}\n${ideasText(m.pitches[id].ideas)}`).join('\n\n');
  navigator.clipboard.writeText(out).then(() => toast('Ideas copied'), () => toast('Could not copy'));
}
