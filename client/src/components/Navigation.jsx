import { useNavigate } from 'react-router-dom'
import { useWebSocket } from '../hooks/useWebSocket'
import './Navigation.css'

export default function Navigation({ onPostClick, onHelpClick }) {
  const navigate = useNavigate()
  const { connected } = useWebSocket(() => {})

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand" onClick={() => navigate('/')}>
          💻STEM
        </div>
        <div className="navbar-center">
          <h1>体育祭掲示板</h1>
          <p>メッセージを投稿して感想を共有しよう！</p>
        </div>
        <div className="navbar-controls">
          {connected && <span className="connection-status">🟢 オンライン</span>}
          <button
            className="nav-help-btn"
            onClick={onHelpClick}
            title="使い方ガイド"
          >
            ❓ ヘルプ
          </button>
          <button
            className="nav-post-btn"
            onClick={onPostClick}
          >
            ✏️ 新規投稿
          </button>
        </div>
      </div>
    </nav>
  )
}
