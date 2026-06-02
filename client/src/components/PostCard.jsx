import { useState, useEffect } from 'react'
import './PostCard.css'

function PostImage({ src, alt }) {
  const [state, setState] = useState('loading') // loading | loaded | error

  return (
    <div className="post-image-wrapper">
      {state === 'loading' && <div className="image-skeleton" aria-hidden="true" />}
      {state === 'error' && (
        <div className="image-error" aria-label="画像を読み込めませんでした">📷</div>
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={`post-image${state === 'loaded' ? ' loaded' : ''}`}
        onLoad={() => setState('loaded')}
        onError={() => setState('error')}
      />
    </div>
  )
}

const REACTIONS = {
  like: '👍',
  heart: '❤️',
  fire: '🔥',
  surprise: '😲'
}

export default function PostCard({ post, deviceId, isOwnPost }) {
  const [reactions, setReactions] = useState(post.reactions || {})
  const [userReactions, setUserReactions] = useState({})
  const [animatingReactions, setAnimatingReactions] = useState({})

  // Update reactions when post.reactions changes (for WebSocket real-time sync)
  useEffect(() => {
    const newReactions = post.reactions || {}
    const prevReactions = reactions || {}
    
    // Detect which reactions changed and determine direction (up/down)
    const changedReactions = {}
    Object.entries(REACTIONS).forEach(([type]) => {
      const newCount = newReactions[type] || 0
      const oldCount = prevReactions[type] || 0
      if (newCount !== oldCount) {
        // 'up' if increased, 'down' if decreased
        changedReactions[type] = newCount > oldCount ? 'up' : 'down'
      }
    })
    
    // Update reactions state
    setReactions(newReactions)
    
    // Trigger animation if any reactions changed
    if (Object.keys(changedReactions).length > 0) {
      // Remove animation class first to allow retriggering on rapid clicks
      setAnimatingReactions({})
      
      // Use requestAnimationFrame to ensure DOM update before re-adding animation
      requestAnimationFrame(() => {
        setAnimatingReactions(changedReactions)
      })
    }
  }, [post.reactions])

  // Handle animation end to reset animation state
  const handleAnimationEnd = (reactionType) => {
    setAnimatingReactions(prev => {
      const updated = { ...prev }
      delete updated[reactionType]
      return updated
    })
  }

  // Fetch user's reactions from server on mount
  useEffect(() => {
    const fetchUserReactions = async () => {
      try {
        const response = await fetch(`/api/posts/${post.id}/user-reactions?device_id=${deviceId}`)
        if (response.ok) {
          const data = await response.json()
          setUserReactions(data || {})
        }
      } catch (error) {
        console.error('Error fetching user reactions:', error)
      }
    }

    fetchUserReactions()
  }, [post.id, deviceId])

  async function handleReaction(reactionType) {
    try {
      const response = await fetch(`/api/posts/${post.id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          reaction_type: reactionType
        })
      })

      if (response.ok) {
        const data = await response.json()
        setReactions(data.reactions)
        
        // Update user reactions state
        const newUserReactions = {
          ...userReactions,
          [reactionType]: !userReactions[reactionType]
        };
        setUserReactions(newUserReactions)
      }
    } catch (error) {
      console.error('Error toggling reaction:', error)
    }
  }

  const timestamp = new Date(post.timestamp).toLocaleString('ja-JP')

  // Build a safe image URL. Rejects dangerous protocols to prevent XSS.
  const getImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    const lower = imageUrl.toLowerCase().replace(/\s/g, '');
    // Block javascript:, data:text/html, vbscript:, and similar
    if (/^(javascript|vbscript|data:text\/html|data:application):/i.test(lower)) return null;
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    if (imageUrl.startsWith('/images/')) {
      return `/api${imageUrl}`;
    }
    // Only allow /api/images/ relative paths from the server
    if (imageUrl.startsWith('/api/images/')) {
      return imageUrl;
    }
    return null;
  };

  return (
    <div className={`post-card ${isOwnPost ? 'own-post' : ''}`}>
      <div className="post-header">
        <div className="post-info">
          <span className="nickname">{post.nickname}</span>
          <span className="timestamp">{timestamp}</span>
        </div>
      </div>

      <div className="post-content">
        {post.content}
      </div>

      {post.image_url && (
        <PostImage src={getImageUrl(post.image_url)} alt="投稿画像" />
      )}

      <div className="post-footer">
        <div className="reactions">
          {Object.entries(REACTIONS).map(([type, emoji]) => (
            <button
              key={type}
              className={`reaction-btn ${userReactions[type] ? 'active' : ''} ${animatingReactions[type] === 'up' ? 'pulse-animate' : ''} ${animatingReactions[type] === 'down' ? 'fade-animate' : ''}`}
              onClick={() => handleReaction(type)}
              title={userReactions[type] ? 'リアクションを削除' : 'リアクションを追加'}
            >
              <span className="emoji">{emoji}</span>
              <span 
                className={`count ${animatingReactions[type] === 'up' ? 'count-flip-up' : animatingReactions[type] === 'down' ? 'count-fade-down' : ''}`}
                onAnimationEnd={() => handleAnimationEnd(type)}
              >
                {reactions[type] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
