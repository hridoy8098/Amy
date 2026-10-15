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
    name: Mapped[str] = mapped_column(String)
    phone: Mapped[Optional[str]] = mapped_column(String, default=None)
    password_hash: Mapped[str] = mapped_column(String)
    xp: Mapped[int] = mapped_column(Integer, default=0)
    streak_days: Mapped[int] = mapped_column(Integer, default=0)
    language: Mapped[str] = mapped_column(String, default="en")
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    last_active: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class Course(Base):
    __tablename__ = "courses"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String)
    price_paisa: Mapped[int] = mapped_column(Integer, default=0)  # 0 = FREE
    lessons_count: Mapped[int] = mapped_column(Integer, default=10)
    emoji: Mapped[str] = mapped_column(String, default="📘")


class Enrollment(Base):
    __tablename__ = "enrollments"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"))
    progress_pct: Mapped[float] = mapped_column(Float, default=0.0)
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
    kind: Mapped[str] = mapped_column(String, default="info")
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"))
    method: Mapped[str] = mapped_column(String)  # sslcommerz | bkash | nagad
    amount_paisa: Mapped[int] = mapped_column(Integer)
    trx_id: Mapped[Optional[str]] = mapped_column(String, default=None)
    sender_number: Mapped[Optional[str]] = mapped_column(String, default=None)
    status: Mapped[str] = mapped_column(String, default="pending")  # pending|verified|rejected
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
        demo = User(id=1, email="demo@amy.ai", name="Demo Student", phone="01711-111111",
                    password_hash=pw("demo1234"), xp=1240, streak_days=7, language="en",
                    last_active=now)
        admin = User(id=2, email="admin@amy.ai", name="Amy Admin", phone="01811-222222",
                     password_hash=pw("admin1234"), xp=9999, streak_days=30, is_admin=True,
                     last_active=now)
        rashid = User(id=3, email="rashid@gmail.com", name="Rashid Ahmed", phone="01911-333333",
                      password_hash=pw("rashid12"), xp=860, streak_days=3, last_active=now - timedelta(hours=5))
        nusrat = User(id=4, email="nusrat@gmail.com", name="Nusrat Jahan", phone="01611-444444",
                      password_hash=pw("nusrat12"), xp=2110, streak_days=14, last_active=now - timedelta(hours=1))
        db.add_all([demo, admin, rashid, nusrat])

        courses = [
            Course(id=1, title="HSC Physics 1st Paper", description="Vectors, dynamics, work-energy, gravitation — full HSC syllabus with Amy's step-by-step tutoring.", category="HSC", price_paisa=0, lessons_count=42, emoji="⚛️"),
            Course(id=2, title="HSC Higher Math", description="Calculus, matrices, vectors, analytic geometry. Bengali medium support.", category="HSC", price_paisa=49900, lessons_count=56, emoji="📐"),
            Course(id=3, title="SSC ICT", description="NCTB ICT book coverage — digital world, networks, programming basics.", category="SSC", price_paisa=0, lessons_count=24, emoji="💻"),
            Course(id=4, title="BCS Preliminary Question Bank", description="BCS preliminary MCQ drills with explanations. Adaptive difficulty.", category="Job Prep", price_paisa=99900, lessons_count=120, emoji="🏛️"),
            Course(id=5, title="Python for Beginners", description="Learn Python from zero — variables to OOP, with Amy as your pair programmer.", category="Programming", price_paisa=149900, lessons_count=38, emoji="🐍"),
            Course(id=6, title="Spoken English for BD Students", description="Daily conversation practice with Amy. Fix common Bangla-speaker mistakes.", category="Language", price_paisa=29900, lessons_count=30, emoji="🗣️"),
            Course(id=7, title="University Admission Math (BUET)", description="Problem-solving marathon for BUET/DU/MUST admission tests.", category="University", price_paisa=19900, lessons_count=48, emoji="🎓"),
            Course(id=8, title="HTML & CSS Web Basics", description="Build your first website. Project-based, mobile friendly.", category="Programming", price_paisa=0, lessons_count=20, emoji="🌐"),
        ]
        db.add_all(courses)

        db.add_all([
            Enrollment(user_id=1, course_id=1, progress_pct=62.0),
            Enrollment(user_id=1, course_id=3, progress_pct=100.0),
            Enrollment(user_id=1, course_id=8, progress_pct=25.0),
            Enrollment(user_id=3, course_id=2, progress_pct=40.0),
            Enrollment(user_id=4, course_id=5, progress_pct=80.0),
        ])

        db.add_all([
            ChatMessage(user_id=1, role="user", content="Amy, explain Newton's second law for my HSC physics?", created_at=now - timedelta(minutes=30)),
            ChatMessage(user_id=1, role="assistant", content="Sure! F = ma means the net force on an object equals its mass times acceleration. Example: pushing a 5 kg box with 20 N gives a = 20/5 = 4 m/s². Want a numerical practice problem?", created_at=now - timedelta(minutes=29)),
        ])

        db.add_all([
            Notification(user_id=1, title="🔥 Streak at risk!", body="Study 1 lesson to keep your 7-day streak alive.", kind="streak", created_at=now - timedelta(hours=2)),
            Notification(user_id=1, title="Payment verified ✅", body="Your bKash payment for 'University Admission Math' was confirmed by admin.", kind="payment", created_at=now - timedelta(days=1)),
            Notification(user_id=1, title="New course: Spoken English", body="Amy can now do live conversation practice in English.", kind="info", read=True, created_at=now - timedelta(days=2)),
        ])

        db.add_all([
            Payment(user_id=1, course_id=7, method="bkash", amount_paisa=19900, trx_id="BKS8H3F2KD1", sender_number="01711111111", status="verified", created_at=now - timedelta(days=1)),
            Payment(user_id=3, course_id=2, method="nagad", amount_paisa=49900, trx_id="NGD9X1M2PQ7", sender_number="01911333333", status="pending", created_at=now - timedelta(hours=6)),
            Payment(user_id=4, course_id=5, method="sslcommerz", amount_paisa=149900, trx_id="SSLC-A77X91", status="verified", created_at=now - timedelta(days=3)),
            Payment(user_id=3, course_id=4, method="bkash", amount_paisa=99900, trx_id="BKS2QQ8WZ4T", sender_number="01911333333", status="pending", created_at=now - timedelta(hours=2)),
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
    name: Optional[str] = None
    phone: Optional[str] = None
    language: Optional[str] = None


class ChatIn(BaseModel):
    message: str


class EnrollIn(BaseModel):
    course_id: int


class PaymentIn(BaseModel):
    course_id: int
    method: str
    trx_id: Optional[str] = None
    sender_number: Optional[str] = None


class VerifyIn(BaseModel):
    action: str  # verify | reject


def _user_out(u: User):
    return {"id": u.id, "email": u.email, "name": u.name, "phone": u.phone,
            "xp": u.xp, "streak_days": u.streak_days, "language": u.language,
            "is_admin": u.is_admin}


# ---------------------------------------------------------------- routes
@app.get("/health")
def health():
    return {"status": "ok", "service": "amy-ai-backend"}


@app.post("/auth/register")
def register(body: RegisterIn, db=Depends(get_db)):
    if db.scalar(select(User).where(User.email == body.email)):
        raise HTTPException(400, "Email already registered")
    u = User(email=body.email, name=body.name, password_hash=pw(body.password))
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


@app.get("/courses")
def list_courses(category: Optional[str] = None, db=Depends(get_db)):
    q = select(Course)
    if category and category.lower() != "all":
        q = q.where(Course.category == category)
    rows = db.scalars(q).all()
    return [{"id": c.id, "title": c.title, "description": c.description, "category": c.category,
             "price_paisa": c.price_paisa, "lessons_count": c.lessons_count, "emoji": c.emoji} for c in rows]


@app.get("/courses/{cid}")
def course_detail(cid: int, db=Depends(get_db), u: User = Depends(current_user)):
    c = db.get(Course, cid)
    if not c:
        raise HTTPException(404, "Course not found")
    enr = db.scalar(select(Enrollment).where(Enrollment.user_id == u.id, Enrollment.course_id == cid))
    return {"id": c.id, "title": c.title, "description": c.description, "category": c.category,
            "price_paisa": c.price_paisa, "lessons_count": c.lessons_count, "emoji": c.emoji,
            "enrolled": bool(enr), "progress_pct": enr.progress_pct if enr else 0.0}


@app.post("/enrollments")
def enroll(body: EnrollIn, db=Depends(get_db), u: User = Depends(current_user)):
    c = db.get(Course, body.course_id)
    if not c:
        raise HTTPException(404, "Course not found")
    if db.scalar(select(Enrollment).where(Enrollment.user_id == u.id, Enrollment.course_id == c.id)):
        raise HTTPException(400, "Already enrolled")
    if c.price_paisa > 0:
        paid = db.scalar(select(Payment).where(Payment.user_id == u.id, Payment.course_id == c.id,
                                               Payment.status == "verified"))
        if not paid:
            raise HTTPException(402, "Payment required before enrolling in this paid course")
    e = Enrollment(user_id=u.id, course_id=c.id)
    db.add(e)
    db.add(Notification(user_id=u.id, title="🎉 Enrolled!", body=f"You're in: {c.title}", kind="info"))
    db.commit()
    return {"ok": True, "course_id": c.id}


@app.get("/profile")
def profile(u: User = Depends(current_user)):
    level = u.xp // 500 + 1
    return {**_user_out(u), "level": level, "xp_into_level": u.xp % 500, "xp_per_level": 500}


@app.put("/profile")
def update_profile(body: ProfileIn, db=Depends(get_db), u: User = Depends(current_user)):
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(u, k, v)
    db.commit(); db.refresh(u)
    return _user_out(u)


@app.get("/notifications")
def notifications(db=Depends(get_db), u: User = Depends(current_user)):
    rows = db.scalars(select(Notification).where(Notification.user_id == u.id)
                      .order_by(Notification.created_at.desc())).all()
    return {"items": [{"id": n.id, "title": n.title, "body": n.body, "kind": n.kind,
                       "read": n.read, "created_at": n.created_at.isoformat()} for n in rows],
            "unread_count": sum(1 for n in rows if not n.read)}


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
    return [{"id": m.id, "role": m.role, "content": m.content,
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


@app.post("/chat/send")
def chat_send(body: ChatIn, db=Depends(get_db), u: User = Depends(current_user)):
    db.add(ChatMessage(user_id=u.id, role="user", content=body.message))
    reply = amy_reply(body.message)
    db.add(ChatMessage(user_id=u.id, role="assistant", content=reply))
    u.xp += 10
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    dx = db.scalar(select(DailyXp).where(DailyXp.user_id == u.id, DailyXp.day == day))
    if dx:
        dx.xp += 10
    else:
        db.add(DailyXp(user_id=u.id, day=day, xp=10, lessons=1))
    db.commit()

    # Stream the reply word-by-word via SSE (ChatGPT-style typing effect)
    def gen():
        for w in reply.split(" "):
            yield f"data: {json.dumps({'delta': w + ' '})}\n\n"
            time.sleep(0.05)
        yield "data: [DONE]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")


@app.get("/progress")
def progress(db=Depends(get_db), u: User = Depends(current_user)):
    days = db.scalars(select(DailyXp).where(DailyXp.user_id == u.id).order_by(DailyXp.day)).all()
    enrs = db.scalars(select(Enrollment).where(Enrollment.user_id == u.id)).all()
    out = []
    for e in enrs:
        c = db.get(Course, e.course_id)
        out.append({"course": c.title, "emoji": c.emoji, "pct": e.progress_pct,
                    "lessons_done": int(c.lessons_count * e.progress_pct / 100),
                    "lessons_total": c.lessons_count})
    return {"xp_history": [{"day": d.day, "xp": d.xp, "lessons": d.lessons} for d in days],
            "course_progress": out, "total_xp": u.xp, "streak": u.streak_days}


@app.post("/payments")
def create_payment(body: PaymentIn, db=Depends(get_db), u: User = Depends(current_user)):
    c = db.get(Course, body.course_id)
    if not c:
        raise HTTPException(404, "Course not found")
    if body.method == "sslcommerz":
        p = Payment(user_id=u.id, course_id=c.id, method="sslcommerz", amount_paisa=c.price_paisa,
                    trx_id=f"SSLC-{uuid.uuid4().hex[:8].upper()}", status="pending")
        db.add(p); db.commit(); db.refresh(p)
        return {"redirect_url": f"https://sandbox.sslcommerz.com/gwprocess/v4/paymentgw.php?dummy={p.trx_id}",
                "payment_id": p.id, "method": "sslcommerz"}
    if body.method in ("bkash", "nagad"):
        if not body.trx_id:
            raise HTTPException(400, "TrxID required for manual payment methods")
        dup = db.scalar(select(Payment).where(Payment.trx_id == body.trx_id))
        if dup:
            raise HTTPException(409, "This TrxID has already been submitted")  # idempotency
        p = Payment(user_id=u.id, course_id=c.id, method=body.method, amount_paisa=c.price_paisa,
                    trx_id=body.trx_id, sender_number=body.sender_number, status="pending")
        db.add(p); db.commit(); db.refresh(p)
        db.add(Notification(user_id=u.id, title="Payment submitted ⏳",
                            body=f"{body.method.upper()} payment of ৳{c.price_paisa / 100:.0f} is awaiting verification.",
                            kind="payment"))
        db.commit()
        return {"payment_id": p.id, "status": "pending", "method": body.method}
    raise HTTPException(400, "Unknown payment method")


@app.get("/payments")
def my_payments(db=Depends(get_db), u: User = Depends(current_user)):
    rows = db.scalars(select(Payment).where(Payment.user_id == u.id)
                      .order_by(Payment.created_at.desc())).all()
    return [{"id": p.id, "course_id": p.course_id, "course_title": db.get(Course, p.course_id).title,
             "method": p.method, "amount_paisa": p.amount_paisa, "trx_id": p.trx_id,
             "status": p.status, "created_at": p.created_at.isoformat()} for p in rows]


@app.get("/admin/analytics")
def admin_analytics(db=Depends(get_db), admin: User = Depends(current_user)):
    if not admin.is_admin:
        raise HTTPException(403, "Admin only")
    users = db.query(User).count()
    revenue = sum(p.amount_paisa for p in db.query(Payment).filter(Payment.status == "verified"))
    pending = db.query(Payment).filter(Payment.status == "pending").count()
    enrollments = db.query(Enrollment).count()
    queue = db.scalars(select(Payment).where(Payment.status == "pending")
                       .order_by(Payment.created_at)).all()
    qout = []
    for p in queue:
        usr = db.get(User, p.user_id)
        qout.append({"id": p.id, "user_name": usr.name, "course_title": db.get(Course, p.course_id).title,
                     "method": p.method, "amount_paisa": p.amount_paisa, "trx_id": p.trx_id,
                     "sender_number": p.sender_number, "created_at": p.created_at.isoformat()})
    return {"total_users": users, "verified_revenue_paisa": revenue, "pending_payments": pending,
            "total_enrollments": enrollments, "verification_queue": qout}


@app.post("/admin/payments/{pid}/verify")
def verify_payment(pid: int, body: VerifyIn, db=Depends(get_db), admin: User = Depends(current_user)):
    if not admin.is_admin:
        raise HTTPException(403, "Admin only")
    p = db.get(Payment, pid)
    if not p:
        raise HTTPException(404, "Payment not found")
    if p.status != "pending":
        raise HTTPException(400, f"Payment already {p.status}")
    p.status = "verified" if body.action == "verify" else "rejected"
    if p.status == "verified":
        exists = db.scalar(select(Enrollment).where(Enrollment.user_id == p.user_id,
                                                    Enrollment.course_id == p.course_id))
        if not exists:
            db.add(Enrollment(user_id=p.user_id, course_id=p.course_id))
    db.add(Notification(user_id=p.user_id,
                        title="Payment " + ("verified ✅" if p.status == "verified" else "rejected ❌"),
                        body=f"Transaction {p.trx_id} ({p.method}) — {p.status}.", kind="payment"))
    db.commit()
    return {"ok": True, "status": p.status}
