import React, { useState } from 'react'

const API = 'http://localhost:4000/api'

export default function Admin(){
  const [password, setPassword] = useState('')
  const [posts, setPosts] = useState([])
  const [loaded, setLoaded] = useState(false)

  async function load(){
    const res = await fetch(API+'/admin/posts', { headers: { 'x-admin-password': password }})
    if(res.ok){
      const json = await res.json()
      setPosts(json)
      setLoaded(true)
    } else {
      alert('認証失敗または取得エラー')
    }
  }

  async function del(id){
    if(!confirm('この投稿を削除しますか？')) return
    const res = await fetch(`${API}/posts/${id}`, { method:'DELETE', headers:{ 'x-admin-password': password }})
    if(res.ok){
      setPosts(prev=>prev.filter(p=>p.post_id!==id))
    } else {
      alert('削除に失敗しました')
    }
  }

  return (
    <div>
      <h2>管理ページ</h2>
      <div style={{marginBottom:8}}>
        <input type="password" placeholder="管理パスワード" value={password} onChange={e=>setPassword(e.target.value)} />
        <button onClick={load}>認証して読み込み</button>
      </div>
      {loaded && (
        <div>
          {posts.map(p=> (
            <div key={p.post_id} style={{border:'1px solid #ddd', padding:8, marginBottom:8}}>
              <div><strong>{p.nickname}</strong> <small>{new Date(p.timestamp).toLocaleString()}</small></div>
              <div>{p.content}</div>
              {p.imageUrl && <img src={`http://localhost:4000${p.imageUrl}`} style={{maxWidth:'200px',display:'block',marginTop:8}} alt="" />}
              <div style={{marginTop:8}}>
                <button onClick={()=>del(p.post_id)}>削除</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
