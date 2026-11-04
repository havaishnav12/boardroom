// ---------- Ask the whole board a follow-up ----------
// After a meeting, one question goes to every advisor who spoke. They answer on stage one by one
// (like a mini round), then the host combines their answers into one. Stored on the meeting as m.boardQs.

function boardFollowupHTML(m, busy) {
  const qs = m.boardQs || [];
  return `
    <section class="panel p-5 md:p-6 mb-8" style="border-color:rgba(216,176,106,.3)">
      <div class="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <div class="label gold">💬 Ask the whole board</div>
        <div class="text-[11px] text-[color:var(--muted)]">Everyone answers, then you get one combined answer · about C$0.03</div>
      </div>
      <p class="text-[12.5px] text-[color:var(--muted)] mb-4">Any doubt about the decision, or a new question. They all remember this meeting.</p>
      ${qs.length ? `<div class="space-y-6 mb-5">${qs.map(boardQHTML).join('')}</div>` : ''}
      <div class="flex flex-col sm:flex-row gap-2">
        <textarea id="boardQInput" rows="2" class="field resize-none flex-1 text-[14px]" ${busy ? 'disabled' : ''}
          placeholder="e.g. What if no shop says yes this week?  /  Is C$200 a month too high?"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();askBoard()}"></textarea>
        <button class="btn-gold rounded-xl px-5 py-2.5 text-sm shrink-0" onclick="askBoard()" ${busy ? 'disabled' : ''}>${busy ? 'Answering…' : 'Ask the board'}</button>
      </div>
    </section>`;
}

function boardQHTML(b) {
  const answers = Object.entries(b.answers || {});
  const shown = answers.filter(([, a]) => a.status === 'done' && a.shown !== false);
  const failed = answers.filter(([, a]) => a.status === 'error');
  const s = b.summary || {};
  return `
    <div>
      <div class="flex justify-end mb-3">
        <div class="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm whitespace-pre-wrap" style="background:var(--gold-soft);color:#f1e3c6"><span class="opacity-70">To the board:</span> ${esc(b.q)}</div>
      </div>
      <div class="space-y-2.5">
        ${shown.map(([id, a]) => `
          <div class="msg">${avatar(id, 32)}
            <div class="bubble" style="--c:${colorOf(id)}">
              <div class="text-[12px] font-medium mb-1" style="color:${colorOf(id)}">${esc(advisorOf(id).name)}</div>
              <div class="prose-board">${md(a.content)}</div>
            </div>
          </div>`).join('')}
        ${failed.map(([id, a]) => `<p class="text-[12.5px] text-red-300">${esc(firstName(id))} couldn't answer: ${esc(a.error)}</p>`).join('')}
      </div>
      ${s.status === 'done' ? `
        <div class="panel-2 p-4 mt-3" style="border-color:rgba(216,176,106,.5)">
          <div class="label gold mb-1.5">🏛️ The board's answer</div>
          <div class="prose-board">${md(s.text)}</div>
        </div>`
      : s.status === 'pending' ? `<div class="panel-2 p-4 mt-3"><span class="text-sm gold">The host is combining their answers…</span></div>`
      : s.status === 'error' ? `<p class="text-sm text-red-300 mt-2">${esc(s.error)}</p>` : ''}
    </div>`;
}

async function askBoard() {
  const p = activeProject(), m = current;
  const input = $('#boardQInput');
  const q = input?.value.trim();
  if (!q) { input?.focus(); return; }
  if (live.m && live.m.phase && live.m.phase !== 'done') { toast('Wait until the board has finished.'); return; }

  const ids = m.seats.filter(id => m.opinions[id]?.status === 'done');
  const decision = m.synthesis?.data?.headline || '';
  const b = { id: uid(), q, at: Date.now(), answers: {}, summary: { status: 'waiting' } };
  m.boardQs ||= [];
  m.boardQs.push(b);
  input.value = '';
  live = { m, speaker: null, mode: null, reactions: {}, typed: 0 };
  m.phase = 'followup';
  save();
  refreshMeeting(m);
  $('#main').scrollTo({ top: 0, behavior: 'smooth' });

  // Each advisor remembers their own opening, discussion and earlier board questions
  const historyFor = id => {
    const h = [{ role: 'user', content: m.question }, { role: 'assistant', content: m.opinions[id].content }];
    if (m.debate?.[id]?.status === 'done') h.push({ role: 'user', content: 'What did you say in the discussion?' }, { role: 'assistant', content: m.debate[id].content });
    m.boardQs.slice(0, -1).forEach(prev => {
      const a = prev.answers?.[id];
      if (a?.status === 'done') h.push({ role: 'user', content: prev.q }, { role: 'assistant', content: a.content });
    });
    return h;
  };
  const ask = `${q}\n\n(This is a follow-up question to the whole board after the meeting.${decision ? ` The board's final decision was: "${decision}".` : ''} Answer in 50-110 words, directly, in your own voice. You may agree or disagree with the decision.)`;

  await playRound(m, 'followup', b.answers, ids, id => ['/api/consult', {
    advisor_id: id, project: profileOf(p), question: ask, history: historyFor(id), memory: memoryOf(p, m), documents: docsOf(p, m),
  }]);

  const answers = Object.fromEntries(ids.filter(id => b.answers[id]?.status === 'done').map(id => [id, b.answers[id].content]));
  if (Object.keys(answers).length) {
    b.summary = { status: 'pending' };
    setLive(m, { speaker: 'chair' });
    try {
      const r = await api('/api/followup/summary', { project: profileOf(p), question: q, decision, answers });
      b.summary = { status: 'done', text: r.answer };
    } catch (e) {
      b.summary = { status: 'error', error: e.message };
    }
  } else {
    b.summary = { status: 'error', error: 'None of the advisors could answer. Try again.' };
  }
  m.phase = 'done';
  save();
  setLive(m, { speaker: null });
  setTimeout(() => document.getElementById('followups')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}
