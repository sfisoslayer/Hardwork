import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  const [stats, setStats] = useState({
    active_sessions: 0,
    total_claims: 0,
    total_earnings: 0.0,
    proxy_count: 0,
    faucet_count: 0,
    success_rate: 0
  });
  
  const [faucets, setFaucets] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedFaucets, setSelectedFaucets] = useState([]);
  const [isStarting, setIsStarting] = useState(false);
  const [logs, setLogs] = useState([]);
  const [customFaucet, setCustomFaucet] = useState({
    name: '',
    url: '',
    claim_selector: '',
    captcha_selector: '',
    cooldown_minutes: 60
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [selectedWithdrawalFaucets, setSelectedWithdrawalFaucets] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [walletAddress] = useState('bc1qzh55yrw9z4ve9zxy04xuw9mq838g5c06tqvrxk');

  // Fetch data functions
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  const fetchFaucets = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/faucets`);
      if (response.ok) {
        const data = await response.json();
        setFaucets(data);
      }
    } catch (error) {
      console.error('Error fetching faucets:', error);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/sessions`);
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  }, []);

  const fetchWithdrawals = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/withdrawals`);
      if (response.ok) {
        const data = await response.json();
        setWithdrawals(data);
      }
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    }
  }, []);

  const requestWithdrawal = async () => {
    if (!withdrawalAmount || selectedWithdrawalFaucets.length === 0) {
      addLog('Please enter amount and select faucets', 'warning');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/withdrawals/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          wallet_address: walletAddress,
          amount: parseFloat(withdrawalAmount),
          faucet_sources: selectedWithdrawalFaucets
        })
      });

      if (response.ok) {
        const data = await response.json();
        addLog(`Withdrawal requested: ${data.withdrawal_id}`, 'success');
        setWithdrawalAmount('');
        setSelectedWithdrawalFaucets([]);
        fetchWithdrawals();
      } else {
        const error = await response.json();
        addLog(`Withdrawal failed: ${error.detail}`, 'error');
      }
    } catch (error) {
      addLog(`Error requesting withdrawal: ${error.message}`, 'error');
    }
  };

  const refreshProxies = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/proxies/refresh`, {
        method: 'POST'
      });
      if (response.ok) {
        const data = await response.json();
        addLog(`Refreshed ${data.count} proxies`, 'info');
        fetchStats();
      }
    } catch (error) {
      addLog(`Error refreshing proxies: ${error.message}`, 'error');
    }
  };

  const startSession = async () => {
    if (selectedFaucets.length === 0) {
      addLog('Please select at least one faucet', 'warning');
      return;
    }

    setIsStarting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/sessions/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(selectedFaucets)
      });

      if (response.ok) {
        const data = await response.json();
        addLog(`Started claiming session: ${data.session_id}`, 'success');
        fetchSessions();
        fetchStats();
      }
    } catch (error) {
      addLog(`Error starting session: ${error.message}`, 'error');
    } finally {
      setIsStarting(false);
    }
  };

  const stopSession = async (sessionId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/stop`, {
        method: 'POST'
      });

      if (response.ok) {
        addLog(`Stopped session: ${sessionId}`, 'info');
        fetchSessions();
        fetchStats();
      }
    } catch (error) {
      addLog(`Error stopping session: ${error.message}`, 'error');
    }
  };

  const addCustomFaucet = async () => {
    if (!customFaucet.name || !customFaucet.url) {
      addLog('Please fill in required fields', 'warning');
      return;
    }

    try {
      const faucetData = {
        ...customFaucet,
        id: customFaucet.name.toLowerCase().replace(/\s+/g, '-'),
        enabled: true
      };

      const response = await fetch(`${BACKEND_URL}/api/faucets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(faucetData)
      });

      if (response.ok) {
        addLog(`Added custom faucet: ${customFaucet.name}`, 'success');
        setCustomFaucet({
          name: '',
          url: '',
          claim_selector: '',
          captcha_selector: '',
          cooldown_minutes: 60
        });
        fetchFaucets();
      }
    } catch (error) {
      addLog(`Error adding faucet: ${error.message}`, 'error');
    }
  };

  const addLog = (message, type = 'info') => {
    const newLog = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    };
    setLogs(prev => [newLog, ...prev.slice(0, 99)]); // Keep last 100 logs
  };

  const handleFaucetSelection = (faucetId) => {
    setSelectedFaucets(prev => 
      prev.includes(faucetId) 
        ? prev.filter(id => id !== faucetId)
        : [...prev, faucetId]
    );
  };

  const selectAllFaucets = () => {
    setSelectedFaucets(faucets.filter(f => f.enabled).map(f => f.id));
  };

  const clearAllFaucets = () => {
    setSelectedFaucets([]);
  };

  // Auto-refresh data
  useEffect(() => {
    fetchStats();
    fetchFaucets();
    fetchSessions();
    fetchWithdrawals();

    const interval = setInterval(() => {
      fetchStats();
      fetchSessions();
      fetchWithdrawals();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [fetchStats, fetchFaucets, fetchSessions, fetchWithdrawals]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <img 
                  src="https://images.unsplash.com/photo-1639815188546-c43c240ff4df" 
                  alt="Crypto Faucet" 
                  className="h-10 w-10 rounded-lg object-cover"
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Crypto Faucet Automator</h1>
                <p className="text-blue-200 text-sm">Advanced Multi-Session Claiming System</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-blue-200">Active Sessions</p>
                <p className="text-2xl font-bold text-white">{stats.active_sessions}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-200">Total Earnings</p>
                <p className="text-2xl font-bold text-green-400">{stats.total_earnings.toFixed(8)} BTC</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-black/10 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {['dashboard', 'faucets', 'sessions', 'logs'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                  activeTab === tab
                    ? 'border-blue-400 text-blue-400'
                    : 'border-transparent text-gray-300 hover:text-white hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-black/20 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold">S</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-300">Active Sessions</p>
                    <p className="text-2xl font-bold text-white">{stats.active_sessions}</p>
                  </div>
                </div>
              </div>

              <div className="bg-black/20 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold">C</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-300">Total Claims</p>
                    <p className="text-2xl font-bold text-white">{stats.total_claims}</p>
                  </div>
                </div>
              </div>

              <div className="bg-black/20 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold">P</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-300">Proxies Available</p>
                    <p className="text-2xl font-bold text-white">{stats.proxy_count}</p>
                  </div>
                </div>
              </div>

              <div className="bg-black/20 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold">F</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-300">Faucets Available</p>
                    <p className="text-2xl font-bold text-white">{stats.faucet_count}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Hero Section */}
            <div className="bg-black/20 backdrop-blur-lg rounded-xl p-8 border border-white/10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-4">
                    Automated Crypto Faucet Claims
                  </h2>
                  <p className="text-gray-300 mb-6">
                    Run up to 100+ concurrent claiming sessions across multiple faucets with intelligent
                    proxy rotation and CAPTCHA solving. Maximize your crypto earnings with minimal effort.
                  </p>
                  <div className="flex space-x-4">
                    <button
                      onClick={refreshProxies}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
                    >
                      Refresh Proxies
                    </button>
                    <button
                      onClick={() => setActiveTab('faucets')}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors"
                    >
                      Manage Faucets
                    </button>
                  </div>
                </div>
                <div className="hidden lg:block">
                  <img 
                    src="https://images.pexels.com/photos/7788009/pexels-photo-7788009.jpeg" 
                    alt="Crypto Trading" 
                    className="rounded-xl shadow-2xl"
                  />
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-black/20 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">Quick Start</h3>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={selectAllFaucets}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Select All Faucets
                </button>
                <button
                  onClick={startSession}
                  disabled={isStarting || selectedFaucets.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  {isStarting ? 'Starting...' : 'Start Claiming'}
                </button>
                <button
                  onClick={clearAllFaucets}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Clear Selection
                </button>
              </div>
              <p className="text-gray-400 mt-2">
                Selected: {selectedFaucets.length} faucets
              </p>
            </div>
          </div>
        )}

        {/* Faucets Tab */}
        {activeTab === 'faucets' && (
          <div className="space-y-8">
            {/* Add Custom Faucet */}
            <div className="bg-black/20 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">Add Custom Faucet</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Faucet Name"
                  value={customFaucet.name}
                  onChange={(e) => setCustomFaucet({...customFaucet, name: e.target.value})}
                  className="bg-black/30 text-white px-4 py-2 rounded-lg border border-white/20 focus:border-blue-400 focus:outline-none"
                />
                <input
                  type="url"
                  placeholder="Faucet URL"
                  value={customFaucet.url}
                  onChange={(e) => setCustomFaucet({...customFaucet, url: e.target.value})}
                  className="bg-black/30 text-white px-4 py-2 rounded-lg border border-white/20 focus:border-blue-400 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Claim Button Selector"
                  value={customFaucet.claim_selector}
                  onChange={(e) => setCustomFaucet({...customFaucet, claim_selector: e.target.value})}
                  className="bg-black/30 text-white px-4 py-2 rounded-lg border border-white/20 focus:border-blue-400 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="CAPTCHA Selector (optional)"
                  value={customFaucet.captcha_selector}
                  onChange={(e) => setCustomFaucet({...customFaucet, captcha_selector: e.target.value})}
                  className="bg-black/30 text-white px-4 py-2 rounded-lg border border-white/20 focus:border-blue-400 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Cooldown (minutes)"
                  value={customFaucet.cooldown_minutes}
                  onChange={(e) => setCustomFaucet({...customFaucet, cooldown_minutes: parseInt(e.target.value)})}
                  className="bg-black/30 text-white px-4 py-2 rounded-lg border border-white/20 focus:border-blue-400 focus:outline-none"
                />
                <button
                  onClick={addCustomFaucet}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Add Faucet
                </button>
              </div>
            </div>

            {/* Faucet Selection */}
            <div className="bg-black/20 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">Available Faucets ({faucets.length})</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={selectAllFaucets}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearAllFaucets}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {faucets.map((faucet) => (
                  <div
                    key={faucet.id}
                    className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      selectedFaucets.includes(faucet.id)
                        ? 'border-blue-400 bg-blue-900/20'
                        : 'border-white/20 bg-black/20 hover:border-white/40'
                    }`}
                    onClick={() => handleFaucetSelection(faucet.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-white">{faucet.name}</h4>
                        <p className="text-sm text-gray-400">
                          Cooldown: {faucet.cooldown_minutes}m
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {faucet.enabled ? (
                          <span className="text-green-400 text-sm">●</span>
                        ) : (
                          <span className="text-red-400 text-sm">●</span>
                        )}
                        <input
                          type="checkbox"
                          checked={selectedFaucets.includes(faucet.id)}
                          onChange={() => handleFaucetSelection(faucet.id)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="space-y-8">
            <div className="bg-black/20 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">Active Sessions ({sessions.length})</h3>
              
              {sessions.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No active sessions</p>
              ) : (
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <div key={session.id} className="bg-black/30 rounded-lg p-4 border border-white/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-white">Session {session.id.slice(0, 8)}</h4>
                          <p className="text-sm text-gray-400">
                            Status: <span className={`font-medium ${
                              session.status === 'running' ? 'text-green-400' :
                              session.status === 'error' ? 'text-red-400' : 'text-yellow-400'
                            }`}>{session.status}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-400">Claims: {session.total_claims}</p>
                          <p className="text-sm text-gray-400">Earnings: {session.total_earnings.toFixed(8)} BTC</p>
                        </div>
                        <button
                          onClick={() => stopSession(session.id)}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          Stop
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="bg-black/20 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">System Logs</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center space-x-3 text-sm">
                  <span className="text-gray-400 font-mono">{log.timestamp}</span>
                  <span className={`w-2 h-2 rounded-full ${
                    log.type === 'success' ? 'bg-green-400' :
                    log.type === 'error' ? 'bg-red-400' :
                    log.type === 'warning' ? 'bg-yellow-400' : 'bg-blue-400'
                  }`}></span>
                  <span className="text-gray-300">{log.message}</span>
                </div>
              ))}
              {logs.length === 0 && (
                <p className="text-gray-400 text-center py-8">No logs yet</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;