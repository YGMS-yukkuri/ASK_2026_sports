import './OnboardingOverlay.css'

// Shown on first visit. Highlights the post button and shows usage hints.
export default function OnboardingOverlay({ onClose, onPostClick }) {
  function handlePost() {
    onClose()
    onPostClick()
  }

  return (
    <div className="onboarding-overlay" onClick={onClose}>
      <div className="onboarding-content" onClick={e => e.stopPropagation()}>
        <div className="onboarding-emoji">💻🏃</div>
        <h2 className="onboarding-title">体育祭掲示板へようこそ！</h2>
        <p className="onboarding-desc">
          応援メッセージや感想をリアルタイムで共有しよう！
        </p>

        <div className="onboarding-tips">
          <div className="onboarding-tip">
            <span className="tip-icon">✏️</span>
            <span>右上の <strong>新規投稿</strong> ボタンから投稿できます</span>
          </div>
          <div className="onboarding-tip">
            <span className="tip-icon">👍</span>
            <span>投稿に <strong>リアクション</strong> して盛り上げよう！</span>
          </div>
          <div className="onboarding-tip">
            <span className="tip-icon">❓</span>
            <span>使い方は <strong>ヘルプ</strong> ボタンでいつでも確認できます</span>
          </div>
        </div>

        <div className="onboarding-actions">
          <button className="onboarding-post-btn" onClick={handlePost}>
            ✏️ 投稿してみる
          </button>
          <button className="onboarding-close-btn" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>

      {/* Arrow pointing to post button in top-right */}
      <div className="onboarding-arrow" aria-hidden="true">
        <svg viewBox="0 0 60 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M30 90 Q10 50 50 10" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" strokeDasharray="6 4"/>
          <polygon points="50,0 42,18 58,18" fill="white"/>
        </svg>
      </div>
    </div>
  )
}
