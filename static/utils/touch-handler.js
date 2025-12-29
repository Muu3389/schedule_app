/**
 * タッチイベントとマウスイベントを統合的に処理するモジュール
 * PCとスマートフォンの両方に対応
 */

/**
 * タッチ/マウスイベントハンドラーをセルにアタッチ
 * @param {HTMLElement} td - 対象のセル要素
 * @param {string} key - セルのキー（日付-スロット）
 * @param {Object} callbacks - コールバック関数群
 * @param {Function} callbacks.onToggle - セルの状態を切り替える関数 (td, key, isAdd) => void
 * @param {Function} callbacks.getState - セルの現在の状態を取得する関数 (key) => boolean
 * @param {Function} callbacks.onSwipe - スワイプ時の処理 (direction) => void
 * @param {Function} callbacks.hasPrevWeek - 前の週があるかチェック () => boolean
 * @param {Function} callbacks.hasNextWeek - 次の週があるかチェック () => boolean
 */
function attachTouchHandler(td, key, callbacks) {
    const {
        onToggle,
        getState,
        onSwipe,
        hasPrevWeek,
        hasNextWeek
    } = callbacks;

    // =====================
    // タッチ用変数
    // =====================
    let touchStartTime = 0;      // タッチ開始時間
    let startKey = null;         // タッチ開始key
    let startTd = null;          // タッチ開始td
    let isScroll = false;        // スクロールかどうか
    let dragStarted = false;     // ドラッグ開始したか
    let dragAdd = null;          // ドラッグモード（true: 追加, false: 削除）- ドラッグ開始時に一度だけ設定
    let el = null;               // 現在の要素
    let moveKey = null;          // 現在のkey
    let elapsed = 0;             // 経過時間
    let startX = 0;              // 開始X座標
    let startY = 0;              // 開始Y座標
    let lastX = 0;               // 最後のX座標
    let lastY = 0;               // 最後のY座標

    // ===== スマホ（タッチ）=====
    td.addEventListener("touchstart", (e) => {
        if (e.touches.length !== 1) return;

        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;

        touchStartTime = Date.now();
        startKey = key;
        startTd = td;
        isScroll = false;
        dragStarted = false;
        dragAdd = null;  // リセット
    });

    td.addEventListener("touchmove", (e) => {
        if (e.touches.length !== 1) return;

        elapsed = Date.now() - touchStartTime;
        const touch = e.touches[0];
        el = document.elementFromPoint(
            touch.clientX,
            touch.clientY
        );
        lastX = touch.clientX;
        lastY = touch.clientY;

        if (!el || el.tagName !== "TD") return; // 無効マスを無視

        moveKey = el.dataset.key;
        if (!moveKey) return;   // 無効マスを無視

        // スクロール判定（開始位置と異なり、0.25秒未満ならスクロールと判断）
        if (moveKey !== startKey && !isScroll && elapsed < 250) {
            isScroll = true;
        }

        // 無効マスは無視（disabledクラスがある場合）
        if (el.classList.contains("disabled")) return;

        // 0.25秒未満なら何もしない
        if (elapsed < 250) return;

        // スクロールだったら何もしない
        if (isScroll) return;

        // スクロール防止
        e.preventDefault();

        // ドラッグ開始
        if (!dragStarted) {
            dragStarted = true;
            // 開始セルの状態に基づいてドラッグモードを決定（一度だけ設定）
            dragAdd = !getState(startKey);
            onToggle(startTd, startKey, dragAdd);
        }

        // マス切り替え（ドラッグ中）
        if (dragStarted && dragAdd !== null) {
            const moveKeyState = getState(moveKey);
            // 追加モードの場合：未選択のセルを選択
            // 削除モードの場合：選択済みのセルを解除
            if (dragAdd && !moveKeyState) {
                onToggle(el, moveKey, true);
            } else if (!dragAdd && moveKeyState) {
                onToggle(el, moveKey, false);
            }
        }
    }, { passive: false });

    td.addEventListener("touchend", (e) => {
        const elapsed = Date.now() - touchStartTime;

        const dX = lastX - startX;
        const dY = lastY - startY;
        let slideVector = null;

        // スワイプ方向の判定（横方向に50px以上移動）
        if (Math.abs(dX) > 50 && Math.abs(dY) < Math.abs(dX)) {
            if (dX > 0) {
                slideVector = "right";
            } else {
                slideVector = "left";
            }
        }

        // スクロールだった場合、週の切り替えを実行
        if (isScroll && slideVector === "right" && hasPrevWeek && hasPrevWeek()) {
            onSwipe && onSwipe("right");
        }
        if (isScroll && slideVector === "left" && hasNextWeek && hasNextWeek()) {
            onSwipe && onSwipe("left");
        }

        // 短タップ（0.25秒未満 ＆ 移動なし）
        if (elapsed < 250 && !isScroll) {
            const isAdd = !getState(startKey);
            onToggle(startTd, startKey, isAdd);
        }

        if (e.cancelable) {
            e.preventDefault();
        }
        e.stopPropagation();
    });

    // 注意: PC用のマウスイベントは各ファイルで個別に設定される
    // （グローバルなisDragフラグの管理が必要なため）
}
