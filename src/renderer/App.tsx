import { type CSSProperties, useEffect, useState, useRef, type FormEvent } from "react";
import type { WebviewTag } from "electron";
import { Monitor, Code, Image, Settings, Menu, Search, Tag, Link as LinkIcon, Database, Network } from "lucide-react";
import AddressBar from "./components/AddressBar";
import ScreenshotButton from "./components/ScreenshotButton";
import ViewportPreview from "./components/ViewportPreview";
import CustomDevTools from "./components/CustomDevTools";
import ImageViewer from "./components/ImageViewer";
import SettingsPanel, { type AppSettings } from "./components/SettingsPanel";
import SEOPanel from "./components/SEOPanel";
import MetaTagsPanel from "./components/MetaTagsPanel";
import InternalLinksPanel from "./components/InternalLinksPanel";
import DatabasePanel from "./components/DatabasePanel";
import NetworkPanel from "./components/NetworkPanel";
import { theme } from "./styles/theme";
import type { ViewportPreset } from "./types/viewport";

export interface BrowserTab {
  id: string;
  title: string;
  url: string;
  favicon?: string;
}

const defaultViewportPresets: ViewportPreset[] = [
  { id: "responsive", label: "Responsive", width: "100%", height: "100%", description: "Full width" },
  { id: "iphone-se", label: "iPhone SE", width: 375, height: 667, description: "Small mobile" },
  { id: "iphone-12", label: "iPhone 12", width: 390, height: 844, description: "Modern mobile" },
  { id: "iphone-14-pro-max", label: "iPhone 14 Pro Max", width: 430, height: 932, description: "Large mobile" },
  { id: "tablet", label: "iPad", width: 768, height: 1024, description: "Portrait tablet" },
  { id: "ipad-pro", label: "iPad Pro", width: 1024, height: 1366, description: "Large tablet" },
  { id: "surface-pro", label: "Surface Pro", width: 1280, height: 900, description: "Small laptop" },
  { id: "desktop-1366", label: "Desktop 1366", width: 1366, height: 768, description: "HD Ready" },
  { id: "macbook-air", label: "MacBook Air", width: 1440, height: 900, description: "13-inch laptop" },
  { id: "desktop", label: "Desktop HD", width: 1920, height: 1080, description: "Full HD" },
  { id: "desktop-qhd", label: "Desktop QHD", width: 2560, height: 1440, description: "2K display" }
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

const defaultUrl = "https://filipstudio.pl/";

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
  const [viewportPresets, setViewportPresets] = useState<ViewportPreset[]>(defaultViewportPresets);
  const [selectedViewportId, setSelectedViewportId] = useState<string>(defaultViewportPresets[0].id);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(true);
  const [isDevToolsOpen, setIsDevToolsOpen] = useState<boolean>(false);
  const [isImageViewOpen, setIsImageViewOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSEOPanelOpen, setIsSEOPanelOpen] = useState<boolean>(false);
  const [isMetaTagsPanelOpen, setIsMetaTagsPanelOpen] = useState<boolean>(false);
  const [isInternalLinksPanelOpen, setIsInternalLinksPanelOpen] = useState<boolean>(false);
  const [isDatabasePanelOpen, setIsDatabasePanelOpen] = useState<boolean>(false);
  const [isNetworkPanelOpen, setIsNetworkPanelOpen] = useState<boolean>(false);
  const [pageImages, setPageImages] = useState<Array<{src: string, alt: string, width: number, height: number}>>([]);
  const [customViewportWidth, setCustomViewportWidth] = useState<string>("");
  const [customViewportHeight, setCustomViewportHeight] = useState<string>("");
  const [customViewportLabel, setCustomViewportLabel] = useState<string>("");
  const [customViewportError, setCustomViewportError] = useState<string | null>(null);
  
  // Load settings from localStorage
  const loadSettings = (): AppSettings => {
    try {
      const savedSettings = localStorage.getItem('flareonSettings');
      if (savedSettings) {
        return JSON.parse(savedSettings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
    return getDefaultSettings();
  };

  const getDefaultSettings = (): AppSettings => ({
    // Screenshots
    screenshotFormat: "png",
    screenshotQuality: 90,
    autoSaveScreenshots: true,
    screenshotFolder: "~/Pictures",
    includeTimestampInFilename: true,
    screenshotNamePrefix: "flareon-screenshot",
    
    // Appearance
    showTabFavicons: true,
    showStatusBar: true,
    darkMode: true,
    sidebarDefaultState: "collapsed",
    accentColor: "#FF6D00",
    
    // Viewport
    defaultViewport: "responsive",
    rememberLastViewport: false,
    scaleViewportToFit: true,
    showViewportDimensions: false,
    
    // Navigation
    defaultHomepage: "https://filipstudio.pl/",
    openLinksInSameTab: true,
    enableJavaScript: true,
    loadImagesAutomatically: true,
    
    // Privacy & Security
    clearCacheOnExit: false,
    blockPopups: true,
    enableCookies: true,
    doNotTrack: false,
    
    // Performance
    hardwareAcceleration: true,
    preloadPages: false,
    maxCacheSize: 500,
    
    // Tabs
    showTabCloseButton: true,
    confirmBeforeClosingMultipleTabs: true,
    restoreTabsOnStartup: false,
    
    // Updates
    checkForUpdates: true,
    autoInstallUpdates: false,
  });

  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('flareonSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }, [settings]);

  // Initialize sidebar state from settings
  useEffect(() => {
    setSidebarCollapsed(settings.sidebarDefaultState === "collapsed");
  }, []);

  // Get the current accent color from settings
  const accentColor = settings.accentColor || theme.colors.accent;

  const webviewRef = useRef<any>(null);
  const skipNextWebviewNavigationRef = useRef<boolean>(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const viewportHostRef = useRef<HTMLDivElement>(null);
  const [tabWidth, setTabWidth] = useState<number>(180);
  const [showAddButton, setShowAddButton] = useState<boolean>(true);
  const [viewportHostSize, setViewportHostSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [viewportScale, setViewportScale] = useState<number>(1);

  const activeTab = tabs.find((tab: BrowserTab) => tab.id === activeTabId) ?? tabs[0];
  const activeViewport = viewportPresets.find((preset) => preset.id === selectedViewportId) ?? viewportPresets[0] ?? defaultViewportPresets[0];
  const numericViewportWidth = typeof activeViewport.width === 'number' ? activeViewport.width : null;
  const numericViewportHeight = typeof activeViewport.height === 'number' ? activeViewport.height : null;
  const scaledViewportWidth = numericViewportWidth ? Math.round(numericViewportWidth * viewportScale) : null;
  const scaledViewportHeight = numericViewportHeight ? Math.round(numericViewportHeight * viewportScale) : null;

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
    console.log('App component mounted');
    console.log('window.electronAPI available:', !!window.electronAPI);
    if (window.electronAPI) {
      console.log('electronAPI methods:', Object.keys(window.electronAPI));
    } else {
      console.error('electronAPI not available - preload script may not have loaded');
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + T - New tab
      if (cmdOrCtrl && e.key === 't' && !e.shiftKey) {
        e.preventDefault();
        const newTab = createTab(defaultUrl);
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
        setStatusMessage('New tab created');
      }

      // Cmd/Ctrl + W - Close tab
      if (cmdOrCtrl && e.key === 'w' && !e.shiftKey) {
        e.preventDefault();
        if (tabs.length > 1) {
          onCloseTab(activeTabId);
          setStatusMessage('Tab closed');
        } else {
          setStatusMessage('Cannot close last tab');
        }
      }

      // Cmd/Ctrl + R - Refresh page
      if (cmdOrCtrl && e.key === 'r' && !e.shiftKey) {
        e.preventDefault();
        const webview = webviewRef.current;
        if (webview && typeof webview.reload === 'function') {
          webview.reload();
          setStatusMessage('Page reloaded');
        }
      }

      // Cmd/Ctrl + L - Focus address bar
      if (cmdOrCtrl && e.key === 'l' && !e.shiftKey) {
        e.preventDefault();
        const addressBar = document.querySelector('input[type="text"]') as HTMLInputElement;
        if (addressBar) {
          addressBar.focus();
          addressBar.select();
          setStatusMessage('Address bar focused');
        }
      }

      // Cmd/Ctrl + Shift + I - Toggle DevTools
      if (cmdOrCtrl && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        toggleDevToolsEmbedded();
      }

      // Cmd/Ctrl + Shift + S - Take screenshot
      if (cmdOrCtrl && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        handleScreenshot();
      }

      // Cmd/Ctrl + Shift + D - Toggle Database Tools
      if (cmdOrCtrl && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsDatabasePanelOpen(!isDatabasePanelOpen);
        setStatusMessage(isDatabasePanelOpen ? 'Database Tools closed' : 'Database Tools opened');
      }

      // Cmd/Ctrl + Shift + N - Toggle Network Panel
      if (cmdOrCtrl && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        setIsNetworkPanelOpen(!isNetworkPanelOpen);
        setStatusMessage(isNetworkPanelOpen ? 'Network Panel closed' : 'Network Panel opened');
      }

      // Cmd/Ctrl + , - Open settings
      if (cmdOrCtrl && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen(true);
        setStatusMessage('Settings opened');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTabId, isDatabasePanelOpen, isNetworkPanelOpen]);

  useEffect(() => {
    const el = webviewRef.current;
    if (!el) return;

    const handleDidFinishLoad = async () => {
      try {
        // try getTitle, otherwise fall back to executeJavaScript
        const title = (typeof el.getTitle === 'function') ? await el.getTitle() : await (el.executeJavaScript && el.executeJavaScript('document.title'));
        
        // Get favicon
        let favicon = '';
        try {
          favicon = await el.executeJavaScript(`
            (function() {
              const iconLink = document.querySelector('link[rel*="icon"]');
              if (iconLink && iconLink.href) {
                return iconLink.href;
              }
              // Fallback to default favicon location
              const url = new URL(window.location.href);
              return url.origin + '/favicon.ico';
            })();
          `);
        } catch (err) {
          // Fallback to default favicon
          try {
            const url = new URL(activeTab?.url || '');
            favicon = url.origin + '/favicon.ico';
          } catch (e) {
            favicon = '';
          }
        }
        
        // Inject helpers: override window.open and capture clicks on anchors/buttons so external links open in the same webview
        try {
          await el.executeJavaScript(`(function(){
            try{
              if (window.__flareon_link_patch_installed) return;
              window.__flareon_link_patch_installed = true;

              const _open = window.open.bind(window);
              window.open = function(url, name, features){
                try{
                  if (typeof url === 'string' && url) {
                    // navigate same window
                    window.location.href = url;
                    return null;
                  }
                }catch(e){}
                return _open(url, name, features);
              };

              document.addEventListener('click', function(e){
                try{
                  let el = e.target;
                  while(el && el.nodeType === 1){
                    // anchor links
                    if (el.tagName && el.tagName.toLowerCase() === 'a' && el.href){
                      const href = el.href;
                      const targ = el.getAttribute('target');
                      // if anchor tries to open in new window, force same-window navigation
                      if (targ && targ !== '_self'){
                        e.preventDefault();
                        window.location.href = href;
                        return;
                      }
                      // otherwise allow default behavior
                      return;
                    }

                    // elements using data-href
                    if (el.dataset && el.dataset.href){
                      e.preventDefault();
                      window.location.href = el.dataset.href;
                      return;
                    }

                    el = el.parentElement;
                  }
                }catch(err){}
              }, true);
            }catch(err){}
          })();`);
        } catch (err) {
          // ignore injection errors
        }

        if (title) {
          setTabs((prev) => prev.map((t) => (t.id === activeTabId ? { ...t, title, favicon } : t)));
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

    const handleDidNavigate = async (ev: any) => {
      const url = ev?.url || null;
      const isMainFrame = ev?.isMainFrame !== false; // Default to true if undefined
      
      // Only update for main frame navigation, ignore iframes/embeds
      if (url && isMainFrame) {
        // Double check: verify this matches the webview's actual URL
        try {
          const webviewUrl = await el.executeJavaScript('window.location.href');
          if (webviewUrl && webviewUrl === url) {
            // Update the tab URL and address bar
            setTabs((prev) => prev.map((t) => (t.id === activeTabId ? { ...t, url } : t)));
            setAddressValue(url);
          }
        } catch (err) {
          // Fallback: if we can't verify, just update it
          setTabs((prev) => prev.map((t) => (t.id === activeTabId ? { ...t, url } : t)));
          setAddressValue(url);
        }
      }
    };

    const handleDidNavigateInPage = async (ev: any) => {
      const url = ev?.url || null;
      const isMainFrame = ev?.isMainFrame !== false; // Default to true if undefined
      
      // Only update for main frame navigation, ignore iframes/embeds  
      if (url && isMainFrame) {
        // Double check: verify this matches the webview's actual URL
        try {
          const webviewUrl = await el.executeJavaScript('window.location.href');
          if (webviewUrl && webviewUrl === url) {
            // Update the tab URL and address bar (for single page apps)
            setTabs((prev) => prev.map((t) => (t.id === activeTabId ? { ...t, url } : t)));
            setAddressValue(url);
          }
        } catch (err) {
          // Fallback: if we can't verify, just update it
          setTabs((prev) => prev.map((t) => (t.id === activeTabId ? { ...t, url } : t)));
          setAddressValue(url);
        }
      }
    };

    const handleNewWindow = async (ev: any) => {
      const url = ev?.url || null;
      if (!url) {
        return;
      }

      ev.preventDefault?.();

      try {
        if (typeof el.loadURL === 'function') {
          await el.loadURL(url);
        } else {
          el.setAttribute?.('src', url);
        }
      } catch (error) {
        console.error('Failed to open external link', error);
      }

      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? { ...t, url }
            : t
        )
      );
      setAddressValue(url);
    };

    el.addEventListener && el.addEventListener('did-finish-load', handleDidFinishLoad);
    el.addEventListener && el.addEventListener('page-title-updated', handlePageTitleUpdated);
    el.addEventListener && el.addEventListener('did-navigate', handleDidNavigate);
    el.addEventListener && el.addEventListener('did-navigate-in-page', handleDidNavigateInPage);
    el.addEventListener && el.addEventListener('new-window', handleNewWindow);

    // try an initial read in case content is already loaded
    handleDidFinishLoad();

    return () => {
      el.removeEventListener && el.removeEventListener('did-finish-load', handleDidFinishLoad);
      el.removeEventListener && el.removeEventListener('page-title-updated', handlePageTitleUpdated);
      el.removeEventListener && el.removeEventListener('did-navigate', handleDidNavigate);
      el.removeEventListener && el.removeEventListener('did-navigate-in-page', handleDidNavigateInPage);
      el.removeEventListener && el.removeEventListener('new-window', handleNewWindow);
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

  useEffect(() => {
    const hostEl = viewportHostRef.current;
    if (!hostEl || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setViewportHostSize((prev) => (
        prev.width !== width || prev.height !== height
          ? { width, height }
          : prev
      ));
    });

    observer.observe(hostEl);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const numericWidth = typeof activeViewport.width === 'number' ? activeViewport.width : null;
    const numericHeight = typeof activeViewport.height === 'number' ? activeViewport.height : null;

    let nextScale = 1;
    const padding = 48; // allow some breathing room around the viewport

    if (numericWidth && viewportHostSize.width > 0) {
      const availableWidth = Math.max(0, viewportHostSize.width - padding);
      nextScale = Math.min(nextScale, availableWidth / numericWidth);
    }

    if (numericHeight && viewportHostSize.height > 0) {
      const availableHeight = Math.max(0, viewportHostSize.height - padding);
      nextScale = Math.min(nextScale, availableHeight / numericHeight);
    }

    if (!Number.isFinite(nextScale) || nextScale <= 0) {
      nextScale = 1;
    }

    nextScale = Math.min(nextScale, 1);

    if (Math.abs(nextScale - viewportScale) > 0.01) {
      setViewportScale(nextScale);
    }
  }, [activeViewport.width, activeViewport.height, viewportHostSize.width, viewportHostSize.height, viewportScale]);

  // Calculate tab width based on available space
  useEffect(() => {
    const calculateTabWidth = () => {
      if (!headerRef.current) return;

  const headerWidth = headerRef.current.offsetWidth;
  const stackedLayout = tabs.length >= 10;
      
  if (stackedLayout) {
        // When 10 tabs, tabs are on second row, full width available
        const tabCount = tabs.length;
  const gapWidth = 4;
  const padding = 92; // header horizontal padding (80 left + 12 right)
        
        // Full width available for tabs (no logo on tabs row)
        const availableForTabs = headerWidth - padding;
        
        // Calculate width for tabs (no button when max tabs)
        const spaceForTabs = availableForTabs - (gapWidth * (tabCount - 1));
        const calculatedWidth = Math.floor(spaceForTabs / tabCount);
        
        // Constrain between 40px and 180px for max tabs layout
  const finalWidth = Math.max(40, calculatedWidth);
        setTabWidth(finalWidth);
        // Hide add button if tabs are at minimum width
        setShowAddButton(finalWidth > 40);
      } else {
        // Original logic for < 10 tabs
        const logoWidth = 24 + 12; // logo + gap
        const addressBarMinWidth = headerWidth * 0.5; // 50% for address bar
        const availableForTabs = headerWidth - logoWidth - addressBarMinWidth - 16; // 16 for gaps
        
        const tabCount = tabs.length;
        const buttonWidth = 28; // "+" button
        const gapWidth = 4;
        
        // Calculate how much space we have per tab
        const spaceForTabs = availableForTabs - buttonWidth - (gapWidth * (tabCount + 1));
        const calculatedWidth = Math.floor(spaceForTabs / tabCount);
        
        // Constrain between 20px and 180px
        const finalWidth = Math.max(20, Math.min(180, calculatedWidth));
        setTabWidth(finalWidth);
        
        // Hide add button if tabs are at minimum width
        setShowAddButton(finalWidth > 20);
      }
    };

    // Initial calculation
    calculateTabWidth();

    // Recalculate on window resize
    window.addEventListener('resize', calculateTabWidth);
    
    return () => {
      window.removeEventListener('resize', calculateTabWidth);
    };
  }, [tabs.length]);

  const onSubmitAddress = async (value: string) => {
    if (!activeTab) {
      return;
    }

    const normalized = sanitizeUrl(value);
    if (!normalized) {
      return;
    }

    // Check if this is just an anchor change (same URL, different hash)
    const currentUrl = activeTab.url;
    const currentUrlWithoutHash = currentUrl.split('#')[0];
    const normalizedWithoutHash = normalized.split('#')[0];
    
    const isOnlyAnchorChange = currentUrlWithoutHash === normalizedWithoutHash && 
                               normalized.includes('#') && 
                               currentUrl !== normalized;

    if (isOnlyAnchorChange && webviewRef.current) {
      skipNextWebviewNavigationRef.current = true;
      // For anchor changes, just update the hash via JavaScript - no reload
      try {
        const targetUrl = new URL(normalized);
        const hashFragment = targetUrl.hash.startsWith('#') ? targetUrl.hash.slice(1) : targetUrl.hash;
        await webviewRef.current.executeJavaScript(`
          (function() {
            const hash = ${JSON.stringify(hashFragment)};
            if (hash) {
              if (window.location.hash !== '#' + hash) {
                window.location.hash = hash;
              }
            } else {
              if (window.location.hash) {
                window.location.hash = '';
              }
            }
          })();
        `);

        // Update the tab URL
        setTabs((prev: BrowserTab[]) =>
          prev.map((tab: BrowserTab) =>
            tab.id === activeTab.id
              ? { ...tab, url: normalized }
              : tab
          )
        );
        setAddressValue(normalized);
      } catch (err) {
        skipNextWebviewNavigationRef.current = false;
        console.error('Failed to update hash', err);
      }
    } else {
      // Normal navigation - update tab state so the webview effect performs a full load
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
    }
  };

  const onRefreshPage = () => {
    const webview = webviewRef.current;
    if (!activeTab || !webview) {
      return;
    }

    const performReload = () => {
      if (typeof webview.reload === 'function') {
        webview.reload();
      } else if (activeTab.url) {
        webview.setAttribute('src', activeTab.url);
      }
    };

    try {
      performReload();
    } catch (error) {
      console.warn('webview.reload unavailable before dom-ready, deferring reload');
      const handleDomReady = () => {
        webview.removeEventListener('dom-ready', handleDomReady);
        try {
          performReload();
        } catch (err) {
          console.error('Failed to reload webview after dom-ready', err);
        }
      };
      webview.addEventListener('dom-ready', handleDomReady);
    }
  };

  const handleAddCustomViewport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedWidth = parseInt(customViewportWidth, 10);
    const parsedHeight = parseInt(customViewportHeight, 10);

    if (!Number.isFinite(parsedWidth) || parsedWidth <= 0 || !Number.isFinite(parsedHeight) || parsedHeight <= 0) {
      setCustomViewportError("Provide correct dimensions (width and height in pixels).");
      return;
    }

    const label = customViewportLabel.trim() || `${parsedWidth} × ${parsedHeight}`;
    const id = `custom-${Date.now()}`;

    const newPreset: ViewportPreset = {
      id,
      label,
      width: parsedWidth,
      height: parsedHeight,
      description: "Custom viewport"
    };

    setViewportPresets((prev) => [...prev, newPreset]);
    setSelectedViewportId(id);
    setCustomViewportWidth("");
    setCustomViewportHeight("");
    setCustomViewportLabel("");
    setCustomViewportError(null);
  };

  const handleDeleteCustomViewport = (viewportId: string) => {
    setViewportPresets((prev) => {
      const filtered = prev.filter((preset) => preset.id !== viewportId);
      // If the deleted viewport was selected, select the first default viewport or the first remaining
      if (selectedViewportId === viewportId) {
        const fallback = filtered.find((preset) => !preset.id.startsWith('custom-')) || filtered[0] || defaultViewportPresets[0];
        setSelectedViewportId(fallback.id);
      }
      return filtered;
    });
  };

  const onAddTab = () => {
    if (!showAddButton) return;
    
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

      if (!window.electronAPI) {
        setStatusMessage("Electron API not available");
        console.error("window.electronAPI is undefined");
        return;
      }

  const webview = webviewRef.current as (WebviewTag | null);
      if (!webview) {
        setStatusMessage("No active webview to capture");
        console.error("webviewRef is null during capture");
        return;
      }

      let webContentsId: number | null = null;
      try {
        webContentsId = typeof webview.getWebContentsId === 'function'
          ? webview.getWebContentsId()
          : null;
      } catch (error) {
        console.error('Failed to obtain webContentsId from webview', error);
        setStatusMessage("Page not ready for capture yet");
        return;
      }

      if (!webContentsId) {
        setStatusMessage("Page not ready for capture yet");
        console.error("webContentsId unavailable on webview");
        return;
      }

      const bounds = webview.getBoundingClientRect();
      const scale = viewportScale || 1;
      const width = Math.max(1, Math.round((numericViewportWidth ?? bounds.width) / scale));
      const height = Math.max(1, Math.round((numericViewportHeight ?? bounds.height) / scale));

      const filePath = await window.electronAPI.captureViewport({
        webContentsId,
        rect: { x: 0, y: 0, width, height },
        format: settings.screenshotFormat,
        quality: settings.screenshotQuality,
        namePrefix: settings.screenshotNamePrefix,
        includeTimestamp: settings.includeTimestampInFilename
      });
      if (filePath) {
        setStatusMessage(`Screenshot saved to ${filePath}`);
      } else {
        setStatusMessage("Capture failed — no active window");
      }
    } catch (error) {
      setStatusMessage("Screenshot failed. See console for details.");
      console.error("Screenshot error:", error);
    } finally {
      setIsCapturing(false);
    }
  };

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview || !activeTab) {
      return;
    }

    if (skipNextWebviewNavigationRef.current) {
      skipNextWebviewNavigationRef.current = false;
      return;
    }

    const targetUrl = activeTab.url;
    if (!targetUrl) {
      return;
    }

    const currentSrc = webview.getAttribute('src') || '';
    if (currentSrc === targetUrl) {
      return;
    }

    try {
      webview.setAttribute('src', targetUrl);
    } catch (error) {
      console.error('Failed to update webview src', error);
    }
  }, [activeTab?.id, activeTab?.url]);

  const isStackedTabs = tabs.length >= 10;

  const tabElements = tabs.map((tab) => (
    <div
      key={tab.id}
      onClick={() => onSelectTab(tab.id)}
      style={{
        padding: '4px 10px',
        borderRadius: 6,
        background: tab.id === activeTabId ? 'rgba(255, 109, 0, 0.12)' : 'rgba(255, 255, 255, 0.03)',
        border: tab.id === activeTabId ? `1px solid ${accentColor}` : '1px solid transparent',
        color: tab.id === activeTabId ? accentColor : theme.colors.textSecondary,
        fontSize: 11,
        fontWeight: tab.id === activeTabId ? 600 : 400,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        transition: 'all 0.2s ease',
        width: tabWidth,
        flexShrink: 0,
        whiteSpace: 'nowrap' as const
      }}
      onMouseEnter={(event: any) => {
        if (tab.id !== activeTabId) {
          event.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
        }
      }}
      onMouseLeave={(event: any) => {
        if (tab.id !== activeTabId) {
          event.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
        }
      }}
    >
      {settings.showTabFavicons && (
        tab.favicon ? (
          <img 
            src={tab.favicon} 
            alt="" 
            style={{ 
              width: 13, 
              height: 13, 
              objectFit: 'contain',
              flexShrink: 0
            }}
            onError={(event: any) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <Monitor size={13} />
        )
      )}
      <span style={{ 
        overflow: 'hidden', 
        textOverflow: 'ellipsis', 
        whiteSpace: 'nowrap',
        flex: 1,
        minWidth: 0
      }}>
        {tab.title}
      </span>
      {tabs.length > 1 && (
        <button
          onClick={(event) => {
            event.stopPropagation();
            onCloseTab(tab.id);
          }}
          aria-label="Close tab"
          style={{
            background: 'transparent',
            border: 'none',
            color: tab.id === activeTabId ? accentColor : theme.colors.textSecondary,
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
          onMouseEnter={(event: any) => {
            event.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
          onMouseLeave={(event: any) => {
            event.currentTarget.style.background = 'transparent';
          }}
        >
          ×
        </button>
      )}
    </div>
  ));

  const renderTabsRow = (fullWidth: boolean) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: fullWidth ? 0 : 4,
        width: fullWidth ? '100%' : 'auto',
        minWidth: 0,
        flex: fullWidth ? 1 : undefined,
        flexShrink: fullWidth ? 1 : 0
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          minWidth: 0,
          width: 'auto',
          justifyContent: fullWidth ? 'space-between' : 'flex-start',
          overflow: 'hidden',
          flex: undefined
        }}
      >
        {tabElements}
      </div>
      {showAddButton && (
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
            minWidth: 20,
            height: 26,
            flexShrink: 0,
            marginLeft: fullWidth ? 8 : 16,
            marginRight: fullWidth ? 16 : 12
          }}
          onMouseEnter={(event: any) => {
            event.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
            event.currentTarget.style.color = accentColor;
          }}
          onMouseLeave={(event: any) => {
            event.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
            event.currentTarget.style.color = theme.colors.textSecondary;
          }}
        >
          +
        </button>
      )}
    </div>
  );

  return (
    <div style={styles.appShell}>
      <header
        ref={headerRef}
        style={{
          ...styles.header,
          flexDirection: isStackedTabs ? 'column' as const : 'row' as const,
          alignItems: isStackedTabs ? 'stretch' : 'center',
          gap: isStackedTabs ? 6 : 12,
          transition: 'all 0.3s ease'
        }}
      >
        {isStackedTabs ? (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                minWidth: 0
              }}
            >
              <img src="./assets/logo.png" alt="Flareon" style={styles.logo} />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flex: 1,
                  gap: 8,
                  minWidth: 0,
                  /* @ts-ignore */
                  ['WebkitAppRegion' as any]: 'no-drag'
                }}
              >
                <AddressBar
                  value={addressValue}
                  onChange={setAddressValue}
                  onSubmit={onSubmitAddress}
                  onRefresh={onRefreshPage}
                  placeholder="Enter URL..."
                  style={{
                    flex: 1,
                    minWidth: 0
                  }}
                />
              </div>
            </div>
            <div
              style={{
                width: 'calc(100% + 92px)',
                minWidth: 0,
                paddingLeft: 12,
                paddingRight: 0,
                marginLeft: -80,
                marginRight: -12,
                /* @ts-ignore */
                ['WebkitAppRegion' as any]: 'no-drag'
              }}
            >
              {renderTabsRow(true)}
            </div>
          </>
        ) : (
          <>
            <img src="./assets/logo.png" alt="Flareon" style={styles.logo} />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flex: 1,
                gap: 8,
                minWidth: 0,
                /* @ts-ignore */
                ['WebkitAppRegion' as any]: 'no-drag'
              }}
            >
              {renderTabsRow(false)}
              <AddressBar
                value={addressValue}
                onChange={setAddressValue}
                onSubmit={onSubmitAddress}
                onRefresh={onRefreshPage}
                placeholder="Enter URL..."
                style={{
                  flex: 1,
                  minWidth: 200
                }}
              />
            </div>
          </>
        )}
      </header>
      <div style={styles.mainContent}>
        <section style={{ 
          ...styles.contentArea, 
          flex: 1, 
          flexDirection: 'column' as const, 
          display: 'flex',
          padding: 0
        }}>
          <div
            ref={viewportHostRef}
            style={{ 
              flex: 1, 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'flex-start', 
              overflow: 'hidden', 
              padding: '20px',
              width: '100%'
            }}
          >
            {activeTab ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  width: '100%',
                  height: '100%',
                  overflow: 'visible'
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: numericViewportWidth ? `${scaledViewportWidth}px` : '100%',
                    height: numericViewportHeight ? `${scaledViewportHeight}px` : '100%',
                    transition: 'width 0.2s ease, height 0.2s ease',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-start'
                  }}
                >
                  <div
                    style={{
                      ...styles.webviewContainer,
                      width: numericViewportWidth ? `${numericViewportWidth}px` : '100%',
                      height: numericViewportHeight ? `${numericViewportHeight}px` : '100%',
                      transform: `scale(${viewportScale})`,
                      transformOrigin: 'top center',
                      transition: 'transform 0.2s ease'
                    } as CSSProperties}
                  >
                    <webview
                      ref={webviewRef}
                      style={{ width: '100%', height: '100%', border: 'none' }}
                    />
                    {settings.showViewportDimensions && numericViewportWidth && numericViewportHeight && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          background: 'rgba(0, 0, 0, 0.85)',
                          color: accentColor,
                          padding: '6px 12px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          fontFamily: "'Source Code Pro', monospace",
                          border: `1px solid ${accentColor}`,
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
                          pointerEvents: 'none',
                          zIndex: 1000,
                        }}
                      >
                        {numericViewportWidth} × {numericViewportHeight}
                        {viewportScale !== 1 && ` (${Math.round(viewportScale * 100)}%)`}
                      </div>
                    )}
                  </div>
                </div>
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
          {isSEOPanelOpen && (
            <SEOPanel
              webviewRef={webviewRef}
              isOpen={isSEOPanelOpen}
              onClose={() => setIsSEOPanelOpen(false)}
            />
          )}
          {isMetaTagsPanelOpen && (
            <MetaTagsPanel
              webviewRef={webviewRef}
              isOpen={isMetaTagsPanelOpen}
              onClose={() => setIsMetaTagsPanelOpen(false)}
            />
          )}
          {isInternalLinksPanelOpen && (
            <InternalLinksPanel
              webviewRef={webviewRef}
              isOpen={isInternalLinksPanelOpen}
              onClose={() => setIsInternalLinksPanelOpen(false)}
            />
          )}
          {isDatabasePanelOpen && (
            <DatabasePanel
              webviewRef={webviewRef}
              isOpen={isDatabasePanelOpen}
              onClose={() => setIsDatabasePanelOpen(false)}
            />
          )}
          {isNetworkPanelOpen && (
            <NetworkPanel
              webviewRef={webviewRef}
              isOpen={isNetworkPanelOpen}
              onClose={() => setIsNetworkPanelOpen(false)}
            />
          )}
        </section>
        <aside style={{ ...styles.sidebar, width: sidebarCollapsed ? 64 : 320 }}>
          {!sidebarCollapsed ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: theme.colors.textSecondary, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Viewport Manager
                </span>
                <button
                  aria-label="Collapse sidebar"
                  title="Collapse tools"
                  onClick={() => setSidebarCollapsed(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: accentColor,
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px'
                  }}
                >
                  <Monitor size={16} />
                </button>
              </div>

              <div>
                <div style={styles.sectionTitle}>Preset sizes</div>
                <ViewportPreview
                  viewports={viewportPresets}
                  selectedViewportId={selectedViewportId}
                  onSelect={setSelectedViewportId}
                  onDelete={handleDeleteCustomViewport}
                />
              </div>

              <div style={styles.infoCard}>
                <div style={{ ...styles.sectionTitle, marginBottom: '8px' }}>Custom size</div>
                <form onSubmit={handleAddCustomViewport} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11, color: theme.colors.textSecondary }}>Width (px)</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={customViewportWidth}
                        onChange={(event) => {
                          setCustomViewportWidth(event.target.value);
                          if (customViewportError) setCustomViewportError(null);
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: 6,
                          padding: '6px 8px',
                          color: theme.colors.textPrimary,
                          fontSize: 12,
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                        placeholder="e.g. 1440"
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11, color: theme.colors.textSecondary }}>Height (px)</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={customViewportHeight}
                        onChange={(event) => {
                          setCustomViewportHeight(event.target.value);
                          if (customViewportError) setCustomViewportError(null);
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: 6,
                          padding: '6px 8px',
                          color: theme.colors.textPrimary,
                          fontSize: 12,
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                        placeholder="e.g. 900"
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11, color: theme.colors.textSecondary }}>Name (optional)</label>
                    <input
                      type="text"
                      value={customViewportLabel}
                      onChange={(event) => {
                        setCustomViewportLabel(event.target.value);
                        if (customViewportError) setCustomViewportError(null);
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: 6,
                        padding: '6px 8px',
                        color: theme.colors.textPrimary,
                        fontSize: 12,
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                      placeholder="e.g. My layout"
                    />
                  </div>
                  {customViewportError && (
                    <div style={{ color: '#ff6b6b', fontSize: 11 }}>
                      {customViewportError}
                    </div>
                  )}
                  <button
                    type="submit"
                    style={{
                      marginTop: 4,
                      padding: '8px',
                      borderRadius: 6,
                      border: 'none',
                      background: accentColor,
                      color: '#000',
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: 'pointer',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    Add size
                  </button>
                </form>
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
                  title="SEO Analysis" 
                  onClick={() => setIsSEOPanelOpen(!isSEOPanelOpen)}
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    color: theme.colors.textSecondary,
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '4px'
                  }}
                >
                  <Search size={20} color={isSEOPanelOpen ? accentColor : undefined} />
                </button>
                <button 
                  title="Meta Tags" 
                  onClick={() => setIsMetaTagsPanelOpen(!isMetaTagsPanelOpen)}
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    color: theme.colors.textSecondary,
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '4px'
                  }}
                >
                  <Tag size={20} color={isMetaTagsPanelOpen ? accentColor : undefined} />
                </button>
                <button 
                  title="Internal Links" 
                  onClick={() => setIsInternalLinksPanelOpen(!isInternalLinksPanelOpen)}
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    color: theme.colors.textSecondary,
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '4px'
                  }}
                >
                  <LinkIcon size={20} color={isInternalLinksPanelOpen ? accentColor : undefined} />
                </button>
                <button 
                  title="Database Tools" 
                  onClick={() => setIsDatabasePanelOpen(!isDatabasePanelOpen)}
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    color: theme.colors.textSecondary,
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '4px'
                  }}
                >
                  <Database size={20} color={isDatabasePanelOpen ? accentColor : undefined} />
                </button>
                <button 
                  title="Network & API" 
                  onClick={() => setIsNetworkPanelOpen(!isNetworkPanelOpen)}
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    color: theme.colors.textSecondary,
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '4px'
                  }}
                >
                  <Network size={20} color={isNetworkPanelOpen ? accentColor : undefined} />
                </button>
                <button 
                  title="DevTools" 
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
                  <Code size={20} color={isDevToolsOpen ? accentColor : undefined} />
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
                  <Image size={20} color={isImageViewOpen ? accentColor : undefined} />
                </button>
                <ScreenshotButton onCapture={handleScreenshot} loading={isCapturing} />
                <button 
                  title="Settings" 
                  onClick={() => setIsSettingsOpen(true)}
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
      {settings.showStatusBar && (
        <footer style={styles.statusBar}>
          {statusMessage || activeTab?.url || "Ready"}
        </footer>
      )}
      
      {/* Image Viewer Overlay */}
      {isImageViewOpen && (
        <ImageViewer 
          images={pageImages}
          onClose={() => setIsImageViewOpen(false)}
        />
      )}

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
      />
    </div>
  );
}

export default App;
