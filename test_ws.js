const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000/ws-api');
ws.on('open', () => {
  console.log('Connected!');
  ws.send('ping');
});
ws.on('message', (msg) => {
  console.log('Received:', msg.toString());
  ws.close();
});
ws.on('error', (err) => {
  console.error('Error:', err);
});
ws.on('close', () => {
  console.log('Closed');
});
