import json
import os
import re
import secrets
from datetime import date, datetime, timedelta

import pas
import requests
from flask import Flask, jsonify, redirect, render_template, request, session
from flask_sqlalchemy import SQLAlchemy
from linebot import LineBotApi, WebhookHandler
from linebot.exceptions import InvalidSignatureError, LineBotApiError
from linebot.models import MessageEvent, TextMessage, TextSendMessage
from sqlalchemy import inspect, text
from werkzeug.security import check_password_hash, generate_password_hash

# =====================
# Flask アプリ初期化
# =====================
template_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")
app = Flask(__name__, template_folder=template_dir)
app.secret_key = pas.FLASK_SECRET_KEY
app.config.update(
    SESSION_COOKIE_PATH="/",
    SESSION_COOKIE_SECURE=os.environ.get("SESSION_COOKIE_SECURE", "true").lower() == "true",
    SESSION_COOKIE_SAMESITE=None,
    SESSION_COOKIE_HTTPONLY=True,
)

line_bot_api = LineBotApi(pas.LINE_BOT_CHANNEL_ACCESS_TOKEN)
handler = WebhookHandler(pas.LINE_BOT_CHANNEL_SECRET)

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
    creator_password = db.Column(db.String(255), nullable=True)
    creator_line_id = db.Column(db.String(100), nullable=True)
    notification_enabled = db.Column(db.Boolean, nullable=False, default=True)


class Answer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    schedule_id = db.Column(db.String(16), nullable=False)
    name = db.Column(db.String(50), nullable=False)
    day = db.Column(db.String(10), nullable=False)
    slot = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(10), nullable=False)
    last_answered = db.Column(
        db.DateTime,
        server_default=db.func.now(),
        onupdate=db.func.now(),
        nullable=False,
    )


class Respondent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    schedule_id = db.Column(db.String, nullable=False)
    name = db.Column(db.String, nullable=False)

    __table_args__ = (db.UniqueConstraint("schedule_id", "name"),)


class LineState(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    state = db.Column(db.String(64), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now(), nullable=False)

    @staticmethod
    def cleanup_old_states():
        cutoff = datetime.utcnow() - timedelta(minutes=10)
        LineState.query.filter(LineState.created_at < cutoff).delete()
        db.session.commit()


# =====================
# Helpers
# =====================
def summary_url(schedule_id):
    return f"{pas.BASE_URL}/{schedule_id}/summary"


def validate_name(name):
    if not name or not isinstance(name, str):
        return False, "名前が無効です"

    name = name.strip()

    if len(name) == 0 or len(name) > 50:
        return False, "名前は1文字以上50文字以内で入力してください"

    dangerous_pattern = re.compile(r"<[^>]*>|javascript:|on\w+\s*=", re.IGNORECASE)
    if dangerous_pattern.search(name):
        return False, "名前に使用できない文字が含まれています"

    return True, name


def migrate_db():
    db.create_all()

    inspector = inspect(db.engine)
    if not inspector.has_table("schedule"):
        return

    columns = {column["name"] for column in inspector.get_columns("schedule")}
    with db.engine.begin() as conn:
        if "creator_line_id" not in columns:
            conn.execute(text("ALTER TABLE schedule ADD COLUMN creator_line_id VARCHAR(100)"))
        if "notification_enabled" not in columns:
            conn.execute(text("ALTER TABLE schedule ADD COLUMN notification_enabled BOOLEAN DEFAULT 1"))


# =====================
# Routes
# =====================
@app.route("/")
def index_page():
    return render_template("index.html", line_add_friend_url=pas.LINE_ADD_FRIEND_URL)


@app.route("/setup")
def setup_page():
    return render_template(
        "setup.html",
        line_user_id=session.get("line_user_id"),
        line_name=session.get("line_name"),
        line_picture=session.get("line_picture"),
    )


@app.route("/select")
def create_page():
    return render_template("create.html", today=date.today().isoformat())


@app.route("/create", methods=["POST"])
def create_schedule():
    data = request.json
    schedule_id = secrets.token_hex(8)

    password = data.get("creator_password", "")
    password_hash = generate_password_hash(password) if password else ""
    creator_line_id = session.get("line_user_id")

    s = Schedule(
        id=schedule_id,
        create_day=date.today().isoformat(),
        slots_json=json.dumps(data["slots"]),
        title=data.get("title", ""),
        time_interval=data.get("time_interval", 30),
        creator_password=password_hash,
        creator_line_id=creator_line_id,
        notification_enabled=True,
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
        time_interval=schedule.time_interval or 30,
    )


@app.route("/<sid>/summary")
def summary_page(sid):
    s = Schedule.query.get_or_404(sid)
    return render_template(
        "summary.html",
        schedule_id=sid,
        slots_json=s.slots_json,
        title=s.title or "スケジュール",
        time_interval=s.time_interval or 30,
    )


@app.route("/<sid>/submit", methods=["POST"])
def submit(sid):
    data = request.json
    name = data.get("name", "")

    is_valid, result = validate_name(name)
    if not is_valid:
        return jsonify({"error": result}), 400
    name = result

    selections = data.get("selections", [])
    if not isinstance(selections, list):
        return jsonify({"error": "無効なデータ形式です"}), 400

    if not Respondent.query.filter_by(schedule_id=sid, name=name).first():
        db.session.add(Respondent(schedule_id=sid, name=name))

    Answer.query.filter_by(schedule_id=sid, name=name).delete()

    for s in selections:
        if not all(key in s for key in ["day", "slot", "status"]):
            continue
        db.session.add(
            Answer(
                schedule_id=sid,
                name=name,
                day=s["day"],
                slot=s["slot"],
                status=s["status"],
            )
        )

    db.session.commit()

    schedule = Schedule.query.get(sid)
    if schedule and schedule.creator_line_id and schedule.notification_enabled:
        try:
            url = summary_url(sid)
            message = (
                f"{name}さんが回答を送信しました。\n\n"
                f"スケジュール: {schedule.title or '無題'}\n\n"
                f"確認する: {url}"
            )
            line_bot_api.push_message(schedule.creator_line_id, TextSendMessage(text=message))
        except LineBotApiError:
            pass

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
    password = data.get("password", "")

    if not schedule.creator_password and not password:
        return jsonify({"valid": True})

    if schedule.creator_password and check_password_hash(schedule.creator_password, password):
        return jsonify({"valid": True})
    return jsonify({"valid": False}), 401


@app.route("/<sid>/edit")
def edit_page(sid):
    schedule = Schedule.query.get_or_404(sid)
    password = request.args.get("password", "")

    if not schedule.creator_password and password:
        return "パスワードが正しくありません", 401
    if schedule.creator_password and not check_password_hash(schedule.creator_password, password):
        return "パスワードが正しくありません", 401

    return render_template(
        "edit.html",
        schedule_id=sid,
        slots_json=schedule.slots_json,
        time_interval=schedule.time_interval or 30,
        password=password,
    )


@app.route("/<sid>/update_slots", methods=["POST"])
def update_slots(sid):
    data = request.json
    schedule = Schedule.query.get_or_404(sid)
    password = data.get("password", "")

    if not schedule.creator_password and password:
        return jsonify({"error": "パスワードが正しくありません"}), 401
    if schedule.creator_password and not check_password_hash(schedule.creator_password, password):
        return jsonify({"error": "パスワードが正しくありません"}), 401

    schedule.slots_json = json.dumps(data["slots"])
    db.session.commit()

    return jsonify({"success": True})


@app.route("/line_login")
def line_login():
    LineState.cleanup_old_states()

    state = secrets.token_hex(16)
    line_state = LineState(state=state)
    db.session.add(line_state)
    db.session.commit()

    url = (
        "https://access.line.me/oauth2/v2.1/authorize?"
        f"response_type=code&"
        f"client_id={pas.LINE_CHANNEL_ID}&"
        f"redirect_uri={pas.REDIRECT_URL}&"
        f"state={state}&"
        f"scope=openid%20profile"
    )
    return redirect(url)


@app.route("/line_callback")
def line_callback():
    code = request.args.get("code")
    if not code:
        return "認証に失敗しました", 400

    received_state = request.args.get("state")
    line_state = LineState.query.filter_by(state=received_state).first()
    if not line_state:
        return "不正なリクエストです", 400

    db.session.delete(line_state)
    db.session.commit()

    token_res = requests.post(
        "https://api.line.me/oauth2/v2.1/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": pas.REDIRECT_URL,
            "client_id": pas.LINE_CHANNEL_ID,
            "client_secret": pas.LINE_CHANNEL_SECRET,
        },
        timeout=10,
    ).json()

    if "access_token" not in token_res:
        return "トークン取得失敗", 400

    access_token = token_res["access_token"]
    profile = requests.get(
        "https://api.line.me/v2/profile",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    ).json()

    session["line_user_id"] = profile["userId"]
    session["line_name"] = profile["displayName"]
    session["line_picture"] = profile.get("pictureUrl")
    session.permanent = True
    session.modified = True

    return redirect("/setup")


@app.route("/logout")
def logout():
    session.clear()
    return redirect("/setup")


@app.route("/line_webhook", methods=["POST"])
def line_webhook():
    signature = request.headers.get("X-Line-Signature")
    if not signature:
        return "Bad Request", 400

    body = request.get_data(as_text=True)

    try:
        handler.handle(body, signature)
    except InvalidSignatureError:
        return "Invalid signature", 400
    except Exception:
        pass

    return "OK", 200


@handler.add(MessageEvent, message=TextMessage)
def handle_message(event):
    try:
        if not hasattr(event.source, "user_id") or not event.source.user_id:
            return

        user_id = event.source.user_id
        text = (event.message.text or "").strip()
        if not text:
            return

        if text == "一覧":
            schedules = Schedule.query.filter_by(creator_line_id=user_id).limit(50).all()

            if not schedules:
                reply_text = "スケジュールが見つかりませんでした。"
            else:
                reply_lines = ["【スケジュール一覧】\n"]
                for schedule in schedules[:20]:
                    notification_status = "オン" if schedule.notification_enabled else "オフ"
                    title = schedule.title or "無題"
                    reply_lines.append(
                        f"・{title}\n  {summary_url(schedule.id)}\n  通知:{notification_status}\n"
                    )
                reply_text = "\n".join(reply_lines)

            line_bot_api.reply_message(event.reply_token, TextSendMessage(text=reply_text))

        elif text.startswith("オン ") or text.startswith("オフ "):
            parts = text.split(" ", 1)
            if len(parts) != 2:
                reply_text = (
                    "形式が正しくありません。\n"
                    "「オン スケジュール名」または「オフ スケジュール名」と送信してください。"
                )
                line_bot_api.reply_message(event.reply_token, TextSendMessage(text=reply_text))
            else:
                command, schedule_title = parts
                schedules = Schedule.query.filter_by(creator_line_id=user_id).all()

                matching_schedule = None
                for schedule in schedules:
                    if schedule.title == schedule_title or (not schedule.title and schedule_title == "無題"):
                        matching_schedule = schedule
                        break

                if not matching_schedule:
                    reply_text = f"「{schedule_title}」という名前のスケジュールが見つかりませんでした。"
                else:
                    try:
                        matching_schedule.notification_enabled = command == "オン"
                        db.session.commit()
                        status = "オン" if command == "オン" else "オフ"
                        reply_text = f"「{schedule_title}」の通知を{status}にしました。"
                    except Exception:
                        db.session.rollback()
                        reply_text = "エラーが発生しました。もう一度お試しください。"

                line_bot_api.reply_message(event.reply_token, TextSendMessage(text=reply_text))

        elif text.startswith("削除 "):
            parts = text.split(" ", 1)
            if len(parts) != 2:
                reply_text = "形式が正しくありません。\n「削除 スケジュール名」と送信してください。"
                line_bot_api.reply_message(event.reply_token, TextSendMessage(text=reply_text))
            else:
                schedule_title = parts[1]
                schedules = Schedule.query.filter_by(creator_line_id=user_id).all()

                matching_schedule = None
                for schedule in schedules:
                    if schedule.title == schedule_title or (not schedule.title and schedule_title == "無題"):
                        matching_schedule = schedule
                        break

                if not matching_schedule:
                    reply_text = f"「{schedule_title}」という名前のスケジュールが見つかりませんでした。"
                else:
                    try:
                        schedule_id = matching_schedule.id
                        Answer.query.filter_by(schedule_id=schedule_id).delete()
                        Respondent.query.filter_by(schedule_id=schedule_id).delete()
                        db.session.delete(matching_schedule)
                        db.session.commit()
                        reply_text = f"「{schedule_title}」を削除しました。"
                    except Exception:
                        db.session.rollback()
                        reply_text = "エラーが発生しました。もう一度お試しください。"

                line_bot_api.reply_message(event.reply_token, TextSendMessage(text=reply_text))

        else:
            help_text = (
                f"こちらからスケジュールを作成できます。\n{pas.BASE_URL}\n\n"
                "【コマンド一覧】\n"
                "・「一覧」: スケジュール一覧\n"
                "・「オン スケジュール名」: 通知ON\n"
                "・「オフ スケジュール名」: 通知OFF\n"
                "・「削除 スケジュール名」: スケジュール削除"
            )
            line_bot_api.reply_message(event.reply_token, TextSendMessage(text=help_text))

    except (LineBotApiError, Exception):
        pass


# =====================
# 起動時にテーブル作成・マイグレーション
# =====================
with app.app_context():
    migrate_db()


# =====================
# Run
# =====================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(debug=debug, host="0.0.0.0", port=port)
