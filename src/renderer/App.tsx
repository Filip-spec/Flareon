import { type CSSProperties, useEffect, useState, useRef } from "react";
import { Monitor, Code, Image, Settings, Menu } from "lucide-react";
import AddressBar from "./components/AddressBar";
import ScreenshotButton from "./components/ScreenshotButton";
import ViewportPreview from "./components/ViewportPreview";
import CustomDevTools from "./components/CustomDevTools";
import ImageViewer from "./components/ImageViewer";
import { theme } from "./styles/theme";
import type { ViewportPreset } from "./types/viewport";

export interface BrowserTab {
  id: string;
  title: string;
  url: string;
}

const viewportPresets: ViewportPreset[] = [
  { id: "responsive", label: "Responsive", width: "100%", height: "100%", description: "Full width" },
  { id: "mobile", label: "Mobile", width: 375, height: 667, description: "iPhone SE" },
  { id: "tablet", label: "Tablet", width: 768, height: 1024, description: "iPad" },
  { id: "laptop", label: "Laptop", width: 1280, height: 800, description: "13-inch" },
  { id: "desktop", label: "Desktop", width: 1920, height: 1080, description: "Full HD" }
];

const createTab = (url: string): BrowserTab => ({
  id: crypto.randomUUID(),
  title: "New Tab",
  url
});

const styles = {
  appShell: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100vh",
    backgroundColor: theme.colors.background,
    color: theme.colors.textPrimary,
    fontFamily: theme.font as string
  },
  header: {
    padding: "8px 12px 8px 80px",
    borderBottom: `1px solid ${theme.colors.border}`,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    background: "rgba(0, 0, 0, 0.2)",
    WebkitAppRegion: "drag" as const,
    minHeight: "48px"
  },
  mainContent: {
    flex: 1,
    display: "flex",
    overflow: "hidden"
  },
  logo: {
    width: "24px",
    height: "24px",
    objectFit: "contain" as const,
    WebkitAppRegion: "no-drag" as const
  },
  addressRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flex: 1,
    WebkitAppRegion: "no-drag" as const
  },
  contentArea: {
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    overflow: "auto",
    position: "relative" as const,
    borderRight: `1px solid ${theme.colors.border}`,
    background: "#0a0a0a",
    padding: "20px"
  },
  webviewContainer: {
    background: theme.colors.background,
    borderRadius: "8px",
    border: `1px solid ${theme.colors.border}`,
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
    overflow: "hidden",
    alignSelf: 'flex-start'
  },
  sidebar: {
    background: "linear-gradient(180deg, rgba(20,20,20,0.95) 0%, rgba(15,15,15,0.98) 100%)",
    borderLeft: `1px solid ${theme.colors.border}`,
    padding: "16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
    overflowY: "auto" as const,
    transition: "width 0.3s ease",
    minWidth: "64px",
    position: "relative" as const
  },
  statusBar: {
    padding: "4px 12px",
    borderTop: `1px solid ${theme.colors.border}`,
    color: theme.colors.textSecondary,
    fontSize: "11px",
    background: "rgba(0, 0, 0, 0.2)"
  },
  sectionTitle: {
    fontSize: "11px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: theme.colors.textSecondary,
    marginBottom: "8px"
  },
  infoCard: {
    border: `1px solid ${theme.colors.border}`,
    borderRadius: "8px",
    padding: "12px",
    background: "rgba(255, 255, 255, 0.03)",
    fontSize: "12px"
  },
  infoLabel: {
    color: theme.colors.textSecondary,
    marginBottom: "4px"
  },
  infoValue: {
    color: theme.colors.textPrimary,
    fontWeight: 600
  }
};

const defaultUrl = "https://developer.mozilla.org/";

const sanitizeUrl = (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.toString();
  } catch (error) {
    return `https://${trimmed.replace(/^https?:\/\//i, "")}`;
  }
};

function App() {
  const [tabs, setTabs] = useState<BrowserTab[]>([createTab(defaultUrl)]);
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);
  const [addressValue, setAddressValue] = useState(defaultUrl);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [selectedViewportId, setSelectedViewportId] = useState<string>(viewportPresets[0].id);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(true);
  const [isDevToolsOpen, setIsDevToolsOpen] = useState<boolean>(false);
  const [isImageViewOpen, setIsImageViewOpen] = useState<boolean>(false);
  const [pageImages, setPageImages] = useState<Array<{src: string, alt: string, width: number, height: number}>>([]);

  const activeTab = tabs.find((tab: BrowserTab) => tab.id === activeTabId) ?? tabs[0];
  const activeViewport = viewportPresets.find((preset) => preset.id === selectedViewportId) ?? viewportPresets[0];

  const webviewRef = useRef<any>(null);

  const toggleDevToolsEmbedded = () => {
    setIsDevToolsOpen((prev) => !prev);
    setStatusMessage(isDevToolsOpen ? 'DevTools closed' : 'DevTools opened');
  };

  const toggleImageView = async () => {
    const newState = !isImageViewOpen;
    setIsImageViewOpen(newState);
    
    if (newState && webviewRef.current) {
      // Fetch images from the page
      try {
        const images = await webviewRef.current.executeJavaScript(`
          Array.from(document.querySelectorAll('img')).map(img => ({
            src: img.src,
            alt: img.alt || '',
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height
          }))
        `);
        setPageImages(images);
        setStatusMessage(`Found ${images.length} images`);
      } catch (err) {
        console.error('Failed to get images', err);
        setPageImages([]);
      }
    } else {
      setStatusMessage('Image view closed');
    }
  };

  useEffect(() => {
    const el = webviewRef.current;
    if (!el) return;

    const handleDidFinishLoad = async () => {
      try {
        // try getTitle, otherwise fall back to executeJavaScript
        const title = (typeof el.getTitle === 'function') ? await el.getTitle() : await (el.executeJavaScript && el.executeJavaScript('document.title'));
        if (title) {
          setTabs((prev) => prev.map((t) => (t.id === activeTabId ? { ...t, title } : t)));
        }
      } catch (err) {
        // ignore
      }
    };

    const handlePageTitleUpdated = (ev: any) => {
      const title = ev?.title || null;
      if (title) {
        setTabs((prev) => prev.map((t) => (t.id === activeTabId ? { ...t, title } : t)));
      }
    };

    el.addEventListener && el.addEventListener('did-finish-load', handleDidFinishLoad);
    el.addEventListener && el.addEventListener('page-title-updated', handlePageTitleUpdated);

    // try an initial read in case content is already loaded
    handleDidFinishLoad();

    return () => {
      el.removeEventListener && el.removeEventListener('did-finish-load', handleDidFinishLoad);
      el.removeEventListener && el.removeEventListener('page-title-updated', handlePageTitleUpdated);
    };
  }, [activeTabId]);

  useEffect(() => {
    if (activeTab) {
      setAddressValue(activeTab.url);
    }
  }, [activeTab?.url]);

  useEffect(() => {
    if (!statusMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setStatusMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  const onSubmitAddress = (value: string) => {
    if (!activeTab) {
      return;
    }

    const normalized = sanitizeUrl(value);
    if (!normalized) {
      return;
    }

    setTabs((prev: BrowserTab[]) =>
      prev.map((tab: BrowserTab) =>
        tab.id === activeTab.id
          ? {
              ...tab,
              url: normalized,
              title: tab.title === "New Tab" ? normalized : tab.title
            }
          : tab
      )
    );
  };

  const onRefreshPage = () => {
    if (!activeTab || !webviewRef.current) {
      return;
    }
    
    // Reload the current page
    webviewRef.current.reload();
  };

  const onAddTab = () => {
    const newTab = createTab(defaultUrl);
    setTabs((prev: BrowserTab[]) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setAddressValue(defaultUrl);
  };

  const onCloseTab = (id: string) => {
    setTabs((prev: BrowserTab[]) => {
      if (prev.length === 1) {
        return prev;
      }

      const filtered = prev.filter((tab: BrowserTab) => tab.id !== id);
      if (activeTabId === id) {
        const fallback = filtered[filtered.length - 1];
        setActiveTabId(fallback.id);
        setAddressValue(fallback.url);
      }
      return filtered;
    });
  };

  const onSelectTab = (id: string) => {
    setActiveTabId(id);
    const tab = tabs.find((item: BrowserTab) => item.id === id);
    if (tab) {
      setAddressValue(tab.url);
    }
  };

  const handleScreenshot = async () => {
    try {
      setIsCapturing(true);
      const filePath = await window.electronAPI.captureViewport();
      if (filePath) {
        setStatusMessage(`Screenshot saved to ${filePath}`);
      } else {
        setStatusMessage("Capture failed — no active window");
      }
    } catch (error) {
      setStatusMessage("Screenshot failed. See console for details.");
      console.error(error);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div style={styles.appShell}>
      <header style={styles.header}>
        <img src="./assets/logo.png" alt="Flareon" style={styles.logo} />
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 8, /* @ts-ignore */ ['WebkitAppRegion' as any]: 'no-drag' }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  onClick={() => onSelectTab(tab.id)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: tab.id === activeTabId ? 'rgba(255, 109, 0, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                    border: tab.id === activeTabId ? `1px solid ${theme.colors.accent}` : '1px solid transparent',
                    color: tab.id === activeTabId ? theme.colors.accent : theme.colors.textSecondary,
                    fontSize: 11,
                    fontWeight: tab.id === activeTabId ? 600 : 400,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s ease',
                    minWidth: 80,
                    maxWidth: 160
                  }}
                  onMouseEnter={(e) => {
                    if (tab.id !== activeTabId) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (tab.id !== activeTabId) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    }
                  }}
                >
                  <span style={{ 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap',
                    flex: 1
                  }}>
                    {tab.title}
                  </span>
                  {tabs.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseTab(tab.id);
                      }}
                      aria-label="Close tab"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: tab.id === activeTabId ? theme.colors.accent : theme.colors.textSecondary,
                        cursor: 'pointer',
                        padding: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        lineHeight: 1,
                        borderRadius: 4,
                        width: 18,
                        height: 18,
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={onAddTab}
                title="New tab"
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: 'rgba(255, 255, 255, 0.03)',
                  color: theme.colors.textSecondary,
                  border: '1px solid transparent',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 400,
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 28,
                  height: 26
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.color = theme.colors.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.color = theme.colors.textSecondary;
                }}
              >
                +
              </button>
            </div>

          <div style={styles.addressRow}>
            <AddressBar
              value={addressValue}
              onChange={setAddressValue}
              onSubmit={() => onSubmitAddress(addressValue)}
              onRefresh={onRefreshPage}
              placeholder="Enter URL..."
            />
          </div>
        </div>
      </header>
      <div style={styles.mainContent}>
        <section style={{ 
          ...styles.contentArea, 
          flex: 1, 
          flexDirection: 'column' as const, 
          display: 'flex',
          padding: 0
        }}>
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'flex-start', 
            overflow: 'auto', 
            padding: '20px',
            width: '100%'
          }}>
            {activeTab ? (
              <div
                style={{
                  ...styles.webviewContainer,
                  width: typeof activeViewport.width === "number" ? `${activeViewport.width}px` : activeViewport.width,
                  height: typeof activeViewport.height === "number" ? `${activeViewport.height}px` : activeViewport.height
                } as CSSProperties}
              >
                <webview
                  ref={webviewRef}
                  src={activeTab.url}
                  style={{ width: "100%", height: "100%", border: "none" }}
                  allowpopups={true}
                />
              </div>
            ) : (
              <div>No active tab</div>
            )}
          </div>
          {isDevToolsOpen && (
            <CustomDevTools 
              webviewRef={webviewRef} 
              onClose={() => setIsDevToolsOpen(false)} 
            />
          )}
        </section>
        <aside style={{ ...styles.sidebar, width: sidebarCollapsed ? 64 : 320 }}>
          {!sidebarCollapsed ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: theme.colors.textSecondary, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Developer Tools
                </span>
                <button
                  aria-label="Collapse sidebar"
                  title="Collapse tools"
                  onClick={() => setSidebarCollapsed(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: theme.colors.accent,
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px'
                  }}
                >
                  <Monitor size={16} />
                </button>
              </div>
              
              <div>
                <div style={styles.sectionTitle}>Viewport</div>
                <ViewportPreview
                  viewports={viewportPresets}
                  selectedViewportId={selectedViewportId}
                  onSelect={setSelectedViewportId}
                />
              </div>

              <div>
                <div style={styles.sectionTitle}>Current Page</div>
                <div style={styles.infoCard}>
                  <div style={styles.infoLabel}>URL</div>
                  <div style={styles.infoValue}>{activeTab?.url || 'No page loaded'}</div>
                </div>
              </div>

              <div>
                <div style={styles.sectionTitle}>Dev Tools</div>
                <div style={styles.infoCard}>
                  <button
                    type="button"
                    onClick={toggleDevToolsEmbedded}
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: theme.colors.accent,
                      border: 'none',
                      borderRadius: '6px',
                      color: '#000',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '12px'
                    }}
                  >
                    {isDevToolsOpen ? 'Close DevTools' : 'Open DevTools'}
                  </button>
                </div>
              </div>

              <div>
                <div style={styles.sectionTitle}>Analysis</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {["SEO", "WCAG", "Schema.org", "Open Graph", "Colors"].map((tool) => (
                    <div key={tool} style={styles.infoCard}>
                      <div style={styles.infoValue}>{tool}</div>
                      <div style={{ ...styles.infoLabel, marginTop: '4px' }}>Coming soon...</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', paddingTop: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                <button 
                  title="Expand tools"
                  onClick={() => setSidebarCollapsed(false)}
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    color: theme.colors.textSecondary,
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '4px'
                  }}
                >
                  <Monitor size={20} />
                </button>
                <button 
                  title="SEO" 
                  onClick={toggleDevToolsEmbedded}
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    color: theme.colors.textSecondary,
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '4px'
                  }}
                >
                  <Code size={20} color={isDevToolsOpen ? theme.colors.accent : undefined} />
                </button>
                <button 
                  title="Page Images" 
                  onClick={toggleImageView}
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    color: theme.colors.textSecondary,
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '4px'
                  }}
                >
                  <Image size={20} color={isImageViewOpen ? theme.colors.accent : undefined} />
                </button>
                <ScreenshotButton onCapture={handleScreenshot} loading={isCapturing} />
                <button 
                  title="Tools" 
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    color: theme.colors.textSecondary,
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '4px'
                  }}
                >
                  <Settings size={20} />
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
      <footer style={styles.statusBar}>
        {statusMessage || activeTab?.url || "Ready"}
      </footer>
      
      {/* Image Viewer Overlay */}
      {isImageViewOpen && (
        <ImageViewer 
          images={pageImages}
          onClose={() => setIsImageViewOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
