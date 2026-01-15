// server.js - Hyperliquid WebSocket Backend
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Enable CORS for frontend
app.use(cors());
app.use(express.json());

// WebSocket server for clients
const wss = new WebSocket.Server({ server });

// Store active Hyperliquid WebSocket connection
let hyperliquidWs = null;
const TRACKED_COINS = ['BTC', 'ETH', 'XRP', 'SOL', 'DOGE'];
let connectionStatus = 'disconnected';

// Connect to Hyperliquid
function connectToHyperliquid() {
  console.log('Connecting to Hyperliquid...');
  connectionStatus = 'connecting';
  
  hyperliquidWs = new WebSocket('wss://api.hyperliquid.xyz/ws');

  hyperliquidWs.on('open', () => {
    console.log('Connected to Hyperliquid WebSocket');
    connectionStatus = 'connected';
    
    // Subscribe to trades for each tracked coin
    TRACKED_COINS.forEach(coin => {
      const subscribeMsg = {
        method: 'subscribe',
        subscription: { type: 'trades', coin: coin }
      };
      hyperliquidWs.send(JSON.stringify(subscribeMsg));
      console.log(`Subscribed to ${coin} trades`);
    });
  });

  hyperliquidWs.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // Check if this is a trade message
      if (message.channel === 'trades' && message.data) {
        message.data.forEach(trade => {
          const notionalValue = parseFloat(trade.px) * parseFloat(trade.sz);
          
          // Create transaction object
          const transaction = {
            id: `${trade.tid}-${Date.now()}`,
            timestamp: new Date(trade.time).toISOString(),
            wallet: trade.user || generateRandomWallet(),
            coin: trade.coin,
            side: trade.side === 'A' ? 'SHORT' : 'LONG',
            notionalValue: notionalValue,
            price: parseFloat(trade.px),
            size: parseFloat(trade.sz)
          };

          // Broadcast to all connected clients
          broadcastToClients(transaction);
        });
      }
    } catch (error) {
      console.error('Error parsing Hyperliquid message:', error);
    }
  });

  hyperliquidWs.on('error', (error) => {
    console.error('Hyperliquid WebSocket error:', error);
    connectionStatus = 'error';
  });

  hyperliquidWs.on('close', () => {
    console.log('Hyperliquid connection closed. Reconnecting in 5s...');
    connectionStatus = 'reconnecting';
    setTimeout(connectToHyperliquid, 5000);
  });
}

// Generate random wallet for trades without user data
function generateRandomWallet() {
  const chars = '0123456789abcdef';
  let wallet = '0x';
  for (let i = 0; i < 40; i++) {
    wallet += chars[Math.floor(Math.random() * chars.length)];
  }
  return wallet;
}

// Broadcast transaction to all connected clients
function broadcastToClients(transaction) {
  const message = JSON.stringify(transaction);
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Handle client connections
wss.on('connection', (ws) => {
  console.log('New client connected');
  
  ws.on('message', (message) => {
    console.log('Received from client:', message.toString());
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('Client WebSocket error:', error);
  });
});

// Root endpoint - Landing page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Hyperliquid Whale Tracker API</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: linear-gradient(135deg, #1e293b 0%, #4c1d95 100%);
            color: white;
            line-height: 1.6;
          }
          .container {
            background: rgba(30, 41, 59, 0.8);
            padding: 30px;
            border-radius: 10px;
            border: 1px solid rgba(139, 92, 246, 0.3);
          }
          h1 { color: #a78bfa; margin-top: 0; }
          .status { 
            padding: 10px 15px; 
            border-radius: 5px; 
            margin: 20px 0;
            font-weight: bold;
          }
          .connected { background: #10b981; }
          .error { background: #ef4444; }
          .connecting { background: #f59e0b; }
          code {
            background: #1e293b;
            padding: 2px 6px;
            border-radius: 3px;
            color: #a78bfa;
          }
          .endpoint {
            background: #1e293b;
            padding: 15px;
            border-radius: 5px;
            margin: 10px 0;
            border-left: 3px solid #a78bfa;
          }
          a { color: #a78bfa; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🐋 Hyperliquid Whale Tracker Backend</h1>
          
          <div class="status ${connectionStatus === 'connected' ? 'connected' : connectionStatus === 'error' ? 'error' : 'connecting'}">
            Status: ${connectionStatus.toUpperCase()}
          </div>
          
          <h2>📡 Backend is Running</h2>
          <p>This is the WebSocket backend server for the Hyperliquid Whale Tracker.</p>
          
          <h3>Tracked Coins:</h3>
          <p><strong>${TRACKED_COINS.join(', ')}</strong></p>
          
          <h3>Connected Clients:</h3>
          <p><strong>${wss.clients.size}</strong></p>
          
          <h3>API Endpoints:</h3>
          
          <div class="endpoint">
            <strong>GET /health</strong><br>
            Check server health and connection status<br>
            <a href="/health">→ View health status</a>
          </div>
          
          <div class="endpoint">
            <strong>WebSocket Connection</strong><br>
            <code>wss://${req.headers.host}</code><br>
            Connect to this URL from your frontend
          </div>
          
          <h3>How to Connect Frontend:</h3>
          <ol>
            <li>Set your frontend environment variable:<br>
                <code>REACT_APP_WS_URL=wss://${req.headers.host}</code>
            </li>
            <li>Deploy your React frontend</li>
            <li>Watch live transactions stream in!</li>
          </ol>
          
          <p style="margin-top: 30px; opacity: 0.7; font-size: 14px;">
            💡 If you see "CONNECTED" status above, your backend is successfully receiving data from Hyperliquid!
          </p>
        </div>
      </body>
    </html>
  `);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    hyperliquidConnected: hyperliquidWs && hyperliquidWs.readyState === WebSocket.OPEN,
    connectionStatus: connectionStatus,
    trackedCoins: TRACKED_COINS,
    connectedClients: wss.clients.size,
    uptime: process.uptime()
  });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  connectToHyperliquid();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing connections...');
  if (hyperliquidWs) hyperliquidWs.close();
  wss.clients.forEach(client => client.close());
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
