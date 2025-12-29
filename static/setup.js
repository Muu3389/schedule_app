/**
 * スケジュール設定画面のメインロジック
 * 事前情報の入力とセッションストレージへの保存を管理
 */

document.getElementById("setupForm").addEventListener("submit", (e) => {
    e.preventDefault();

    const title = document.getElementById("title").value.trim();
    const timeInterval = parseInt(document.getElementById("timeInterval").value);
    const creatorPassword = document.getElementById("creatorPassword").value;

    // セッションストレージに保存（タイトルとパスワードは任意）
    sessionStorage.setItem("scheduleSetup", JSON.stringify({
        title: title || "",
        timeInterval,
        creatorPassword: creatorPassword || ""
    }));

    // 作成画面に遷移
    window.location.href = "/select";
});
