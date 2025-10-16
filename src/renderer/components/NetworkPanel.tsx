import { useEffect, useState } from "react";
import { Network, Download, Upload, Clock, AlertCircle, CheckCircle, Wifi, WifiOff, Play, Edit2, Trash2, Save, Radio, MessageSquare } from "lucide-react";
import { theme } from "../styles/theme";
import type { WebviewTag } from "electron";

interface NetworkRequest {
  id: string;
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  type: string;
  size: number;
  time: number;
  timestamp: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  blocked?: boolean;
}

interface WebSocketMessage {
  id: string;
  timestamp: number;
  direction: "sent" | "received";
  data: string;
  url: string;
}

interface ServiceWorkerInfo {
  scriptURL: string;
  state: string;
  scope: string;
}

interface NetworkThrottle {
  id: string;
  label: string;
  downloadThroughput: number; // bytes per second
  uploadThroughput: number;
  latency: number; // milliseconds
}

interface NetworkPanelProps {
  webviewRef: React.RefObject<WebviewTag>;
  isOpen: boolean;
  onClose: () => void;
}

const throttlePresets: NetworkThrottle[] = [
  { id: "online", label: "Online", downloadThroughput: -1, uploadThroughput: -1, latency: 0 },
  { id: "offline", label: "Offline", downloadThroughput: 0, uploadThroughput: 0, latency: 0 },
  { id: "2g", label: "Slow 2G", downloadThroughput: 250 * 1024 / 8, uploadThroughput: 50 * 1024 / 8, latency: 2000 },
  { id: "3g", label: "Fast 3G", downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8, latency: 562.5 },
  { id: "4g", label: "4G", downloadThroughput: 4 * 1024 * 1024 / 8, uploadThroughput: 3 * 1024 * 1024 / 8, latency: 170 },
];

export default function NetworkPanel({ webviewRef, isOpen, onClose }: NetworkPanelProps) {
  const [activeTab, setActiveTab] = useState<"requests" | "websockets" | "serviceworker">("requests");
  const [requests, setRequests] = useState<NetworkRequest[]>([]);
  const [wsMessages, setWsMessages] = useState<WebSocketMessage[]>([]);
  const [serviceWorkers, setServiceWorkers] = useState<ServiceWorkerInfo[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<NetworkRequest | null>(null);
  const [throttle, setThrottle] = useState<string>("online");
  const [blockedDomains, setBlockedDomains] = useState<string[]>([]);
  const [blockInput, setBlockInput] = useState("");
  const [wsInput, setWsInput] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingRequest, setEditingRequest] = useState<NetworkRequest | null>(null);

  // Load persisted requests from localStorage
  useEffect(() => {
    if (isOpen) {
      try {
        const saved = localStorage.getItem('flareon-network-history');
        if (saved) {
          setRequests(JSON.parse(saved));
        }
      } catch (e) {
        console.error('Failed to load network history', e);
      }
      
      analyzeNetwork();
    }
  }, [isOpen]);

  // Persist requests
  useEffect(() => {
    if (requests.length > 0) {
      try {
        localStorage.setItem('flareon-network-history', JSON.stringify(requests.slice(-100)));
      } catch (e) {
        console.error('Failed to save network history', e);
      }
    }
  }, [requests]);

  const analyzeNetwork = async () => {
    const webview = webviewRef.current;
    if (!webview) return;

    setLoading(true);

    try {
      // Get Service Workers
      const swData = await webview.executeJavaScript(`
        (async function() {
          try {
            if ('serviceWorker' in navigator) {
              const registrations = await navigator.serviceWorker.getRegistrations();
              return registrations.map(reg => ({
                scriptURL: reg.active ? reg.active.scriptURL : 'none',
                state: reg.active ? reg.active.state : 'none',
                scope: reg.scope
              }));
            }
            return [];
          } catch (err) {
            return [];
          }
        })();
      `);

      setServiceWorkers(swData);

      // Check WebSocket connections
      const wsData = await webview.executeJavaScript(`
        (function() {
          return window.__wsConnections ? window.__wsConnections.length : 0;
        })();
      `);

      setWsConnected(wsData > 0);

    } catch (err) {
      console.error('Failed to analyze network', err);
    } finally {
      setLoading(false);
    }
  };

  const clearRequests = () => {
    setRequests([]);
    localStorage.removeItem('flareon-network-history');
  };

  const exportHAR = () => {
    const har = {
      log: {
        version: "1.2",
        creator: {
          name: "Flareon Browser",
          version: "1.0.0"
        },
        entries: requests.map(req => ({
          startedDateTime: new Date(req.timestamp).toISOString(),
          time: req.time,
          request: {
            method: req.method,
            url: req.url,
            httpVersion: "HTTP/1.1",
            headers: Object.entries(req.requestHeaders || {}).map(([name, value]) => ({ name, value })),
            queryString: [],
            postData: req.requestBody ? {
              mimeType: "application/json",
              text: req.requestBody
            } : undefined
          },
          response: {
            status: req.status || 0,
            statusText: req.statusText || "",
            httpVersion: "HTTP/1.1",
            headers: Object.entries(req.responseHeaders || {}).map(([name, value]) => ({ name, value })),
            content: {
              size: req.size,
              mimeType: req.type,
              text: req.responseBody || ""
            }
          },
          cache: {},
          timings: {
            send: 0,
            wait: req.time,
            receive: 0
          }
        }))
      }
    };

    const blob = new Blob([JSON.stringify(har, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `network-${Date.now()}.har`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const applyThrottle = async (throttleId: string) => {
    const preset = throttlePresets.find(p => p.id === throttleId);
    if (!preset) return;

    setThrottle(throttleId);

    // Apply throttling to webview
    const webview = webviewRef.current;
    if (webview) {
      try {
        // Electron's webview doesn't have direct throttling API
        // We can simulate it by injecting delays into network requests
        await webview.executeJavaScript(`
          (function() {
            const throttle = ${JSON.stringify(preset)};
            console.log('Network throttling applied:', throttle.label);
            
            if (throttle.id === 'offline') {
              // Simulate offline
              window.__offlineMode = true;
            } else {
              window.__offlineMode = false;
              window.__throttle = throttle;
            }
          })();
        `);
      } catch (err) {
        console.error('Failed to apply throttle', err);
      }
    }
  };

  const addBlockedDomain = () => {
    if (blockInput.trim() && !blockedDomains.includes(blockInput.trim())) {
      setBlockedDomains([...blockedDomains, blockInput.trim()]);
      setBlockInput("");
    }
  };

  const removeBlockedDomain = (domain: string) => {
    setBlockedDomains(blockedDomains.filter(d => d !== domain));
  };

  const replayRequest = async (request: NetworkRequest) => {
    const webview = webviewRef.current;
    if (!webview) return;

    try {
      await webview.executeJavaScript(`
        (async function() {
          const options = {
            method: '${request.method}',
            headers: ${JSON.stringify(request.requestHeaders || {})},
            ${request.requestBody ? `body: '${request.requestBody}'` : ''}
          };
          
          const response = await fetch('${request.url}', options);
          const text = await response.text();
          
          return {
            status: response.status,
            statusText: response.statusText,
            body: text
          };
        })();
      `);

      // Add replayed request to history
      const newRequest: NetworkRequest = {
        ...request,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };
      setRequests(prev => [newRequest, ...prev]);
    } catch (err) {
      console.error('Failed to replay request', err);
    }
  };

  const sendWebSocketMessage = async () => {
    if (!wsInput.trim()) return;

    const webview = webviewRef.current;
    if (!webview) return;

    try {
      await webview.executeJavaScript(`
        (function() {
          if (window.__wsConnection && window.__wsConnection.readyState === 1) {
            window.__wsConnection.send('${wsInput}');
            return true;
          }
          return false;
        })();
      `);

      const newMessage: WebSocketMessage = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        direction: "sent",
        data: wsInput,
        url: "websocket"
      };
      setWsMessages(prev => [...prev, newMessage]);
      setWsInput("");
    } catch (err) {
      console.error('Failed to send WebSocket message', err);
    }
  };

  const clearServiceWorkerCache = async () => {
    const webview = webviewRef.current;
    if (!webview) return;

    try {
      await webview.executeJavaScript(`
        (async function() {
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            return cacheNames.length;
          }
          return 0;
        })();
      `);

      alert('Service Worker caches cleared!');
      analyzeNetwork();
    } catch (err) {
      console.error('Failed to clear SW cache', err);
    }
  };

  const unregisterServiceWorker = async () => {
    const webview = webviewRef.current;
    if (!webview) return;

    try {
      await webview.executeJavaScript(`
        (async function() {
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(reg => reg.unregister()));
            return registrations.length;
          }
          return 0;
        })();
      `);

      alert('Service Workers unregistered!');
      analyzeNetwork();
    } catch (err) {
      console.error('Failed to unregister SW', err);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: 500,
        background: "linear-gradient(180deg, rgba(20,20,20,0.98) 0%, rgba(15,15,15,0.98) 100%)",
        borderLeft: `1px solid ${theme.colors.border}`,
        display: "flex",
        flexDirection: "column",
        zIndex: 1000,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px",
          borderBottom: `1px solid ${theme.colors.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Network size={18} color={theme.colors.accent} />
          <h3
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 600,
              color: theme.colors.textPrimary,
            }}
          >
            Network & API
          </h3>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={analyzeNetwork}
            disabled={loading}
            style={{
              padding: "4px 12px",
              borderRadius: 4,
              border: `1px solid ${theme.colors.border}`,
              background: "rgba(255, 255, 255, 0.05)",
              color: theme.colors.textPrimary,
              fontSize: 12,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? "Analyzing..." : "Refresh"}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "4px 8px",
              borderRadius: 4,
              border: "none",
              background: "transparent",
              color: theme.colors.textSecondary,
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: "8px 12px",
          borderBottom: `1px solid ${theme.colors.border}`,
          background: "rgba(0, 0, 0, 0.2)",
        }}
      >
        {[
          { id: "requests", label: "Requests", icon: Network },
          { id: "websockets", label: "WebSockets", icon: Radio },
          { id: "serviceworker", label: "Service Worker", icon: MessageSquare },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: "6px 12px",
              borderRadius: 4,
              border: "none",
              background: activeTab === tab.id ? "rgba(255, 109, 0, 0.15)" : "transparent",
              color: activeTab === tab.id ? theme.colors.accent : theme.colors.textSecondary,
              fontSize: 11,
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
        }}
      >
        {activeTab === "requests" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Throttling */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: theme.colors.textPrimary, marginBottom: 8 }}>
                Network Throttling
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {throttlePresets.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => applyThrottle(preset.id)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 4,
                      border: throttle === preset.id ? `2px solid ${theme.colors.accent}` : `1px solid ${theme.colors.border}`,
                      background: throttle === preset.id ? "rgba(255, 109, 0, 0.1)" : "rgba(255, 255, 255, 0.03)",
                      color: throttle === preset.id ? theme.colors.accent : theme.colors.textPrimary,
                      fontSize: 11,
                      fontWeight: throttle === preset.id ? 600 : 400,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {preset.id === "offline" ? <WifiOff size={14} /> : <Wifi size={14} />}
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Block Domains */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: theme.colors.textPrimary, marginBottom: 8 }}>
                Block Domains
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  value={blockInput}
                  onChange={(e) => setBlockInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addBlockedDomain()}
                  placeholder="example.com"
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    borderRadius: 4,
                    border: `1px solid ${theme.colors.border}`,
                    background: "rgba(255, 255, 255, 0.05)",
                    color: theme.colors.textPrimary,
                    fontSize: 12,
                  }}
                />
                <button
                  onClick={addBlockedDomain}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 4,
                    border: "none",
                    background: theme.colors.accent,
                    color: "white",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Block
                </button>
              </div>
              {blockedDomains.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {blockedDomains.map(domain => (
                    <div
                      key={domain}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 4,
                        background: "rgba(255, 23, 68, 0.1)",
                        border: "1px solid rgba(255, 23, 68, 0.3)",
                        color: "#FF1744",
                        fontSize: 11,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {domain}
                      <button
                        onClick={() => removeBlockedDomain(domain)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#FF1744",
                          cursor: "pointer",
                          padding: 0,
                          display: "flex",
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={exportHAR}
                disabled={requests.length === 0}
                style={{
                  padding: "6px 12px",
                  borderRadius: 4,
                  border: `1px solid ${theme.colors.border}`,
                  background: "rgba(76, 175, 80, 0.1)",
                  color: "#4CAF50",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: requests.length === 0 ? "not-allowed" : "pointer",
                  opacity: requests.length === 0 ? 0.5 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Save size={14} />
                Export HAR
              </button>
              <button
                onClick={clearRequests}
                disabled={requests.length === 0}
                style={{
                  padding: "6px 12px",
                  borderRadius: 4,
                  border: `1px solid ${theme.colors.border}`,
                  background: "rgba(255, 23, 68, 0.1)",
                  color: "#FF1744",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: requests.length === 0 ? "not-allowed" : "pointer",
                  opacity: requests.length === 0 ? 0.5 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Trash2 size={14} />
                Clear
              </button>
            </div>

            {/* Requests List */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: theme.colors.textPrimary, marginBottom: 8 }}>
                Request History ({requests.length})
              </div>
              
              {requests.length === 0 ? (
                <div
                  style={{
                    padding: 20,
                    background: "rgba(255, 255, 255, 0.02)",
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: 6,
                    color: theme.colors.textSecondary,
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  No requests recorded yet. Navigate to a page to see network activity.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {requests.slice(0, 50).map(request => (
                    <div
                      key={request.id}
                      onClick={() => setSelectedRequest(selectedRequest?.id === request.id ? null : request)}
                      style={{
                        padding: 12,
                        background: selectedRequest?.id === request.id ? "rgba(255, 109, 0, 0.1)" : "rgba(255, 255, 255, 0.03)",
                        border: selectedRequest?.id === request.id ? `1px solid ${theme.colors.accent}` : `1px solid ${theme.colors.border}`,
                        borderRadius: 6,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: 3,
                              fontSize: 10,
                              fontWeight: 700,
                              background: request.method === "GET" ? "rgba(76, 175, 80, 0.2)" : "rgba(33, 150, 243, 0.2)",
                              color: request.method === "GET" ? "#4CAF50" : "#2196F3",
                            }}
                          >
                            {request.method}
                          </span>
                          {request.status && (
                            <span
                              style={{
                                padding: "2px 6px",
                                borderRadius: 3,
                                fontSize: 10,
                                fontWeight: 700,
                                background: request.status < 300 ? "rgba(76, 175, 80, 0.2)" : request.status < 400 ? "rgba(255, 193, 7, 0.2)" : "rgba(255, 23, 68, 0.2)",
                                color: request.status < 300 ? "#4CAF50" : request.status < 400 ? "#FFC107" : "#FF1744",
                              }}
                            >
                              {request.status}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 12, fontSize: 10, color: theme.colors.textSecondary }}>
                          <span>{formatBytes(request.size)}</span>
                          <span>{formatTime(request.time)}</span>
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: theme.colors.textPrimary,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          marginBottom: 4,
                        }}
                      >
                        {request.url}
                      </div>
                      <div style={{ fontSize: 10, color: theme.colors.textSecondary }}>
                        {new Date(request.timestamp).toLocaleTimeString()}
                      </div>

                      {selectedRequest?.id === request.id && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${theme.colors.border}` }}>
                          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); replayRequest(request); }}
                              style={{
                                padding: "4px 10px",
                                borderRadius: 4,
                                border: "none",
                                background: theme.colors.accent,
                                color: "white",
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <Play size={12} />
                              Replay
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingRequest(request); }}
                              style={{
                                padding: "4px 10px",
                                borderRadius: 4,
                                border: `1px solid ${theme.colors.border}`,
                                background: "rgba(255, 255, 255, 0.05)",
                                color: theme.colors.textPrimary,
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <Edit2 size={12} />
                              Edit & Replay
                            </button>
                          </div>

                          {request.requestHeaders && (
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: theme.colors.accent, marginBottom: 4 }}>
                                Request Headers:
                              </div>
                              <div
                                style={{
                                  padding: 8,
                                  background: "rgba(0, 0, 0, 0.3)",
                                  borderRadius: 4,
                                  fontSize: 10,
                                  fontFamily: "monospace",
                                  color: theme.colors.textSecondary,
                                  maxHeight: 150,
                                  overflow: "auto",
                                }}
                              >
                                {Object.entries(request.requestHeaders).map(([key, value]) => (
                                  <div key={key}>
                                    <strong>{key}:</strong> {value}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {request.responseBody && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: theme.colors.accent, marginBottom: 4 }}>
                                Response Body:
                              </div>
                              <div
                                style={{
                                  padding: 8,
                                  background: "rgba(0, 0, 0, 0.3)",
                                  borderRadius: 4,
                                  fontSize: 10,
                                  fontFamily: "monospace",
                                  color: theme.colors.textSecondary,
                                  maxHeight: 200,
                                  overflow: "auto",
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                }}
                              >
                                {request.responseBody.substring(0, 500)}
                                {request.responseBody.length > 500 && '...'}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "websockets" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Connection Status */}
            <div
              style={{
                padding: 12,
                background: wsConnected ? "rgba(76, 175, 80, 0.1)" : "rgba(255, 193, 7, 0.1)",
                border: wsConnected ? "1px solid rgba(76, 175, 80, 0.3)" : "1px solid rgba(255, 193, 7, 0.3)",
                borderRadius: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Radio size={16} color={wsConnected ? "#4CAF50" : "#FFC107"} />
                <span style={{ fontSize: 12, fontWeight: 600, color: wsConnected ? "#4CAF50" : "#FFC107" }}>
                  {wsConnected ? "Connected" : "No active connections"}
                </span>
              </div>
              <div style={{ fontSize: 10, color: theme.colors.textSecondary }}>
                {wsConnected ? "WebSocket connection is active" : "Open a page with WebSocket to see live messages"}
              </div>
            </div>

            {/* Send Message */}
            {wsConnected && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: theme.colors.textPrimary, marginBottom: 8 }}>
                  Send Message
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={wsInput}
                    onChange={(e) => setWsInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendWebSocketMessage()}
                    placeholder="Type message..."
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: 4,
                      border: `1px solid ${theme.colors.border}`,
                      background: "rgba(255, 255, 255, 0.05)",
                      color: theme.colors.textPrimary,
                      fontSize: 12,
                    }}
                  />
                  <button
                    onClick={sendWebSocketMessage}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 4,
                      border: "none",
                      background: theme.colors.accent,
                      color: "white",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Send
                  </button>
                </div>
              </div>
            )}

            {/* Messages */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: theme.colors.textPrimary, marginBottom: 8 }}>
                Messages ({wsMessages.length})
              </div>
              
              {wsMessages.length === 0 ? (
                <div
                  style={{
                    padding: 20,
                    background: "rgba(255, 255, 255, 0.02)",
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: 6,
                    color: theme.colors.textSecondary,
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  No messages yet
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {wsMessages.map(msg => (
                    <div
                      key={msg.id}
                      style={{
                        padding: 10,
                        background: msg.direction === "sent" ? "rgba(33, 150, 243, 0.05)" : "rgba(76, 175, 80, 0.05)",
                        border: msg.direction === "sent" ? "1px solid rgba(33, 150, 243, 0.3)" : "1px solid rgba(76, 175, 80, 0.3)",
                        borderRadius: 6,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {msg.direction === "sent" ? <Upload size={12} color="#2196F3" /> : <Download size={12} color="#4CAF50" />}
                          <span style={{ fontSize: 11, fontWeight: 600, color: msg.direction === "sent" ? "#2196F3" : "#4CAF50" }}>
                            {msg.direction === "sent" ? "Sent" : "Received"}
                          </span>
                        </div>
                        <span style={{ fontSize: 10, color: theme.colors.textSecondary }}>
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div
                        style={{
                          padding: 8,
                          background: "rgba(0, 0, 0, 0.3)",
                          borderRadius: 4,
                          fontSize: 11,
                          fontFamily: "monospace",
                          color: theme.colors.textPrimary,
                          wordBreak: "break-word",
                        }}
                      >
                        {msg.data}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "serviceworker" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Service Workers */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: theme.colors.textPrimary, marginBottom: 8 }}>
                Active Service Workers ({serviceWorkers.length})
              </div>
              
              {serviceWorkers.length === 0 ? (
                <div
                  style={{
                    padding: 20,
                    background: "rgba(255, 255, 255, 0.02)",
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: 6,
                    color: theme.colors.textSecondary,
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  No service workers registered
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {serviceWorkers.map((sw, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 12,
                        background: "rgba(76, 175, 80, 0.05)",
                        border: "1px solid rgba(76, 175, 80, 0.3)",
                        borderRadius: 6,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <CheckCircle size={14} color="#4CAF50" />
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#4CAF50" }}>
                            {sw.state}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: theme.colors.textPrimary, marginBottom: 4 }}>
                        <strong>Script:</strong> {sw.scriptURL}
                      </div>
                      <div style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                        <strong>Scope:</strong> {sw.scope}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={clearServiceWorkerCache}
                style={{
                  padding: "8px 16px",
                  borderRadius: 4,
                  border: `1px solid ${theme.colors.border}`,
                  background: "rgba(255, 193, 7, 0.1)",
                  color: "#FFC107",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Trash2 size={14} />
                Clear Cache
              </button>
              <button
                onClick={unregisterServiceWorker}
                disabled={serviceWorkers.length === 0}
                style={{
                  padding: "8px 16px",
                  borderRadius: 4,
                  border: `1px solid ${theme.colors.border}`,
                  background: "rgba(255, 23, 68, 0.1)",
                  color: "#FF1744",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: serviceWorkers.length === 0 ? "not-allowed" : "pointer",
                  opacity: serviceWorkers.length === 0 ? 0.5 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <AlertCircle size={14} />
                Unregister All
              </button>
            </div>

            {/* Info */}
            <div
              style={{
                padding: 12,
                background: "rgba(33, 150, 243, 0.05)",
                border: "1px solid rgba(33, 150, 243, 0.2)",
                borderRadius: 6,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: "#2196F3", marginBottom: 8 }}>
                Service Worker Features
              </div>
              <ul style={{ margin: 0, padding: "0 0 0 20px", fontSize: 10, color: theme.colors.textSecondary, lineHeight: 1.8 }}>
                <li>Cache management and inspection</li>
                <li>Background sync monitoring</li>
                <li>Push notification testing</li>
                <li>Offline functionality control</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
