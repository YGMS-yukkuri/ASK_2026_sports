import { useState, useEffect } from 'react'
import './MainPage.css'
import PostCard from '../components/PostCard'
import PostModal from '../components/PostModal'
import { EmojiEffectLayer, useEmojiEffect } from '../components/EmojiEffect'
import { useWebSocket } from '../hooks/useWebSocket'

export default function MainPage({ deviceId, showPostModal, onCloseModal }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPosts, setTotalPosts] = useState(0)
  // cursorStack[i] = { timestamp, id } to fetch page i (null for first page).
  // Enables keyset (cursor) pagination — no OFFSET, O(log n) regardless of depth.
  const [cursorStack, setCursorStack] = useState([null])
  const postsPerPage = 10

  const { containerRef: emojiContainerRef, trigger: triggerEmoji } = useEmojiEffect()

  const { connected } = useWebSocket((message) => {
    if (message.type === 'new_post') {
      setPosts(prev => [message.data, ...prev])
    } else if (message.type === 'post_deleted') {
      setPosts(prev => prev.filter(p => p.id !== message.data.postId))
    } else if (message.type === 'post_restored') {
      // Re-insert the restored post in timestamp order (avoid duplicates).
      setPosts(prev => {
        if (prev.some(p => p.id === message.data.id)) return prev
        return [...prev, message.data].sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        )
      })
    } else if (message.type === 'reaction_update') {
      setPosts(prev => prev.map(p =>
        p.id === message.data.postId
          ? { ...p, reactions: message.data.reactions }
          : p
      ))
      if (message.data.added && message.data.changedReaction) {
        triggerEmoji(message.data.changedReaction)
      }
    }
  }, { deviceId, role: 'user' })

  useEffect(() => {
    fetchPosts(0, null)
  }, [])

  async function fetchPosts(pageNum, cursor) {
    try {
      setLoading(true)
      const params = new URLSearchParams({ limit: postsPerPage })
      if (cursor) {
        params.set('before', cursor.timestamp)
        params.set('beforeId', cursor.id)
      }
      const response = await fetch(`/api/posts?${params}`)
      const data = await response.json()
      setPosts(data.posts)
      setTotalPosts(data.total)
      setPage(pageNum)

      // Store cursor for the next page (last item of the current page)
      if (data.posts.length > 0) {
        const last = data.posts[data.posts.length - 1]
        setCursorStack(prev => {
          const next = [...prev]
          next[pageNum + 1] = { timestamp: last.timestamp, id: last.id }
          return next
        })
      }
    } catch (error) {
      console.error('Error fetching posts:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(totalPosts / postsPerPage)

  return (
    <div className="main-page">
      <EmojiEffectLayer containerRef={emojiContainerRef} />
      <PostModal
        deviceId={deviceId}
        isOpen={showPostModal}
        onClose={onCloseModal}
      />

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : posts.length === 0 ? (
        <div className="no-posts">
          <p>まだ投稿がありません</p>
        </div>
      ) : (
        <>
          <div className="posts-container">
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                deviceId={deviceId}
                isOwnPost={post.device_id === deviceId}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => fetchPosts(page - 1, cursorStack[page - 1] ?? null)}
                disabled={page === 0}
              >
                前へ
              </button>
              <span className="page-info">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => fetchPosts(page + 1, cursorStack[page + 1] ?? null)}
                disabled={page >= totalPages - 1}
              >
                次へ
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
