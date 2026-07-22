const WebSocket = require('ws');

const wsUrl = process.argv[2] || 'ws://localhost:9222/devtools/page/0B5C67B2CC4E2B1A98DD4434861019E3';
const expression = process.argv[3] || 'document.title';

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
});

let step = 0;
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.id === 1 && step === 0) {
    step = 1;
    ws.send(JSON.stringify({
      id: 2,
      method: 'Runtime.evaluate',
      params: { expression, returnByValue: true }
    }));
  }
  if (msg.id === 2) {
    const val = msg.result?.result?.value;
    console.log(val || JSON.stringify(msg));
    ws.close();
  }
});

ws.on('close', () => process.exit(0));
ws.on('error', (e) => { console.error('ERR:', e.message); process.exit(1); });
setTimeout(() => process.exit(1), 15000);
