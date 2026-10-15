"""Amy AI — demo FastAPI backend (SQLite + SQLAlchemy).

Seeds realistic Bangladesh-context data so the Next.js frontend has
something meaningful to render end-to-end:
  - auth (login -> JWT), courses, enrollment
  - Amy chat history + SSE streaming replies
  - profile/streak/XP, notifications (polling), payments (bKash/Nagad/SSLCommerz)
  - admin analytics + manual payment verification queue
"""
from datetime import datetime, timedelta, timezone
import hashlib
import json
import random
import time
import uuid
from typing import Optional

from fastapi import FastAPI, Depends, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, String, Integer, Float, DateTime, Boolean, ForeignKey, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

# ---------------------------------------------------------------- database
engine = create_engine("sqlite:///./amy_demo.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True)
    full_name: Mapped[str] = mapped_column(String)          # frontend contract: full_name
    phone: Mapped[Optional[str]] = mapped_column(String, default=None)
    password_hash: Mapped[str] = mapped_column(String)
    xp_total: Mapped[int] = mapped_column(Integer, default=0)   # UserProgress.xp_total
    xp_today: Mapped[int] = mapped_column(Integer, default=0)   # reset daily in prod
    lessons_completed: Mapped[int] = mapped_column(Integer, default=0)
    streak_days: Mapped[int] = mapped_column(Integer, default=0)
    preferred_language: Mapped[str] = mapped_column(String, default="en")  # en | bn
    role: Mapped[str] = mapped_column(String, default="student")           # student | admin
    avatar_url: Mapped[Optional[str]] = mapped_column(String, default=None)
    last_active: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


class Course(Base):
    __tablename__ = "courses"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String)
    price_poisha: Mapped[int] = mapped_column(Integer, default=0)  # 0 = FREE
    lesson_count: Mapped[int] = mapped_column(Integer, default=10)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String, default=None)
    emoji: Mapped[str] = mapped_column(String, default="📘")


class Enrollment(Base):
    __tablename__ = "enrollments"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"))
    payment_id: Mapped[Optional[int]] = mapped_column(Integer, default=None)
    progress_percent: Mapped[float] = mapped_column(Float, default=0.0)
    enrolled_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    role: Mapped[str] = mapped_column(String)  # user | assistant
    content: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String)
    body: Mapped[str] = mapped_column(String)
    type: Mapped[str] = mapped_column(String, default="system")  # streak|payment|course|system
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"))
    method: Mapped[str] = mapped_column(String)  # sslcommerz | bkash | nagad
    amount_poisha: Mapped[int] = mapped_column(Integer)
    trx_id: Mapped[Optional[str]] = mapped_column(String, default=None)     # bKash/Nagad manual
    trans_id: Mapped[Optional[str]] = mapped_column(String, default=None)   # SSLCommerz
    sender_number: Mapped[Optional[str]] = mapped_column(String, default=None)
    status: Mapped[str] = mapped_column(String, default="pending")  # pending|processing|verified|failed|rejected
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class DailyXp(Base):
    __tablename__ = "daily_xp"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    day: Mapped[str] = mapped_column(String)  # YYYY-MM-DD
    xp: Mapped[int] = mapped_column(Integer, default=0)
    lessons: Mapped[int] = mapped_column(Integer, default=0)


Base.metadata.create_all(engine)

# ---------------------------------------------------------------- seed
def pw(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


def seed():
    with SessionLocal() as db:
        if db.query(User).count():
            return
        now = datetime.now(timezone.utc)
        demo = User(id=1, email="demo@amy.ai", full_name="Demo Student", phone="01711-111111",
                    password_hash=pw("demo1234"), xp_total=1240, xp_today=30, lessons_completed=18,
                    streak_days=7, preferred_language="en", role="student", last_active=now)
        admin = User(id=2, email="admin@amy.ai", full_name="Amy Admin", phone="01811-222222",
                     password_hash=pw("admin1234"), xp_total=9999, streak_days=30, role="admin",
                     last_active=now)
        rashid = User(id=3, email="rashid@gmail.com", full_name="Rashid Ahmed", phone="01911-333333",
                      password_hash=pw("rashid12"), xp_total=860, lessons_completed=9,
                      streak_days=3, last_active=now - timedelta(hours=5))
        nusrat = User(id=4, email="nusrat@gmail.com", full_name="Nusrat Jahan", phone="01611-444444",
                      password_hash=pw("nusrat12"), xp_total=2110, lessons_completed=27,
                      streak_days=14, last_active=now - timedelta(hours=1))
        db.add_all([demo, admin, rashid, nusrat])

        courses = [
            Course(id=1, title="HSC Physics 1st Paper", description="Vectors, dynamics, work-energy, gravitation — full HSC syllabus with Amy's step-by-step tutoring.", category="HSC", price_poisha=0, lesson_count=42, emoji="⚛️"),
            Course(id=2, title="HSC Higher Math", description="Calculus, matrices, vectors, analytic geometry. Bengali medium support.", category="HSC", price_poisha=49900, lesson_count=56, emoji="📐"),
            Course(id=3, title="SSC ICT", description="NCTB ICT book coverage — digital world, networks, programming basics.", category="SSC", price_poisha=0, lesson_count=24, emoji="💻"),
            Course(id=4, title="BCS Preliminary Question Bank", description="BCS preliminary MCQ drills with explanations. Adaptive difficulty.", category="Job Prep", price_poisha=99900, lesson_count=120, emoji="🏛️"),
            Course(id=5, title="Python for Beginners", description="Learn Python from zero — variables to OOP, with Amy as your pair programmer.", category="Programming", price_poisha=149900, lesson_count=38, emoji="🐍"),
            Course(id=6, title="Spoken English for BD Students", description="Daily conversation practice with Amy. Fix common Bangla-speaker mistakes.", category="Language", price_poisha=29900, lesson_count=30, emoji="🗣️"),
            Course(id=7, title="University Admission Math (BUET)", description="Problem-solving marathon for BUET/DU/MUST admission tests.", category="University", price_poisha=19900, lesson_count=48, emoji="🎓"),
            Course(id=8, title="HTML & CSS Web Basics", description="Build your first website. Project-based, mobile friendly.", category="Programming", price_poisha=0, lesson_count=20, emoji="🌐"),
        ]
        db.add_all(courses)

        db.add_all([
            Enrollment(user_id=1, course_id=1, progress_percent=62.0),
            Enrollment(user_id=1, course_id=3, progress_percent=100.0),
            Enrollment(user_id=1, course_id=8, progress_percent=25.0),
            Enrollment(user_id=3, course_id=2, progress_percent=40.0),
            Enrollment(user_id=4, course_id=5, progress_percent=80.0),
        ])

        db.add_all([
            ChatMessage(user_id=1, role="user", content="Amy, explain Newton's second law for my HSC physics?", created_at=now - timedelta(minutes=30)),
            ChatMessage(user_id=1, role="assistant", content="Sure! F = ma means the net force on an object equals its mass times acceleration. Example: pushing a 5 kg box with 20 N gives a = 20/5 = 4 m/s². Want a numerical practice problem?", created_at=now - timedelta(minutes=29)),
        ])

        db.add_all([
            Notification(user_id=1, title="🔥 Streak at risk!", body="Study 1 lesson to keep your 7-day streak alive.", type="streak", created_at=now - timedelta(hours=2)),
            Notification(user_id=1, title="Payment verified ✅", body="Your bKash payment for 'University Admission Math' was confirmed by admin.", type="payment", created_at=now - timedelta(days=1)),
            Notification(user_id=1, title="New course: Spoken English", body="Amy can now do live conversation practice in English.", type="course", read=True, created_at=now - timedelta(days=2)),
        ])

        db.add_all([
            Payment(user_id=1, course_id=7, method="bkash", amount_poisha=19900, trx_id="BKS8H3F2KD1", sender_number="01711111111", status="verified", verified_at=now - timedelta(days=1), created_at=now - timedelta(days=1)),
            Payment(user_id=3, course_id=2, method="nagad", amount_poisha=49900, trx_id="NGD9X1M2PQ7", sender_number="01911333333", status="pending", created_at=now - timedelta(hours=6)),
            Payment(user_id=4, course_id=5, method="sslcommerz", amount_poisha=149900, trans_id="SSLC-A77X91", status="verified", verified_at=now - timedelta(days=3), created_at=now - timedelta(days=3)),
            Payment(user_id=3, course_id=4, method="bkash", amount_poisha=99900, trx_id="BKS2QQ8WZ4T", sender_number="01911333333", status="pending", created_at=now - timedelta(hours=2)),
        ])

        # XP history for the last 14 days (for the Progress chart)
        for uid, base in [(1, 90), (3, 60), (4, 120)]:
            for i in range(14):
                d = (now - timedelta(days=13 - i)).strftime("%Y-%m-%d")
                rng = random.Random(uid * 100 + i)
                if rng.random() < 0.8:
                    db.add(DailyXp(user_id=uid, day=d, xp=base + rng.randint(-30, 60),
                                   lessons=rng.randint(1, 5)))
        db.commit()


seed()

# ---------------------------------------------------------------- app
app = FastAPI(title="Amy AI Demo Backend")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

TOKENS: dict[str, int] = {}  # token -> user_id


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def current_user(authorization: Optional[str] = Header(None),
                 x_token: Optional[str] = Header(None, alias="x-token"),
                 db=Depends(get_db)) -> User:
    tok = authorization.removeprefix("Bearer ").strip() if authorization else x_token
    uid = TOKENS.get(tok) if tok else None
    if not uid:
        raise HTTPException(401, "Not authenticated")
    u = db.get(User, uid)
    if not u:
        raise HTTPException(401, "User not found")
    return u


class LoginIn(BaseModel):
    email: str
    password: str


class RegisterIn(LoginIn):
    name: str


class ProfileIn(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    preferred_language: Optional[str] = None


class ChatIn(BaseModel):
    message: str
    session_id: Optional[int] = None


class EnrollIn(BaseModel):
    course_id: int


class PaymentIn(BaseModel):
    course_id: int
    method: Optional[str] = None
    trx_id: Optional[str] = None
    sender_number: Optional[str] = None


class VerifyIn(BaseModel):
    action: str  # verify | reject


def _user_out(u: User):
    return {"id": u.id, "email": u.email, "full_name": u.full_name, "phone": u.phone,
            "xp_total": u.xp_total, "streak_days": u.streak_days,
            "preferred_language": u.preferred_language, "role": u.role,
            "avatar_url": u.avatar_url}


def _course_out(c: Course):
    return {"id": c.id, "title": c.title, "description": c.description, "category": c.category,
            "price_poisha": c.price_poisha, "lesson_count": c.lesson_count,
            "thumbnail_url": c.thumbnail_url, "emoji": c.emoji}


def _payment_out(p: Payment):
    return {"id": p.id, "user_id": p.user_id, "course_id": p.course_id, "method": p.method,
            "amount_poisha": p.amount_poisha, "trx_id": p.trx_id, "trans_id": p.trans_id,
            "sender_number": p.sender_number, "status": p.status,
            "created_at": p.created_at.isoformat(),
            "verified_at": p.verified_at.isoformat() if p.verified_at else None}


# ---------------------------------------------------------------- routes
@app.get("/health")
def health():
    return {"status": "ok", "service": "amy-ai-backend"}


@app.post("/auth/register")
def register(body: RegisterIn, db=Depends(get_db)):
    if db.scalar(select(User).where(User.email == body.email)):
        raise HTTPException(400, "Email already registered")
    u = User(email=body.email, full_name=body.name, password_hash=pw(body.password))
    db.add(u); db.commit(); db.refresh(u)
    tok = uuid.uuid4().hex
    TOKENS[tok] = u.id
    return {"token": tok, "user": _user_out(u)}


@app.post("/auth/login")
def login(body: LoginIn, db=Depends(get_db)):
    u = db.scalar(select(User).where(User.email == body.email))
    if not u or u.password_hash != pw(body.password):
        raise HTTPException(401, "Invalid credentials")
    tok = uuid.uuid4().hex
    TOKENS[tok] = u.id
    return {"token": tok, "user": _user_out(u)}


@app.get("/auth/me")
def me(u: User = Depends(current_user)):
    return _user_out(u)


# frontend uses PATCH /users/me (profile page)
@app.patch("/users/me")
@app.put("/users/me")
def update_users_me(body: ProfileIn, db=Depends(get_db), u: User = Depends(current_user)):
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(u, k, v)
    db.commit(); db.refresh(u)
    return _user_out(u)


@app.get("/courses")
@app.get("/courses/")
def list_courses(category: Optional[str] = None, db=Depends(get_db)):
    q = select(Course)
    if category and category.lower() != "all":
        q = q.where(Course.category == category)
    rows = db.scalars(q).all()
    return [_course_out(c) for c in rows]


# GET /courses/enrollments — dashboard "continue learning" list.
# Declared BEFORE /courses/{cid} so the literal path wins over the int route.
@app.get("/courses/enrollments")
@app.get("/enrollments")
def my_enrollments(db=Depends(get_db), u: User = Depends(current_user)):
    rows = db.scalars(select(Enrollment).where(Enrollment.user_id == u.id)).all()
    return [{"id": e.id, "user_id": e.user_id, "course_id": e.course_id,
             "payment_id": e.payment_id, "enrolled_at": e.enrolled_at.isoformat(),
             "progress_percent": e.progress_percent} for e in rows]


@app.get("/courses/{cid}")
def course_detail(cid: int, db=Depends(get_db), u: User = Depends(current_user)):
    c = db.get(Course, cid)
    if not c:
        raise HTTPException(404, "Course not found")
    enr = db.scalar(select(Enrollment).where(Enrollment.user_id == u.id, Enrollment.course_id == cid))
    return {**_course_out(c), "enrolled": bool(enr),
            "progress_percent": enr.progress_percent if enr else 0.0}


@app.post("/enrollments")
def enroll(body: EnrollIn, db=Depends(get_db), u: User = Depends(current_user)):
    c = db.get(Course, body.course_id)
    if not c:
        raise HTTPException(404, "Course not found")
    if db.scalar(select(Enrollment).where(Enrollment.user_id == u.id, Enrollment.course_id == c.id)):
        raise HTTPException(400, "Already enrolled")
    if c.price_poisha > 0:
        paid = db.scalar(select(Payment).where(Payment.user_id == u.id, Payment.course_id == c.id,
                                               Payment.status == "verified"))
        if not paid:
            raise HTTPException(402, "Payment required before enrolling in this paid course")
    e = Enrollment(user_id=u.id, course_id=c.id)
    db.add(e)
    db.add(Notification(user_id=u.id, title="🎉 Enrolled!", body=f"You're in: {c.title}", type="course"))
    db.commit()
    return {"ok": True, "course_id": c.id}


@app.get("/profile")
def profile(u: User = Depends(current_user)):
    level = u.xp_total // 500 + 1
    return {**_user_out(u), "level": level, "xp_into_level": u.xp_total % 500, "xp_per_level": 500}


@app.put("/profile")
def update_profile(body: ProfileIn, db=Depends(get_db), u: User = Depends(current_user)):
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(u, k, v)
    db.commit(); db.refresh(u)
    return _user_out(u)


# XpBar polls /profile/me/progress → UserProgress shape
@app.get("/profile/me/progress")
def progress_summary(u: User = Depends(current_user)):
    return {"user_id": u.id, "xp_total": u.xp_total, "xp_today": u.xp_today,
            "streak_days": u.streak_days, "lessons_completed": u.lessons_completed,
            "last_active_date": u.last_active.isoformat()}


@app.get("/notifications")
@app.get("/notifications/")
def notifications(db=Depends(get_db), u: User = Depends(current_user)):
    rows = db.scalars(select(Notification).where(Notification.user_id == u.id)
                      .order_by(Notification.created_at.desc())).all()
    return [{"id": n.id, "user_id": n.user_id, "title": n.title, "body": n.body, "type": n.type,
             "read": n.read, "created_at": n.created_at.isoformat()} for n in rows]


@app.patch("/notifications/{nid}/read")
@app.post("/notifications/{nid}/read")
def mark_read(nid: int, db=Depends(get_db), u: User = Depends(current_user)):
    n = db.get(Notification, nid)
    if n and n.user_id == u.id:
        n.read = True; db.commit()
    return {"ok": True}


@app.get("/chat/history")
def chat_history(db=Depends(get_db), u: User = Depends(current_user)):
    rows = db.scalars(select(ChatMessage).where(ChatMessage.user_id == u.id)
                      .order_by(ChatMessage.created_at)).all()
    return [{"id": m.id, "session_id": 1, "role": m.role, "content": m.content,
             "created_at": m.created_at.isoformat()} for m in rows]



AMY_REPLIES = {
    "physics": "Great question! In HSC Physics, break it into: (1) identify the concept, (2) write the formula, (3) plug in units carefully. Example — for projectile motion, horizontal velocity stays constant while vertical changes by g = 9.8 m/s². Try this: a ball thrown at 20 m/s at 30° — what's its max height?",
    "math": "Let's solve it step by step 🧮 First, what we know; then the relevant theorem; then compute. For integration by parts remember ILATE order. Want me to generate 3 practice problems like your exam?",
    "english": "Let's practice! Repeat after me: 'I have been studying for two hours.' Notice present perfect continuous — very common in HSC writing tasks. Your turn: tell me about your day in 3 sentences and I'll correct them.",
    "default": "I'm Amy, your study buddy! 🎓 Tell me which subject — Physics, Higher Math, ICT, or English — and paste the exact problem. I'll explain it in Bangla or English, your choice. What are we studying today?",
}


def amy_reply(text: str) -> str:
    t = text.lower()
    if any(k in t for k in ("physics", "newton", "force", "motion")):
        return AMY_REPLIES["physics"]
    if any(k in t for k in ("math", "calculus", "integrat", "matrix", "vector")):
        return AMY_REPLIES["math"]
    if any(k in t for k in ("english", "speak", "grammar", "sentence")):
        return AMY_REPLIES["english"]
    return AMY_REPLIES["default"]


def _award_xp(db, u: User, xp: int):
    """Add XP to the user + today's DailyXp row (single source of truth)."""
    u.xp_total += xp
    u.xp_today += xp
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    dx = db.scalar(select(DailyXp).where(DailyXp.user_id == u.id, DailyXp.day == day))
    if dx:
        dx.xp += xp
    else:
        db.add(DailyXp(user_id=u.id, day=day, xp=xp, lessons=1))


@app.post("/chat/send")
def chat_send(body: ChatIn, db=Depends(get_db), u: User = Depends(current_user)):
    db.add(ChatMessage(user_id=u.id, role="user", content=body.message))
    reply = amy_reply(body.message)
    db.add(ChatMessage(user_id=u.id, role="assistant", content=reply))
    _award_xp(db, u, 10)
    db.commit()

    # Stream the reply word-by-word via SSE (ChatGPT-style typing effect)
    def gen():
        for w in reply.split(" "):
            yield f"data: {json.dumps({'token': w + ' '})}\n\n"
            time.sleep(0.05)
        yield "data: [DONE]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")


# ---------------------------------------------------------------- Amy routes
# Frontend calls /amy/sessions, /amy/chat, /amy/chat/stream — demo backend
# keeps a single implicit session per user (session_id = user_id).
@app.get("/amy/sessions")
def amy_sessions(u: User = Depends(current_user)):
    return [{"id": u.id, "user_id": u.id, "title": "Study with Amy",
             "subject": None, "created_at": u.created_at.isoformat()}]


@app.get("/amy/sessions/{sid}")
def amy_session_detail(sid: int, db=Depends(get_db), u: User = Depends(current_user)):
    rows = db.scalars(select(ChatMessage).where(ChatMessage.user_id == u.id)
                      .order_by(ChatMessage.created_at)).all()
    return {"id": sid, "user_id": u.id, "title": "Study with Amy", "subject": None,
            "created_at": u.created_at.isoformat(),
            "messages": [{"id": m.id, "session_id": sid, "role": m.role,
                          "content": m.content, "created_at": m.created_at.isoformat()} for m in rows]}


def _amy_chat(db, u: User, body: ChatIn):
    db.add(ChatMessage(user_id=u.id, role="user", content=body.message))
    reply_text = amy_reply(body.message)
    bot = ChatMessage(user_id=u.id, role="assistant", content=reply_text)
    db.add(bot)
    _award_xp(db, u, 10)
    db.commit()
    db.refresh(bot)
    return {"message": {"id": bot.id, "session_id": u.id, "role": "assistant",
                        "content": bot.content, "created_at": bot.created_at.isoformat()},
            "session_id": u.id}


@app.post("/amy/chat")
def amy_chat(db=Depends(get_db), u: User = Depends(current_user), body: ChatIn = None):
    return _amy_chat(db, u, body)


@app.post("/amy/chat/stream")
def amy_chat_stream(db=Depends(get_db), u: User = Depends(current_user), body: ChatIn = None):
    result = _amy_chat(db, u, body)
    reply = result["message"]["content"]

    def gen():
        yield f"data: {json.dumps({'session_id': result['session_id']})}\n\n"
        for w in reply.split(" "):
            yield f"data: {json.dumps({'token': w + ' '})}\n\n"
            time.sleep(0.04)
        yield "data: [DONE]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")


# ------------------------------------------------------------- Analytics routes
@app.get("/analytics/me/daily-xp")
def my_daily_xp(db=Depends(get_db), u: User = Depends(current_user)):
    days = db.scalars(select(DailyXp).where(DailyXp.user_id == u.id).order_by(DailyXp.day)).all()
    return [{"date": d.day, "xp": d.xp, "lessons": d.lessons} for d in days]


@app.get("/analytics/admin/summary")
def admin_summary(db=Depends(get_db), admin: User = Depends(current_user)):
    if not admin.is_admin:
        raise HTTPException(403, "Admin only")
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    users = db.query(User).count()
    active_today = sum(1 for x in db.query(User).all()
                       if x.last_active.astimezone(timezone.utc).strftime("%Y-%m-%d") == today)
    revenue = sum(p.amount_poisha for p in db.query(Payment).filter(Payment.status == "verified"))
    pending = db.query(Payment).filter(Payment.status == "pending").count()
    enrollments = db.query(Enrollment).count()
    return {"total_users": users, "active_today": active_today,
            "total_revenue_poisha": revenue, "pending_payments": pending,
            "total_enrollments": enrollments}


@app.get("/progress")
def progress(db=Depends(get_db), u: User = Depends(current_user)):
    days = db.scalars(select(DailyXp).where(DailyXp.user_id == u.id).order_by(DailyXp.day)).all()
    enrs = db.scalars(select(Enrollment).where(Enrollment.user_id == u.id)).all()
    out = []
    for e in enrs:
        c = db.get(Course, e.course_id)
        out.append({"course": c.title, "emoji": c.emoji, "pct": e.progress_percent,
                    "lessons_done": int(c.lesson_count * e.progress_percent / 100),
                    "lessons_total": c.lesson_count})
    return {"user_id": u.id, "xp_total": u.xp_total, "xp_today": u.xp_today,
            "streak_days": u.streak_days, "lessons_completed": u.lessons_completed,
            "last_active_date": u.last_active.isoformat(),
            "xp_history": [{"day": d.day, "xp": d.xp, "lessons": d.lessons} for d in days],
            "course_progress": out}


# ---------------------------------------------------------------- payments
def _create_payment(body: PaymentIn, method: str, db, u: User):
    c = db.get(Course, body.course_id)
    if not c:
        raise HTTPException(404, "Course not found")
    if method == "sslcommerz":
        tid = f"SSLC-{uuid.uuid4().hex[:8].upper()}"
        p = Payment(user_id=u.id, course_id=c.id, method="sslcommerz", amount_poisha=c.price_poisha,
                    trans_id=tid, status="pending")
        db.add(p); db.commit(); db.refresh(p)
        return {"redirect_url": f"https://sandbox.sslcommerz.com/gwprocess/v4/paymentgw.php?dummy={tid}",
                "payment_id": p.id, "method": "sslcommerz"}
    if method in ("bkash", "nagad"):
        if not body.trx_id:
            raise HTTPException(400, "TrxID required for manual payment methods")
        dup = db.scalar(select(Payment).where(Payment.trx_id == body.trx_id))
        if dup:
            raise HTTPException(409, "This TrxID has already been submitted")  # idempotency
        p = Payment(user_id=u.id, course_id=c.id, method=method, amount_poisha=c.price_poisha,
                    trx_id=body.trx_id, sender_number=body.sender_number, status="pending")
        db.add(p); db.commit(); db.refresh(p)
        db.add(Notification(user_id=u.id, title="Payment submitted ⏳",
                            body=f"{method.upper()} payment of ৳{c.price_poisha / 100:.0f} is awaiting verification.",
                            type="payment"))
        db.commit()
        return _payment_out(p)
    raise HTTPException(400, "Unknown payment method")


@app.post("/payments")
def create_payment(body: PaymentIn, db=Depends(get_db), u: User = Depends(current_user)):
    return _create_payment(body, body.method or "", db, u)


@app.post("/payments/manual")
def create_manual_payment(body: PaymentIn, db=Depends(get_db), u: User = Depends(current_user)):
    return _create_payment(body, body.method or "bkash", db, u)


@app.post("/payments/sslcommerz/init")
def init_sslcommerz(body: PaymentIn, db=Depends(get_db), u: User = Depends(current_user)):
    return _create_payment(body, "sslcommerz", db, u)


@app.get("/payments")
@app.get("/payments/mine")
def my_payments(db=Depends(get_db), u: User = Depends(current_user)):
    rows = db.scalars(select(Payment).where(Payment.user_id == u.id)
                      .order_by(Payment.created_at.desc())).all()
    return [_payment_out(p) for p in rows]


# GET /payments/admin?status=pending — admin verification queue
@app.get("/payments/admin")
def admin_payment_queue(status: Optional[str] = None, db=Depends(get_db),
                        admin: User = Depends(current_user)):
    if not admin.is_admin:
        raise HTTPException(403, "Admin only")
    q = select(Payment)
    if status:
        q = q.where(Payment.status == status)
    rows = db.scalars(q.order_by(Payment.created_at)).all()
    return [_payment_out(p) for p in rows]


# POST /payments/admin/{pid}/verify|reject  (+ legacy /admin/payments/{pid}/verify)
@app.post("/payments/admin/{pid}/{action}")
def admin_verify_payment(pid: int, action: str, db=Depends(get_db),
                         admin: User = Depends(current_user)):
    if action not in ("verify", "reject"):
        raise HTTPException(400, "action must be verify|reject")
    return _verify_payment(pid, VerifyIn(action=action), db, admin)


@app.post("/admin/payments/{pid}/verify")
def verify_payment(pid: int, body: VerifyIn, db=Depends(get_db),
                   admin: User = Depends(current_user)):
    return _verify_payment(pid, body, db, admin)


def _verify_payment(pid: int, body: VerifyIn, db, admin: User):
    if not admin.is_admin:
        raise HTTPException(403, "Admin only")
    p = db.get(Payment, pid)
    if not p:
        raise HTTPException(404, "Payment not found")
    if p.status != "pending":
        raise HTTPException(400, f"Payment already {p.status}")
    p.status = "verified" if body.action == "verify" else "rejected"
    if p.status == "verified":
        p.verified_at = datetime.now(timezone.utc)
        exists = db.scalar(select(Enrollment).where(Enrollment.user_id == p.user_id,
                                                    Enrollment.course_id == p.course_id))
        if not exists:
            db.add(Enrollment(user_id=p.user_id, course_id=p.course_id, payment_id=p.id))
    db.add(Notification(user_id=p.user_id,
                        title="Payment " + ("verified ✅" if p.status == "verified" else "rejected ❌"),
                        body=f"Transaction {p.trx_id or p.trans_id} ({p.method}) — {p.status}.",
                        type="payment"))
    db.commit()
    return {"ok": True, "status": p.status}


# Legacy admin analytics kept for older clients
@app.get("/admin/analytics")
def admin_analytics(db=Depends(get_db), admin: User = Depends(current_user)):
    if not admin.is_admin:
        raise HTTPException(403, "Admin only")
    users = db.query(User).count()
    revenue = sum(p.amount_poisha for p in db.query(Payment).filter(Payment.status == "verified"))
    pending = db.query(Payment).filter(Payment.status == "pending").count()
    enrollments = db.query(Enrollment).count()
    queue = db.scalars(select(Payment).where(Payment.status == "pending")
                       .order_by(Payment.created_at)).all()
    qout = []
    for p in queue:
        usr = db.get(User, p.user_id)
        qout.append({"id": p.id, "user_name": usr.full_name,
                     "course_title": db.get(Course, p.course_id).title,
                     "method": p.method, "amount_poisha": p.amount_poisha, "trx_id": p.trx_id,
                     "sender_number": p.sender_number, "created_at": p.created_at.isoformat()})
    return {"total_users": users, "verified_revenue_poisha": revenue, "pending_payments": pending,
            "total_enrollments": enrollments, "verification_queue": qout}
