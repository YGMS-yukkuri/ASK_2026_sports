import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWebSocket } from '../hooks/useWebSocket'
import './AdminPage.css'

const REACTIONS = {
  like: '👍',
  heart: '❤️',
  fire: '🔥',
  surprise: '😲'
}

export default function AdminPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [posts, setPosts] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [animatingReactions, setAnimatingReactions] = useState({}) // postId_reactionType -> true

  // Helper function to convert relative image URLs to absolute
  const getImageUrl = (imageUrl) => {
    if (!imageUrl) return null
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl
    }
    const apiBase = 'http://localhost:5000'
    return `${apiBase}${imageUrl}`
  }

  // WebSocket for real-time updates
  const { connected } = useWebSocket((message) => {
    if (message.type === 'new_post') {
      setPosts(prev => [message.data, ...prev])
    } else if (message.type === 'post_deleted') {
      setPosts(prev => prev.filter(p => p.id !== message.data.postId))
    } else if (message.type === 'reaction_update') {
      const postId = message.data.postId
      
      // Mark which reactions changed for animation and determine direction
      const newAnimating = {}
      Object.keys(REACTIONS).forEach(type => {
        const reactionKey = `${postId}_${type}`
        const newCount = message.data.reactions[type] || 0
        const oldPost = posts.find(p => p.id === postId)
        const oldCount = oldPost?.reactions?.[type] || 0
        
        if (newCount !== oldCount) {
          // Store direction: 'up' if increased, 'down' if decreased
          newAnimating[reactionKey] = newCount > oldCount ? 'up' : 'down'
        }
      })
      
      // Remove animation first to allow retriggering on rapid clicks
      setAnimatingReactions({})
      
      // Use requestAnimationFrame to ensure DOM update before re-adding animation
      requestAnimationFrame(() => {
        setAnimatingReactions(prev => ({ ...prev, ...newAnimating }))
      })
      
      // Update posts
      setPosts(prev => prev.map(p => 
        p.id === postId 
          ? { ...p, reactions: message.data.reactions }
          : p
      ))
    }
  })

  async function handleLogin(e) {
    e.preventDefault()
    try {
      setLoading(true)
      setError('')
      
      const response = await fetch('/api/admin/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      if (!response.ok) {
        setError('パスワードが正しくありません')
        return
      }

      const data = await response.json()
      setPosts(data.posts)
      setIsAuthenticated(true)
      
      // Fetch statistics
      const statsResponse = await fetch('/api/admin/statistics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData)
      }
    } catch (err) {
      console.error('Error logging in:', err)
      setError('ログインに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // Handle badge animation end to reset animation state
  const handleAnimationEnd = (reactionKey) => {
    setAnimatingReactions(prev => {
      const updated = { ...prev }
      delete updated[reactionKey]
      return updated
    })
  }

  async function handleDeletePost(postId) {
    if (!confirm('この投稿を削除しますか？')) return

    try {
      const response = await fetch(`/api/admin/posts/${postId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      if (response.ok) {
        setPosts(prev => prev.filter(p => p.id !== postId))
      } else {
        setError('投稿の削除に失敗しました')
      }
    } catch (err) {
      console.error('Error deleting post:', err)
      setError('投稿の削除に失敗しました')
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-login">
        <div className="login-container">
          <h1>🔐 管理者ログイン</h1>
          {error && <div className="alert alert-error">{error}</div>}
          
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="password">パスワード</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                disabled={loading}
              />
            </div>
            
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

          <button
            className="btn btn-secondary"
            onClick={() => navigate('/')}
          >
            戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>⚙️ 管理ページ</h1>
        <button
          className="btn btn-secondary btn-small"
          onClick={() => {
            setIsAuthenticated(false)
            setPassword('')
            setPosts([])
          }}
        >
          ログアウト
        </button>
      </div>

      {stats && (
        <div className="stats-container">
          <div className="stat-card">
            <div className="stat-value">{stats.totalPosts}</div>
            <div className="stat-label">総投稿数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalReactions}</div>
            <div className="stat-label">総リアクション数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.uniqueDevices}</div>
            <div className="stat-label">ユニークデバイス</div>
          </div>
        </div>
      )}

      <div className="posts-management">
        <h2>投稿管理</h2>
        {posts.length === 0 ? (
          <p className="no-posts">投稿がありません</p>
        ) : (
          <div className="admin-posts-list">
            {posts.map(post => (
              <div key={post.id} className={`admin-post ${post.deleted ? 'deleted' : ''}`}>
                <div className="admin-post-header">
                  <span className="nickname">{post.nickname}</span>
                  <span className="device-id">ID: {post.device_id}</span>
                  <span className="timestamp">
                    {new Date(post.timestamp).toLocaleString('ja-JP')}
                  </span>
                </div>

                <div className="admin-post-content">
                  {post.content}
                </div>

                {post.image_url && (
                  <img src={getImageUrl(post.image_url)} alt="Post" className="admin-post-image" />
                )}

                {post.reactions && Object.keys(post.reactions).length > 0 && (
                  <div className="admin-post-reactions">
                    {Object.entries(post.reactions).map(([type, count]) => {
                      const animKey = `${post.id}_${type}`
                      const isAnimating = animatingReactions[animKey]
                      return (
                        <span 
                          key={type} 
                          className={`reaction-badge ${isAnimating === 'up' ? 'badge-flip-up' : isAnimating === 'down' ? 'badge-fade-down' : ''}`}
                          onAnimationEnd={() => handleAnimationEnd(animKey)}
                        >
                          {REACTIONS[type]} {count}
                        </span>
                      )
                    })}
                  </div>
                )}

                {!post.deleted && (
                  <button
                    className="btn btn-delete"
                    onClick={() => handleDeletePost(post.id)}
                  >
                    削除
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
