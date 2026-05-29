import React, { useEffect, useState } from 'react'

const API = 'http://localhost:4000/api'
const WS = 'http://localhost:4000'

function PostForm({ onPosted }) {
  const [nickname, setNickname] = useState(localStorage.getItem('nickname')||'')
  const [content, setContent] = useState('')
  const [image, setImage] = useState(null)

  useEffect(()=>{
    if(nickname) localStorage.setItem('nickname', nickname)
  },[nickname])

  async function submit(e){
    e.preventDefault()
    const device_id = localStorage.getItem('device_id') || (()=>{ const id = crypto.randomUUID(); localStorage.setItem('device_id', id); return id })()
    const fd = new FormData()
    fd.append('nickname', nickname)
    fd.append('content', content)
    fd.append('device_id', device_id)
    if(image) fd.append('image', image)

    const res = await fetch(API+'/posts', { method:'POST', body: fd })
    if(res.ok){
      const json = await res.json()
      setContent('')
      setImage(null)
      onPosted(json)
    } else {
      const err = await res.json()
      alert(err.error||'投稿失敗')
    }
  }

  return (
    <form onSubmit={submit} className="post-form">
      <input value={nickname} onChange={e=>setNickname(e.target.value)} placeholder="ニックネーム (必須)" required />
      <textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="投稿内容 (200文字以内)" maxLength={200} required />
      <input type="file" accept="image/*" onChange={e=>setImage(e.target.files[0])} />
      <button type="submit">投稿</button>
    </form>
  )
}

function PostList({ posts }){
  return (
    <div className="posts">
      {posts.map(p=> (
        <div key={p.post_id} className={`post ${p.device_id===localStorage.getItem('device_id')? 'mine':''}`}>
          <div className="meta">
            <strong>{p.nickname}</strong>
            <span>{new Date(p.timestamp).toLocaleString()}</span>
          </div>
          <div className="content">{p.content}</div>
          {p.imageUrl && <img src={`http://localhost:4000${p.imageUrl}`} alt="" />}
          <div className="reactions">
            <span>🔥 {p.reactions.fire}</span>
            <span>❤️ {p.reactions.heart}</span>
            <span>👍 {p.reactions.like}</span>
            <span>😮 {p.reactions.surprise}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

import Admin from './Admin'

export default function App(){
  const [posts, setPosts] = useState([])
  const [route, setRoute] = useState(window.location.hash.replace('#','') || '/')

  useEffect(()=>{ fetch(API+'/posts').then(r=>r.json()).then(setPosts) },[])

  useEffect(()=>{
    let socket
    ;(async()=>{
      socket = (await import('socket.io-client')).io(WS)
      socket.on('new_post', p=> setPosts(prev=>[p, ...prev]))
      socket.on('delete_post', d=> setPosts(prev=>prev.filter(p=>p.post_id!==d.post_id)))
    })()
    return ()=> socket && socket.close()
  },[])

  useEffect(()=>{
    const onHash = ()=> setRoute(window.location.hash.replace('#','') || '/')
    window.addEventListener('hashchange', onHash)
    return ()=> window.removeEventListener('hashchange', onHash)
  },[])

  return (
    <div className="container">
      <h1>体育祭 掲示板</h1>
      <nav style={{marginBottom:12}}>
        <a href="#/">Home</a> |
        <a href="#/admin"> Admin</a>
      </nav>
      {route === '/' && (
        <>
          <PostForm onPosted={p=> setPosts(prev=>[p,...prev])} />
          <PostList posts={posts} />
        </>
      )}
      {route === '/admin' && <Admin />}
    </div>
  )
}
