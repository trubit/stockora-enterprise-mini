import { io } from 'socket.io-client';
import { getSocketBaseUrl } from './utils/url.ts';

export const socket = io(getSocketBaseUrl(), {
  autoConnect: true,
  transports: ['polling', 'websocket'],
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
  timeout: 10000,
});

socket.on('connect_error', (err) => {
  console.warn('[Socket.IO] Connection warning:', err.message);
});

export default socket;
