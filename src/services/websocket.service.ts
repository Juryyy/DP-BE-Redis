import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../config/logger';
import { redisSubClient } from '../config/redis';

export interface SessionProgressUpdate {
  sessionId: string;
  status: string;
  progress: number;
  prompts?: {
    total: number;
    completed: number;
    processing: number;
    pending: number;
    failed: number;
  };
  hasClarifications?: boolean;
  clarificationCount?: number;
  hasResult?: boolean;
  result?: any;
  timestamp: string;
}

export interface ModelResultUpdate {
  sessionId: string;
  modelName: string;
  duration: number;
  result: string;
  status: 'processing' | 'completed' | 'failed';
  error?: string;
  timestamp: string;
}

export interface ClarificationUpdate {
  sessionId: string;
  clarificationId: string;
  question: string;
  status: 'pending' | 'answered';
  timestamp: string;
}

class WebSocketService {
  private io: SocketIOServer | null = null;
  private connectedClients: Map<string, Set<string>> = new Map(); // sessionId -> Set of socket IDs

  /**
   * Initialize WebSocket server
   */
  initialize(server: HTTPServer): void {
    if (this.io) {
      logger.warn('WebSocket server already initialized');
      return;
    }

    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
      },
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
    this.setupRedisSubscriptions();

    logger.info('WebSocket server initialized');
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      logger.info(`WebSocket client connected: ${socket.id}`);

      // Handle session subscription
      socket.on('subscribe', (sessionId: string) => {
        this.subscribeToSession(socket, sessionId);
      });

      // Handle session unsubscription
      socket.on('unsubscribe', (sessionId: string) => {
        this.unsubscribeFromSession(socket, sessionId);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      // Send welcome message
      socket.emit('connected', {
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Setup Redis pub/sub subscriptions
   */
  private async setupRedisSubscriptions(): Promise<void> {
    try {
      // Subscribe to all session-related events
      await redisSubClient.psubscribe('session:*', (message, channel) => {
        this.handleRedisMessage(channel, message);
      });

      logger.info('Redis pub/sub subscriptions established');
    } catch (error) {
      logger.error('Failed to setup Redis subscriptions:', error);
    }
  }

  /**
   * Handle Redis pub/sub messages
   */
  private handleRedisMessage(channel: string, message: string): void {
    try {
      const data = JSON.parse(message);

      // Extract sessionId from channel name (e.g., "session:abc123:progress")
      const parts = channel.split(':');
      if (parts.length < 2) return;

      const sessionId = parts[1];
      const eventType = parts[2] || 'update';

      // Emit to all clients subscribed to this session
      this.emitToSession(sessionId, eventType, data);
    } catch (error) {
      logger.error('Error handling Redis message:', error);
    }
  }

  /**
   * Subscribe socket to session updates
   */
  private subscribeToSession(socket: Socket, sessionId: string): void {
    const roomName = `session:${sessionId}`;
    socket.join(roomName);

    // Track connection
    if (!this.connectedClients.has(sessionId)) {
      this.connectedClients.set(sessionId, new Set());
    }
    this.connectedClients.get(sessionId)!.add(socket.id);

    logger.info(`Socket ${socket.id} subscribed to session ${sessionId}`);

    socket.emit('subscribed', {
      sessionId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Unsubscribe socket from session updates
   */
  private unsubscribeFromSession(socket: Socket, sessionId: string): void {
    const roomName = `session:${sessionId}`;
    socket.leave(roomName);

    // Remove from tracking
    const clients = this.connectedClients.get(sessionId);
    if (clients) {
      clients.delete(socket.id);
      if (clients.size === 0) {
        this.connectedClients.delete(sessionId);
      }
    }

    logger.info(`Socket ${socket.id} unsubscribed from session ${sessionId}`);

    socket.emit('unsubscribed', {
      sessionId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle socket disconnect
   */
  private handleDisconnect(socket: Socket): void {
    // Remove from all session subscriptions
    for (const [sessionId, clients] of this.connectedClients.entries()) {
      if (clients.has(socket.id)) {
        clients.delete(socket.id);
        if (clients.size === 0) {
          this.connectedClients.delete(sessionId);
        }
      }
    }

    logger.info(`WebSocket client disconnected: ${socket.id}`);
  }

  /**
   * Emit event to all clients subscribed to a session
   */
  private emitToSession(sessionId: string, event: string, data: any): void {
    if (!this.io) return;

    const roomName = `session:${sessionId}`;
    this.io.to(roomName).emit(event, {
      ...data,
      sessionId,
      timestamp: new Date().toISOString(),
    });

    logger.debug(`Emitted ${event} to session ${sessionId}`);
  }

  /**
   * Broadcast session progress update
   */
  public broadcastProgress(update: SessionProgressUpdate): void {
    this.emitToSession(update.sessionId, 'progress', update);
  }

  /**
   * Broadcast model result update
   */
  public broadcastModelResult(update: ModelResultUpdate): void {
    this.emitToSession(update.sessionId, 'model_result', update);
  }

  /**
   * Broadcast clarification request
   */
  public broadcastClarification(update: ClarificationUpdate): void {
    this.emitToSession(update.sessionId, 'clarification', update);
  }

  /**
   * Broadcast session completion
   */
  public broadcastCompletion(sessionId: string, result: any): void {
    this.emitToSession(sessionId, 'completed', {
      sessionId,
      result,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast session error
   */
  public broadcastError(sessionId: string, error: any): void {
    this.emitToSession(sessionId, 'error', {
      sessionId,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get number of connected clients for a session
   */
  public getClientCount(sessionId: string): number {
    return this.connectedClients.get(sessionId)?.size || 0;
  }

  /**
   * Get total number of connected clients
   */
  public getTotalClientCount(): number {
    let total = 0;
    for (const clients of this.connectedClients.values()) {
      total += clients.size;
    }
    return total;
  }

  /**
   * Shutdown WebSocket server
   */
  public async shutdown(): Promise<void> {
    if (!this.io) return;

    logger.info('Shutting down WebSocket server...');

    // Disconnect all clients
    this.io.disconnectSockets();

    // Close server
    await new Promise<void>((resolve) => {
      this.io!.close(() => {
        logger.info('WebSocket server closed');
        resolve();
      });
    });

    this.io = null;
    this.connectedClients.clear();
  }
}

export const websocketService = new WebSocketService();
