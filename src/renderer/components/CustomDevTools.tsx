import { useState, useEffect } from "react";
import { theme } from "../styles/theme";
import { Code, Network, Terminal, X, Database, Activity, Box } from "lucide-react";

// Add keyframe animation
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes slideUp {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;
if (!document.head.querySelector('style[data-devtools-animation]')) {
  styleSheet.setAttribute('data-devtools-animation', 'true');
  document.head.appendChild(styleSheet);
}

interface CustomDevToolsProps {
  webviewRef: React.RefObject<any>;
  onClose: () => void;
}

interface ConsoleMessage {
  id: string;
  level: string;
  message: string;
  timestamp: number;
  args?: any[];
}

interface NetworkRequest {
  id: string;
  url: string;
  method: string;
  status?: number;
  timestamp: number;
  duration?: number;
}

interface StorageItem {
  key: string;
  value: string;
}

const CustomDevTools = ({ webviewRef, onClose }: CustomDevToolsProps) => {
  const [activeTab, setActiveTab] = useState<'console' | 'elements' | 'pageinfo' | 'network' | 'storage' | 'performance'>('console');
  const [consoleLogs, setConsoleLogs] = useState<ConsoleMessage[]>([]);
  const [pageInfo, setPageInfo] = useState<any>(null);
  const [htmlTree, setHtmlTree] = useState<string>('');
  const [networkRequests, setNetworkRequests] = useState<NetworkRequest[]>([]);
  const [localStorage, setLocalStorage] = useState<StorageItem[]>([]);
  const [sessionStorage, setSessionStorage] = useState<StorageItem[]>([]);
  const [performance, setPerformance] = useState<any>(null);
  const [logFilter, setLogFilter] = useState<'all' | 'log' | 'warn' | 'error' | 'info'>('all');

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    // Inject console interceptor into the page
    const injectConsoleLogger = () => {
      webview.executeJavaScript(`
        (function() {
          if (window.__consoleInjected) return;
          window.__consoleInjected = true;
          
          const originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info,
            debug: console.debug
          };
          
          ['log', 'warn', 'error', 'info', 'debug'].forEach(level => {
            console[level] = function(...args) {
              originalConsole[level].apply(console, args);
              
              // Send to DevTools via console-message event
              const message = args.map(arg => {
                if (typeof arg === 'object') {
                  try {
                    return JSON.stringify(arg, null, 2);
                  } catch {
                    return String(arg);
                  }
                }
                return String(arg);
              }).join(' ');
              
              // This will trigger console-message event
              originalConsole.log('[DEVTOOLS-' + level.toUpperCase() + ']', message);
            };
          });
        })();
      `).catch((err: any) => console.error('Failed to inject console logger:', err));
    };

    const handleConsoleMessage = (e: any) => {
      const message = e.message || '';
      
      // Check if it's our injected message
      let level = 'log';
      let cleanMessage = message;
      
      if (message.includes('[DEVTOOLS-')) {
        const match = message.match(/\[DEVTOOLS-(LOG|WARN|ERROR|INFO|DEBUG)\]\s*(.*)/);
        if (match) {
          level = match[1].toLowerCase();
          cleanMessage = match[2];
        }
      } else {
        // Regular console message
        level = e.level?.toString() || 'log';
        cleanMessage = message;
      }
      
      const msg: ConsoleMessage = {
        id: crypto.randomUUID(),
        level: level,
        message: cleanMessage,
        timestamp: Date.now()
      };
      setConsoleLogs((prev) => [...prev, msg].slice(-500)); // Keep last 500
    };

    const handleDidFinishLoad = async () => {
      // Inject console logger first
      injectConsoleLogger();
      
      try {
        // Get comprehensive page data
        const data = await webview.executeJavaScript(`
          (function() {
            // Page info
            const info = {
              title: document.title,
              url: window.location.href,
              readyState: document.readyState,
              doctype: document.doctype ? document.doctype.name : 'none',
              elements: document.querySelectorAll('*').length,
              scripts: document.scripts.length,
              stylesheets: document.styleSheets.length,
              images: document.images.length,
              links: document.links.length
            };

            // Full HTML tree like Chrome DevTools
            const getElementTree = (el, depth = 0, maxDepth = 10) => {
              if (depth > maxDepth) return '';
              
              const tagName = el.tagName.toLowerCase();
              const indent = '  '.repeat(depth);
              
              // Opening tag
              let html = indent + '<' + tagName;
              
              // Attributes
              if (el.id) html += ' id="' + el.id + '"';
              if (el.className && typeof el.className === 'string') {
                html += ' class="' + el.className + '"';
              }
              
              // Add other important attributes
              const attrs = el.attributes;
              for (let i = 0; i < Math.min(attrs.length, 10); i++) {
                const attr = attrs[i];
                if (attr.name !== 'id' && attr.name !== 'class') {
                  const value = attr.value.length > 50 ? attr.value.substring(0, 50) + '...' : attr.value;
                  html += ' ' + attr.name + '="' + value + '"';
                }
              }
              
              html += '>\\n';
              
              // Text content (if no children)
              if (el.children.length === 0 && el.textContent && el.textContent.trim()) {
                const text = el.textContent.trim();
                if (text.length > 0) {
                  const shortText = text.length > 100 ? text.substring(0, 100) + '...' : text;
                  html += indent + '  ' + shortText + '\\n';
                }
              }
              
              // Children (show all, not just 5)
              const maxChildren = 50; // Limit to prevent hanging
              Array.from(el.children).slice(0, maxChildren).forEach(child => {
                html += getElementTree(child, depth + 1, maxDepth);
              });
              
              if (el.children.length > maxChildren) {
                html += indent + '  ... (' + (el.children.length - maxChildren) + ' more children)\\n';
              }
              
              // Closing tag (only for elements with children or important tags)
              if (el.children.length > 0 || ['div', 'body', 'html', 'head'].includes(tagName)) {
                html += indent + '</' + tagName + '>\\n';
              }
              
              return html;
            };
            
            const htmlTree = getElementTree(document.documentElement);

            // Storage
            const localStorageItems = [];
            try {
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key) {
                  localStorageItems.push({ key, value: localStorage.getItem(key) });
                }
              }
            } catch (e) {}

            const sessionStorageItems = [];
            try {
              for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key) {
                  sessionStorageItems.push({ key, value: sessionStorage.getItem(key) });
                }
              }
            } catch (e) {}

            // Performance
            const perfData = window.performance.timing;
            const perf = {
              domContentLoaded: perfData.domContentLoadedEventEnd - perfData.navigationStart,
              loadComplete: perfData.loadEventEnd - perfData.navigationStart,
              domInteractive: perfData.domInteractive - perfData.navigationStart,
              dnsLookup: perfData.domainLookupEnd - perfData.domainLookupStart,
              tcpConnection: perfData.connectEnd - perfData.connectStart,
              serverResponse: perfData.responseEnd - perfData.requestStart
            };

            return { info, htmlTree, localStorageItems, sessionStorageItems, perf };
          })()
        `);
        
        setPageInfo(data.info);
        setHtmlTree(data.htmlTree);
        setLocalStorage(data.localStorageItems);
        setSessionStorage(data.sessionStorageItems);
        setPerformance(data.perf);
      } catch (err) {
        console.error('Failed to get page info', err);
      }
    };

    const handleDidStartNavigation = () => {
      // Clear console on new page navigation
      setConsoleLogs([]);
    };

    webview.addEventListener('console-message', handleConsoleMessage);
    webview.addEventListener('did-finish-load', handleDidFinishLoad);
    webview.addEventListener('did-start-loading', handleDidStartNavigation);
    webview.addEventListener('did-navigate', injectConsoleLogger);
    webview.addEventListener('did-navigate-in-page', injectConsoleLogger);

    // Initial load
    if (webview.src) {
      handleDidFinishLoad();
    }

    return () => {
      webview.removeEventListener('console-message', handleConsoleMessage);
      webview.removeEventListener('did-finish-load', handleDidFinishLoad);
      webview.removeEventListener('did-start-loading', handleDidStartNavigation);
      webview.removeEventListener('did-navigate', injectConsoleLogger);
      webview.removeEventListener('did-navigate-in-page', injectConsoleLogger);
    };
  }, [webviewRef]);

  const styles = {
    container: {
      width: '100%',
      height: 300,
      background: 'rgba(10, 10, 10, 0.98)',
      borderTop: `1px solid ${theme.colors.border}`,
      display: 'flex',
      flexDirection: 'column' as const,
      color: theme.colors.textPrimary,
      fontSize: 12,
      fontFamily: 'Source Code Pro, Monaco, monospace',
      animation: 'slideUp 0.3s ease-out',
      transformOrigin: 'bottom'
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 12px',
      borderBottom: `1px solid ${theme.colors.border}`,
      background: 'rgba(0, 0, 0, 0.3)'
    },
    tabs: {
      display: 'flex',
      gap: 8
    },
    tab: (active: boolean) => ({
      padding: '4px 12px',
      borderRadius: 4,
      background: active ? 'rgba(255, 109, 0, 0.15)' : 'transparent',
      color: active ? theme.colors.accent : theme.colors.textSecondary,
      border: 'none',
      cursor: 'pointer',
      fontSize: 11,
      fontWeight: active ? 600 : 400,
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }),
    closeBtn: {
      background: 'transparent',
      border: 'none',
      color: theme.colors.textSecondary,
      cursor: 'pointer',
      padding: 4,
      borderRadius: 4,
      display: 'flex',
      alignItems: 'center'
    },
    content: {
      flex: 1,
      overflow: 'auto',
      padding: 12
    },
    consoleLog: (level: string) => ({
      padding: '4px 8px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      fontFamily: 'Source Code Pro, Monaco, monospace',
      fontSize: 11,
      color: level === 'error' ? '#ff6b6b' : 
             level === 'warn' ? '#ffd93d' : 
             level === 'info' ? '#6bcbff' : 
             theme.colors.textPrimary,
      display: 'flex',
      gap: 8
    }),
    timestamp: {
      color: theme.colors.textSecondary,
      minWidth: 60
    },
    infoGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    },
    infoCard: {
      background: 'rgba(255, 255, 255, 0.03)',
      border: `1px solid ${theme.colors.border}`,
      borderRadius: 6,
      padding: 12
    },
    infoLabel: {
      color: theme.colors.textSecondary,
      fontSize: 10,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
      marginBottom: 6
    },
    infoValue: {
      color: theme.colors.textPrimary,
      fontSize: 13,
      fontWeight: 600
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.tabs}>
          <button
            style={styles.tab(activeTab === 'console')}
            onClick={() => setActiveTab('console')}
          >
            <Terminal size={14} />
            Console
          </button>
          <button
            style={styles.tab(activeTab === 'elements')}
            onClick={() => setActiveTab('elements')}
          >
            <Box size={14} />
            Elements
          </button>
          <button
            style={styles.tab(activeTab === 'pageinfo')}
            onClick={() => setActiveTab('pageinfo')}
          >
            <Code size={14} />
            Page Info
          </button>
          <button
            style={styles.tab(activeTab === 'network')}
            onClick={() => setActiveTab('network')}
          >
            <Network size={14} />
            Network
          </button>
          <button
            style={styles.tab(activeTab === 'storage')}
            onClick={() => setActiveTab('storage')}
          >
            <Database size={14} />
            Storage
          </button>
          <button
            style={styles.tab(activeTab === 'performance')}
            onClick={() => setActiveTab('performance')}
          >
            <Activity size={14} />
            Performance
          </button>
        </div>
        <button style={styles.closeBtn} onClick={onClose} title="Close DevTools">
          <X size={16} />
        </button>
      </div>

      <div style={styles.content}>
        {activeTab === 'console' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Console content */}
            <div style={{ 
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
              fontSize: 11,
              flex: 1,
              overflow: 'auto'
            }}>
              {consoleLogs.filter(log => logFilter === 'all' || log.level === logFilter).length === 0 ? (
                <div style={{ 
                  color: theme.colors.textSecondary, 
                  padding: '12px 8px',
                  fontSize: 12,
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  {consoleLogs.length === 0 ? 'Console is empty' : `No ${logFilter} messages`}
                </div>
              ) : (
                consoleLogs
                  .filter(log => logFilter === 'all' || log.level === logFilter)
                  .map((log) => (
                <div key={log.id} style={{
                  display: 'flex',
                  padding: '2px 8px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                  alignItems: 'flex-start',
                  gap: 8,
                  lineHeight: '18px',
                  background: log.level === 'error' ? 'rgba(255, 0, 0, 0.05)' : 
                             log.level === 'warn' ? 'rgba(255, 200, 0, 0.05)' : 
                             'transparent'
                }}>
                  <span style={{ 
                    color: log.level === 'error' ? '#f48771' : 
                           log.level === 'warn' ? '#e8a735' : 
                           log.level === 'info' ? '#49a6d4' : 
                           '#898989',
                    fontSize: 10,
                    minWidth: 50,
                    marginTop: 2
                  }}>
                    {formatTime(log.timestamp)}
                  </span>
                  <span style={{ 
                    color: log.level === 'error' ? '#f48771' : 
                           log.level === 'warn' ? '#e8a735' : 
                           log.level === 'info' ? '#49a6d4' : 
                           '#a6a6a6',
                    flex: 1,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {log.message}
                  </span>
                </div>
              ))
            )}
            </div>
            
            {/* Console toolbar at bottom */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 8px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(0, 0, 0, 0.4)',
              gap: 8
            }}>
              <button
                onClick={() => setConsoleLogs([])}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: theme.colors.textSecondary,
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 3,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = theme.colors.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = theme.colors.textSecondary;
                }}
                title="Clear console"
              >
                🗑️ Clear
              </button>
              
              <div style={{ 
                height: 16, 
                width: 1, 
                background: 'rgba(255, 255, 255, 0.1)' 
              }} />
              
              {/* Filter buttons */}
              <div style={{ display: 'flex', gap: 4 }}>
                {['all', 'log', 'info', 'warn', 'error'].map((level) => (
                  <button
                    key={level}
                    onClick={() => setLogFilter(level as any)}
                    style={{
                      background: logFilter === level ? 'rgba(255, 109, 0, 0.2)' : 'transparent',
                      border: `1px solid ${logFilter === level ? theme.colors.accent : 'rgba(255, 255, 255, 0.1)'}`,
                      color: logFilter === level ? theme.colors.accent : theme.colors.textSecondary,
                      fontSize: 10,
                      cursor: 'pointer',
                      padding: '3px 8px',
                      borderRadius: 3,
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      textTransform: 'capitalize' as const,
                      fontWeight: logFilter === level ? 600 : 400
                    }}
                    title={`Show ${level} messages`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              
              <span style={{
                marginLeft: 'auto',
                fontSize: 10,
                color: theme.colors.textSecondary,
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
                {consoleLogs.filter(log => logFilter === 'all' || log.level === logFilter).length} / {consoleLogs.length} messages
              </span>
            </div>
          </div>
        )}

        {activeTab === 'elements' && (
          <div style={{
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: 11,
            padding: '8px',
            height: '100%',
            overflow: 'auto',
            background: '#1e1e1e'
          }}>
            {!htmlTree ? (
              <div style={{ 
                color: theme.colors.textSecondary, 
                padding: '12px 8px',
                fontSize: 12,
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
                Loading DOM tree...
              </div>
            ) : (
              <pre style={{ 
                margin: 0,
                padding: 0,
                whiteSpace: 'pre',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                lineHeight: '20px',
                color: '#cccccc',
                tabSize: 2
              }}>
                {htmlTree.split('\n').map((line, idx) => {
                  // Basic syntax highlighting
                  let styledLine = line;
                  
                  // Check line type
                  const trimmed = line.trim();
                  const isOpeningTag = trimmed.startsWith('<') && !trimmed.startsWith('</');
                  const isClosingTag = trimmed.startsWith('</');
                  
                  return (
                    <div key={idx} style={{
                      color: isOpeningTag ? '#569cd6' : 
                             isClosingTag ? '#569cd6' : 
                             trimmed.startsWith('<') ? '#569cd6' :
                             '#9cdcfe'
                    }}>
                      {line}
                    </div>
                  );
                })}
              </pre>
            )}
          </div>
        )}

        {activeTab === 'pageinfo' && (
          <div>
            {!pageInfo ? (
              <div style={{ color: theme.colors.textSecondary, textAlign: 'center', padding: 20 }}>
                Loading page info...
              </div>
            ) : (
              <div style={styles.infoGrid}>
                <div style={styles.infoCard}>
                  <div style={styles.infoLabel}>Title</div>
                  <div style={styles.infoValue}>{pageInfo.title || 'Untitled'}</div>
                </div>
                <div style={styles.infoCard}>
                  <div style={styles.infoLabel}>Ready State</div>
                  <div style={styles.infoValue}>{pageInfo.readyState}</div>
                </div>
                <div style={styles.infoCard}>
                  <div style={styles.infoLabel}>Doctype</div>
                  <div style={styles.infoValue}>{pageInfo.doctype}</div>
                </div>
                <div style={styles.infoCard}>
                  <div style={styles.infoLabel}>Elements</div>
                  <div style={styles.infoValue}>{pageInfo.elements}</div>
                </div>
                <div style={styles.infoCard}>
                  <div style={styles.infoLabel}>Scripts</div>
                  <div style={styles.infoValue}>{pageInfo.scripts}</div>
                </div>
                <div style={styles.infoCard}>
                  <div style={styles.infoLabel}>Stylesheets</div>
                  <div style={styles.infoValue}>{pageInfo.stylesheets}</div>
                </div>
                <div style={styles.infoCard}>
                  <div style={styles.infoLabel}>Images</div>
                  <div style={styles.infoValue}>{pageInfo.images}</div>
                </div>
                <div style={styles.infoCard}>
                  <div style={styles.infoLabel}>Links</div>
                  <div style={styles.infoValue}>{pageInfo.links}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'network' && (
          <div style={{ color: theme.colors.textSecondary, textAlign: 'center', padding: 20 }}>
            Network monitoring in webview is limited. Feature coming soon...
          </div>
        )}

        {activeTab === 'storage' && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ 
                color: theme.colors.accent, 
                fontWeight: 600, 
                marginBottom: 12,
                fontSize: 13 
              }}>
                localStorage
              </div>
              {localStorage.length > 0 ? (
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: 6,
                  overflow: 'hidden'
                }}>
                  {localStorage.map((item, idx) => (
                    <div key={idx} style={{ 
                      padding: '10px 12px',
                      borderBottom: idx < localStorage.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                      display: 'flex',
                      gap: 16
                    }}>
                      <span style={{ 
                        color: '#4ade80', 
                        minWidth: 180,
                        fontWeight: 600
                      }}>
                        {item.key}
                      </span>
                      <span style={{ 
                        color: theme.colors.textPrimary, 
                        flex: 1, 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ 
                  color: theme.colors.textSecondary, 
                  fontSize: 11,
                  fontStyle: 'italic' 
                }}>
                  Empty
                </div>
              )}
            </div>

            <div>
              <div style={{ 
                color: theme.colors.accent, 
                fontWeight: 600, 
                marginBottom: 12,
                fontSize: 13 
              }}>
                sessionStorage
              </div>
              {sessionStorage.length > 0 ? (
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: 6,
                  overflow: 'hidden'
                }}>
                  {sessionStorage.map((item, idx) => (
                    <div key={idx} style={{ 
                      padding: '10px 12px',
                      borderBottom: idx < sessionStorage.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                      display: 'flex',
                      gap: 16
                    }}>
                      <span style={{ 
                        color: '#4ade80', 
                        minWidth: 180,
                        fontWeight: 600
                      }}>
                        {item.key}
                      </span>
                      <span style={{ 
                        color: theme.colors.textPrimary, 
                        flex: 1, 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ 
                  color: theme.colors.textSecondary, 
                  fontSize: 11,
                  fontStyle: 'italic' 
                }}>
                  Empty
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'performance' && (
          <div>
            {!performance ? (
              <div style={{ color: theme.colors.textSecondary, textAlign: 'center', padding: 20 }}>
                Loading performance metrics...
              </div>
            ) : (
              <div style={styles.infoGrid}>
                <div style={styles.infoCard}>
                  <div style={styles.infoLabel}>DOM Content Loaded</div>
                  <div style={styles.infoValue}>{performance.domContentLoaded}ms</div>
                </div>
                <div style={styles.infoCard}>
                  <div style={styles.infoLabel}>Load Complete</div>
                  <div style={styles.infoValue}>{performance.loadComplete}ms</div>
                </div>
                <div style={styles.infoCard}>
                  <div style={styles.infoLabel}>DOM Interactive</div>
                  <div style={styles.infoValue}>{performance.domInteractive}ms</div>
                </div>
                <div style={styles.infoCard}>
                  <div style={styles.infoLabel}>DNS Lookup</div>
                  <div style={styles.infoValue}>{performance.dnsLookup}ms</div>
                </div>
                <div style={styles.infoCard}>
                  <div style={styles.infoLabel}>TCP Connection</div>
                  <div style={styles.infoValue}>{performance.tcpConnection}ms</div>
                </div>
                <div style={styles.infoCard}>
                  <div style={styles.infoLabel}>Server Response</div>
                  <div style={styles.infoValue}>{performance.serverResponse}ms</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomDevTools;
