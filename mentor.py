"""The personal life mentor, Rowan: a friend and guide who knows the great money, strategy and life books.

Everything the mentor knows about you is kept in data/mentor.json on this computer.
app.py calls register() to add the /api/mentor routes.
"""
import asyncio
import json
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

MENTOR_PROMPT = """You are {mentor_name}, the user's personal guide and closest friend: calm, cheerful, wise and honest. You are an AI guide, and you always push your friend to rise and act.
You have mastered the greatest books on money, strategy, success and the human mind (below), so you can guide your friend in business, money and life. You believe in them completely: loving, but never soft on the truth.

YOUR LIBRARY (use the real ideas, name the book when you use one, explain it simply, never quote long passages):
MONEY AND WEALTH
- Rich Dad Poor Dad (Kiyosaki): assets put money in your pocket, liabilities take it out; the rich buy assets; financial education; don't work for money, make money work for you; the cash-flow quadrant (employee, self-employed, business owner, investor).
- The Intelligent Investor (Graham): margin of safety; Mr. Market is your servant, not your guide; investing vs speculating; the defensive investor.
- The Millionaire Fastlane (DeMarco): sidewalk, slowlane and fastlane; the CENTS rules (Control, Entry, Need, Time, Scale); build systems that earn without your hours; sell what people truly need.
- Think and Grow Rich (Hill): definite purpose, burning desire, faith, the mastermind group, persistence, going the extra mile.
- The Psychology of Money (Housel): wealth is what you don't see; knowing what is "enough"; compounding needs time; leave room for error; saving is the gap between your ego and your income.
- The Richest Man in Babylon (Clason): pay yourself first (keep at least one tenth), make your money work, guard it from loss, increase your ability to earn.
- The Millionaire Next Door (Stanley): most millionaires live below their means; a big income is not wealth.
- I Will Teach You to Be Rich (Sethi): automate your money; spend freely on what you love and cut hard on what you don't.
WISDOM AND DECISIONS
- Poor Charlie's Almanack (Munger): invert, always invert; mental models; avoid stupidity instead of chasing brilliance; incentives explain behaviour.
- Principles (Dalio): pain + reflection = progress; radical truth; the 5-step process (goals, problems, diagnosis, design, doing).
- The Almanack of Naval Ravikant: seek wealth, not money or status; specific knowledge, accountability and leverage (code, media, capital, people); play long-term games with long-term people.
- Thinking, Fast and Slow (Kahneman): fast vs slow thinking; biases like loss aversion, overconfidence and anchoring.
HABITS AND FOCUS
- Atomic Habits (Clear): 1% better every day; identity-based habits; make it obvious, attractive, easy and satisfying; systems beat goals.
- Deep Work (Newport): focused work is rare and valuable; protect deep blocks of time.
- Essentialism (McKeown): less but better; if it isn't a clear yes, it's a no.
- The 7 Habits of Highly Effective People (Covey): be proactive, begin with the end in mind, first things first, think win-win, seek first to understand, synergize, sharpen the saw.
PEOPLE, POWER AND STRATEGY (use these as a shield and for honest strategy; never to manipulate or harm people)
- How to Win Friends and Influence People (Carnegie): real interest in others, remember names, don't criticise, make people feel important.
- Influence (Cialdini): reciprocity, commitment, social proof, liking, authority, scarcity, unity; spot when they are used on you.
- Never Split the Difference (Voss): tactical empathy, mirroring, labelling, calibrated "how" and "what" questions.
- The 48 Laws of Power, The 33 Strategies of War and Mastery (Greene): how power really works, guard your reputation, the long apprenticeship to mastery.
- The Art of War (Sun Tzu): know yourself and your opponent; the best victory needs no battle; choose your battlefield.
- The Prince (Machiavelli): how power is won and kept; be realistic about human nature.
- Good Strategy Bad Strategy (Rumelt): a real strategy = diagnosis + guiding policy + coherent actions.
INNER STRENGTH
- Meditations (Marcus Aurelius): control what you can, accept what you can't; the obstacle is the way.
- Man's Search for Meaning (Frankl): between what happens and how you respond there is a space; meaning makes suffering bearable.

HOW YOU GUIDE:
- You remember the user's life (see WHAT YOU KNOW ABOUT THEM) and use it naturally. Never ask for something you already know.
- Morning plans, evening reviews, weekly check-ins, journal replies and habit coaching.
- Money coaching: budget, saving, emergency fund, assets vs liabilities, net worth, investing basics; warn about scams, MLMs, get-rich-quick schemes and risky hype.
- Decision help: worst case, the regret test, 10/10/10 (how will this feel in 10 minutes, 10 months, 10 years), is it reversible, does it fit their values and goal. Then give your honest recommendation.
- Their big goal: keep it in view, break it into steps, and be honest about how realistic it is and what it really takes, without crushing their spirit.
- Hard times: listen first, then perspective (Stoics, Frankl), then one small next step.
- People, negotiation and strategy: help them read situations, protect them from manipulation, and keep their reputation clean.
- Values: help them become rich AND good. Wealth built on a bad name collapses.
- For big business questions, suggest taking it to their business board (six advisors: Maya, Ravi, Nora, Leo, Ada and Sam) and help them frame the question.

HOW YOU TALK:
- Like a warm friend with a smile in your words. When they make excuses, tease them gently, then give deep clarity.
- Sometimes tell a short story from business or history when it truly fits. Keep stories to 2-3 sentences.
- Honest tough love: if they are wrong, say so kindly and clearly. You are not a yes-man.
- Usually 120-250 words, in short paragraphs or a few bullets, and never more than 280 words. End with ONE good question or one clear next step.
- Use their name if you know it, or call them "my friend". Don't assume their gender unless they have told you.

LIMITS:
- You are not a licensed financial adviser, lawyer or doctor. For big money moves, taxes, legal issues or health problems, tell them to also check with a qualified professional.
- If they talk about hurting themselves, or feeling hopeless for a long time, respond with care, encourage them to talk to someone they trust today, and share a free crisis line: in Canada, call or text 9-8-8 (Suicide Crisis Helpline, 24/7); in India, Tele-MANAS 14416. If they may be in danger right now, tell them to call 911. Never ignore this.
- Never invent facts about the user. If you don't know something, ask."""

# What each quick button asks the mentor to do this turn
MODES = {
    "chat": "",
    "morning": "MORNING PLAN: Help them plan today. Agree on their 3 most important tasks (sharpen them if they gave some, suggest them from their goals if not), one habit to focus on, and end with one short line of wisdom.",
    "evening": "EVENING REVIEW: Review their day: wins, what went wrong, the lesson, how their habits went (see the habit log), and one thing to do better tomorrow. Be warm and honest.",
    "weekly": "WEEKLY CHECK-IN: Look at the past week against their roadmap, habits, journal and goals. Give an honest assessment (are they on track?), one key lesson, and a short plan for next week.",
    "decision": "DECISION HELP: Help them decide. If the decision isn't clear yet, ask what it is. Walk through: worst case, regret test, 10/10/10, reversible or not, fit with values and goal, and what one relevant book says. End with your honest recommendation.",
    "money": "MONEY CHECK: Act as their money coach. Use what you know about their income, savings, debt and net worth. Teach assets vs liabilities and paying yourself first, and give 2-3 concrete money steps. Warn about any risky moves. Remind them you're not a licensed adviser for big decisions.",
    "lesson": "BOOK LESSON: Teach ONE powerful lesson from one of your books that fits their life right now. Explain it simply, show how to apply it this week, then ask 2 short quiz questions to check they understood.",
    "strategy": "STRATEGY AND PEOPLE: Help with a situation involving people, power, competition or negotiation, using The Art of War, the 48 Laws of Power, Influence, Never Split the Difference and similar. Use them as a shield and for honest strategy, never to manipulate or harm. If they haven't described a situation, ask about one.",
    "low": "FEELING LOW: They are feeling low. Listen first and show you understand. Then give gentle perspective (Marcus Aurelius, Frankl) and one small, doable next step. If anything sounds serious, follow your safety rule.",
    "board": "ASK MY BOARD: They want to take something to their business board of six advisors. Help them turn it into one clear, specific question for the board, and tell them which advisors' views matter most for it. Put the final question on its own line starting with 'Question for the board:'.",
    "journal": "JOURNAL: They just wrote this diary entry. Reply like a mentor reading their diary: notice what matters, praise real progress, gently point out patterns or blind spots, share one lesson from a book and ask one question. 100-180 words.",
}

MEMORY_PROMPT = """You keep the long-term memory of a personal life mentor. From the latest exchange, pick out NEW lasting facts about the user worth remembering for months: goals, plans, decisions, important people, money numbers, work, health, struggles, wins, values and preferences. Skip small talk, passing moods and anything already in the memory list. Write each fact as one short sentence about the user, e.g. "Earns about C$3,000 a month from freelancing."
Return ONLY JSON: {"facts": ["..."]} with at most 3 facts, or {"facts": []}."""

ROADMAP_PROMPT = """You are the user's life mentor. Using everything you know about them, write an honest year-by-year roadmap from their current age to the age in their big goal. For each year give the age, the calendar year, a short title, and 2-3 concrete targets (business, money, skills, people, health). Make it ambitious but real, and say plainly how realistic the goal is and what would have to be true.
Return ONLY JSON: {"reality_check": "2-4 honest sentences", "milestones": [{"age": 23, "year": 2027, "title": "...", "detail": "..."}]}"""

DEFAULT_HABITS = ["Sleep 7+ hours", "Exercise", "Read 20 pages", "2 hours deep work", "Meditate", "Track spending"]


def default_state() -> dict:
    return {
        "profile": {
            "your_name": "", "mentor_name": "Rowan", "age": "", "birthday": "", "city": "",
            "work": "", "goal": "", "values": "", "income": "", "savings": "",
            "debt": "", "people": "", "notes": "",
        },
        "memories": [],
        "chat": [],
        "journal": [],
        "habits": {"list": list(DEFAULT_HABITS), "log": {}},
        "roadmap": {"reality_check": "", "milestones": [], "made_at": ""},
        "networth": [],
    }


PROFILE_LABELS = [
    ("your_name", "Name"), ("age", "Age"), ("birthday", "Birthday"), ("city", "City"), ("work", "What they do now"),
    ("goal", "Big life goal"), ("values", "Values"), ("income", "Monthly income"), ("savings", "Savings"),
    ("debt", "Debt"), ("people", "Important people"), ("notes", "Other notes"),
]


class ChatReq(BaseModel):
    message: str
    mode: str = "chat"
    web: bool = False


class TextReq(BaseModel):
    text: str


class IdReq(BaseModel):
    id: str


class HabitsReq(BaseModel):
    date: str | None = None
    done: list[str] | None = None
    habits: list[str] | None = None


class NetWorthReq(BaseModel):
    amount: str
    note: str = ""


def register(app: FastAPI, *, call_llm, parse_json_obj, plain_english: str, model: str, fast_model: str,
             demo: bool, base_dir: Path, portrait_urls) -> None:
    data_file = base_dir / "data" / "mentor.json"
    data_file.parent.mkdir(exist_ok=True)
    lock = asyncio.Lock()

    def load() -> dict:
        state = default_state()
        if data_file.exists():
            saved = json.loads(data_file.read_text(encoding="utf-8"))
            for key, value in saved.items():
                if isinstance(value, dict) and isinstance(state.get(key), dict):
                    state[key].update(value)
                else:
                    state[key] = value
        if state["profile"].get("mentor_name") in ("", "Dada"):  # the first mentor was called Dada
            state["profile"]["mentor_name"] = "Rowan"
        return state

    def save(state: dict) -> None:
        tmp = data_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(data_file)

    def now() -> str:
        return datetime.now().isoformat(timespec="seconds")

    def new_id() -> str:
        return uuid.uuid4().hex[:10]

    def context(s: dict) -> str:
        p = s["profile"]
        about = "\n".join(f"- {label}: {p.get(key, '').strip()}" for key, label in PROFILE_LABELS if p.get(key, "").strip())
        parts = [f"TODAY: {datetime.now().strftime('%A %d %B %Y, %H:%M')}",
                 "WHAT YOU KNOW ABOUT THEM\n" + (about or "- (nothing yet; ask about them)")]
        if s["memories"]:
            parts.append("THINGS YOU REMEMBER FROM PAST TALKS\n" + "\n".join(f"- {m['text']}" for m in s["memories"][-80:]))
        road = s["roadmap"]
        if road.get("milestones"):
            parts.append("THEIR ROADMAP\n" + "\n".join(
                f"- Age {m.get('age')} ({m.get('year')}): {m.get('title')}{' [DONE]' if m.get('done') else ''}" for m in road["milestones"]))
        log, habits = s["habits"]["log"], s["habits"]["list"]
        if habits and not any(log.values()):
            # An empty log means they haven't started tracking, not that they failed every day
            parts.append("HABITS: they have not started using the habit tracker yet (no data; don't treat this as failure). "
                         "Their habit list: " + ", ".join(habits))
        elif habits:
            first = min(d for d, v in log.items() if v)
            days = [d for d in ((date.today() - timedelta(days=i)).isoformat() for i in range(6, -1, -1)) if d >= first]
            parts.append("HABITS SINCE THEY STARTED TRACKING, LAST 7 DAYS AT MOST (done / total)\n" + "\n".join(
                f"- {d}: {len(log.get(d, []))}/{len(habits)} {', '.join(log.get(d, []))}" for d in days))
        if s["networth"]:
            parts.append("NET WORTH LOG\n" + "\n".join(f"- {n['date']}: {n['amount']} {n.get('note', '')}" for n in s["networth"][-6:]))
        if s["journal"]:
            parts.append("RECENT JOURNAL\n" + "\n".join(f"- {j['date']}: {j['text'][:300]}" for j in s["journal"][-3:]))
        return "\n\n".join(parts)

    def system_prompt(s: dict, mode: str) -> str:
        name = s["profile"].get("mentor_name") or "Rowan"
        task = MODES.get(mode, "")
        return (MENTOR_PROMPT.replace("{mentor_name}", name) + "\n\n" + plain_english + "\n\n" + context(s)
                + (f"\n\nFOR THIS REPLY: {task}" if task else ""))

    async def remember(user_text: str, reply: str) -> None:
        """Pull lasting facts out of an exchange into long-term memory (cheap model, runs in the background)."""
        if demo:
            return
        try:
            async with lock:
                known = [m["text"] for m in load()["memories"]]
            messages = [
                {"role": "system", "content": MEMORY_PROMPT},
                {"role": "user", "content": "MEMORY LIST:\n" + "\n".join(f"- {k}" for k in known[-80:])
                                            + f"\n\nLATEST EXCHANGE\nUser: {user_text[:3000]}\nMentor: {reply[:1500]}"},
            ]
            facts = parse_json_obj(await call_llm(messages, fast_model, temperature=0.2)).get("facts") or []
            async with lock:
                s = load()
                seen = {m["text"].strip().lower() for m in s["memories"]}
                for fact in facts[:3]:
                    if isinstance(fact, str) and fact.strip() and fact.strip().lower() not in seen:
                        s["memories"].append({"id": new_id(), "text": fact.strip(), "at": now(), "source": "auto"})
                save(s)
        except Exception as e:  # memory is best-effort; never break the chat
            print("mentor memory update failed:", repr(e))

    async def reply_to(s: dict, mode: str, extra_user: str | None = None, web: bool = False, meta: dict | None = None) -> str:
        if demo:
            await asyncio.sleep(1.2)
            if web and meta is not None:
                meta["sources"] = [{"url": "https://www150.statcan.gc.ca/", "title": "Statistics Canada (demo source)"}]
            name = s["profile"].get("your_name") or "my friend"
            return (f"_Demo reply. Set `OPENROUTER_API_KEY` for real guidance._\n\nListen, {name}. Do today's three most important tasks "
                    "with your full effort, "
                    "and let the results come.\n\nWhat is the one task that would make today a win?")
        history = [{"role": c["role"], "content": c["content"]} for c in s["chat"][-16:]]
        if extra_user is not None:
            history = [{"role": "user", "content": extra_user}]
        messages = [{"role": "system", "content": system_prompt(s, mode)}] + history
        return await call_llm(messages, model, temperature=0.7, web=web, meta=meta)

    @app.get("/api/mentor")
    async def mentor_state():
        async with lock:
            s = load()
        s["portrait"] = portrait_urls("mentor")
        s["demo"] = demo
        return s

    @app.post("/api/mentor/chat")
    async def mentor_chat(req: ChatReq):
        text = req.message.strip()
        if not text:
            raise HTTPException(status_code=400, detail="Message is empty.")
        mode = req.mode if req.mode in MODES else "chat"
        async with lock:
            s = load()
            s["chat"].append({"role": "user", "content": text, "mode": mode, "at": now()})
            s["chat"] = s["chat"][-300:]
            save(s)
        meta = {}
        reply = await reply_to(s, mode, web=req.web, meta=meta)
        sources = meta.get("sources", [])
        async with lock:
            s = load()
            s["chat"].append({"role": "assistant", "content": reply, "mode": mode, "at": now(), "sources": sources})
            save(s)
        asyncio.create_task(remember(text, reply))
        return {"reply": reply, "sources": sources}

    @app.post("/api/mentor/chat/clear")
    async def mentor_clear_chat():
        async with lock:
            s = load()
            s["chat"] = []
            save(s)
        return {"ok": True}

    @app.post("/api/mentor/profile")
    async def mentor_profile(profile: dict):
        async with lock:
            s = load()
            for key in s["profile"]:
                if key in profile:
                    s["profile"][key] = str(profile[key])[:1000]
            save(s)
        return s["profile"]

    @app.post("/api/mentor/memory/add")
    async def memory_add(req: TextReq):
        if not req.text.strip():
            raise HTTPException(status_code=400, detail="Nothing to remember.")
        async with lock:
            s = load()
            s["memories"].append({"id": new_id(), "text": req.text.strip()[:400], "at": now(), "source": "you"})
            save(s)
        return s["memories"]

    @app.post("/api/mentor/memory/delete")
    async def memory_delete(req: IdReq):
        async with lock:
            s = load()
            s["memories"] = [m for m in s["memories"] if m["id"] != req.id]
            save(s)
        return s["memories"]

    @app.post("/api/mentor/journal")
    async def journal_add(req: TextReq):
        text = req.text.strip()
        if not text:
            raise HTTPException(status_code=400, detail="Write something first.")
        async with lock:
            s = load()
        reply = await reply_to(s, "journal", extra_user=f"My journal entry for today:\n\n{text}")
        entry = {"id": new_id(), "date": date.today().isoformat(), "text": text, "reply": reply, "at": now()}
        async with lock:
            s = load()
            s["journal"].append(entry)
            save(s)
        asyncio.create_task(remember(text, reply))
        return entry

    @app.post("/api/mentor/journal/delete")
    async def journal_delete(req: IdReq):
        async with lock:
            s = load()
            s["journal"] = [j for j in s["journal"] if j["id"] != req.id]
            save(s)
        return {"ok": True}

    @app.post("/api/mentor/habits")
    async def habits_update(req: HabitsReq):
        async with lock:
            s = load()
            h = s["habits"]
            if req.habits is not None:
                h["list"] = [x.strip()[:60] for x in req.habits if x.strip()][:12]
            if req.date and req.done is not None:
                h["log"][req.date] = [d for d in req.done if d in h["list"]]
            cutoff = (date.today() - timedelta(days=180)).isoformat()
            h["log"] = {d: v for d, v in h["log"].items() if d >= cutoff}
            save(s)
        return h

    @app.post("/api/mentor/roadmap")
    async def roadmap_make():
        async with lock:
            s = load()
        if demo:
            await asyncio.sleep(1.2)
            data = {"reality_check": "Demo roadmap. Set OPENROUTER_API_KEY for a real one.",
                    "milestones": [{"age": 23 + i, "year": date.today().year + 1 + i, "title": f"Demo milestone {i + 1}",
                                    "detail": "Build skills, revenue and reputation."} for i in range(7)]}
        else:
            messages = [{"role": "system", "content": ROADMAP_PROMPT + "\n\n" + plain_english + "\n\n" + context(s)},
                        {"role": "user", "content": "Make my roadmap to my big goal."}]
            data = parse_json_obj(await call_llm(messages, model, temperature=0.5))
            if not data.get("milestones"):
                raise HTTPException(status_code=502, detail="The mentor couldn't write a roadmap. Try again.")
        milestones = [{"id": new_id(), "age": m.get("age"), "year": m.get("year"), "title": str(m.get("title", "")),
                       "detail": str(m.get("detail", "")), "done": False}
                      for m in data["milestones"] if isinstance(m, dict)]
        async with lock:
            s = load()
            s["roadmap"] = {"reality_check": str(data.get("reality_check", "")), "milestones": milestones, "made_at": now()}
            save(s)
        return s["roadmap"]

    @app.post("/api/mentor/roadmap/toggle")
    async def roadmap_toggle(req: IdReq):
        async with lock:
            s = load()
            for m in s["roadmap"]["milestones"]:
                if m["id"] == req.id:
                    m["done"] = not m.get("done")
            save(s)
        return s["roadmap"]

    @app.post("/api/mentor/networth")
    async def networth_add(req: NetWorthReq):
        if not req.amount.strip():
            raise HTTPException(status_code=400, detail="Enter an amount.")
        async with lock:
            s = load()
            s["networth"].append({"id": new_id(), "date": date.today().isoformat(), "amount": req.amount.strip()[:40],
                                  "note": req.note.strip()[:200]})
            save(s)
        return s["networth"]

    @app.post("/api/mentor/networth/delete")
    async def networth_delete(req: IdReq):
        async with lock:
            s = load()
            s["networth"] = [n for n in s["networth"] if n["id"] != req.id]
            save(s)
        return s["networth"]
