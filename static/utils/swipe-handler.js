/**
 * ビューポートでのスワイプ処理を管理するモジュール
 * 週の切り替えに使用
 */

/**
 * ビューポートにスワイプハンドラーをアタッチ
 * @param {HTMLElement} viewport - ビューポート要素
 * @param {Object} callbacks - コールバック関数群
 * @param {Function} callbacks.onSwipeLeft - 左スワイプ時の処理 () => void
 * @param {Function} callbacks.onSwipeRight - 右スワイプ時の処理 () => void
 * @param {Function} callbacks.hasPrevWeek - 前の週があるかチェック () => boolean
 * @param {Function} callbacks.hasNextWeek - 次の週があるかチェック () => boolean
 * @param {number} threshold - スワイプ判定の閾値（デフォルト: 50px）
 */
function attachSwipeHandler(viewport, callbacks, threshold = 50) {
    const {
        onSwipeLeft,
        onSwipeRight,
        hasPrevWeek,
        hasNextWeek
    } = callbacks;

    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;

    viewport.addEventListener("touchstart", (e) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
    });

    viewport.addEventListener("touchmove", (e) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        lastX = touch.clientX;
        lastY = touch.clientY;
    });

    viewport.addEventListener("touchend", () => {
        const dX = lastX - startX;
        const dY = lastY - startY;
        let slideVector = null;

        // スワイプ方向の判定（横方向に閾値以上移動）
        if (Math.abs(dX) > threshold && Math.abs(dY) < Math.abs(dX)) {
            if (dX > 0) {
                slideVector = "right";
            } else {
                slideVector = "left";
            }
        }

        // 週の切り替えを実行
        if (slideVector === "right" && hasPrevWeek && hasPrevWeek()) {
            onSwipeRight && onSwipeRight();
        }
        if (slideVector === "left" && hasNextWeek && hasNextWeek()) {
            onSwipeLeft && onSwipeLeft();
        }
    });
}
