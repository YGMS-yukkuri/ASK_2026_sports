import { useEffect, useRef } from 'react'
import './EmojiEffect.css'

const REACTIONS = {
  like: '👍',
  heart: '❤️',
  fire: '🔥',
  surprise: '😲'
}

// Spawns 4 emoji particles flying across the screen.
// Call trigger(reactionType) to fire the effect.
export function useEmojiEffect() {
  const containerRef = useRef(null)

  function trigger(reactionType) {
    const emoji = REACTIONS[reactionType]
    if (!emoji || !containerRef.current) return

    for (let i = 0; i < 4; i++) {
      const el = document.createElement('span')
      el.className = 'emoji-particle'
      el.textContent = emoji

      // Random starting position on the edges of the screen
      const side = Math.floor(Math.random() * 4) // 0=top 1=right 2=bottom 3=left
      let startX, startY, endX, endY
      const W = window.innerWidth
      const H = window.innerHeight

      if (side === 0) {
        startX = Math.random() * W; startY = -40
        endX = (Math.random() - 0.5) * W * 0.8 + W / 2
        endY = H * (0.3 + Math.random() * 0.5)
      } else if (side === 1) {
        startX = W + 40; startY = Math.random() * H
        endX = W * (0.1 + Math.random() * 0.4)
        endY = (Math.random() - 0.5) * H * 0.8 + H / 2
      } else if (side === 2) {
        startX = Math.random() * W; startY = H + 40
        endX = (Math.random() - 0.5) * W * 0.8 + W / 2
        endY = H * (0.1 + Math.random() * 0.4)
      } else {
        startX = -40; startY = Math.random() * H
        endX = W * (0.5 + Math.random() * 0.4)
        endY = (Math.random() - 0.5) * H * 0.8 + H / 2
      }

      el.style.left = `${startX}px`
      el.style.top = `${startY}px`
      el.style.setProperty('--dx', `${endX - startX}px`)
      el.style.setProperty('--dy', `${endY - startY}px`)
      el.style.animationDelay = `${i * 80}ms`
      el.style.fontSize = `${28 + Math.random() * 20}px`

      containerRef.current.appendChild(el)
      el.addEventListener('animationend', () => el.remove(), { once: true })
    }
  }

  return { containerRef, trigger }
}

export function EmojiEffectLayer({ containerRef }) {
  return <div ref={containerRef} className="emoji-effect-layer" aria-hidden="true" />
}
