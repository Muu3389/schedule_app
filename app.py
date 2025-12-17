from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from datetime import date
import secrets, json

# Flask アプリ初期化
app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///schedule.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# =====================
# Models (SQLAlchemyのおかげでclass定義でDBテーブルが作れる)
# =====================
class Schedule(db.Model):   # スケジュール管理用テーブル
    id = db.Column(db.String(16), primary_key=True)
    start_date = db.Column(db.String(10), nullable=False)   # スケジュール作成日
    slots_json = db.Column(db.Text, nullable=False)  # 有効slot一覧

class Answer(db.Model): # 回答保存用テーブル
    id = db.Column(db.Integer, primary_key=True)
    schedule_id = db.Column(db.String(16), nullable=False)
    name = db.Column(db.String(50), nullable=False)
    day = db.Column(db.String(10), nullable=False)
    slot = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(10), nullable=False)

class Respondent(db.Model): # 回答者管理用テーブル
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
def create_page():
    return render_template("create.html", start_date=date.today().isoformat())  # start_dateを渡した状態でtemplateフォルダのcreate.htmlを表示

@app.route("/create", methods=["POST"]) #POSTメソッドでアクセスされたときのみ
def create_schedule():
    data = request.json # JSから送られたJSONデータを取得(dict型)
    schedule_id = secrets.token_hex(8)  # ランダムな16文字のIDを生成

    s = Schedule(
        id=schedule_id,
        start_date=data["start_date"],
        slots_json=json.dumps(data["slots"])    # dict型をJSON文字列に変換して保存
    )
    db.session.add(s)   # 予約
    db.session.commit() # 保存

    return jsonify({"schedule_id": schedule_id})    # 作成したスケジュールIDをJSONで返す

@app.route("/<sid>/answer")
def answer_page(sid):
    schedule = Schedule.query.get_or_404(sid)   # Scheduleテーブルにアクセスしsidのレコードを取得。なければ404
    name = request.args.get("name") # クエリパラメータからnameを取得(URLの?name=xxx)

    answers = []
    if name:
        answers = Answer.query.filter_by(
            schedule_id=sid,
            name=name
        ).all() # filter_byの条件でアクセスし、リストで取得

    return render_template(
        "schedule.html",
        schedule=schedule,
        slots=json.loads(schedule.slots_json),  # JSON文字列をdict型に変換して渡す
        edit_name=name,
        answers=[
            {"day": a.day, "slot": a.slot, "status": a.status}
            for a in answers
        ]
    )


@app.route("/<sid>/summary")
def summary_page(sid):
    s = Schedule.query.get_or_404(sid)
    return render_template(
        "summary.html",
        schedule_id=sid,
        start_date=s.start_date,
        slots_json=s.slots_json
    )

@app.route("/<sid>/submit", methods=["POST"])
def submit(sid):
    data = request.json
    name = data["name"]
    selections = data["selections"]

    # ① 回答者登録（ここが新規）
    if not Respondent.query.filter_by(
        schedule_id=sid,
        name=name
    ).first():
        db.session.add(
            Respondent(schedule_id=sid, name=name)
        )

    # ② 既存回答を削除（編集対応）
    Answer.query.filter_by(
        schedule_id=sid,
        name=name
    ).delete()

    # ③ 新しい回答を保存
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

# =====================
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True, host="0.0.0.0")
