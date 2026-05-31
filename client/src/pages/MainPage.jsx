import { useState, useEffect } from 'react'
import './MainPage.css'
import PostCard from '../components/PostCard'
import PostModal from '../components/PostModal'
import { useWebSocket } from '../hooks/useWebSocket'

export default function MainPage({ deviceId, showPostModal, onCloseModal }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPosts, setTotalPosts] = useState(0)
  const postsPerPage = 10

  const { connected } = useWebSocket((message) => {
    if (message.type === 'new_post') {
      setPosts(prev => [message.data, ...prev])
    } else if (message.type === 'post_deleted') {
      setPosts(prev => prev.filter(p => p.id !== message.data.postId))
    } else if (message.type === 'reaction_update') {
      setPosts(prev => prev.map(p => 
        p.id === message.data.postId 
          ? { ...p, reactions: message.data.reactions }
          : p
      ))
    }
  })

  useEffect(() => {
    fetchPosts(0)
  }, [])

  async function fetchPosts(pageNum) {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/posts?limit=${postsPerPage}&offset=${pageNum * postsPerPage}`
      )
      const data = await response.json()
      setPosts(data.posts)
      setTotalPosts(data.total)
      setPage(pageNum)
    } catch (error) {
      console.error('Error fetching posts:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(totalPosts / postsPerPage)

  return (
    <div className="main-page">
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
          <button 
            className="btn-post-large"
            onClick={() => setShowPostModal(true)}
          >
            ✏️ 最初の投稿をしてみよう！
          </button>
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
                onClick={() => fetchPosts(page - 1)}
                disabled={page === 0}
              >
                前へ
              </button>
              <span className="page-info">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => fetchPosts(page + 1)}
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
