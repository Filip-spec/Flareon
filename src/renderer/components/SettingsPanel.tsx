import { useState } from "react";
import { X } from "lucide-react";
import { theme } from "../styles/theme";

export interface AppSettings {
  // Screenshots
  screenshotFormat: "png" | "jpeg" | "webp";
  screenshotQuality: number;
  autoSaveScreenshots: boolean;
  screenshotFolder: string;
  includeTimestampInFilename: boolean;
  screenshotNamePrefix: string;
  
  // Appearance
  showTabFavicons: boolean;
  showStatusBar: boolean;
  darkMode: boolean;
  sidebarDefaultState: "collapsed" | "expanded";
  accentColor: string;
  
  // Viewport
  defaultViewport: string;
  rememberLastViewport: boolean;
  scaleViewportToFit: boolean;
  showViewportDimensions: boolean;
  
  // Navigation
  defaultHomepage: string;
  openLinksInSameTab: boolean;
  enableJavaScript: boolean;
  loadImagesAutomatically: boolean;
  
  // Privacy & Security
  clearCacheOnExit: boolean;
  blockPopups: boolean;
  enableCookies: boolean;
  doNotTrack: boolean;
  
  // Performance
  hardwareAcceleration: boolean;
  preloadPages: boolean;
  maxCacheSize: number;
  
  // Tabs
  showTabCloseButton: boolean;
  confirmBeforeClosingMultipleTabs: boolean;
  restoreTabsOnStartup: boolean;
  
  // Updates
  checkForUpdates: boolean;
  autoInstallUpdates: boolean;
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

export default function SettingsPanel({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
}: SettingsPanelProps) {
  if (!isOpen) return null;

  const handleChange = (key: keyof AppSettings, value: any) => {
    onSettingsChange({
      ...settings,
      [key]: value,
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10000,
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "linear-gradient(180deg, rgba(20,20,20,0.98) 0%, rgba(15,15,15,0.98) 100%)",
          border: `1px solid ${theme.colors.border}`,
          borderRadius: 12,
          width: "90%",
          maxWidth: 600,
          maxHeight: "85vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: `1px solid ${theme.colors.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 600,
              color: theme.colors.textPrimary,
            }}
          >
            Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: theme.colors.textSecondary,
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
              borderRadius: 4,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
              e.currentTarget.style.color = theme.colors.accent;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = theme.colors.textSecondary;
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Screenshots Section */}
            <section>
              <h3
                style={{
                  margin: "0 0 16px 0",
                  fontSize: 14,
                  fontWeight: 600,
                  color: theme.colors.accent,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Screenshots
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Screenshot Format */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      color: theme.colors.textSecondary,
                      marginBottom: 8,
                    }}
                  >
                    Format
                  </label>
                  <select
                    value={settings.screenshotFormat}
                    onChange={(e) =>
                      handleChange("screenshotFormat", e.target.value as "png" | "jpeg" | "webp")
                    }
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: 6,
                      color: theme.colors.textPrimary,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <option value="png">PNG (Lossless, larger file)</option>
                    <option value="jpeg">JPEG (Compressed, smaller file)</option>
                    <option value="webp">WebP (Modern, best balance)</option>
                  </select>
                </div>

                {/* Quality Slider (for JPEG/WebP) */}
                {(settings.screenshotFormat === "jpeg" || settings.screenshotFormat === "webp") && (
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 12,
                        color: theme.colors.textSecondary,
                        marginBottom: 8,
                      }}
                    >
                      Quality: {settings.screenshotQuality}%
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={settings.screenshotQuality}
                      onChange={(e) =>
                        handleChange("screenshotQuality", parseInt(e.target.value))
                      }
                      style={{
                        width: "100%",
                        cursor: "pointer",
                      }}
                    />
                  </div>
                )}

                {/* Filename Prefix */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      color: theme.colors.textSecondary,
                      marginBottom: 8,
                    }}
                  >
                    Filename prefix
                  </label>
                  <input
                    type="text"
                    value={settings.screenshotNamePrefix}
                    onChange={(e) => handleChange("screenshotNamePrefix", e.target.value)}
                    placeholder="flareon-screenshot"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: 6,
                      color: theme.colors.textPrimary,
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Include Timestamp */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    id="includeTimestamp"
                    checked={settings.includeTimestampInFilename}
                    onChange={(e) =>
                      handleChange("includeTimestampInFilename", e.target.checked)
                    }
                    style={{
                      width: 16,
                      height: 16,
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="includeTimestamp"
                    style={{
                      fontSize: 13,
                      color: theme.colors.textPrimary,
                      cursor: "pointer",
                    }}
                  >
                    Include timestamp in filename
                  </label>
                </div>

                {/* Auto-save */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    id="autoSave"
                    checked={settings.autoSaveScreenshots}
                    onChange={(e) =>
                      handleChange("autoSaveScreenshots", e.target.checked)
                    }
                    style={{
                      width: 16,
                      height: 16,
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="autoSave"
                    style={{
                      fontSize: 13,
                      color: theme.colors.textPrimary,
                      cursor: "pointer",
                    }}
                  >
                    Auto-save to Pictures folder
                  </label>
                </div>

                {/* Screenshot Folder */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      color: theme.colors.textSecondary,
                      marginBottom: 8,
                    }}
                  >
                    Save location
                  </label>
                  <div
                    style={{
                      padding: "8px 12px",
                      background: "rgba(255, 255, 255, 0.03)",
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: 6,
                      color: theme.colors.textSecondary,
                      fontSize: 12,
                      fontFamily: "monospace",
                    }}
                  >
                    {settings.screenshotFolder}
                  </div>
                </div>
              </div>
            </section>

            {/* Appearance Section */}
            <section>
              <h3
                style={{
                  margin: "0 0 16px 0",
                  fontSize: 14,
                  fontWeight: 600,
                  color: theme.colors.accent,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Appearance
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Accent Color */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      color: theme.colors.textSecondary,
                      marginBottom: 8,
                    }}
                  >
                    Accent color
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["#FF6D00", "#FF1744", "#00E676", "#00B0FF", "#E040FB", "#FFD600"].map((color) => (
                      <button
                        key={color}
                        onClick={() => handleChange("accentColor", color)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          background: color,
                          border: settings.accentColor === color 
                            ? `2px solid ${theme.colors.textPrimary}` 
                            : "2px solid transparent",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          boxShadow: settings.accentColor === color 
                            ? "0 0 0 2px rgba(255, 255, 255, 0.2)" 
                            : "none",
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Sidebar Default State */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      color: theme.colors.textSecondary,
                      marginBottom: 8,
                    }}
                  >
                    Sidebar on startup
                  </label>
                  <select
                    value={settings.sidebarDefaultState}
                    onChange={(e) =>
                      handleChange("sidebarDefaultState", e.target.value as "collapsed" | "expanded")
                    }
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: 6,
                      color: theme.colors.textPrimary,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <option value="collapsed">Collapsed (icons only)</option>
                    <option value="expanded">Expanded (full width)</option>
                  </select>
                </div>

                {/* Show Tab Favicons */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    id="showFavicons"
                    checked={settings.showTabFavicons}
                    onChange={(e) => handleChange("showTabFavicons", e.target.checked)}
                    style={{
                      width: 16,
                      height: 16,
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="showFavicons"
                    style={{
                      fontSize: 13,
                      color: theme.colors.textPrimary,
                      cursor: "pointer",
                    }}
                  >
                    Show tab favicons
                  </label>
                </div>

                {/* Show Status Bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    id="showStatusBar"
                    checked={settings.showStatusBar}
                    onChange={(e) => handleChange("showStatusBar", e.target.checked)}
                    style={{
                      width: 16,
                      height: 16,
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="showStatusBar"
                    style={{
                      fontSize: 13,
                      color: theme.colors.textPrimary,
                      cursor: "pointer",
                    }}
                  >
                    Show status bar
                  </label>
                </div>

                {/* Dark Mode (always on for now) */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    id="darkMode"
                    checked={settings.darkMode}
                    disabled
                    style={{
                      width: 16,
                      height: 16,
                      cursor: "not-allowed",
                      opacity: 0.5,
                    }}
                  />
                  <label
                    htmlFor="darkMode"
                    style={{
                      fontSize: 13,
                      color: theme.colors.textSecondary,
                      cursor: "not-allowed",
                    }}
                  >
                    Dark mode (always enabled)
                  </label>
                </div>
              </div>
            </section>

            {/* Viewport Section */}
            <section>
              <h3
                style={{
                  margin: "0 0 16px 0",
                  fontSize: 14,
                  fontWeight: 600,
                  color: theme.colors.accent,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Viewport
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Default Viewport */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      color: theme.colors.textSecondary,
                      marginBottom: 8,
                    }}
                  >
                    Default viewport on startup
                  </label>
                  <select
                    value={settings.defaultViewport}
                    onChange={(e) => handleChange("defaultViewport", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: 6,
                      color: theme.colors.textPrimary,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <option value="responsive">Responsive</option>
                    <option value="desktop">Desktop HD (1920×1080)</option>
                    <option value="macbook-air">MacBook Air (1440×900)</option>
                    <option value="iphone-12">iPhone 12 (390×844)</option>
                    <option value="tablet">iPad (768×1024)</option>
                  </select>
                </div>

                {/* Remember Last Viewport */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    id="rememberViewport"
                    checked={settings.rememberLastViewport}
                    onChange={(e) => handleChange("rememberLastViewport", e.target.checked)}
                    style={{
                      width: 16,
                      height: 16,
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="rememberViewport"
                    style={{
                      fontSize: 13,
                      color: theme.colors.textPrimary,
                      cursor: "pointer",
                    }}
                  >
                    Remember last used viewport
                  </label>
                </div>

                {/* Scale Viewport to Fit */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    id="scaleViewport"
                    checked={settings.scaleViewportToFit}
                    onChange={(e) => handleChange("scaleViewportToFit", e.target.checked)}
                    style={{
                      width: 16,
                      height: 16,
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="scaleViewport"
                    style={{
                      fontSize: 13,
                      color: theme.colors.textPrimary,
                      cursor: "pointer",
                    }}
                  >
                    Auto-scale viewport to fit window
                  </label>
                </div>

                {/* Show Viewport Dimensions */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    id="showDimensions"
                    checked={settings.showViewportDimensions}
                    onChange={(e) => handleChange("showViewportDimensions", e.target.checked)}
                    style={{
                      width: 16,
                      height: 16,
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="showDimensions"
                    style={{
                      fontSize: 13,
                      color: theme.colors.textPrimary,
                      cursor: "pointer",
                    }}
                  >
                    Show viewport dimensions overlay
                  </label>
                </div>
              </div>
            </section>

            {/* Navigation Section */}
            <section>
              <h3
                style={{
                  margin: "0 0 16px 0",
                  fontSize: 14,
                  fontWeight: 600,
                  color: theme.colors.accent,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Navigation
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Default Homepage */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      color: theme.colors.textSecondary,
                      marginBottom: 8,
                    }}
                  >
                    Homepage URL
                  </label>
                  <input
                    type="text"
                    value={settings.defaultHomepage}
                    onChange={(e) => handleChange("defaultHomepage", e.target.value)}
                    placeholder="https://example.com"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: 6,
                      color: theme.colors.textPrimary,
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Open Links in Same Tab */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    id="openLinksInSameTab"
                    checked={settings.openLinksInSameTab}
                    onChange={(e) => handleChange("openLinksInSameTab", e.target.checked)}
                    style={{
                      width: 16,
                      height: 16,
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="openLinksInSameTab"
                    style={{
                      fontSize: 13,
                      color: theme.colors.textPrimary,
                      cursor: "pointer",
                    }}
                  >
                    Open external links in same tab
                  </label>
                </div>

                {/* Enable JavaScript */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    id="enableJS"
                    checked={settings.enableJavaScript}
                    onChange={(e) => handleChange("enableJavaScript", e.target.checked)}
                    style={{
                      width: 16,
                      height: 16,
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="enableJS"
                    style={{
                      fontSize: 13,
                      color: theme.colors.textPrimary,
                      cursor: "pointer",
                    }}
                  >
                    Enable JavaScript
                  </label>
                </div>

                {/* Load Images Automatically */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    id="loadImages"
                    checked={settings.loadImagesAutomatically}
                    onChange={(e) => handleChange("loadImagesAutomatically", e.target.checked)}
                    style={{
                      width: 16,
                      height: 16,
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="loadImages"
                    style={{
                      fontSize: 13,
                      color: theme.colors.textPrimary,
                      cursor: "pointer",
                    }}
                  >
                    Load images automatically
                  </label>
                </div>
              </div>
            </section>

            {/* Privacy & Security Section */}
            <section>
              <h3
                style={{
                  margin: "0 0 16px 0",
                  fontSize: 14,
                  fontWeight: 600,
                  color: theme.colors.accent,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Privacy & Security
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Enable Cookies */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    id="enableCookies"
                    checked={settings.enableCookies}
                    onChange={(e) => handleChange("enableCookies", e.target.checked)}
                    style={{
                      width: 16,
                      height: 16,
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="enableCookies"
                    style={{
                      fontSize: 13,
                      color: theme.colors.textPrimary,
                      cursor: "pointer",
                    }}
                  >
                    Enable cookies
                  </label>
                </div>

                {/* Block Popups */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    id="blockPopups"
                    checked={settings.blockPopups}
                    onChange={(e) => handleChange("blockPopups", e.target.checked)}
                    style={{
                      width: 16,
                      height: 16,
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="blockPopups"
                    style={{
                      fontSize: 13,
                      color: theme.colors.textPrimary,
                      cursor: "pointer",
                    }}
                  >
                    Block popup windows
                  </label>
                </div>

                {/* Do Not Track */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    id="doNotTrack"
                    checked={settings.doNotTrack}
                    onChange={(e) => handleChange("doNotTrack", e.target.checked)}
                    style={{
                      width: 16,
                      height: 16,
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="doNotTrack"
                    style={{
                      fontSize: 13,
                      color: theme.colors.textPrimary,
                      cursor: "pointer",
                    }}
                  >
                    Send "Do Not Track" header
                  </label>
                </div>

                {/* Clear Cache on Exit */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    id="clearCache"
                    checked={settings.clearCacheOnExit}
                    onChange={(e) => handleChange("clearCacheOnExit", e.target.checked)}
                    style={{
                      width: 16,
                      height: 16,
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="clearCache"
                    style={{
                      fontSize: 13,
                      color: theme.colors.textPrimary,
                      cursor: "pointer",
                    }}
                  >
                    Clear cache on exit
                  </label>
                </div>
              </div>
            </section>

            {/* Performance Section */}
            <section>
              <h3
                style={{
                  margin: "0 0 16px 0",
                  fontSize: 14,
                  fontWeight: 600,
                  color: theme.colors.accent,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Performance
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Max Cache Size */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      color: theme.colors.textSecondary,
                      marginBottom: 8,
                    }}
                  >
                    Max cache size: {settings.maxCacheSize} MB
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="1000"
                    step="50"
                    value={settings.maxCacheSize}
                    onChange={(e) =>
                      handleChange("maxCacheSize", parseInt(e.target.value))
                    }
                    style={{
                      width: "100%",
                      cursor: "pointer",
                    }}
                  />
                </div>

                {/* Hardware Acceleration */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    id="hardwareAccel"
                    checked={settings.hardwareAcceleration}
                    onChange={(e) => handleChange("hardwareAcceleration", e.target.checked)}
                    style={{
                      width: 16,
                      height: 16,
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="hardwareAccel"
                    style={{
                      fontSize: 13,
                      color: theme.colors.textPrimary,
                      cursor: "pointer",
                    }}
                  >
                    Hardware acceleration (restart required)
                  </label>
                </div>

                {/* Preload Pages */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    id="preloadPages"
                    checked={settings.preloadPages}
                    onChange={(e) => handleChange("preloadPages", e.target.checked)}
                    style={{
                      width: 16,
                      height: 16,
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="preloadPages"
                    style={{
                      fontSize: 13,
                      color: theme.colors.textPrimary,
                      cursor: "pointer",
                    }}
                  >
                    Preload pages for faster navigation
                  </label>
                </div>
              </div>
            </section>

            {/* Tabs Section */}
            <section>
              <h3
                style={{
                  margin: "0 0 16px 0",
                  fontSize: 14,
                  fontWeight: 600,
                  color: theme.colors.accent,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Tabs
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Show Tab Close Button */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    id="showTabClose"
                    checked={settings.showTabCloseButton}
                    onChange={(e) => handleChange("showTabCloseButton", e.target.checked)}
                    style={{
                      width: 16,
                      height: 16,
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="showTabClose"
                    style={{
                      fontSize: 13,
                      color: theme.colors.textPrimary,
                      cursor: "pointer",
                    }}
                  >
                    Show close button on tabs
                  </label>
                </div>

                {/* Confirm Before Closing Multiple Tabs */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    id="confirmClose"
                    checked={settings.confirmBeforeClosingMultipleTabs}
                    onChange={(e) => handleChange("confirmBeforeClosingMultipleTabs", e.target.checked)}
                    style={{
                      width: 16,
                      height: 16,
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="confirmClose"
                    style={{
                      fontSize: 13,
                      color: theme.colors.textPrimary,
                      cursor: "pointer",
                    }}
                  >
                    Confirm before closing multiple tabs
                  </label>
                </div>

                {/* Restore Tabs on Startup */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    id="restoreTabs"
                    checked={settings.restoreTabsOnStartup}
                    onChange={(e) => handleChange("restoreTabsOnStartup", e.target.checked)}
                    style={{
                      width: 16,
                      height: 16,
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="restoreTabs"
                    style={{
                      fontSize: 13,
                      color: theme.colors.textPrimary,
                      cursor: "pointer",
                    }}
                  >
                    Restore tabs on startup
                  </label>
                </div>
              </div>
            </section>

            {/* Updates Section */}
            <section>
              <h3
                style={{
                  margin: "0 0 16px 0",
                  fontSize: 14,
                  fontWeight: 600,
                  color: theme.colors.accent,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Updates
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Check for Updates */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    id="checkUpdates"
                    checked={settings.checkForUpdates}
                    onChange={(e) => handleChange("checkForUpdates", e.target.checked)}
                    style={{
                      width: 16,
                      height: 16,
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="checkUpdates"
                    style={{
                      fontSize: 13,
                      color: theme.colors.textPrimary,
                      cursor: "pointer",
                    }}
                  >
                    Check for updates automatically
                  </label>
                </div>

                {/* Auto Install Updates */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    id="autoInstall"
                    checked={settings.autoInstallUpdates}
                    onChange={(e) => handleChange("autoInstallUpdates", e.target.checked)}
                    disabled={!settings.checkForUpdates}
                    style={{
                      width: 16,
                      height: 16,
                      cursor: settings.checkForUpdates ? "pointer" : "not-allowed",
                      opacity: settings.checkForUpdates ? 1 : 0.5,
                    }}
                  />
                  <label
                    htmlFor="autoInstall"
                    style={{
                      fontSize: 13,
                      color: settings.checkForUpdates ? theme.colors.textPrimary : theme.colors.textSecondary,
                      cursor: settings.checkForUpdates ? "pointer" : "not-allowed",
                    }}
                  >
                    Auto-install updates (restart required)
                  </label>
                </div>
              </div>
            </section>

            {/* About Section */}
            <section>
              <h3
                style={{
                  margin: "0 0 16px 0",
                  fontSize: 14,
                  fontWeight: 600,
                  color: theme.colors.accent,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                About
              </h3>

              <div
                style={{
                  padding: 16,
                  background: "rgba(255, 109, 0, 0.05)",
                  border: `1px solid rgba(255, 109, 0, 0.2)`,
                  borderRadius: 8,
                }}
              >
                <p
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: 14,
                    fontWeight: 600,
                    color: theme.colors.accent,
                  }}
                >
                  Flareon Browser
                </p>
                <p
                  style={{
                    margin: "0 0 4px 0",
                    fontSize: 12,
                    color: theme.colors.textSecondary,
                  }}
                >
                  Version 1.0.0
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    color: theme.colors.textSecondary,
                  }}
                >
                  A developer-focused web browser for testing responsive designs
                </p>
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: `1px solid ${theme.colors.border}`,
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 20px",
              borderRadius: 6,
              border: `1px solid ${theme.colors.border}`,
              background: "rgba(255, 255, 255, 0.05)",
              color: theme.colors.textPrimary,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
