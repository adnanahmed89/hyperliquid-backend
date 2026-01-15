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

// Connect to Hyperliquid
function connectToHyperliquid() {
  console.log('Connecting to Hyperliquid...');
  
  hyperliquidWs = new WebSocket('wss://api.hyperliquid.xyz/ws');

  hyperliquidWs.on('open', () => {
    console.log('Connected to Hyperliquid WebSocket');
    
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
  });

  hyperliquidWs.on('close', () => {
    console.log('Hyperliquid connection closed. Reconnecting in 5s...');
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    hyperliquidConnected: hyperliquidWs && hyperliquidWs.readyState === WebSocket.OPEN,
    trackedCoins: TRACKED_COINS,
    connectedClients: wss.clients.size
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
