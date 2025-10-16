import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, XCircle, Search, Image as ImageIcon, Link as LinkIcon, FileText, Zap, Eye, Accessibility } from "lucide-react";
import { theme } from "../styles/theme";
import type { WebviewTag } from "electron";

interface SEOData {
  metaTags: {
    title: string;
    titleLength: number;
    description: string;
    descriptionLength: number;
    hasTitle: boolean;
    hasDescription: boolean;
  };
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
    h4: string[];
    h5: string[];
    h6: string[];
    hasMultipleH1: boolean;
    hasNoH1: boolean;
    hierarchyIssues: string[];
  };
  coreWebVitals: {
    lcp: { value: number; status: "good" | "needs-improvement" | "poor" | "unknown" };
    cls: { value: number; status: "good" | "needs-improvement" | "poor" | "unknown" };
    inp: { value: number; status: "good" | "needs-improvement" | "poor" | "unknown" };
  };
  images: {
    withoutAlt: Array<{ src: string; index: number }>;
    largeImages: Array<{ src: string; size: number; index: number }>;
    totalImages: number;
  };
  links: {
    broken: Array<{ href: string; text: string }>;
    unsafeTargetBlank: Array<{ href: string; text: string }>;
    totalLinks: number;
  };
  technical: {
    canonicalUrl: string | null;
    indexStatus: "index" | "noindex" | "unknown";
    hasRobotsTxt: boolean;
    robotsTxtUrl: string;
  };
  accessibility: {
    wcagIssues: Array<{ level: "A" | "AA" | "AAA"; rule: string; description: string; elements: number }>;
    contrastIssues: Array<{ text: string; fg: string; bg: string; ratio: number; required: number }>;
    ariaIssues: Array<{ type: string; description: string; count: number }>;
    keyboardIssues: Array<{ type: string; description: string; count: number }>;
    totalIssues: number;
    wcagLevel: "A" | "AA" | "AAA" | "fail";
    screenReaderText: string[];
  };
}

interface SEOPanelProps {
  webviewRef: React.RefObject<WebviewTag>;
  isOpen: boolean;
  onClose: () => void;
}

const StatusBadge = ({ status }: { status: "good" | "needs-improvement" | "poor" | "unknown" }) => {
  const colors = {
    good: "#00E676",
    "needs-improvement": "#FFD600",
    poor: "#FF1744",
    unknown: theme.colors.textSecondary,
  };

  const labels = {
    good: "Good",
    "needs-improvement": "Needs Work",
    poor: "Poor",
    unknown: "Unknown",
  };

  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        background: `${colors[status]}20`,
        color: colors[status],
        textTransform: "uppercase",
      }}
    >
      {labels[status]}
    </span>
  );
};

export default function SEOPanel({ webviewRef, isOpen, onClose }: SEOPanelProps) {
  const [seoData, setSeoData] = useState<SEOData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeSEO = async () => {
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
            // Meta Tags
            const title = document.title || '';
            const metaDescription = document.querySelector('meta[name="description"]');
            const description = metaDescription ? metaDescription.getAttribute('content') || '' : '';

            // Headings
            const h1Elements = Array.from(document.querySelectorAll('h1')).map(h => h.textContent?.trim() || '');
            const h2Elements = Array.from(document.querySelectorAll('h2')).map(h => h.textContent?.trim() || '');
            const h3Elements = Array.from(document.querySelectorAll('h3')).map(h => h.textContent?.trim() || '');
            const h4Elements = Array.from(document.querySelectorAll('h4')).map(h => h.textContent?.trim() || '');
            const h5Elements = Array.from(document.querySelectorAll('h5')).map(h => h.textContent?.trim() || '');
            const h6Elements = Array.from(document.querySelectorAll('h6')).map(h => h.textContent?.trim() || '');

            // Check heading hierarchy
            const hierarchyIssues = [];
            const allHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            let prevLevel = 0;
            allHeadings.forEach((heading, idx) => {
              const level = parseInt(heading.tagName.substring(1));
              if (prevLevel > 0 && level > prevLevel + 1) {
                hierarchyIssues.push(\`Heading \${heading.tagName} appears after H\${prevLevel} (skipped levels)\`);
              }
              prevLevel = level;
            });

            // Images
            const images = Array.from(document.querySelectorAll('img'));
            const imagesWithoutAlt = images
              .map((img, idx) => ({ src: img.src, alt: img.alt, idx }))
              .filter(img => !img.alt || img.alt.trim() === '')
              .map(img => ({ src: img.src, index: img.idx }));

            // For large images, we'd need to fetch them - simplified for now
            const largeImages = [];

            // Links
            const links = Array.from(document.querySelectorAll('a[href]'));
            const unsafeTargetBlank = links
              .filter(link => link.target === '_blank' && !link.rel.includes('noopener'))
              .map(link => ({ href: link.href, text: link.textContent?.trim() || '' }));

            // Technical
            const canonicalLink = document.querySelector('link[rel="canonical"]');
            const canonicalUrl = canonicalLink ? canonicalLink.getAttribute('href') : null;
            
            const robotsMeta = document.querySelector('meta[name="robots"]');
            const robotsContent = robotsMeta ? robotsMeta.getAttribute('content') || '' : '';
            const indexStatus = robotsContent.toLowerCase().includes('noindex') ? 'noindex' : 'index';

            const getPerfEntries = (type) => {
              try {
                if (window.PerformanceObserver && PerformanceObserver.supportedEntryTypes && PerformanceObserver.supportedEntryTypes.includes(type)) {
                  const observer = new PerformanceObserver(() => {});
                  observer.observe({ type, buffered: true });
                  const records = observer.takeRecords ? observer.takeRecords() : [];
                  observer.disconnect();
                  if (records && records.length > 0) {
                    return records;
                  }
                }
              } catch (err) {
                // Ignore observer issues to avoid noisy consoles
              }

              return [];
            };

            // Core Web Vitals - Safe API calls only
            let lcpValue = 0;
            let clsValue = 0;
            let inpValue = 0;

            // LCP (Largest Contentful Paint) - completely safe approach
            try {
              const lcpEntries = getPerfEntries('largest-contentful-paint');
              if (lcpEntries && lcpEntries.length > 0) {
                lcpValue = lcpEntries[lcpEntries.length - 1].startTime;
              } else {
                // Fallback: use navigation timing
                const navEntries = getPerfEntries('navigation');
                if (navEntries && navEntries.length > 0 && navEntries[0].loadEventEnd) {
                  lcpValue = navEntries[0].loadEventEnd;
                } else {
                  // Use DOMContentLoaded as last resort
                  const paintEntries = getPerfEntries('paint');
                  const fcp = paintEntries ? paintEntries.find(e => e.name === 'first-contentful-paint') : null;
                  if (fcp) {
                    lcpValue = fcp.startTime;
                  }
                }
              }
            } catch (e) {
              // Silently handle any API errors
              console.debug('LCP measurement not available');
            }

            // CLS (Cumulative Layout Shift) - completely safe approach
            try {
              const clsEntries = getPerfEntries('layout-shift');
              if (clsEntries && clsEntries.length > 0) {
                clsValue = clsEntries
                  .filter(entry => !entry.hadRecentInput)
                  .reduce((sum, entry) => sum + entry.value, 0);
              }
            } catch (e) {
              // Silently handle any API errors
              console.debug('CLS measurement not available');
            }

            // INP (Interaction to Next Paint) - completely safe approach
            try {
              const eventEntries = getPerfEntries('event');
              if (eventEntries && eventEntries.length > 0) {
                const interactions = eventEntries.filter(e =>
                  e.duration && e.duration > 0
                );
                if (interactions.length > 0) {
                  // Use the 98th percentile of interaction delays
                  const durations = interactions
                    .map(e => e.duration)
                    .sort((a, b) => a - b);
                  const p98Index = Math.floor(durations.length * 0.98);
                  inpValue = durations[p98Index] || durations[durations.length - 1];
                }
              }
            } catch (e) {
              // Silently handle any API errors
              console.debug('INP measurement not available');
            }

            return {
              metaTags: {
                title,
                titleLength: title.length,
                description,
                descriptionLength: description.length,
                hasTitle: title.length > 0,
                hasDescription: description.length > 0,
              },
              headings: {
                h1: h1Elements,
                h2: h2Elements,
                h3: h3Elements,
                h4: h4Elements,
                h5: h5Elements,
                h6: h6Elements,
                hasMultipleH1: h1Elements.length > 1,
                hasNoH1: h1Elements.length === 0,
                hierarchyIssues,
              },
              coreWebVitals: {
                lcp: { 
                  value: lcpValue, 
                  status: lcpValue === 0 ? 'unknown' : 
                          lcpValue <= 2500 ? 'good' : 
                          lcpValue <= 4000 ? 'needs-improvement' : 'poor' 
                },
                cls: { 
                  value: clsValue, 
                  // CLS of 0 is actually good (no layout shifts)
                  status: clsValue <= 0.1 ? 'good' : 
                          clsValue <= 0.25 ? 'needs-improvement' : 'poor' 
                },
                inp: { 
                  value: inpValue, 
                  // INP requires user interaction, 0 means no interactions yet
                  status: inpValue === 0 ? 'unknown' : 
                          inpValue <= 200 ? 'good' : 
                          inpValue <= 500 ? 'needs-improvement' : 'poor' 
                },
              },
              images: {
                withoutAlt: imagesWithoutAlt,
                largeImages,
                totalImages: images.length,
              },
              links: {
                broken: [],
                unsafeTargetBlank,
                totalLinks: links.length,
              },
              technical: {
                canonicalUrl,
                indexStatus,
                hasRobotsTxt: false,
                robotsTxtUrl: new URL('/robots.txt', window.location.origin).href,
              },
              accessibility: await (async function() {
                const wcagIssues = [];
                const contrastIssues = [];
                const ariaIssues = [];
                const keyboardIssues = [];
                const screenReaderText = [];

                // Helper: Get contrast ratio
                const getContrastRatio = (fg, bg) => {
                  const getLuminance = (color) => {
                    const rgb = color.match(/\\d+/g).map(Number);
                    const [r, g, b] = rgb.map(val => {
                      val = val / 255;
                      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
                    });
                    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
                  };
                  
                  const l1 = getLuminance(fg);
                  const l2 = getLuminance(bg);
                  const lighter = Math.max(l1, l2);
                  const darker = Math.min(l1, l2);
                  return (lighter + 0.05) / (darker + 0.05);
                };

                // Check for missing form labels
                const inputs = document.querySelectorAll('input, textarea, select');
                let formIssues = 0;
                inputs.forEach(input => {
                  const id = input.id;
                  const ariaLabel = input.getAttribute('aria-label');
                  const ariaLabelledBy = input.getAttribute('aria-labelledby');
                  const label = id ? document.querySelector(\`label[for="\${id}"]\`) : null;
                  
                  if (!label && !ariaLabel && !ariaLabelledBy) {
                    formIssues++;
                  }
                });

                if (formIssues > 0) {
                  wcagIssues.push({
                    level: 'A',
                    rule: '3.3.2 Labels or Instructions',
                    description: 'Form inputs without labels',
                    elements: formIssues
                  });
                }

                // Check for images without alt text
                if (imagesWithoutAlt.length > 0) {
                  wcagIssues.push({
                    level: 'A',
                    rule: '1.1.1 Non-text Content',
                    description: 'Images without alt text',
                    elements: imagesWithoutAlt.length
                  });
                }

                // Check heading hierarchy
                if (h1Elements.length === 0) {
                  wcagIssues.push({
                    level: 'A',
                    rule: '2.4.6 Headings and Labels',
                    description: 'Page missing H1 heading',
                    elements: 1
                  });
                }

                if (h1Elements.length > 1) {
                  wcagIssues.push({
                    level: 'AA',
                    rule: '2.4.6 Headings and Labels',
                    description: 'Multiple H1 headings found',
                    elements: h1Elements.length
                  });
                }

                // Check for color contrast
                const textElements = document.querySelectorAll('p, span, a, button, h1, h2, h3, h4, h5, h6, li, td, th');
                const checkedElements = new Set();
                
                textElements.forEach(el => {
                  if (checkedElements.size >= 50) return; // Limit checks
                  
                  const text = el.textContent?.trim();
                  if (!text || text.length < 3) return;
                  
                  const style = window.getComputedStyle(el);
                  const fg = style.color;
                  const bg = style.backgroundColor;
                  
                  if (fg === 'rgba(0, 0, 0, 0)' || bg === 'rgba(0, 0, 0, 0)') return;
                  
                  try {
                    const ratio = getContrastRatio(fg, bg);
                    const fontSize = parseFloat(style.fontSize);
                    const isBold = parseInt(style.fontWeight) >= 700;
                    const isLarge = fontSize >= 18 || (fontSize >= 14 && isBold);
                    
                    const required = isLarge ? 3 : 4.5; // WCAG AA
                    
                    if (ratio < required) {
                      const key = \`\${fg}-\${bg}\`;
                      if (!checkedElements.has(key)) {
                        checkedElements.add(key);
                        contrastIssues.push({
                          text: text.substring(0, 50),
                          fg,
                          bg,
                          ratio: Math.round(ratio * 100) / 100,
                          required
                        });
                      }
                    }
                  } catch (e) {
                    // Skip invalid colors
                  }
                });

                // Check ARIA issues
                const elementsWithAria = document.querySelectorAll('[role], [aria-label], [aria-labelledby], [aria-describedby]');
                let invalidAria = 0;
                
                elementsWithAria.forEach(el => {
                  const role = el.getAttribute('role');
                  if (role) {
                    const validRoles = ['button', 'link', 'navigation', 'main', 'banner', 'contentinfo', 'complementary', 'article', 'region', 'search', 'form', 'dialog', 'alert', 'status', 'log', 'marquee', 'timer', 'alertdialog', 'menu', 'menubar', 'menuitem', 'tab', 'tabpanel', 'tablist', 'tree', 'treeitem', 'grid', 'gridcell', 'row', 'rowgroup', 'columnheader', 'rowheader', 'listbox', 'option', 'progressbar', 'slider', 'spinbutton', 'checkbox', 'radio', 'textbox', 'combobox', 'group', 'presentation', 'none'];
                    if (!validRoles.includes(role)) {
                      invalidAria++;
                    }
                  }
                });

                if (invalidAria > 0) {
                  ariaIssues.push({
                    type: 'Invalid ARIA roles',
                    description: 'Elements with invalid or non-standard ARIA roles',
                    count: invalidAria
                  });
                }

                // Check for keyboard navigation issues
                const interactiveElements = document.querySelectorAll('a, button, input, select, textarea, [tabindex]');
                let keyboardIssueCount = 0;
                
                interactiveElements.forEach(el => {
                  const tabindex = el.getAttribute('tabindex');
                  if (tabindex && parseInt(tabindex) > 0) {
                    keyboardIssueCount++;
                  }
                });

                if (keyboardIssueCount > 0) {
                  keyboardIssues.push({
                    type: 'Positive tabindex',
                    description: 'Elements with positive tabindex values (disrupts natural tab order)',
                    count: keyboardIssueCount
                  });
                }

                // Check for focus indicators
                const clickableWithoutFocus = Array.from(document.querySelectorAll('a, button')).filter(el => {
                  const style = window.getComputedStyle(el, ':focus');
                  return style.outline === 'none' && style.border === el.style.border;
                }).length;

                if (clickableWithoutFocus > 0) {
                  keyboardIssues.push({
                    type: 'Missing focus indicators',
                    description: 'Interactive elements without visible focus indicators',
                    count: clickableWithoutFocus
                  });
                }

                // Generate screen reader text preview
                const landmarks = document.querySelectorAll('header, nav, main, aside, footer, [role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"]');
                landmarks.forEach(landmark => {
                  const role = landmark.getAttribute('role') || landmark.tagName.toLowerCase();
                  const label = landmark.getAttribute('aria-label') || landmark.getAttribute('aria-labelledby');
                  screenReaderText.push(\`\${role}\${label ? ' - ' + label : ''}\`);
                });

                const totalIssues = wcagIssues.length + contrastIssues.length + ariaIssues.length + keyboardIssues.length;
                
                let wcagLevel = 'AAA';
                if (wcagIssues.some(issue => issue.level === 'A')) wcagLevel = 'fail';
                else if (wcagIssues.some(issue => issue.level === 'AA')) wcagLevel = 'A';
                else if (wcagIssues.some(issue => issue.level === 'AAA')) wcagLevel = 'AA';

                return {
                  wcagIssues,
                  contrastIssues: contrastIssues.slice(0, 10), // Limit to 10
                  ariaIssues,
                  keyboardIssues,
                  totalIssues,
                  wcagLevel,
                  screenReaderText: screenReaderText.slice(0, 20) // Limit to 20
                };
              })(),
            };
          } catch (err) {
            return { error: err.message };
          }
        })();
      `);

      if (data.error) {
        setError(data.error);
      } else {
        setSeoData(data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to analyze SEO");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      analyzeSEO();
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
          <Search size={18} color={theme.colors.accent} />
          <h3
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 600,
              color: theme.colors.textPrimary,
            }}
          >
            SEO Analysis
          </h3>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={analyzeSEO}
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
            Analyzing page SEO...
          </div>
        )}

        {seoData && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Meta Tags */}
            <section>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
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
                  Meta Tags
                </h4>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Title */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: theme.colors.textSecondary }}>Title</span>
                    {seoData.metaTags.hasTitle ? (
                      seoData.metaTags.titleLength >= 50 && seoData.metaTags.titleLength <= 60 ? (
                        <CheckCircle size={14} color="#00E676" />
                      ) : (
                        <AlertTriangle size={14} color="#FFD600" />
                      )
                    ) : (
                      <XCircle size={14} color="#FF1744" />
                    )}
                    <span
                      style={{
                        fontSize: 11,
                        color:
                          seoData.metaTags.titleLength >= 50 && seoData.metaTags.titleLength <= 60
                            ? "#00E676"
                            : seoData.metaTags.titleLength > 0
                            ? "#FFD600"
                            : "#FF1744",
                      }}
                    >
                      {seoData.metaTags.titleLength} chars (optimal: 50-60)
                    </span>
                  </div>
                  <div
                    style={{
                      padding: 8,
                      background: "rgba(255, 255, 255, 0.03)",
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: 4,
                      fontSize: 12,
                      color: theme.colors.textPrimary,
                      wordBreak: "break-word",
                    }}
                  >
                    {seoData.metaTags.title || "(empty)"}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: theme.colors.textSecondary }}>Description</span>
                    {seoData.metaTags.hasDescription ? (
                      seoData.metaTags.descriptionLength >= 150 &&
                      seoData.metaTags.descriptionLength <= 160 ? (
                        <CheckCircle size={14} color="#00E676" />
                      ) : (
                        <AlertTriangle size={14} color="#FFD600" />
                      )
                    ) : (
                      <XCircle size={14} color="#FF1744" />
                    )}
                    <span
                      style={{
                        fontSize: 11,
                        color:
                          seoData.metaTags.descriptionLength >= 150 &&
                          seoData.metaTags.descriptionLength <= 160
                            ? "#00E676"
                            : seoData.metaTags.descriptionLength > 0
                            ? "#FFD600"
                            : "#FF1744",
                      }}
                    >
                      {seoData.metaTags.descriptionLength} chars (optimal: 150-160)
                    </span>
                  </div>
                  <div
                    style={{
                      padding: 8,
                      background: "rgba(255, 255, 255, 0.03)",
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: 4,
                      fontSize: 12,
                      color: theme.colors.textPrimary,
                      wordBreak: "break-word",
                    }}
                  >
                    {seoData.metaTags.description || "(empty)"}
                  </div>
                </div>
              </div>
            </section>

            {/* Headings */}
            <section>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
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
                  Headings Structure
                </h4>
              </div>

              {seoData.headings.hasNoH1 && (
                <div
                  style={{
                    padding: 8,
                    background: "rgba(255, 23, 68, 0.1)",
                    border: "1px solid rgba(255, 23, 68, 0.3)",
                    borderRadius: 4,
                    fontSize: 12,
                    color: "#FF1744",
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <XCircle size={14} />
                  No H1 heading found
                </div>
              )}

              {seoData.headings.hasMultipleH1 && (
                <div
                  style={{
                    padding: 8,
                    background: "rgba(255, 214, 0, 0.1)",
                    border: "1px solid rgba(255, 214, 0, 0.3)",
                    borderRadius: 4,
                    fontSize: 12,
                    color: "#FFD600",
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <AlertTriangle size={14} />
                  Multiple H1 headings found ({seoData.headings.h1.length})
                </div>
              )}

              {seoData.headings.hierarchyIssues.length > 0 && (
                <div
                  style={{
                    padding: 8,
                    background: "rgba(255, 214, 0, 0.1)",
                    border: "1px solid rgba(255, 214, 0, 0.3)",
                    borderRadius: 4,
                    fontSize: 12,
                    color: "#FFD600",
                    marginBottom: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <AlertTriangle size={14} />
                    <strong>Hierarchy Issues:</strong>
                  </div>
                  {seoData.headings.hierarchyIssues.map((issue, idx) => (
                    <div key={idx} style={{ marginLeft: 20, marginTop: 4 }}>
                      • {issue}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {["h1", "h2", "h3", "h4", "h5", "h6"].map((level) => {
                  const headings = seoData.headings[level as keyof typeof seoData.headings] as string[];
                  if (headings.length === 0) return null;

                  return (
                    <div key={level}>
                      <div
                        style={{
                          fontSize: 11,
                          color: theme.colors.textSecondary,
                          marginBottom: 4,
                          textTransform: "uppercase",
                        }}
                      >
                        {level.toUpperCase()} ({headings.length})
                      </div>
                      {headings.map((heading, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: 6,
                            background: "rgba(255, 255, 255, 0.02)",
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: 4,
                            fontSize: 12,
                            color: theme.colors.textPrimary,
                            marginBottom: 4,
                            marginLeft: parseInt(level.substring(1)) * 8,
                          }}
                        >
                          {heading}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Core Web Vitals */}
            <section>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <Zap size={16} color={theme.colors.accent} />
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
                  Core Web Vitals
                </h4>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 8,
                    background: "rgba(255, 255, 255, 0.03)",
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: 4,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 12, color: theme.colors.textPrimary }}>
                      LCP (Largest Contentful Paint)
                    </span>
                    <span style={{ fontSize: 11, color: theme.colors.textSecondary, fontFamily: "monospace" }}>
                      {seoData.coreWebVitals.lcp.value > 0 
                        ? `${(seoData.coreWebVitals.lcp.value / 1000).toFixed(2)}s` 
                        : 'Not measured'}
                    </span>
                  </div>
                  <StatusBadge status={seoData.coreWebVitals.lcp.status} />
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 8,
                    background: "rgba(255, 255, 255, 0.03)",
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: 4,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 12, color: theme.colors.textPrimary }}>
                      CLS (Cumulative Layout Shift)
                    </span>
                    <span style={{ fontSize: 11, color: theme.colors.textSecondary, fontFamily: "monospace" }}>
                      {seoData.coreWebVitals.cls.value.toFixed(3)}
                      {seoData.coreWebVitals.cls.value === 0 && ' (no shifts detected)'}
                    </span>
                  </div>
                  <StatusBadge status={seoData.coreWebVitals.cls.status} />
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 8,
                    background: "rgba(255, 255, 255, 0.03)",
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: 4,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 12, color: theme.colors.textPrimary }}>
                      INP (Interaction to Next Paint)
                    </span>
                    <span style={{ fontSize: 11, color: theme.colors.textSecondary, fontFamily: "monospace" }}>
                      {seoData.coreWebVitals.inp.value > 0 
                        ? `${Math.round(seoData.coreWebVitals.inp.value)}ms` 
                        : 'No interactions yet'}
                    </span>
                  </div>
                  <StatusBadge status={seoData.coreWebVitals.inp.status} />
                </div>
              </div>

              <div
                style={{
                  marginTop: 8,
                  padding: 8,
                  background: "rgba(255, 109, 0, 0.05)",
                  border: "1px solid rgba(255, 109, 0, 0.2)",
                  borderRadius: 4,
                  fontSize: 11,
                  color: theme.colors.textSecondary,
                  lineHeight: 1.5,
                }}
              >
                <strong style={{ color: theme.colors.textPrimary }}>Thresholds:</strong><br/>
                • LCP: Good ≤2.5s, Needs Work ≤4s<br/>
                • CLS: Good ≤0.1, Needs Work ≤0.25 (0 = perfect)<br/>
                • INP: Good ≤200ms, Needs Work ≤500ms<br/>
                <br/>
                <strong style={{ color: theme.colors.textPrimary }}>Note:</strong> INP requires user interactions (clicks, taps, key presses). Interact with the page and refresh to measure.
              </div>
            </section>

            {/* Images */}
            <section>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <ImageIcon size={16} color={theme.colors.accent} />
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
                  Images ({seoData.images.totalImages})
                </h4>
              </div>

              {seoData.images.withoutAlt.length > 0 && (
                <div
                  style={{
                    padding: 8,
                    background: "rgba(255, 214, 0, 0.1)",
                    border: "1px solid rgba(255, 214, 0, 0.3)",
                    borderRadius: 4,
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: "#FFD600",
                      marginBottom: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <AlertTriangle size={14} />
                    <strong>{seoData.images.withoutAlt.length} images without alt text</strong>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
                    {seoData.images.withoutAlt.slice(0, 5).map((img, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: 4,
                          background: "rgba(0, 0, 0, 0.2)",
                          borderRadius: 3,
                          color: theme.colors.textSecondary,
                          wordBreak: "break-all",
                        }}
                      >
                        {img.src}
                      </div>
                    ))}
                    {seoData.images.withoutAlt.length > 5 && (
                      <div style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 4 }}>
                        ... and {seoData.images.withoutAlt.length - 5} more
                      </div>
                    )}
                  </div>
                </div>
              )}

              {seoData.images.withoutAlt.length === 0 && (
                <div
                  style={{
                    padding: 8,
                    background: "rgba(0, 230, 118, 0.1)",
                    border: "1px solid rgba(0, 230, 118, 0.3)",
                    borderRadius: 4,
                    fontSize: 12,
                    color: "#00E676",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <CheckCircle size={14} />
                  All images have alt text
                </div>
              )}
            </section>

            {/* Links */}
            <section>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <LinkIcon size={16} color={theme.colors.accent} />
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
                  Links ({seoData.links.totalLinks})
                </h4>
              </div>

              {seoData.links.unsafeTargetBlank.length > 0 && (
                <div
                  style={{
                    padding: 8,
                    background: "rgba(255, 214, 0, 0.1)",
                    border: "1px solid rgba(255, 214, 0, 0.3)",
                    borderRadius: 4,
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: "#FFD600",
                      marginBottom: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <AlertTriangle size={14} />
                    <strong>
                      {seoData.links.unsafeTargetBlank.length} links with target="_blank" missing
                      rel="noopener"
                    </strong>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
                    {seoData.links.unsafeTargetBlank.slice(0, 3).map((link, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: 4,
                          background: "rgba(0, 0, 0, 0.2)",
                          borderRadius: 3,
                          color: theme.colors.textSecondary,
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{link.text}</div>
                        <div style={{ wordBreak: "break-all", opacity: 0.7 }}>{link.href}</div>
                      </div>
                    ))}
                    {seoData.links.unsafeTargetBlank.length > 3 && (
                      <div style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 4 }}>
                        ... and {seoData.links.unsafeTargetBlank.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )}

              {seoData.links.unsafeTargetBlank.length === 0 && (
                <div
                  style={{
                    padding: 8,
                    background: "rgba(0, 230, 118, 0.1)",
                    border: "1px solid rgba(0, 230, 118, 0.3)",
                    borderRadius: 4,
                    fontSize: 12,
                    color: "#00E676",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <CheckCircle size={14} />
                  All external links are secure
                </div>
              )}
            </section>

            {/* Technical */}
            <section>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
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
                  Technical
                </h4>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <span style={{ fontSize: 11, color: theme.colors.textSecondary }}>Canonical URL</span>
                  <div
                    style={{
                      padding: 6,
                      background: "rgba(255, 255, 255, 0.03)",
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: 4,
                      fontSize: 11,
                      color: theme.colors.textPrimary,
                      marginTop: 4,
                      wordBreak: "break-all",
                    }}
                  >
                    {seoData.technical.canonicalUrl || "(not set)"}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: theme.colors.textSecondary }}>Index Status</span>
                  <div
                    style={{
                      padding: 6,
                      background:
                        seoData.technical.indexStatus === "index"
                          ? "rgba(0, 230, 118, 0.1)"
                          : "rgba(255, 23, 68, 0.1)",
                      border:
                        seoData.technical.indexStatus === "index"
                          ? "1px solid rgba(0, 230, 118, 0.3)"
                          : "1px solid rgba(255, 23, 68, 0.3)",
                      borderRadius: 4,
                      fontSize: 12,
                      color: seoData.technical.indexStatus === "index" ? "#00E676" : "#FF1744",
                      marginTop: 4,
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    {seoData.technical.indexStatus}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: theme.colors.textSecondary }}>Robots.txt</span>
                  <div
                    style={{
                      padding: 6,
                      background: "rgba(255, 255, 255, 0.03)",
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: 4,
                      fontSize: 11,
                      color: theme.colors.textPrimary,
                      marginTop: 4,
                      wordBreak: "break-all",
                    }}
                  >
                    {seoData.technical.robotsTxtUrl}
                  </div>
                </div>
              </div>
            </section>

            {/* Accessibility */}
            <section>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <Accessibility size={16} color={theme.colors.accent} />
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
                  Accessibility (WCAG)
                </h4>
              </div>

              {/* WCAG Compliance Level */}
              <div
                style={{
                  padding: 12,
                  background: seoData.accessibility.wcagLevel === "fail"
                    ? "rgba(255, 23, 68, 0.1)"
                    : seoData.accessibility.wcagLevel === "AAA"
                    ? "rgba(0, 230, 118, 0.1)"
                    : "rgba(255, 214, 0, 0.1)",
                  border: seoData.accessibility.wcagLevel === "fail"
                    ? "1px solid rgba(255, 23, 68, 0.3)"
                    : seoData.accessibility.wcagLevel === "AAA"
                    ? "1px solid rgba(0, 230, 118, 0.3)"
                    : "1px solid rgba(255, 214, 0, 0.3)",
                  borderRadius: 6,
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: theme.colors.textPrimary }}>
                    WCAG Compliance Level
                  </span>
                  <span
                    style={{
                      padding: "4px 12px",
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 700,
                      background: seoData.accessibility.wcagLevel === "fail"
                        ? "rgba(255, 23, 68, 0.2)"
                        : seoData.accessibility.wcagLevel === "AAA"
                        ? "rgba(0, 230, 118, 0.2)"
                        : "rgba(255, 214, 0, 0.2)",
                      color: seoData.accessibility.wcagLevel === "fail"
                        ? "#FF1744"
                        : seoData.accessibility.wcagLevel === "AAA"
                        ? "#00E676"
                        : "#FFD600",
                    }}
                  >
                    {seoData.accessibility.wcagLevel === "fail" ? "FAIL" : seoData.accessibility.wcagLevel}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                  {seoData.accessibility.totalIssues} total issues found
                </div>
              </div>

              {/* WCAG Issues */}
              {seoData.accessibility.wcagIssues.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: theme.colors.textPrimary, marginBottom: 8 }}>
                    WCAG Violations
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {seoData.accessibility.wcagIssues.map((issue, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: 10,
                          background: "rgba(255, 23, 68, 0.05)",
                          border: "1px solid rgba(255, 23, 68, 0.3)",
                          borderRadius: 4,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: 3,
                              fontSize: 10,
                              fontWeight: 700,
                              background: "rgba(255, 23, 68, 0.2)",
                              color: "#FF1744",
                            }}
                          >
                            Level {issue.level}
                          </span>
                          <span style={{ fontSize: 10, color: theme.colors.textSecondary }}>
                            {issue.elements} element{issue.elements > 1 ? 's' : ''}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: theme.colors.textPrimary, marginBottom: 2 }}>
                          {issue.rule}
                        </div>
                        <div style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                          {issue.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contrast Issues */}
              {seoData.accessibility.contrastIssues.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: theme.colors.textPrimary,
                      marginBottom: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Eye size={14} color="#FFD600" />
                    Contrast Ratio Issues ({seoData.accessibility.contrastIssues.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {seoData.accessibility.contrastIssues.map((issue, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: 10,
                          background: "rgba(255, 214, 0, 0.05)",
                          border: "1px solid rgba(255, 214, 0, 0.3)",
                          borderRadius: 4,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <div
                              style={{
                                width: 16,
                                height: 16,
                                background: issue.fg,
                                border: "1px solid rgba(255, 255, 255, 0.2)",
                                borderRadius: 2,
                              }}
                            />
                            <span style={{ fontSize: 10, color: theme.colors.textSecondary }}>on</span>
                            <div
                              style={{
                                width: 16,
                                height: 16,
                                background: issue.bg,
                                border: "1px solid rgba(255, 255, 255, 0.2)",
                                borderRadius: 2,
                              }}
                            />
                          </div>
                          <div style={{ fontSize: 10, color: "#FFD600", fontWeight: 600 }}>
                            {issue.ratio}:1 (need {issue.required}:1)
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: theme.colors.textSecondary,
                            fontStyle: "italic",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          "{issue.text}"
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ARIA Issues */}
              {seoData.accessibility.ariaIssues.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: theme.colors.textPrimary, marginBottom: 8 }}>
                    ARIA Issues
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {seoData.accessibility.ariaIssues.map((issue, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: 8,
                          background: "rgba(255, 255, 255, 0.03)",
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: 4,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: theme.colors.textPrimary }}>
                            {issue.type}
                          </span>
                          <span style={{ fontSize: 10, color: theme.colors.textSecondary }}>
                            {issue.count} found
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: theme.colors.textSecondary, marginTop: 4 }}>
                          {issue.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Keyboard Navigation Issues */}
              {seoData.accessibility.keyboardIssues.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: theme.colors.textPrimary, marginBottom: 8 }}>
                    Keyboard Navigation Issues
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {seoData.accessibility.keyboardIssues.map((issue, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: 8,
                          background: "rgba(255, 255, 255, 0.03)",
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: 4,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: theme.colors.textPrimary }}>
                            {issue.type}
                          </span>
                          <span style={{ fontSize: 10, color: theme.colors.textSecondary }}>
                            {issue.count} found
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: theme.colors.textSecondary, marginTop: 4 }}>
                          {issue.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Screen Reader Preview */}
              {seoData.accessibility.screenReaderText.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: theme.colors.textPrimary, marginBottom: 8 }}>
                    Screen Reader Preview
                  </div>
                  <div
                    style={{
                      padding: 12,
                      background: "rgba(33, 150, 243, 0.05)",
                      border: "1px solid rgba(33, 150, 243, 0.2)",
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8 }}>
                      Page landmarks as announced by screen readers:
                    </div>
                    {seoData.accessibility.screenReaderText.map((text, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "4px 0",
                          fontSize: 11,
                          color: theme.colors.textPrimary,
                          fontFamily: "monospace",
                          borderBottom: idx < seoData.accessibility.screenReaderText.length - 1 ? "1px solid rgba(255, 255, 255, 0.05)" : "none",
                        }}
                      >
                        {idx + 1}. {text}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All clear message */}
              {seoData.accessibility.totalIssues === 0 && (
                <div
                  style={{
                    padding: 16,
                    background: "rgba(0, 230, 118, 0.1)",
                    border: "1px solid rgba(0, 230, 118, 0.3)",
                    borderRadius: 6,
                    textAlign: "center",
                  }}
                >
                  <CheckCircle size={24} color="#00E676" style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#00E676", marginBottom: 4 }}>
                    No accessibility issues detected!
                  </div>
                  <div style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                    This page appears to meet WCAG accessibility guidelines
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
