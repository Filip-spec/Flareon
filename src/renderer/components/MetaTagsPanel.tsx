import { useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, Tag, Twitter, Facebook, FileText, Code } from "lucide-react";
import { theme } from "../styles/theme";
import type { WebviewTag } from "electron";

interface MetaTagsData {
  openGraph: {
    hasOgTags: boolean;
    title: string | null;
    description: string | null;
    image: string | null;
    url: string | null;
    type: string | null;
    siteName: string | null;
    imageValid: boolean;
    imageError: string | null;
    missingTags: string[];
  };
  twitterCard: {
    hasTwitterCard: boolean;
    card: string | null;
    title: string | null;
    description: string | null;
    image: string | null;
    site: string | null;
    creator: string | null;
    missingTags: string[];
  };
  favicon: {
    hasFavicon: boolean;
    faviconUrl: string | null;
    faviconBase64: string | null;
    sizes: string[];
    appleTouchIcon: string | null;
    valid: boolean;
    error: string | null;
  };
  schema: {
    hasSchema: boolean;
    types: string[];
    count: number;
    valid: boolean;
    errors: string[];
  };
  sitemap: {
    hasSitemap: boolean;
    sitemapUrl: string | null;
    accessible: boolean;
    error: string | null;
  };
}

interface MetaTagsPanelProps {
  webviewRef: React.RefObject<WebviewTag>;
  isOpen: boolean;
  onClose: () => void;
}

const StatusIcon = ({ status }: { status: "success" | "warning" | "error" }) => {
  const icons = {
    success: <CheckCircle size={16} color="#00E676" />,
    warning: <AlertTriangle size={16} color="#FFD600" />,
    error: <XCircle size={16} color="#FF1744" />,
  };
  return icons[status];
};

export default function MetaTagsPanel({ webviewRef, isOpen, onClose }: MetaTagsPanelProps) {
  const [metaData, setMetaData] = useState<MetaTagsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeMetaTags = async () => {
    const webview = webviewRef.current;
    if (!webview) {
      setError("No webview available");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await webview.executeJavaScript(`
        (async function() {
          try {
            const currentUrl = window.location.href;
            const origin = window.location.origin;

            // Open Graph Tags
            const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
            const ogDescription = document.querySelector('meta[property="og:description"]')?.getAttribute('content');
            const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
            const ogUrl = document.querySelector('meta[property="og:url"]')?.getAttribute('content');
            const ogType = document.querySelector('meta[property="og:type"]')?.getAttribute('content');
            const ogSiteName = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content');

            const hasOgTags = !!(ogTitle || ogDescription || ogImage);
            const ogMissingTags = [];
            if (!ogTitle) ogMissingTags.push('og:title');
            if (!ogDescription) ogMissingTags.push('og:description');
            if (!ogImage) ogMissingTags.push('og:image');
            if (!ogUrl) ogMissingTags.push('og:url');
            if (!ogType) ogMissingTags.push('og:type');

            // Validate OG Image
            let imageValid = false;
            let imageError = null;
            if (ogImage) {
              try {
                const img = new Image();
                await new Promise((resolve, reject) => {
                  img.onload = () => {
                    if (img.width >= 200 && img.height >= 200) {
                      imageValid = true;
                      resolve(true);
                    } else {
                      imageError = \`Image too small: \${img.width}x\${img.height} (min 200x200)\`;
                      reject(imageError);
                    }
                  };
                  img.onerror = () => {
                    imageError = 'Failed to load image';
                    reject(imageError);
                  };
                  img.src = ogImage;
                  setTimeout(() => {
                    imageValid = true; // Assume valid if loading takes too long
                    resolve(true);
                  }, 3000);
                });
              } catch (e) {
                imageError = e.toString();
              }
            }

            // Twitter Card Tags
            const twitterCard = document.querySelector('meta[name="twitter:card"]')?.getAttribute('content');
            const twitterTitle = document.querySelector('meta[name="twitter:title"]')?.getAttribute('content');
            const twitterDescription = document.querySelector('meta[name="twitter:description"]')?.getAttribute('content');
            const twitterImage = document.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
            const twitterSite = document.querySelector('meta[name="twitter:site"]')?.getAttribute('content');
            const twitterCreator = document.querySelector('meta[name="twitter:creator"]')?.getAttribute('content');

            const hasTwitterCard = !!twitterCard;
            const twitterMissingTags = [];
            if (!twitterCard) twitterMissingTags.push('twitter:card');
            if (!twitterTitle && !ogTitle) twitterMissingTags.push('twitter:title');
            if (!twitterDescription && !ogDescription) twitterMissingTags.push('twitter:description');
            if (!twitterImage && !ogImage) twitterMissingTags.push('twitter:image');

            // Favicon
            const faviconLink = document.querySelector('link[rel*="icon"]');
            const appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');
            const faviconHref = faviconLink?.getAttribute('href') || '/favicon.ico';
            const faviconSizes = faviconLink?.getAttribute('sizes')?.split(' ') || [];

            // Convert to full URL
            let faviconUrl = null;
            let appleTouchIconUrl = null;
            let faviconBase64 = null;
            
            try {
              faviconUrl = new URL(faviconHref, currentUrl).href;
              if (appleTouchIcon) {
                const appleTouchHref = appleTouchIcon.getAttribute('href');
                if (appleTouchHref) {
                  appleTouchIconUrl = new URL(appleTouchHref, currentUrl).href;
                }
              }
            } catch (e) {
              faviconUrl = faviconHref;
            }

            // Try to load favicon as base64 to avoid CORS issues
            let faviconValid = false;
            let faviconError = null;
            if (faviconUrl) {
              try {
                const response = await fetch(faviconUrl);
                if (response.ok) {
                  faviconValid = true;
                  const blob = await response.blob();
                  const reader = new FileReader();
                  faviconBase64 = await new Promise((resolve) => {
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                  });
                } else {
                  faviconError = \`HTTP \${response.status}\`;
                }
              } catch (e) {
                faviconError = 'Failed to fetch';
                // Fallback: try to load it anyway
                faviconBase64 = faviconUrl;
              }
            }

            // Schema.org / JSON-LD
            const schemaScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            const schemaData = schemaScripts.map(script => {
              try {
                return JSON.parse(script.textContent || '{}');
              } catch {
                return null;
              }
            }).filter(Boolean);

            const schemaTypes = schemaData.map(data => {
              if (Array.isArray(data)) {
                return data.map(item => item['@type']).filter(Boolean);
              }
              return data['@type'];
            }).flat().filter(Boolean);

            const hasSchema = schemaData.length > 0;
            const schemaErrors = [];
            
            schemaData.forEach((data, idx) => {
              if (!data['@context']) {
                schemaErrors.push(\`Schema #\${idx + 1}: Missing @context\`);
              }
              if (!data['@type']) {
                schemaErrors.push(\`Schema #\${idx + 1}: Missing @type\`);
              }
            });

            // Sitemap
            let sitemapUrl = null;
            let sitemapAccessible = false;
            let sitemapError = null;

            // Check robots.txt first
            try {
              const robotsUrl = new URL('/robots.txt', origin).href;
              const robotsResponse = await fetch(robotsUrl);
              if (robotsResponse.ok) {
                const robotsText = await robotsResponse.text();
                const sitemapMatch = robotsText.match(/Sitemap:\\s*(.+)/i);
                if (sitemapMatch) {
                  sitemapUrl = sitemapMatch[1].trim();
                }
              }
            } catch (e) {
              // Ignore robots.txt errors
            }

            // If no sitemap in robots.txt, check default locations
            if (!sitemapUrl) {
              const defaultSitemaps = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap1.xml'];
              for (const path of defaultSitemaps) {
                try {
                  const url = new URL(path, origin).href;
                  const response = await fetch(url, { method: 'HEAD' });
                  if (response.ok) {
                    sitemapUrl = url;
                    break;
                  }
                } catch (e) {
                  // Continue checking
                }
              }
            }

            // Verify sitemap accessibility
            if (sitemapUrl) {
              try {
                const response = await fetch(sitemapUrl, { method: 'HEAD' });
                sitemapAccessible = response.ok;
                if (!response.ok) {
                  sitemapError = \`HTTP \${response.status}\`;
                }
              } catch (e) {
                sitemapError = 'Failed to fetch';
              }
            }

            return {
              openGraph: {
                hasOgTags,
                title: ogTitle,
                description: ogDescription,
                image: ogImage,
                url: ogUrl,
                type: ogType,
                siteName: ogSiteName,
                imageValid,
                imageError,
                missingTags: ogMissingTags,
              },
              twitterCard: {
                hasTwitterCard,
                card: twitterCard,
                title: twitterTitle || ogTitle,
                description: twitterDescription || ogDescription,
                image: twitterImage || ogImage,
                site: twitterSite,
                creator: twitterCreator,
                missingTags: twitterMissingTags,
              },
              favicon: {
                hasFavicon: !!faviconUrl,
                faviconUrl,
                faviconBase64,
                sizes: faviconSizes,
                appleTouchIcon: appleTouchIconUrl,
                valid: faviconValid,
                error: faviconError,
              },
              schema: {
                hasSchema,
                types: schemaTypes,
                count: schemaData.length,
                valid: schemaErrors.length === 0,
                errors: schemaErrors,
              },
              sitemap: {
                hasSitemap: !!sitemapUrl,
                sitemapUrl,
                accessible: sitemapAccessible,
                error: sitemapError,
              },
            };
          } catch (err) {
            return { error: err.message };
          }
        })();
      `);

      if (data.error) {
        setError(data.error);
      } else {
        setMetaData(data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to analyze meta tags");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      analyzeMetaTags();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: 400,
        background: "linear-gradient(180deg, rgba(20,20,20,0.98) 0%, rgba(15,15,15,0.98) 100%)",
        borderLeft: `1px solid ${theme.colors.border}`,
        display: "flex",
        flexDirection: "column",
        zIndex: 1000,
        boxShadow: "-4px 0 12px rgba(0, 0, 0, 0.5)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${theme.colors.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Tag size={20} color={theme.colors.accent} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: theme.colors.textPrimary }}>
            Meta Tags Analysis
          </h3>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={analyzeMetaTags}
            disabled={loading}
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 6,
              padding: "6px 12px",
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
              background: "transparent",
              border: "none",
              color: theme.colors.textSecondary,
              cursor: "pointer",
              fontSize: 20,
              padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
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

        {loading && !metaData && (
          <div style={{ textAlign: "center", padding: 40, color: theme.colors.textSecondary }}>
            Analyzing meta tags...
          </div>
        )}

        {metaData && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Open Graph */}
            <section>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Facebook size={16} color={theme.colors.accent} />
                <h4
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.colors.textPrimary,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Open Graph (Facebook)
                </h4>
                <StatusIcon
                  status={
                    metaData.openGraph.hasOgTags && metaData.openGraph.missingTags.length === 0
                      ? "success"
                      : metaData.openGraph.hasOgTags
                      ? "warning"
                      : "error"
                  }
                />
              </div>

              {!metaData.openGraph.hasOgTags ? (
                <div
                  style={{
                    padding: 12,
                    background: "rgba(255, 23, 68, 0.1)",
                    border: "1px solid rgba(255, 23, 68, 0.3)",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "#FF1744",
                  }}
                >
                  No Open Graph tags found
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                    {metaData.openGraph.title && (
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: theme.colors.textSecondary }}>Title: </span>
                        <span style={{ color: theme.colors.textPrimary }}>{metaData.openGraph.title}</span>
                      </div>
                    )}
                    {metaData.openGraph.description && (
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: theme.colors.textSecondary }}>Description: </span>
                        <span style={{ color: theme.colors.textPrimary }}>{metaData.openGraph.description}</span>
                      </div>
                    )}
                    {metaData.openGraph.type && (
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: theme.colors.textSecondary }}>Type: </span>
                        <span style={{ color: theme.colors.textPrimary }}>{metaData.openGraph.type}</span>
                      </div>
                    )}
                    {metaData.openGraph.siteName && (
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: theme.colors.textSecondary }}>Site Name: </span>
                        <span style={{ color: theme.colors.textPrimary }}>{metaData.openGraph.siteName}</span>
                      </div>
                    )}
                  </div>

                  {metaData.openGraph.image && (
                    <div
                      style={{
                        padding: 8,
                        background: "rgba(255, 255, 255, 0.03)",
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: 4,
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 4 }}>
                        OG Image:
                      </div>
                      <img
                        src={metaData.openGraph.image}
                        alt="OG Preview"
                        style={{
                          width: "100%",
                          height: "auto",
                          borderRadius: 4,
                          marginBottom: 4,
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <div style={{ fontSize: 11, color: theme.colors.textSecondary, wordBreak: "break-all" }}>
                        {metaData.openGraph.image}
                      </div>
                      {metaData.openGraph.imageError && (
                        <div style={{ fontSize: 11, color: "#FF1744", marginTop: 4 }}>
                          ⚠️ {metaData.openGraph.imageError}
                        </div>
                      )}
                    </div>
                  )}

                  {metaData.openGraph.missingTags.length > 0 && (
                    <div
                      style={{
                        padding: 8,
                        background: "rgba(255, 214, 0, 0.1)",
                        border: "1px solid rgba(255, 214, 0, 0.3)",
                        borderRadius: 4,
                        fontSize: 11,
                        color: "#FFD600",
                      }}
                    >
                      Missing tags: {metaData.openGraph.missingTags.join(", ")}
                    </div>
                  )}
                </>
              )}
            </section>

            {/* Twitter Card */}
            <section>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Twitter size={16} color={theme.colors.accent} />
                <h4
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.colors.textPrimary,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Twitter Card
                </h4>
                <StatusIcon
                  status={
                    metaData.twitterCard.hasTwitterCard && metaData.twitterCard.missingTags.length === 0
                      ? "success"
                      : metaData.twitterCard.hasTwitterCard
                      ? "warning"
                      : "error"
                  }
                />
              </div>

              {!metaData.twitterCard.hasTwitterCard ? (
                <div
                  style={{
                    padding: 12,
                    background: "rgba(255, 23, 68, 0.1)",
                    border: "1px solid rgba(255, 23, 68, 0.3)",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "#FF1744",
                  }}
                >
                  No Twitter Card tags found
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                    {metaData.twitterCard.card && (
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: theme.colors.textSecondary }}>Card Type: </span>
                        <span style={{ color: theme.colors.textPrimary }}>{metaData.twitterCard.card}</span>
                      </div>
                    )}
                    {metaData.twitterCard.title && (
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: theme.colors.textSecondary }}>Title: </span>
                        <span style={{ color: theme.colors.textPrimary }}>{metaData.twitterCard.title}</span>
                      </div>
                    )}
                    {metaData.twitterCard.site && (
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: theme.colors.textSecondary }}>Site: </span>
                        <span style={{ color: theme.colors.textPrimary }}>{metaData.twitterCard.site}</span>
                      </div>
                    )}
                    {metaData.twitterCard.creator && (
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: theme.colors.textSecondary }}>Creator: </span>
                        <span style={{ color: theme.colors.textPrimary }}>{metaData.twitterCard.creator}</span>
                      </div>
                    )}
                  </div>

                  {metaData.twitterCard.missingTags.length > 0 && (
                    <div
                      style={{
                        padding: 8,
                        background: "rgba(255, 214, 0, 0.1)",
                        border: "1px solid rgba(255, 214, 0, 0.3)",
                        borderRadius: 4,
                        fontSize: 11,
                        color: "#FFD600",
                      }}
                    >
                      Missing tags: {metaData.twitterCard.missingTags.join(", ")} (falls back to OG tags)
                    </div>
                  )}
                </>
              )}
            </section>

            {/* Favicon */}
            <section>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <FileText size={16} color={theme.colors.accent} />
                <h4
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.colors.textPrimary,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Favicon
                </h4>
                <StatusIcon
                  status={metaData.favicon.hasFavicon && metaData.favicon.valid ? "success" : "error"}
                />
              </div>

              {metaData.favicon.hasFavicon ? (
                <>
                  <div
                    style={{
                      padding: 8,
                      background: "rgba(255, 255, 255, 0.03)",
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: 4,
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 4,
                          background: 'rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          position: 'relative',
                        }}
                      >
                        {(metaData.favicon.faviconBase64 || metaData.favicon.faviconUrl) ? (
                          <img
                            src={metaData.favicon.faviconBase64 || metaData.favicon.faviconUrl || ''}
                            alt="Favicon"
                            style={{ 
                              width: '100%', 
                              height: '100%', 
                              objectFit: 'contain',
                            }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent && !parent.querySelector('.fallback-icon')) {
                                const fallback = document.createElement('div');
                                fallback.className = 'fallback-icon';
                                fallback.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#666;font-size:18px;';
                                fallback.textContent = '🌐';
                                parent.appendChild(fallback);
                              }
                            }}
                          />
                        ) : (
                          <div style={{ color: '#666', fontSize: 18 }}>🌐</div>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: theme.colors.textSecondary, wordBreak: 'break-all' }}>
                          {metaData.favicon.faviconUrl}
                        </div>
                        {metaData.favicon.sizes.length > 0 && (
                          <div style={{ fontSize: 10, color: theme.colors.textSecondary }}>
                            Sizes: {metaData.favicon.sizes.join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                    {metaData.favicon.error && (
                      <div style={{ fontSize: 11, color: "#FF1744" }}>⚠️ {metaData.favicon.error}</div>
                    )}
                  </div>
                  {metaData.favicon.appleTouchIcon && (
                    <div style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                      ✓ Apple Touch Icon present
                    </div>
                  )}
                </>
              ) : (
                <div
                  style={{
                    padding: 12,
                    background: "rgba(255, 23, 68, 0.1)",
                    border: "1px solid rgba(255, 23, 68, 0.3)",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "#FF1744",
                  }}
                >
                  No favicon found
                </div>
              )}
            </section>

            {/* Schema.org */}
            <section>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Code size={16} color={theme.colors.accent} />
                <h4
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.colors.textPrimary,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Schema.org (JSON-LD)
                </h4>
                <StatusIcon
                  status={
                    metaData.schema.hasSchema && metaData.schema.valid
                      ? "success"
                      : metaData.schema.hasSchema
                      ? "warning"
                      : "error"
                  }
                />
              </div>

              {metaData.schema.hasSchema ? (
                <>
                  <div
                    style={{
                      padding: 8,
                      background: "rgba(255, 255, 255, 0.03)",
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: 4,
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ fontSize: 12, color: theme.colors.textPrimary, marginBottom: 4 }}>
                      Found {metaData.schema.count} schema{metaData.schema.count !== 1 ? "s" : ""}
                    </div>
                    {metaData.schema.types.length > 0 && (
                      <div style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                        Types: {metaData.schema.types.join(", ")}
                      </div>
                    )}
                  </div>
                  {metaData.schema.errors.length > 0 && (
                    <div
                      style={{
                        padding: 8,
                        background: "rgba(255, 214, 0, 0.1)",
                        border: "1px solid rgba(255, 214, 0, 0.3)",
                        borderRadius: 4,
                        fontSize: 11,
                        color: "#FFD600",
                      }}
                    >
                      {metaData.schema.errors.map((err, idx) => (
                        <div key={idx}>⚠️ {err}</div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div
                  style={{
                    padding: 12,
                    background: "rgba(255, 23, 68, 0.1)",
                    border: "1px solid rgba(255, 23, 68, 0.3)",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "#FF1744",
                  }}
                >
                  No Schema.org structured data found
                </div>
              )}
            </section>

            {/* Sitemap */}
            <section>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <FileText size={16} color={theme.colors.accent} />
                <h4
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.colors.textPrimary,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  XML Sitemap
                </h4>
                <StatusIcon
                  status={
                    metaData.sitemap.hasSitemap && metaData.sitemap.accessible
                      ? "success"
                      : metaData.sitemap.hasSitemap
                      ? "warning"
                      : "error"
                  }
                />
              </div>

              {metaData.sitemap.hasSitemap ? (
                <div
                  style={{
                    padding: 8,
                    background: "rgba(255, 255, 255, 0.03)",
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: 4,
                  }}
                >
                  <div style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 4 }}>
                    Sitemap URL:
                  </div>
                  <a
                    href={metaData.sitemap.sitemapUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 11, color: theme.colors.accent, wordBreak: "break-all" }}
                  >
                    {metaData.sitemap.sitemapUrl}
                  </a>
                  {metaData.sitemap.error && (
                    <div style={{ fontSize: 11, color: "#FF1744", marginTop: 4 }}>
                      ⚠️ {metaData.sitemap.error}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    padding: 12,
                    background: "rgba(255, 23, 68, 0.1)",
                    border: "1px solid rgba(255, 23, 68, 0.3)",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "#FF1744",
                  }}
                >
                  No sitemap found. Checked robots.txt and default locations.
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
