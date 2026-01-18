import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Wallet, Copy, Check, AlertCircle } from 'lucide-react';

const HyperliquidMonitor = () => {
  const [transactions, setTransactions] = useState([]);
  const [isLive, setIsLive] = useState(true);
  const [copiedWallet, setCopiedWallet] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [ws, setWs] = useState(null);

  const BACKEND_WS_URL = 'wss://hyperliquid-backend-7cqm.onrender.com';

  useEffect(() => {
    if (!isLive) {
      if (ws) {
        ws.close();
        setWs(null);
      }
      return;
    }

    let websocket = null;
    let reconnectTimeout = null;

    const connect = () => {
      try {
        websocket = new WebSocket(BACKEND_WS_URL);

        websocket.onopen = () => {
          console.log('Connected to backend WebSocket');
          setConnectionStatus('connected');
        };

        websocket.onmessage = (event) => {
          try {
            const transaction = JSON.parse(event.data);
            
            const newTx = {
              id: transaction.id,
              timestamp: new Date(transaction.timestamp).toLocaleTimeString(),
              wallet: transaction.wallet,
              walletShort: transaction.wallet.substring(0, 10),
              coin: transaction.coin,
              side: transaction.side,
              amount: (transaction.notionalValue / 1000000).toFixed(2) + 'M',
              price: '$' + transaction.price.toFixed(2),
              size: transaction.size.toFixed(4)
            };

            setTransactions(prev => {
              const exists = prev.some(tx => tx.id === newTx.id);
              if (!exists) {
                return [newTx, ...prev].slice(0, 100);
              }
              return prev;
            });
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };

        websocket.onerror = (error) => {
          console.error('WebSocket error:', error);
          setConnectionStatus('error');
        };

        websocket.onclose = () => {
          console.log('WebSocket closed. Reconnecting...');
          setConnectionStatus('reconnecting');
          reconnectTimeout = setTimeout(connect, 5000);
        };

        setWs(websocket);
      } catch (error) {
        console.error('Connection error:', error);
        setConnectionStatus('error');
        reconnectTimeout = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      if (websocket) websocket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [isLive]);

  const copyToClipboard = (wallet) => {
    navigator.clipboard.writeText(wallet);
    setCopiedWallet(wallet);
    setTimeout(() => setCopiedWallet(null), 2000);
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-400';
      case 'connecting': return 'text-yellow-400';
      case 'reconnecting': return 'text-orange-400';
      case 'error': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return '🟢 Connected to Hyperliquid';
      case 'connecting': return '🟡 Connecting...';
      case 'reconnecting': return '🟠 Reconnecting...';
      case 'error': return '🔴 Connection Error';
      default: return '⚫ Disconnected';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 mb-6 border border-purple-500/20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Hyperliquid Whale Tracker
              </h1>
              <p className="text-slate-300 mb-2">
                Monitoring BTC, ETH, XRP, SOL, DOGE transactions in real-time
              </p>
              <div className={`flex items-center gap-2 text-sm ${getStatusColor()}`}>
                <AlertCircle className="w-4 h-4" />
                <span>{getStatusText()}</span>
              </div>
            </div>
            <button
              onClick={() => setIsLive(!isLive)}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                isLive
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-slate-600 hover:bg-slate-700 text-slate-200'
              }`}
            >
              {isLive ? '🟢 LIVE' : '⏸️ PAUSED'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-green-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Longs</p>
                <p className="text-2xl font-bold text-green-400">
                  {transactions.filter(t => t.side === 'LONG').length}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-red-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Shorts</p>
                <p className="text-2xl font-bold text-red-400">
                  {transactions.filter(t => t.side === 'SHORT').length}
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-400" />
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-purple-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Tracked</p>
                <p className="text-2xl font-bold text-purple-400">
                  {transactions.length}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-400" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg border border-purple-500/20 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-xl font-bold text-white">Live Transaction Feed</h2>
          </div>
          
          <div className="overflow-auto" style={{ maxHeight: '600px' }}>
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                {connectionStatus === 'connected' 
                  ? 'Waiting for transactions...' 
                  : 'Connecting to live feed...'}
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-4 hover:bg-slate-700/30 transition-colors animate-fade-in"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`p-2 rounded-lg ${
                          tx.side === 'LONG' 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {tx.side === 'LONG' ? (
                            <TrendingUp className="w-5 h-5" />
                          ) : (
                            <TrendingDown className="w-5 h-5" />
                          )}
                        </div>
                        
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-white text-lg">
                              {tx.coin}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              tx.side === 'LONG'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {tx.side}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-3 mt-1 text-sm text-slate-400">
                            <div className="flex items-center space-x-1">
                              <Wallet className="w-4 h-4" />
                              <a
                                href={`https://app.hyperliquid.xyz/explorer/address/${tx.wallet}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-purple-400 transition-colors cursor-pointer"
                              >
                                {tx.walletShort}
                              </a>
                              <button
                                onClick={() => copyToClipboard(tx.wallet)}
                                className="ml-1 p-1 hover:bg-slate-600/50 rounded transition-colors"
                                title="Copy full wallet address"
                              >
                                {copiedWallet === tx.wallet ? (
                                  <Check className="w-3 h-3 text-green-400" />
                                ) : (
                                  <Copy className="w-3 h-3 text-slate-400 hover:text-white" />
                                )}
                              </button>
                            </div>
                            <span>•</span>
                            <span>{tx.timestamp}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-xl font-bold text-white">
                          ${tx.amount}
                        </div>
                        <div className="text-sm text-slate-400">
                          @ {tx.price}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Size: {tx.size}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
          <p className="text-xs text-slate-400 text-center">
            💡 Connected to Hyperliquid via WebSocket API for real-time trade monitoring
          </p>
        </div>
      </div>
      
      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default HyperliquidMonitor;
