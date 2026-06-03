import { useEffect, useState, useRef } from 'react'

export function useWebSocket(onMessage, identify) {
  const [connected, setConnected] = useState(false)
  const ws = useRef(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5
  const reconnectDelay = useRef(1000)
  const hasInitialized = useRef(false)
  // Identify payload (e.g. { deviceId, role }) sent on every (re)connect so the
  // server can track presence by device and grant roles.
  const identifyRef = useRef(identify)
  identifyRef.current = identify

  useEffect(() => {
    // Prevent double initialization
    if (hasInitialized.current) {
      console.log('[WebSocket] Already initialized, skipping...')
      return
    }
    hasInitialized.current = true

    const connectWebSocket = () => {
      try {
        // Close existing connection if any
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.close()
        }

        // Determine WebSocket protocol and host
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const host = window.location.host // Includes hostname and port (or default port)
        // Use /ws path so Vite dev proxy can forward it to the backend, and
        // production uses the same path consistently.
        const wsUrl = `${protocol}//${host}/ws`

        console.log(`[WebSocket] Attempting to connect to ${wsUrl}`)

        ws.current = new WebSocket(wsUrl)

        ws.current.onopen = () => {
          console.log('[WebSocket] Connected successfully')
          setConnected(true)
          reconnectAttempts.current = 0
          reconnectDelay.current = 1000

          // Announce identity so the server can count unique online devices.
          const id = identifyRef.current
          if (id && id.deviceId) {
            ws.current.send(JSON.stringify({ type: 'identify', ...id }))
          }
        }

        ws.current.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            if (onMessage) {
              onMessage(message)
            }
          } catch (error) {
            console.error('[WebSocket] Error parsing message:', error)
          }
        }

        ws.current.onclose = () => {
          console.log('[WebSocket] Connection closed')
          setConnected(false)

          // Attempt to reconnect
          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current += 1
            console.log(
              `[WebSocket] Reconnecting... (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`
            )
            setTimeout(() => {
              connectWebSocket()
            }, reconnectDelay.current)

            // Exponential backoff: increase delay for next attempt
            reconnectDelay.current = Math.min(reconnectDelay.current * 2, 10000)
          } else {
            console.error(
              '[WebSocket] Max reconnection attempts reached. Please check server status.'
            )
          }
        }

        ws.current.onerror = (error) => {
          console.error('[WebSocket] Connection error:', {
            message: error.message || 'Unknown error',
            type: error.type,
            readyState: ws.current?.readyState,
          })
          setConnected(false)
        }
      } catch (error) {
        console.error('[WebSocket] Failed to create WebSocket:', error)
        setConnected(false)
      }
    }

    connectWebSocket()

    return () => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        console.log('[WebSocket] Closing connection on unmount')
        ws.current.close()
      }
    }
  }, [])

  const send = (message) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message))
      console.log('[WebSocket] Sent:', message)
    } else {
      console.warn('[WebSocket] Cannot send message: WebSocket not connected')
    }
  }

  return { connected, send, ws: ws.current }
}
