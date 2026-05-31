import { useState, useRef } from 'react'
import './PostModal.css'

export default function PostModal({ deviceId, isOpen, onClose }) {
  const [nickname, setNickname] = useState(() => {
    return localStorage.getItem('nickname') || ''
  })
  const [content, setContent] = useState('')
  const [image, setImage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [charCount, setCharCount] = useState(0)
  const fileInputRef = useRef(null)

  function handleContentChange(e) {
    const text = e.target.value
    setContent(text)
    setCharCount(text.length)
  }

  function handleImageChange(e) {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 20 * 1024 * 1024) { // 20MB
        setError('画像サイズは20MB以下にしてください')
        setImage(null)
        return
      }
      setImage(file)
      setError('')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    e.stopPropagation()
    
    // Prevent double submission
    if (loading) return
    
    setError('')

    if (!nickname.trim()) {
      setError('ニックネームを入力してください')
      return
    }

    if (!content.trim()) {
      setError('投稿内容を入力してください')
      return
    }

    if (content.length > 200) {
      setError('投稿内容は200文字以下にしてください')
      return
    }

    try {
      setLoading(true)
      const formData = new FormData()
      formData.append('nickname', nickname)
      formData.append('content', content)
      formData.append('device_id', deviceId)
      
      if (image) {
        formData.append('image', image)
      }

      const response = await fetch('/api/posts', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || '投稿に失敗しました')
        setLoading(false)
        return
      }

      // Save nickname
      localStorage.setItem('nickname', nickname)

      // Reset form
      setContent('')
      setImage(null)
      setCharCount(0)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      setLoading(false)
      // Close modal
      onClose()
    } catch (err) {
      console.error('Error posting:', err)
      setError('投稿に失敗しました')
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📝 新規投稿</h2>
          <button
            className="modal-close"
            onClick={onClose}
            disabled={loading}
          >
            ×
          </button>
        </div>

        {error && (
          <div className="alert alert-error">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="post-form">
          <div className="form-group">
            <label htmlFor="nickname">ニックネーム *</label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="ニックネームを入力"
              maxLength="50"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="content">
              投稿内容 * 
              <span className="char-count">
                ({charCount}/200)
              </span>
            </label>
            <textarea
              id="content"
              value={content}
              onChange={handleContentChange}
              placeholder="応援メッセージを入力してください"
              maxLength="200"
              rows="6"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="image">画像 (オプション)</label>
            <input
              id="image"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              disabled={loading}
            />
            {image && (
              <div className="image-preview">
                <img src={URL.createObjectURL(image)} alt="Preview" />
                <button
                  type="button"
                  onClick={() => {
                    setImage(null)
                    if (fileInputRef.current) {
                      fileInputRef.current.value = ''
                    }
                  }}
                  className="remove-image"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? '投稿中...' : '投稿する'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
