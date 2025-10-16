import { useEffect, useState } from "react";
import { Database, Activity, AlertTriangle, CheckCircle, Clock, Zap, Table, Search, PlayCircle } from "lucide-react";
import { theme } from "../styles/theme";
import type { WebviewTag } from "electron";

interface DatabaseConnection {
  id: string;
  type: string;
  host: string;
  database: string;
  status: "connected" | "disconnected" | "error";
  latency?: number;
}

interface DatabaseQuery {
  id: string;
  query: string;
  duration: number;
  timestamp: number;
  status: "success" | "error";
  rowsAffected?: number;
  error?: string;
}

interface IndexedDBStore {
  name: string;
  keyPath: string | string[];
  autoIncrement: boolean;
  indexes: Array<{ name: string; keyPath: string | string[]; unique: boolean }>;
  recordCount?: number;
}

interface IndexedDBDatabase {
  name: string;
  version: number;
  stores: IndexedDBStore[];
}

interface DatabasePanelProps {
  webviewRef: React.RefObject<WebviewTag>;
  isOpen: boolean;
  onClose: () => void;
}

export default function DatabasePanel({ webviewRef, isOpen, onClose }: DatabasePanelProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "queries" | "indexeddb" | "websql" | "localstorage">("overview");
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [queries, setQueries] = useState<DatabaseQuery[]>([]);
  const [indexedDBs, setIndexedDBs] = useState<IndexedDBDatabase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDB, setSelectedDB] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [storeData, setStoreData] = useState<any[]>([]);
  const [queryInput, setQueryInput] = useState("");
  const [localStorage, setLocalStorage] = useState<Array<{ key: string; value: string; size: number }>>([]);
  const [sessionStorage, setSessionStorage] = useState<Array<{ key: string; value: string; size: number }>>([]);

  const analyzeDatabases = async () => {
    const webview = webviewRef.current;
    if (!webview) {
      setError("No webview available");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await webview.executeJavaScript(`
        (function() {
          const result = {
            indexedDBs: [],
            localStorage: [],
            sessionStorage: [],
            connections: [],
            supportsIndexedDB: typeof indexedDB !== 'undefined',
            supportsWebSQL: typeof openDatabase !== 'undefined',
            supportsLocalStorage: typeof localStorage !== 'undefined'
          };

          // LocalStorage Analysis (synchronous, simple)
          try {
            if (typeof localStorage !== 'undefined' && localStorage !== null) {
              for (let i = 0; i < localStorage.length; i++) {
                try {
                  const key = localStorage.key(i);
                  if (key) {
                    const value = localStorage.getItem(key) || '';
                    const size = new Blob([value]).size;
                    result.localStorage.push({ key, value, size });
                  }
                } catch (e) {
                  // Skip items we can't read
                }
              }
            }
          } catch (e) {
            console.error('LocalStorage read failed:', e);
          }

          // SessionStorage Analysis (synchronous, simple)
          try {
            if (typeof sessionStorage !== 'undefined' && sessionStorage !== null) {
              for (let i = 0; i < sessionStorage.length; i++) {
                try {
                  const key = sessionStorage.key(i);
                  if (key) {
                    const value = sessionStorage.getItem(key) || '';
                    const size = new Blob([value]).size;
                    result.sessionStorage.push({ key, value, size });
                  }
                } catch (e) {
                  // Skip items we can't read
                }
              }
            }
          } catch (e) {
            console.error('SessionStorage read failed:', e);
          }

          // Detect database connections (look for common patterns)
          try {
            const scripts = document.scripts ? Array.from(document.scripts) : [];
            const scriptContent = scripts.map(s => s.textContent || '').join(' ');
            
            const patterns = [
              { type: 'MongoDB', regex: /mongodb:\\/\\/|mongoose\\.connect/i },
              { type: 'PostgreSQL', regex: /postgresql:\\/\\/|pg\\.connect/i },
              { type: 'MySQL', regex: /mysql:\\/\\/|mysql\\.createConnection/i },
              { type: 'Firebase', regex: /firebase|firestore/i },
              { type: 'Supabase', regex: /supabase/i },
              { type: 'GraphQL', regex: /graphql|apollo/i }
            ];
            
            patterns.forEach(function(pattern) {
              if (pattern.regex.test(scriptContent)) {
                result.connections.push({
                  id: Date.now().toString() + Math.random().toString(36),
                  type: pattern.type,
                  host: 'Detected in code',
                  database: 'N/A',
                  status: 'unknown'
                });
              }
            });
          } catch (e) {
            console.error('Connection detection failed:', e);
          }

          return result;
        })();
      `, false);  // false = not in main world

      if (data.error) {
        setError(data.error);
      } else {
        setLocalStorage(data.localStorage || []);
        setSessionStorage(data.sessionStorage || []);
        setConnections(data.connections || []);
        
        // Load IndexedDB separately with async
        if (data.supportsIndexedDB) {
          loadIndexedDBs();
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to analyze databases");
    } finally {
      setLoading(false);
    }
  };

  const loadIndexedDBs = async () => {
    const webview = webviewRef.current;
    if (!webview) return;

    try {
      // Note: indexedDB.databases() doesn't work in Electron webview
      // We'll use a simpler approach - just check known database names
      // or wait for user to use query commands
      setIndexedDBs([]);
      
      // Try to get databases if the API exists
      const hasAPI = await webview.executeJavaScript(`
        typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function'
      `, false);
      
      if (!hasAPI) {
        console.log('IndexedDB.databases() not available, use queries to explore databases');
        return;
      }

      // If API exists, try to use it
      const dbNames = await webview.executeJavaScript(`
        (async function() {
          try {
            if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') {
              return [];
            }
            const dbs = await indexedDB.databases();
            return dbs.map(db => ({ name: db.name, version: db.version }));
          } catch (e) {
            return [];
          }
        })();
      `, false);

      // Now get details for each database
      for (const dbInfo of dbNames) {
        try {
          const dbDetails = await webview.executeJavaScript(`
            (async function() {
              try {
                const db = await new Promise(function(resolve, reject) {
                  const request = indexedDB.open('${dbInfo.name.replace(/'/g, "\\'")}');
                  request.onsuccess = function() { resolve(request.result); };
                  request.onerror = function() { reject(request.error); };
                });
                
                const stores = [];
                for (let i = 0; i < db.objectStoreNames.length; i++) {
                  const storeName = db.objectStoreNames[i];
                  try {
                    const tx = db.transaction(storeName, 'readonly');
                    const store = tx.objectStore(storeName);
                    
                    const indexes = [];
                    for (let j = 0; j < store.indexNames.length; j++) {
                      const idx = store.index(store.indexNames[j]);
                      indexes.push({
                        name: idx.name,
                        keyPath: idx.keyPath,
                        unique: idx.unique
                      });
                    }
                    
                    const count = await new Promise(function(resolve) {
                      const req = store.count();
                      req.onsuccess = function() { resolve(req.result); };
                      req.onerror = function() { resolve(0); };
                    });
                    
                    stores.push({
                      name: storeName,
                      keyPath: store.keyPath || '',
                      autoIncrement: store.autoIncrement || false,
                      indexes: indexes,
                      recordCount: count
                    });
                  } catch (e) {
                    // Skip stores we can't read
                  }
                }
                
                db.close();
                return { name: '${dbInfo.name.replace(/'/g, "\\'")}', version: ${dbInfo.version || 1}, stores: stores };
              } catch (e) {
                return null;
              }
            })();
          `, false);

          if (dbDetails) {
            setIndexedDBs(prev => [...prev, dbDetails]);
          }
        } catch (e) {
          console.error(`Failed to load database ${dbInfo.name}:`, e);
        }
      }
    } catch (err: any) {
      console.error('IndexedDB loading failed:', err);
    }
  };

  const loadStoreData = async (dbName: string, storeName: string) => {
    const webview = webviewRef.current;
    if (!webview) return;

    setLoading(true);
    setError(null);

    try {
      const data = await webview.executeJavaScript(`
        (async function() {
          try {
            if (typeof indexedDB === 'undefined') {
              return { error: 'IndexedDB not available' };
            }

            const db = await new Promise(function(resolve, reject) {
              const request = indexedDB.open('${dbName.replace(/'/g, "\\'")}');
              request.onsuccess = function() { resolve(request.result); };
              request.onerror = function() { reject(request.error); };
            });
            
            if (!db.objectStoreNames.contains('${storeName.replace(/'/g, "\\'")}')) {
              db.close();
              return { error: 'Store not found' };
            }

            const transaction = db.transaction('${storeName.replace(/'/g, "\\'")}', 'readonly');
            const objectStore = transaction.objectStore('${storeName.replace(/'/g, "\\'")}');
            const request = objectStore.getAll();
            
            const records = await new Promise(function(resolve, reject) {
              request.onsuccess = function() { resolve(request.result); };
              request.onerror = function() { reject(request.error); };
            });
            
            db.close();
            
            return Array.isArray(records) ? records.slice(0, 100) : [];
          } catch (err) {
            return { error: err.message || String(err) };
          }
        })();
      `, false);

      if (data && data.error) {
        setError(data.error);
        setStoreData([]);
      } else {
        setStoreData(Array.isArray(data) ? data : []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load store data');
      setStoreData([]);
    } finally {
      setLoading(false);
    }
  };

  const executeQuery = async () => {
    if (!queryInput.trim()) return;

    const webview = webviewRef.current;
    if (!webview) return;

    const queryId = crypto.randomUUID();
    const startTime = Date.now();
    const safeQuery = queryInput.replace(/`/g, '\\`').replace(/\$/g, '\\$');

    try {
      const result = await webview.executeJavaScript(`
        (async function() {
          try {
            const query = \`${safeQuery}\`;
            
            // Simple command interpreter for IndexedDB operations
            if (query.toLowerCase().includes('show databases')) {
              if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') {
                return { error: 'indexedDB.databases() not supported in this context' };
              }
              const dbs = await indexedDB.databases();
              return { 
                success: true, 
                data: dbs.map(function(db) { return { name: db.name, version: db.version }; }),
                message: 'Found ' + dbs.length + ' database(s)'
              };
            }
            
            if (query.toLowerCase().includes('show tables') || query.toLowerCase().includes('show stores')) {
              const dbNameMatch = query.match(/from\\s+(\\w+)/i);
              if (!dbNameMatch) {
                return { error: 'Specify database: SHOW STORES FROM dbname' };
              }
              const dbName = dbNameMatch[1];
              
              const db = await new Promise(function(resolve, reject) {
                const request = indexedDB.open(dbName);
                request.onsuccess = function() { resolve(request.result); };
                request.onerror = function() { reject(request.error); };
              });
              
              const stores = [];
              for (let i = 0; i < db.objectStoreNames.length; i++) {
                stores.push(db.objectStoreNames[i]);
              }
              db.close();
              
              return { 
                success: true, 
                data: stores.map(function(name) { return { store: name }; }),
                message: 'Found ' + stores.length + ' store(s)'
              };
            }
            
            if (query.toLowerCase().startsWith('select')) {
              const fromMatch = query.match(/from\\s+(\\w+)\\.(\\w+)/i);
              if (!fromMatch) {
                return { error: 'Use format: SELECT * FROM dbname.storename' };
              }
              const dbName = fromMatch[1];
              const storeName = fromMatch[2];
              
              const db = await new Promise(function(resolve, reject) {
                const request = indexedDB.open(dbName);
                request.onsuccess = function() { resolve(request.result); };
                request.onerror = function() { reject(request.error); };
              });
              
              const transaction = db.transaction(storeName, 'readonly');
              const objectStore = transaction.objectStore(storeName);
              const request = objectStore.getAll();
              
              const records = await new Promise(function(resolve, reject) {
                request.onsuccess = function() { resolve(request.result); };
                request.onerror = function() { reject(request.error); };
              });
              
              db.close();
              
              const limited = records.slice(0, 50);
              return { 
                success: true, 
                data: limited,
                message: 'Retrieved ' + Math.min(records.length, 50) + ' record(s)'
              };
            }
            
            if (query.toLowerCase().startsWith('clear')) {
              const fromMatch = query.match(/from\\s+(\\w+)\\.(\\w+)/i);
              if (!fromMatch) {
                return { error: 'Use format: CLEAR FROM dbname.storename' };
              }
              const dbName = fromMatch[1];
              const storeName = fromMatch[2];
              
              const db = await new Promise(function(resolve, reject) {
                const request = indexedDB.open(dbName);
                request.onsuccess = function() { resolve(request.result); };
                request.onerror = function() { reject(request.error); };
              });
              
              const transaction = db.transaction(storeName, 'readwrite');
              const objectStore = transaction.objectStore(storeName);
              const clearRequest = objectStore.clear();
              
              await new Promise(function(resolve, reject) {
                clearRequest.onsuccess = function() { resolve(true); };
                clearRequest.onerror = function() { reject(clearRequest.error); };
              });
              
              db.close();
              
              return { 
                success: true, 
                message: 'Store cleared successfully'
              };
            }
            
            return { 
              error: 'Unsupported command. Try: SHOW DATABASES, SHOW STORES FROM dbname, SELECT * FROM dbname.storename, CLEAR FROM dbname.storename'
            };
          } catch (err) {
            return { error: err.message || String(err) };
          }
        })();
      `, false);

      const duration = Date.now() - startTime;
      
      if (result.error) {
        setQueries(prev => [{
          id: queryId,
          query: queryInput,
          duration,
          timestamp: Date.now(),
          status: "error" as "error",
          error: result.error
        }, ...prev].slice(0, 100));
      } else {
        setQueries(prev => [{
          id: queryId,
          query: queryInput,
          duration,
          timestamp: Date.now(),
          status: "success" as "success",
          rowsAffected: result.data ? result.data.length : 0
        }, ...prev].slice(0, 100));
        
        if (result.data) {
          setStoreData(result.data);
          setActiveTab('queries');
        }
      }
    } catch (err: any) {
      const duration = Date.now() - startTime;
      setQueries(prev => [{
        id: queryId,
        query: queryInput,
        duration,
        timestamp: Date.now(),
        status: "error" as "error",
        error: err.message || 'Execution failed'
      }, ...prev].slice(0, 100));
    }
  };

  useEffect(() => {
    if (isOpen) {
      analyzeDatabases();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalStorageSize = [...localStorage, ...sessionStorage].reduce((sum, item) => sum + item.size, 0);
  const totalIndexedDBRecords = indexedDBs.reduce((sum, db) => 
    sum + db.stores.reduce((storeSum, store) => storeSum + (store.recordCount || 0), 0), 0
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: 450,
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
          <Database size={18} color={theme.colors.accent} />
          <h3
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 600,
              color: theme.colors.textPrimary,
            }}
          >
            Database Tools
          </h3>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={analyzeDatabases}
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
          { id: "overview", label: "Overview", icon: Activity },
          { id: "queries", label: "Queries", icon: Search },
          { id: "indexeddb", label: "IndexedDB", icon: Database },
          { id: "localstorage", label: "Storage", icon: Table },
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
        {error && (
          <div
            style={{
              padding: 12,
              background: "rgba(255, 23, 68, 0.1)",
              border: "1px solid rgba(255, 23, 68, 0.3)",
              borderRadius: 6,
              color: "#FF1744",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: theme.colors.textSecondary }}>
            Analyzing databases...
          </div>
        )}

        {!loading && activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Stats Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div
                style={{
                  padding: 16,
                  background: "rgba(255, 109, 0, 0.05)",
                  border: "1px solid rgba(255, 109, 0, 0.2)",
                  borderRadius: 8,
                }}
              >
                <div style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8 }}>
                  IndexedDB Databases
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: theme.colors.accent }}>
                  {indexedDBs.length}
                </div>
              </div>

              <div
                style={{
                  padding: 16,
                  background: "rgba(76, 175, 80, 0.05)",
                  border: "1px solid rgba(76, 175, 80, 0.2)",
                  borderRadius: 8,
                }}
              >
                <div style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8 }}>
                  Total Records
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#4CAF50" }}>
                  {totalIndexedDBRecords}
                </div>
              </div>

              <div
                style={{
                  padding: 16,
                  background: "rgba(33, 150, 243, 0.05)",
                  border: "1px solid rgba(33, 150, 243, 0.2)",
                  borderRadius: 8,
                }}
              >
                <div style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8 }}>
                  Storage Items
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#2196F3" }}>
                  {localStorage.length + sessionStorage.length}
                </div>
              </div>

              <div
                style={{
                  padding: 16,
                  background: "rgba(156, 39, 176, 0.05)",
                  border: "1px solid rgba(156, 39, 176, 0.2)",
                  borderRadius: 8,
                }}
              >
                <div style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8 }}>
                  Total Size
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#9C27B0" }}>
                  {(totalStorageSize / 1024).toFixed(1)}KB
                </div>
              </div>
            </div>

            {/* IndexedDB Info */}
            {indexedDBs.length === 0 && (
              <div style={{
                padding: 12,
                background: "rgba(255, 193, 7, 0.1)",
                border: "1px solid rgba(255, 193, 7, 0.3)",
                borderRadius: 6,
                fontSize: 12,
                color: "#FFC107"
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>IndexedDB Detection</div>
                <div style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                  No IndexedDB databases detected. Navigate to a website that uses IndexedDB (e.g., Twitter, Gmail, Discord) 
                  or use the Queries tab with "SHOW DATABASES" command.
                </div>
              </div>
            )}

            {/* Connections */}
            <section>
              <h4
                style={{
                  margin: "0 0 12px 0",
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.colors.textPrimary,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Detected Connections
              </h4>

              {connections.length === 0 ? (
                <div
                  style={{
                    padding: 16,
                    background: "rgba(255, 255, 255, 0.02)",
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: 6,
                    color: theme.colors.textSecondary,
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  No external database connections detected
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {connections.map(conn => (
                    <div
                      key={conn.id}
                      style={{
                        padding: 12,
                        background: "rgba(255, 255, 255, 0.03)",
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: 6,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: theme.colors.textPrimary }}>
                            {conn.type}
                          </div>
                          <div style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 4 }}>
                            {conn.host}
                          </div>
                        </div>
                        <div
                          style={{
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 600,
                            background: "rgba(255, 193, 7, 0.2)",
                            color: "#FFC107",
                          }}
                        >
                          DETECTED
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Recent Queries */}
            {queries.length > 0 && (
              <section>
                <h4
                  style={{
                    margin: "0 0 12px 0",
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.colors.textPrimary,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Recent Queries
                </h4>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {queries.slice(0, 5).map(query => (
                    <div
                      key={query.id}
                      style={{
                        padding: 10,
                        background: "rgba(255, 255, 255, 0.02)",
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: 4,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                          {new Date(query.timestamp).toLocaleTimeString()}
                        </span>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                            {query.duration}ms
                          </span>
                          {query.status === "success" ? (
                            <CheckCircle size={14} color="#4CAF50" />
                          ) : (
                            <AlertTriangle size={14} color="#FF1744" />
                          )}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontFamily: "monospace",
                          color: theme.colors.textPrimary,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {query.query}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {!loading && activeTab === "queries" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Query Input */}
            <div>
              <h4
                style={{
                  margin: "0 0 12px 0",
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.colors.textPrimary,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Execute Query
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <textarea
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="Examples:&#10;SHOW DATABASES&#10;SHOW STORES FROM mydb&#10;SELECT * FROM mydb.storename&#10;CLEAR FROM mydb.storename"
                  style={{
                    padding: 10,
                    background: "rgba(255, 255, 255, 0.05)",
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: 4,
                    color: theme.colors.textPrimary,
                    fontSize: 12,
                    fontFamily: "monospace",
                    minHeight: 80,
                    resize: "vertical",
                  }}
                />
                <button
                  onClick={executeQuery}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 4,
                    border: "none",
                    background: theme.colors.accent,
                    color: "white",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <PlayCircle size={16} />
                  Execute Query
                </button>
              </div>
              
              {/* Quick Commands Helper */}
              <div style={{ 
                padding: 10, 
                background: "rgba(33, 150, 243, 0.1)", 
                border: "1px solid rgba(33, 150, 243, 0.3)",
                borderRadius: 4,
                fontSize: 11,
                color: theme.colors.textSecondary 
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4, color: "#2196F3" }}>Available Commands:</div>
                <div style={{ fontFamily: "monospace" }}>
                  • SHOW DATABASES<br/>
                  • SHOW STORES FROM dbname<br/>
                  • SELECT * FROM dbname.storename<br/>
                  • CLEAR FROM dbname.storename
                </div>
              </div>
            </div>

            {/* Query Results */}
            {storeData.length > 0 && (
              <div>
                <h4
                  style={{
                    margin: "0 0 12px 0",
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.colors.textPrimary,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Query Results ({storeData.length} records)
                </h4>
                <div
                  style={{
                    maxHeight: 300,
                    overflowY: "auto",
                    padding: 12,
                    background: "rgba(0, 0, 0, 0.3)",
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: "monospace",
                    color: theme.colors.textPrimary,
                  }}
                >
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {JSON.stringify(storeData, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Query History */}
            <div>
              <h4
                style={{
                  margin: "0 0 12px 0",
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.colors.textPrimary,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Query History
              </h4>

              {queries.length === 0 ? (
                <div
                  style={{
                    padding: 16,
                    background: "rgba(255, 255, 255, 0.02)",
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: 6,
                    color: theme.colors.textSecondary,
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  No queries executed yet
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {queries.map(query => (
                    <div
                      key={query.id}
                      style={{
                        padding: 12,
                        background: query.status === "error" ? "rgba(255, 23, 68, 0.05)" : "rgba(255, 255, 255, 0.03)",
                        border: `1px solid ${query.status === "error" ? "rgba(255, 23, 68, 0.3)" : theme.colors.border}`,
                        borderRadius: 6,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                          {new Date(query.timestamp).toLocaleTimeString()}
                        </span>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Clock size={12} color={theme.colors.textSecondary} />
                            <span style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                              {query.duration}ms
                            </span>
                          </div>
                          {query.status === "success" ? (
                            <CheckCircle size={14} color="#4CAF50" />
                          ) : (
                            <AlertTriangle size={14} color="#FF1744" />
                          )}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontFamily: "monospace",
                          color: theme.colors.textPrimary,
                          marginBottom: 8,
                          padding: 8,
                          background: "rgba(0, 0, 0, 0.3)",
                          borderRadius: 4,
                        }}
                      >
                        {query.query}
                      </div>
                      {query.error && (
                        <div style={{ fontSize: 11, color: "#FF1744" }}>
                          Error: {query.error}
                        </div>
                      )}
                      {query.status === "success" && query.rowsAffected !== undefined && (
                        <div style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                          Rows affected: {query.rowsAffected}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!loading && activeTab === "indexeddb" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {indexedDBs.length === 0 ? (
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
                No IndexedDB databases found on this page
              </div>
            ) : (
              indexedDBs.map(db => (
                <div
                  key={db.name}
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: 16,
                      background: "rgba(255, 109, 0, 0.1)",
                      borderBottom: `1px solid ${theme.colors.border}`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: theme.colors.textPrimary }}>
                          {db.name}
                        </div>
                        <div style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 4 }}>
                          Version {db.version} • {db.stores.length} object stores
                        </div>
                      </div>
                      <Database size={20} color={theme.colors.accent} />
                    </div>
                  </div>

                  <div style={{ padding: 12 }}>
                    {db.stores.map(store => (
                      <div
                        key={store.name}
                        style={{
                          padding: 12,
                          background: "rgba(255, 255, 255, 0.02)",
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: 6,
                          marginBottom: 8,
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          setSelectedDB(db.name);
                          setSelectedStore(store.name);
                          loadStoreData(db.name, store.name);
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: theme.colors.textPrimary }}>
                            {store.name}
                          </div>
                          <div
                            style={{
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 600,
                              background: "rgba(76, 175, 80, 0.2)",
                              color: "#4CAF50",
                            }}
                          >
                            {store.recordCount || 0} records
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 4 }}>
                          Key Path: {typeof store.keyPath === 'string' ? store.keyPath : JSON.stringify(store.keyPath)}
                        </div>
                        {store.indexes.length > 0 && (
                          <div style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                            Indexes: {store.indexes.map(idx => idx.name).join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {selectedDB === db.name && selectedStore && storeData.length > 0 && (
                    <div
                      style={{
                        padding: 12,
                        background: "rgba(0, 0, 0, 0.3)",
                        borderTop: `1px solid ${theme.colors.border}`,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: theme.colors.textPrimary, marginBottom: 8 }}>
                        Store Data: {selectedStore}
                      </div>
                      <div
                        style={{
                          maxHeight: 300,
                          overflowY: "auto",
                          fontSize: 11,
                          fontFamily: "monospace",
                          color: theme.colors.textPrimary,
                        }}
                      >
                        <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {JSON.stringify(storeData, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {!loading && activeTab === "localstorage" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* LocalStorage */}
            <section>
              <h4
                style={{
                  margin: "0 0 12px 0",
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.colors.textPrimary,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                localStorage ({localStorage.length} items)
              </h4>

              {localStorage.length === 0 ? (
                <div
                  style={{
                    padding: 16,
                    background: "rgba(255, 255, 255, 0.02)",
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: 6,
                    color: theme.colors.textSecondary,
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  Empty
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {localStorage.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 12,
                        background: "rgba(255, 255, 255, 0.03)",
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: 6,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: theme.colors.accent }}>
                          {item.key}
                        </div>
                        <div style={{ fontSize: 10, color: theme.colors.textSecondary }}>
                          {item.size} bytes
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: theme.colors.textSecondary,
                          fontFamily: "monospace",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* SessionStorage */}
            <section>
              <h4
                style={{
                  margin: "0 0 12px 0",
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.colors.textPrimary,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                sessionStorage ({sessionStorage.length} items)
              </h4>

              {sessionStorage.length === 0 ? (
                <div
                  style={{
                    padding: 16,
                    background: "rgba(255, 255, 255, 0.02)",
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: 6,
                    color: theme.colors.textSecondary,
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  Empty
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sessionStorage.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 12,
                        background: "rgba(255, 255, 255, 0.03)",
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: 6,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: theme.colors.accent }}>
                          {item.key}
                        </div>
                        <div style={{ fontSize: 10, color: theme.colors.textSecondary }}>
                          {item.size} bytes
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: theme.colors.textSecondary,
                          fontFamily: "monospace",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
