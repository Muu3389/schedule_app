from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import date
import secrets, json
import os

# =====================
# Flask アプリ初期化
# =====================
template_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")
app = Flask(__name__, template_folder=template_dir)

# SQLiteの絶対パスを指定（Renderでも書き込み可能）
db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schedule.db")
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# =====================
# Models
# =====================
class Schedule(db.Model):
    id = db.Column(db.String(16), primary_key=True)
    create_day = db.Column(db.String(10), nullable=False)
    slots_json = db.Column(db.Text, nullable=False)
    title = db.Column(db.String(200), nullable=True)
    time_interval = db.Column(db.Integer, nullable=False, default=30)
    creator_password = db.Column(db.String(100), nullable=True)

class Answer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    schedule_id = db.Column(db.String(16), nullable=False)
    name = db.Column(db.String(50), nullable=False)
    day = db.Column(db.String(10), nullable=False)
    slot = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(10), nullable=False)
    last_answered = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now(), nullable=False)

class Respondent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    schedule_id = db.Column(db.String, nullable=False)
    name = db.Column(db.String, nullable=False)

    __table_args__ = (
        db.UniqueConstraint("schedule_id", "name"),
    )

# =====================
# Routes
# =====================
@app.route("/")
def index_page():
    return render_template("index.html")

@app.route("/setup")
def setup_page():
    return render_template("setup.html")

@app.route("/select")
def create_page():
    return render_template("create.html", today=date.today().isoformat())

@app.route("/create", methods=["POST"])
def create_schedule():
    data = request.json
    schedule_id = secrets.token_hex(8)

    s = Schedule(
        id=schedule_id,
        create_day=date.today().isoformat(),
        slots_json=json.dumps(data["slots"]),
        title=data.get("title", ""),
        time_interval=data.get("time_interval", 30),
        creator_password=data.get("creator_password", "")
    )
    db.session.add(s)
    db.session.commit()

    return jsonify({"schedule_id": schedule_id})

@app.route("/<sid>/answer")
def answer_page(sid):
    schedule = Schedule.query.get_or_404(sid)
    name = request.args.get("name")

    answers = []
    if name:
        answers = Answer.query.filter_by(schedule_id=sid, name=name).all()

    return render_template(
        "schedule.html",
        schedule=schedule,
        slots=json.loads(schedule.slots_json),
        edit_name=name,
        answers=[{"day": a.day, "slot": a.slot, "status": a.status} for a in answers],
        time_interval=schedule.time_interval or 30
    )

@app.route("/<sid>/summary")
def summary_page(sid):
    s = Schedule.query.get_or_404(sid)
    return render_template(
        "summary.html",
        schedule_id=sid,
        slots_json=s.slots_json,
        title=s.title or "スケジュール",
        time_interval=s.time_interval or 30
    )

@app.route("/<sid>/submit", methods=["POST"])
def submit(sid):
    data = request.json
    name = data["name"]
    selections = data["selections"]

    if not Respondent.query.filter_by(schedule_id=sid, name=name).first():
        db.session.add(Respondent(schedule_id=sid, name=name))

    Answer.query.filter_by(schedule_id=sid, name=name).delete()

    for s in selections:
        db.session.add(Answer(
            schedule_id=sid,
            name=name,
            day=s["day"],
            slot=s["slot"],
            status=s["status"]
        ))

    db.session.commit()
    return "", 204

@app.route("/<sid>/summary_data")
def summary_data(sid):
    answers = Answer.query.filter_by(schedule_id=sid).all()
    result = {}
    for a in answers:
        key = f"{a.day}-{a.slot}"
        result.setdefault(key, {"bad": [], "unknown": []})
        result[key][a.status].append(a.name)
    return jsonify(result)

@app.route("/<sid>/respondents")
def respondents(sid):
    rows = Respondent.query.filter_by(schedule_id=sid).all()
    return jsonify([r.name for r in rows])

@app.route("/<sid>/verify_password", methods=["POST"])
def verify_password(sid):
    data = request.json
    schedule = Schedule.query.get_or_404(sid)
    if schedule.creator_password == data.get("password", ""):
        return jsonify({"valid": True})
    return jsonify({"valid": False}), 401

@app.route("/<sid>/edit")
def edit_page(sid):
    schedule = Schedule.query.get_or_404(sid)
    password = request.args.get("password", "")

    # パスワード確認
    if schedule.creator_password != password:
        return "パスワードが正しくありません", 401

    return render_template(
        "edit.html",
        schedule_id=sid,
        slots_json=schedule.slots_json,
        time_interval=schedule.time_interval or 30,
        password=password
    )

@app.route("/<sid>/update_slots", methods=["POST"])
def update_slots(sid):
    data = request.json
    schedule = Schedule.query.get_or_404(sid)

    # パスワード確認
    if schedule.creator_password != data.get("password", ""):
        return jsonify({"error": "パスワードが正しくありません"}), 401

    # スロットを更新
    schedule.slots_json = json.dumps(data["slots"])
    db.session.commit()

    return jsonify({"success": True})

# =====================
# 起動時に必ずテーブル作成
# =====================
with app.app_context():
    db.create_all()

# =====================
# Run
# =====================
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0")
