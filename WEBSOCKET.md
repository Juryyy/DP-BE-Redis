# WebSocket Real-Time Updates

This document describes the WebSocket implementation for real-time updates in the Document Processing API.

## Overview

The API provides real-time updates via WebSocket using Socket.IO. This allows clients to receive immediate notifications about:

- Session progress (0-100%)
- Individual model execution results
- Clarification requests from AI
- Session completion
- Errors

## Connection

### Endpoint

```
ws://localhost:3000/socket.io/
```

### Client Libraries

**JavaScript/TypeScript:**
```bash
npm install socket.io-client
```

**Python:**
```bash
pip install python-socketio
```

**Other languages:** See [Socket.IO documentation](https://socket.io/docs/v4/)

## Client Implementation

### JavaScript/TypeScript

```typescript
import { io } from 'socket.io-client';

// Connect to WebSocket server
const socket = io('http://localhost:3000', {
  path: '/socket.io/',
  transports: ['websocket', 'polling']
});

// Handle connection
socket.on('connect', () => {
  console.log('Connected to WebSocket:', socket.id);
});

// Subscribe to a session
const sessionId = 'your-session-id';
socket.emit('subscribe', sessionId);

// Listen for subscription confirmation
socket.on('subscribed', (data) => {
  console.log('Subscribed to session:', data.sessionId);
});

// Listen for progress updates
socket.on('progress', (data) => {
  console.log(`Progress: ${data.progress}%`);
  console.log('Prompts:', data.prompts);
  console.log('Status:', data.status);
});

// Listen for model results (multi-model execution)
socket.on('model_result', (data) => {
  console.log(`Model: ${data.modelName}`);
  console.log(`Provider: ${data.provider}`);
  console.log(`Duration: ${data.duration}ms`);
  console.log(`Status: ${data.status}`);

  if (data.status === 'completed') {
    console.log('Result:', data.result);
  } else if (data.error) {
    console.error('Error:', data.error);
  }
});

// Listen for clarification requests
socket.on('clarification', (data) => {
  console.log('Clarification needed:');
  console.log('Question:', data.question);
  console.log('Clarification ID:', data.clarificationId);
  // Prompt user to answer and POST to /api/wizard/clarifications/respond
});

// Listen for session completion
socket.on('completed', (data) => {
  console.log('Session completed!');
  console.log('Result:', data.result);
});

// Listen for errors
socket.on('error', (data) => {
  console.error('Session error:', data.error);
});

// Unsubscribe when done
socket.emit('unsubscribe', sessionId);

// Disconnect when finished
socket.on('disconnect', () => {
  console.log('Disconnected from WebSocket');
});
```

### React Hook Example

```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SessionProgress {
  progress: number;
  status: string;
  prompts: {
    total: number;
    completed: number;
    processing: number;
    pending: number;
    failed: number;
  };
}

export function useSessionWebSocket(sessionId: string | null) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [progress, setProgress] = useState<SessionProgress | null>(null);
  const [modelResults, setModelResults] = useState<any[]>([]);
  const [clarifications, setClarifications] = useState<any[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    // Initialize socket
    const newSocket = io('http://localhost:3000', {
      path: '/socket.io/',
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      newSocket.emit('subscribe', sessionId);
    });

    newSocket.on('progress', (data) => {
      setProgress(data);
    });

    newSocket.on('model_result', (data) => {
      setModelResults(prev => [...prev, data]);
    });

    newSocket.on('clarification', (data) => {
      setClarifications(prev => [...prev, data]);
    });

    newSocket.on('completed', () => {
      setIsCompleted(true);
    });

    setSocket(newSocket);

    // Cleanup
    return () => {
      newSocket.emit('unsubscribe', sessionId);
      newSocket.disconnect();
    };
  }, [sessionId]);

  return {
    socket,
    progress,
    modelResults,
    clarifications,
    isCompleted
  };
}
```

### Python Client

```python
import socketio

# Create client
sio = socketio.Client()

# Connect handlers
@sio.on('connect')
def on_connect():
    print('Connected to WebSocket')
    sio.emit('subscribe', 'your-session-id')

@sio.on('progress')
def on_progress(data):
    print(f"Progress: {data['progress']}%")
    print(f"Status: {data['status']}")

@sio.on('model_result')
def on_model_result(data):
    print(f"Model {data['modelName']}: {data['status']}")
    if data['status'] == 'completed':
        print(f"Result: {data['result']}")

@sio.on('completed')
def on_completed(data):
    print('Session completed!')
    sio.disconnect()

# Connect
sio.connect('http://localhost:3000', socketio_path='/socket.io/')

# Keep alive
sio.wait()
```

## Event Reference

### Client → Server Events

#### `subscribe`
Subscribe to updates for a specific session.

**Payload:**
```typescript
sessionId: string  // UUID of the session
```

**Response:** `subscribed` event

---

#### `unsubscribe`
Unsubscribe from session updates.

**Payload:**
```typescript
sessionId: string  // UUID of the session
```

**Response:** `unsubscribed` event

---

### Server → Client Events

#### `connected`
Sent immediately after connection is established.

**Payload:**
```typescript
{
  socketId: string;
  timestamp: string;  // ISO 8601 format
}
```

---

#### `subscribed`
Confirmation of subscription to a session.

**Payload:**
```typescript
{
  sessionId: string;
  timestamp: string;
}
```

---

#### `unsubscribed`
Confirmation of unsubscription from a session.

**Payload:**
```typescript
{
  sessionId: string;
  timestamp: string;
}
```

---

#### `progress`
Real-time progress updates for session processing.

**Payload:**
```typescript
{
  sessionId: string;
  status: 'ACTIVE' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  progress: number;  // 0-100
  prompts: {
    total: number;
    completed: number;
    processing: number;
    pending: number;
    failed: number;
  };
  hasClarifications: boolean;
  clarificationCount: number;
  hasResult?: boolean;
  result?: object;
  timestamp: string;
}
```

---

#### `model_result`
Individual model execution result (for multi-model execution).

**Payload:**
```typescript
{
  sessionId: string;
  modelName: string;      // e.g., "llama3.1:8b"
  duration: number;       // milliseconds
  result: string;         // Model response
  status: 'processing' | 'completed' | 'failed';
  error?: string;         // Error message if failed
  timestamp: string;
}
```

---

#### `clarification`
AI needs clarification from the user.

**Payload:**
```typescript
{
  sessionId: string;
  clarificationId: string;  // UUID
  question: string;
  status: 'pending' | 'answered';
  timestamp: string;
}
```

**Action Required:** User must respond via `POST /api/wizard/clarifications/respond`

---

#### `completed`
Session processing completed successfully.

**Payload:**
```typescript
{
  sessionId: string;
  result: object;  // Final result object
  timestamp: string;
}
```

---

#### `error`
An error occurred during processing.

**Payload:**
```typescript
{
  sessionId: string;
  error: string;    // Error message
  timestamp: string;
}
```

---

## Best Practices

### 1. Connection Management

```typescript
// Reconnection strategy
const socket = io('http://localhost:3000', {
  path: '/socket.io/',
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000
});

// Handle reconnection
socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
  // Re-subscribe to sessions
  socket.emit('subscribe', sessionId);
});
```

### 2. Error Handling

```typescript
socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  // Fallback to REST API polling
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});
```

### 3. Multiple Sessions

```typescript
// Subscribe to multiple sessions
const sessionIds = ['session-1', 'session-2', 'session-3'];

sessionIds.forEach(id => {
  socket.emit('subscribe', id);
});

// Track which session emitted each event
socket.on('progress', (data) => {
  console.log(`Progress for ${data.sessionId}:`, data.progress);
});
```

### 4. Memory Management

```typescript
// Cleanup on component unmount
useEffect(() => {
  return () => {
    socket.emit('unsubscribe', sessionId);
    socket.disconnect();
  };
}, []);
```

### 5. Combining with REST API

Use WebSocket for real-time updates and REST API for fetching data:

```typescript
// Initial data fetch via REST
const session = await fetch(`/api/wizard/session/${sessionId}`).then(r => r.json());

// Subscribe to updates via WebSocket
socket.emit('subscribe', sessionId);

// Listen for real-time updates
socket.on('progress', (data) => {
  // Update UI with real-time progress
  updateProgressBar(data.progress);
});
```

## Debugging

### Enable Socket.IO Debug Logs

**Browser:**
```javascript
localStorage.debug = 'socket.io-client:socket';
```

**Node.js:**
```bash
DEBUG=socket.io* node app.js
```

### Monitor Active Connections

Check server logs for connection information:
```
🔌 WebSocket server ready at ws://localhost:3000/socket.io/
WebSocket client connected: abc123xyz
Socket abc123xyz subscribed to session session-id-here
```

### Testing with CLI

Use `wscat` for command-line testing:

```bash
npm install -g wscat
wscat -c "ws://localhost:3000/socket.io/?EIO=4&transport=websocket"
```

## Performance Considerations

- **Connection Pooling:** Socket.IO handles connection pooling automatically
- **Message Buffering:** Messages are buffered during reconnection
- **Scalability:** For multi-instance deployments, configure Redis adapter:

```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: 'redis://localhost:6379' });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

io.adapter(createAdapter(pubClient, subClient));
```

## Troubleshooting

### Common Issues

**1. Connection fails immediately**
- Check CORS settings
- Verify WebSocket port is not blocked by firewall
- Try polling transport: `transports: ['polling', 'websocket']`

**2. No events received**
- Verify you called `socket.emit('subscribe', sessionId)`
- Check sessionId is valid
- Monitor server logs for errors

**3. Disconnects frequently**
- Increase timeout: `timeout: 60000`
- Check network stability
- Review server resource usage

**4. Events arrive out of order**
- This is expected behavior
- Use `timestamp` field to sort events
- Maintain event sequence numbers if order matters

## Example: Full Integration

See the complete example in `examples/websocket-client.ts` for a production-ready implementation with:
- Reconnection handling
- Event buffering
- Error recovery
- State synchronization
- UI integration

## Security

- WebSocket connections inherit CORS settings from Express
- Consider adding authentication via connection query params or headers
- Implement rate limiting for subscribe/unsubscribe events
- Validate sessionId before subscribing

## Further Reading

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Socket.IO Client API](https://socket.io/docs/v4/client-api/)
- [Scaling Socket.IO](https://socket.io/docs/v4/using-multiple-nodes/)
