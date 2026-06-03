// Tracks online presence by device_id (not raw socket count), because a single
// user/tab opens several WebSocket connections (Navigation, MainPage, ...).
// Counting unique device_ids gives an accurate "n people online" figure.

const deviceCounts = new Map(); // deviceId -> number of open sockets for that device
let pending = null;

export function addDevice(deviceId) {
  if (!deviceId) return;
  deviceCounts.set(deviceId, (deviceCounts.get(deviceId) || 0) + 1);
}

export function removeDevice(deviceId) {
  if (!deviceId) return;
  const c = deviceCounts.get(deviceId);
  if (c == null) return;
  if (c <= 1) deviceCounts.delete(deviceId);
  else deviceCounts.set(deviceId, c - 1);
}

export function getOnlineCount() {
  return deviceCounts.size;
}

// Debounced broadcast of the current online count to every client. Coalesces
// bursts of connect/disconnect events into a single message.
export function broadcastPresence(wss) {
  if (!wss || pending) return;
  pending = setTimeout(() => {
    pending = null;
    const payload = JSON.stringify({
      type: 'presence',
      data: { online: deviceCounts.size },
    });
    wss.clients.forEach(client => {
      if (client.readyState === 1) client.send(payload);
    });
  }, 300);
}
