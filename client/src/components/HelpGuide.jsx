import './HelpGuide.css'

export default function HelpGuide({ onClose }) {
  return (
    <div className="help-overlay" onClick={onClose}>
      <div className="help-content" onClick={e => e.stopPropagation()}>
        <div className="help-header">
          <h2>❓ 使い方ガイド</h2>
          <button className="help-close" onClick={onClose}>×</button>
        </div>

        <div className="help-sections">
          <div className="help-section">
            <h3>✏️ 投稿する</h3>
            <p>右上の <strong>新規投稿</strong> ボタンを押してメッセージを入力し、投稿できます。ニックネームと投稿内容（200文字以内）が必要です。画像も添付できます。</p>
          </div>

          <div className="help-section">
            <h3>👍 リアクションする</h3>
            <p>各投稿の下にある絵文字ボタンを押してリアクションできます。もう一度押すと取り消せます。リアクションすると画面にエフェクトが飛びます！</p>
            <div className="help-reactions">
              <span>👍 いいね</span>
              <span>❤️ ハート</span>
              <span>🔥 熱い</span>
              <span>😲 びっくり</span>
            </div>
          </div>

          <div className="help-section">
            <h3>🔄 リアルタイム更新</h3>
            <p>他の人の投稿やリアクションはリアルタイムで自動反映されます。右上の <strong>🟢 オンライン</strong> 表示が接続中の証拠です。</p>
          </div>

          <div className="help-section">
            <h3>🎨 エフェクト</h3>
            <p>新しい投稿が届いたとき、またはリアクションされたとき、画面にエフェクトが表示されます。みんなで盛り上げよう！</p>
          </div>
        </div>

        <button className="help-ok-btn" onClick={onClose}>わかった！</button>
      </div>
    </div>
  )
}
