import { useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, Link as LinkIcon, ExternalLink, AlertCircle } from "lucide-react";
import { theme } from "../styles/theme";
import type { WebviewTag } from "electron";

interface LinkData {
  href: string;
  text: string;
  isInternal: boolean;
  isExternal: boolean;
  isBroken: boolean;
  anchorText: string;
  title: string | null;
  rel: string | null;
  target: string | null;
  domain: string;
  isToxic: boolean;
  toxicReason: string | null;
}

interface InternalLinksData {
  currentUrl: string;
  currentDomain: string;
  totalLinks: number;
  internalLinks: LinkData[];
  externalLinks: LinkData[];
  brokenLinks: LinkData[];
  orphanedPages: string[];
  anchorTextAnalysis: {
    [key: string]: number;
  };
  linkJuice: {
    totalOutbound: number;
    internalOutbound: number;
    externalOutbound: number;
    noFollowCount: number;
    doFollowCount: number;
    percentageInternal: number;
  };
  linkMap: {
    [url: string]: {
      count: number;
      anchors: string[];
    };
  };
  outboundAnalysis: {
    topDomains: Array<{ domain: string; count: number; doFollowCount: number; noFollowCount: number }>;
    domainAuthority: Array<{ domain: string; links: number; estimatedDA: number }>;
    linkQuality: {
      highQuality: number;
      mediumQuality: number;
      lowQuality: number;
      toxic: number;
    };
  };
  toxicLinks: LinkData[];
  backlinkOpportunities: Array<{
    competitor: string;
    opportunities: string[];
    potentialValue: 'high' | 'medium' | 'low';
  }>;
}

interface InternalLinksPanelProps {
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

export default function InternalLinksPanel({ webviewRef, isOpen, onClose }: InternalLinksPanelProps) {
  const [linksData, setLinksData] = useState<InternalLinksData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeLinks = async () => {
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
            const currentDomain = window.location.hostname;
            const origin = window.location.origin;

            // Get all links
            const allLinks = Array.from(document.querySelectorAll('a[href]'));
            
            const linkDataPromises = allLinks.map(async (link) => {
              const href = link.getAttribute('href') || '';
              const text = link.textContent?.trim() || '';
              const title = link.getAttribute('title');
              const rel = link.getAttribute('rel');
              const target = link.getAttribute('target');
              
              // Determine if internal or external
              let fullUrl = '';
              let isInternal = false;
              let isExternal = false;
              let domain = '';
              
              try {
                fullUrl = new URL(href, currentUrl).href;
                domain = new URL(fullUrl).hostname;
                isInternal = domain === currentDomain;
                isExternal = !isInternal && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:');
              } catch (e) {
                // Invalid URL or anchor link
                isInternal = href.startsWith('/') || href.startsWith('#') || !href.includes('://');
              }

              // Check if broken (simplified - would need actual fetch in production)
              let isBroken = false;
              if (isInternal && fullUrl && !href.startsWith('#')) {
                try {
                  const response = await fetch(fullUrl, { method: 'HEAD', mode: 'no-cors' });
                  // Note: no-cors mode won't give us status, so we assume it's ok if no error
                } catch (e) {
                  isBroken = true;
                }
              }

              // Toxic links detection
              let isToxic = false;
              let toxicReason = null;
              
              if (isExternal && domain) {
                const toxicDomains = [
                  'spam', 'casino', 'porn', 'adult', 'gambling', 'pharma', 'cialis', 'viagra',
                  'blackhat', 'linkfarm', 'scam', 'malware', 'virus', 'hack', 'crack'
                ];
                
                const toxicKeywords = [
                  'free-money', 'make-money-fast', 'work-from-home', 'earn-1000-day',
                  'lose-weight-fast', 'buy-now', 'limited-time', 'urgent-offer'
                ];
                
                isToxic = toxicDomains.some(toxic => domain.toLowerCase().includes(toxic)) ||
                          toxicKeywords.some(keyword => href.toLowerCase().includes(keyword) || text.toLowerCase().includes(keyword));
                
                if (isToxic) {
                  toxicReason = toxicDomains.find(toxic => domain.toLowerCase().includes(toxic)) ? 'Suspicious domain' : 'Spam-like content';
                }
              }

              return {
                href: fullUrl || href,
                text,
                isInternal,
                isExternal,
                isBroken,
                anchorText: text,
                title,
                rel,
                target,
                domain,
                isToxic,
                toxicReason,
              };
            });

            const linkData = await Promise.all(linkDataPromises);

            // Separate internal and external
            const internalLinks = linkData.filter(l => l.isInternal);
            const externalLinks = linkData.filter(l => l.isExternal);
            const brokenLinks = linkData.filter(l => l.isBroken);
            const toxicLinks = linkData.filter(l => l.isToxic);

            // Anchor text analysis
            const anchorTextAnalysis = {};
            linkData.forEach(link => {
              if (link.anchorText) {
                anchorTextAnalysis[link.anchorText] = (anchorTextAnalysis[link.anchorText] || 0) + 1;
              }
            });

            // Link juice calculation
            const noFollowCount = linkData.filter(l => l.rel && l.rel.includes('nofollow')).length;
            const doFollowCount = linkData.length - noFollowCount;
            const percentageInternal = linkData.length > 0 
              ? Math.round((internalLinks.length / linkData.length) * 100) 
              : 0;

            // Link map - count occurrences of each URL
            const linkMap = {};
            internalLinks.forEach(link => {
              if (!linkMap[link.href]) {
                linkMap[link.href] = {
                  count: 0,
                  anchors: [],
                };
              }
              linkMap[link.href].count++;
              if (link.anchorText && !linkMap[link.href].anchors.includes(link.anchorText)) {
                linkMap[link.href].anchors.push(link.anchorText);
              }
            });

            // Orphaned pages detection (simplified - check if any internal links point to pages with no backlinks)
            // In a real implementation, this would require crawling the entire site
            const orphanedPages = [];
            const linkedPages = new Set(internalLinks.map(l => l.href));
            // Check if current page is linked from anywhere (simplified check)
            if (document.referrer && !linkedPages.has(document.referrer)) {
              orphanedPages.push(document.referrer);
            }

            // Outbound links analysis
            const domainStats = {};
            externalLinks.forEach(link => {
              if (!domainStats[link.domain]) {
                domainStats[link.domain] = {
                  count: 0,
                  doFollowCount: 0,
                  noFollowCount: 0,
                };
              }
              domainStats[link.domain].count++;
              if (link.rel && link.rel.includes('nofollow')) {
                domainStats[link.domain].noFollowCount++;
              } else {
                domainStats[link.domain].doFollowCount++;
              }
            });

            const topDomains = Object.entries(domainStats)
              .map(([domain, stats]) => ({ domain, ...stats }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 10);

            // Domain Authority estimation (simplified)
            const domainAuthority = topDomains.map(({ domain, count }) => {
              // Simple DA estimation based on domain patterns
              let estimatedDA = 20; // Base score
              
              if (domain.includes('.edu') || domain.includes('.gov')) estimatedDA += 40;
              if (domain.includes('.org')) estimatedDA += 20;
              if (domain.includes('wikipedia.org')) estimatedDA += 50;
              if (domain.includes('github.com') || domain.includes('stackoverflow.com')) estimatedDA += 30;
              if (domain.length < 15) estimatedDA += 10; // Shorter domains often have higher DA
              
              // Adjust based on link count
              estimatedDA += Math.min(count * 2, 20);
              
              return { domain, links: count, estimatedDA: Math.min(estimatedDA, 100) };
            });

            // Link quality analysis
            const linkQuality = {
              highQuality: externalLinks.filter(link => {
                const domain = link.domain.toLowerCase();
                return domain.includes('.edu') || domain.includes('.gov') || 
                       domain.includes('wikipedia.org') || domain.includes('github.com') ||
                       domain.includes('stackoverflow.com');
              }).length,
              mediumQuality: externalLinks.filter(link => {
                const domain = link.domain.toLowerCase();
                return !domain.includes('.edu') && !domain.includes('.gov') && 
                       !domain.includes('wikipedia.org') && !domain.includes('github.com') &&
                       !domain.includes('stackoverflow.com') && !link.isToxic;
              }).length,
              lowQuality: externalLinks.filter(link => {
                const domain = link.domain.toLowerCase();
                return domain.includes('.blogspot') || domain.includes('.wordpress.com') ||
                       domain.includes('medium.com') || link.isToxic;
              }).length,
              toxic: toxicLinks.length,
            };

            // Backlink opportunities (competitive analysis)
            // This is a simplified version - in reality would require competitor research
            const backlinkOpportunities = [];
            
            // Find competitors based on similar domains or common patterns
            const competitors = [
              currentDomain.replace('www.', '').replace('.com', '.net'),
              currentDomain.replace('www.', '').replace('.com', '.org'),
              currentDomain.replace('www.', '').replace('.com', '.io'),
            ].filter(comp => comp !== currentDomain);

            competitors.forEach(competitor => {
              const opportunities = [];
              const niche = currentDomain.split('.')[0];
              
              // Generate potential backlink opportunities
              opportunities.push('Guest post on ' + competitor);
              opportunities.push('Industry partnership with ' + competitor);
              opportunities.push('Cross-promotion with ' + competitor);
              opportunities.push('Resource page mention on ' + competitor);
              
              backlinkOpportunities.push({
                competitor,
                opportunities,
                potentialValue: 'medium',
              });
            });

            return {
              currentUrl,
              currentDomain,
              totalLinks: linkData.length,
              internalLinks,
              externalLinks,
              brokenLinks,
              orphanedPages,
              anchorTextAnalysis,
              linkJuice: {
                totalOutbound: linkData.length,
                internalOutbound: internalLinks.length,
                externalOutbound: externalLinks.length,
                noFollowCount,
                doFollowCount,
                percentageInternal,
              },
              linkMap,
              outboundAnalysis: {
                topDomains,
                domainAuthority,
                linkQuality,
              },
              toxicLinks,
              backlinkOpportunities,
            };
          } catch (err) {
            return { error: err.message };
          }
        })();
      `);

      if (data.error) {
        setError(data.error);
      } else {
        setLinksData(data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to analyze links");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      analyzeLinks();
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
          <LinkIcon size={20} color={theme.colors.accent} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: theme.colors.textPrimary }}>
            Internal Links Analysis
          </h3>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={analyzeLinks}
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

        {loading && !linksData && (
          <div style={{ textAlign: "center", padding: 40, color: theme.colors.textSecondary }}>
            Analyzing links...
          </div>
        )}

        {linksData && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Overview */}
            <section>
              <h4
                style={{
                  margin: "0 0 12px 0",
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.colors.accent,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Overview
              </h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    padding: 12,
                    background: "rgba(255, 255, 255, 0.03)",
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: 6,
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 700, color: theme.colors.accent }}>
                    {linksData.totalLinks}
                  </div>
                  <div style={{ fontSize: 11, color: theme.colors.textSecondary }}>Total Links</div>
                </div>
                <div
                  style={{
                    padding: 12,
                    background: "rgba(255, 255, 255, 0.03)",
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: 6,
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#00E676" }}>
                    {linksData.internalLinks.length}
                  </div>
                  <div style={{ fontSize: 11, color: theme.colors.textSecondary }}>Internal Links</div>
                </div>
                <div
                  style={{
                    padding: 12,
                    background: "rgba(255, 255, 255, 0.03)",
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: 6,
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#00B0FF" }}>
                    {linksData.externalLinks.length}
                  </div>
                  <div style={{ fontSize: 11, color: theme.colors.textSecondary }}>External Links</div>
                </div>
                <div
                  style={{
                    padding: 12,
                    background: "rgba(255, 255, 255, 0.03)",
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: 6,
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 700, color: linksData.brokenLinks.length > 0 ? "#FF1744" : "#00E676" }}>
                    {linksData.brokenLinks.length}
                  </div>
                  <div style={{ fontSize: 11, color: theme.colors.textSecondary }}>Broken Links</div>
                </div>
              </div>
            </section>

            {/* Link Juice Flow */}
            <section>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <h4
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.colors.accent,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Link Juice Flow
                </h4>
                <StatusIcon
                  status={
                    linksData.linkJuice.percentageInternal >= 70
                      ? "success"
                      : linksData.linkJuice.percentageInternal >= 50
                      ? "warning"
                      : "error"
                  }
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div
                  style={{
                    padding: 12,
                    background: "rgba(255, 255, 255, 0.03)",
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: 6,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: theme.colors.textSecondary }}>Internal Links</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: theme.colors.textPrimary }}>
                      {linksData.linkJuice.percentageInternal}%
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: 8,
                      background: "rgba(255, 255, 255, 0.1)",
                      borderRadius: 4,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${linksData.linkJuice.percentageInternal}%`,
                        height: "100%",
                        background: linksData.linkJuice.percentageInternal >= 70 ? "#00E676" : "#FFD600",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <div
                    style={{
                      flex: 1,
                      padding: 8,
                      background: "rgba(0, 230, 118, 0.1)",
                      border: "1px solid rgba(0, 230, 118, 0.3)",
                      borderRadius: 4,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#00E676" }}>
                      {linksData.linkJuice.doFollowCount}
                    </div>
                    <div style={{ fontSize: 10, color: theme.colors.textSecondary }}>DoFollow</div>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      padding: 8,
                      background: "rgba(255, 214, 0, 0.1)",
                      border: "1px solid rgba(255, 214, 0, 0.3)",
                      borderRadius: 4,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#FFD600" }}>
                      {linksData.linkJuice.noFollowCount}
                    </div>
                    <div style={{ fontSize: 10, color: theme.colors.textSecondary }}>NoFollow</div>
                  </div>
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
                }}
              >
                <strong style={{ color: theme.colors.textPrimary }}>Best Practice:</strong> Aim for 70%+ internal links
                to keep users on your site and distribute link equity effectively.
              </div>
            </section>

            {/* Link Map */}
            <section>
              <h4
                style={{
                  margin: "0 0 12px 0",
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.colors.accent,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Internal Link Map ({Object.keys(linksData.linkMap).length} unique pages)
              </h4>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
                {Object.entries(linksData.linkMap)
                  .sort(([, a], [, b]) => b.count - a.count)
                  .slice(0, 10)
                  .map(([url, data]) => (
                    <div
                      key={url}
                      style={{
                        padding: 8,
                        background: "rgba(255, 255, 255, 0.03)",
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: 4,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 4 }}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 11,
                            color: theme.colors.accent,
                            textDecoration: "none",
                            flex: 1,
                            wordBreak: "break-all",
                          }}
                        >
                          {url.replace(linksData.currentUrl, '').replace(linksData.currentDomain, '') || '/'}
                        </a>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: theme.colors.textPrimary,
                            background: "rgba(255, 109, 0, 0.2)",
                            padding: "2px 6px",
                            borderRadius: 3,
                            marginLeft: 8,
                          }}
                        >
                          {data.count}×
                        </span>
                      </div>
                      {data.anchors.length > 0 && (
                        <div style={{ fontSize: 10, color: theme.colors.textSecondary }}>
                          Anchors: {data.anchors.slice(0, 3).join(", ")}
                          {data.anchors.length > 3 && ` +${data.anchors.length - 3} more`}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </section>

            {/* Broken Links */}
            {linksData.brokenLinks.length > 0 && (
              <section>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <XCircle size={16} color="#FF1744" />
                  <h4
                    style={{
                      margin: 0,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#FF1744",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Broken Links ({linksData.brokenLinks.length})
                  </h4>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {linksData.brokenLinks.slice(0, 5).map((link, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 8,
                        background: "rgba(255, 23, 68, 0.1)",
                        border: "1px solid rgba(255, 23, 68, 0.3)",
                        borderRadius: 4,
                      }}
                    >
                      <div style={{ fontSize: 11, color: "#FF1744", marginBottom: 2 }}>
                        {link.href}
                      </div>
                      {link.anchorText && (
                        <div style={{ fontSize: 10, color: theme.colors.textSecondary }}>
                          Anchor: "{link.anchorText}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Anchor Text Analysis */}
            <section>
              <h4
                style={{
                  margin: "0 0 12px 0",
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.colors.accent,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Top Anchor Texts
              </h4>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Object.entries(linksData.anchorTextAnalysis)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 10)
                  .map(([text, count]) => (
                    <div
                      key={text}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 8px",
                        background: "rgba(255, 255, 255, 0.03)",
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          color: theme.colors.textPrimary,
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {text || "(empty)"}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: theme.colors.accent,
                          marginLeft: 8,
                        }}
                      >
                        {count}×
                      </span>
                    </div>
                  ))}
              </div>
            </section>

            {/* Orphaned Pages */}
            {linksData.orphanedPages.length > 0 && (
              <section>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <AlertCircle size={16} color="#FFD600" />
                  <h4
                    style={{
                      margin: 0,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#FFD600",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Potential Orphaned Pages
                  </h4>
                </div>

                <div
                  style={{
                    padding: 12,
                    background: "rgba(255, 214, 0, 0.1)",
                    border: "1px solid rgba(255, 214, 0, 0.3)",
                    borderRadius: 6,
                    fontSize: 11,
                    color: theme.colors.textSecondary,
                  }}
                >
                  <div style={{ marginBottom: 8, color: theme.colors.textPrimary }}>
                    Orphaned pages have no internal links pointing to them, making them hard to discover.
                  </div>
                  {linksData.orphanedPages.map((page, idx) => (
                    <div key={idx} style={{ color: "#FFD600", marginTop: 4 }}>
                      • {page}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Outbound Links Analysis */}
            <section>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <ExternalLink size={16} color={theme.colors.accent} />
                <h4
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.colors.accent,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Outbound Links Analysis
                </h4>
              </div>

              {/* Link Quality Overview */}
              <div style={{ marginBottom: 16 }}>
                <h5 style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>
                  Link Quality Distribution
                </h5>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1, textAlign: "center", padding: 8, background: "rgba(0, 230, 118, 0.1)", border: "1px solid rgba(0, 230, 118, 0.3)", borderRadius: 4 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#00E676" }}>{linksData.outboundAnalysis.linkQuality.highQuality}</div>
                    <div style={{ fontSize: 9, color: theme.colors.textSecondary }}>High Quality</div>
                  </div>
                  <div style={{ flex: 1, textAlign: "center", padding: 8, background: "rgba(255, 214, 0, 0.1)", border: "1px solid rgba(255, 214, 0, 0.3)", borderRadius: 4 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#FFD600" }}>{linksData.outboundAnalysis.linkQuality.mediumQuality}</div>
                    <div style={{ fontSize: 9, color: theme.colors.textSecondary }}>Medium Quality</div>
                  </div>
                  <div style={{ flex: 1, textAlign: "center", padding: 8, background: "rgba(255, 109, 0, 0.1)", border: "1px solid rgba(255, 109, 0, 0.3)", borderRadius: 4 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#FF6D00" }}>{linksData.outboundAnalysis.linkQuality.lowQuality}</div>
                    <div style={{ fontSize: 9, color: theme.colors.textSecondary }}>Low Quality</div>
                  </div>
                  <div style={{ flex: 1, textAlign: "center", padding: 8, background: "rgba(255, 23, 68, 0.1)", border: "1px solid rgba(255, 23, 68, 0.3)", borderRadius: 4 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#FF1744" }}>{linksData.outboundAnalysis.linkQuality.toxic}</div>
                    <div style={{ fontSize: 9, color: theme.colors.textSecondary }}>Toxic</div>
                  </div>
                </div>
              </div>

              {/* Top Domains */}
              <div>
                <h5 style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>
                  Top External Domains ({linksData.outboundAnalysis.topDomains.length})
                </h5>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
                  {linksData.outboundAnalysis.topDomains.map((domain, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 8,
                        background: "rgba(255, 255, 255, 0.03)",
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: 4,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: theme.colors.accent, fontWeight: 600 }}>
                          {domain.domain}
                        </span>
                        <span style={{ fontSize: 11, color: theme.colors.textPrimary, background: "rgba(255, 109, 0, 0.2)", padding: "2px 6px", borderRadius: 3 }}>
                          {domain.count} links
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 12, fontSize: 10, color: theme.colors.textSecondary }}>
                        <span>DoFollow: {domain.doFollowCount}</span>
                        <span>NoFollow: {domain.noFollowCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Toxic Links Detector */}
            {linksData.toxicLinks.length > 0 && (
              <section>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <XCircle size={16} color="#FF1744" />
                  <h4
                    style={{
                      margin: 0,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#FF1744",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Toxic Links Detected ({linksData.toxicLinks.length})
                  </h4>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {linksData.toxicLinks.slice(0, 5).map((link, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 8,
                        background: "rgba(255, 23, 68, 0.1)",
                        border: "1px solid rgba(255, 23, 68, 0.3)",
                        borderRadius: 4,
                      }}
                    >
                      <div style={{ fontSize: 11, color: "#FF1744", marginBottom: 2 }}>
                        {link.href}
                      </div>
                      <div style={{ fontSize: 10, color: theme.colors.textSecondary, marginBottom: 2 }}>
                        Reason: {link.toxicReason}
                      </div>
                      {link.anchorText && (
                        <div style={{ fontSize: 10, color: theme.colors.textSecondary }}>
                          Anchor: "{link.anchorText}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    marginTop: 8,
                    padding: 8,
                    background: "rgba(255, 23, 68, 0.05)",
                    border: "1px solid rgba(255, 23, 68, 0.2)",
                    borderRadius: 4,
                    fontSize: 10,
                    color: theme.colors.textSecondary,
                  }}
                >
                  <strong style={{ color: "#FF1744" }}>Warning:</strong> Toxic links can harm your SEO. Consider removing or adding rel="nofollow" to these links.
                </div>
              </section>
            )}

            {/* Backlink Opportunities */}
            <section>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <LinkIcon size={16} color={theme.colors.accent} />
                <h4
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.colors.accent,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Backlink Opportunities
                </h4>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {linksData.backlinkOpportunities.map((opportunity, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 12,
                      background: "rgba(255, 255, 255, 0.03)",
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: theme.colors.accent, fontWeight: 600 }}>
                        {opportunity.competitor}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: opportunity.potentialValue === 'high' ? '#00E676' : opportunity.potentialValue === 'medium' ? '#FFD600' : '#FF6D00',
                          background: opportunity.potentialValue === 'high' ? 'rgba(0, 230, 118, 0.1)' : opportunity.potentialValue === 'medium' ? 'rgba(255, 214, 0, 0.1)' : 'rgba(255, 109, 0, 0.1)',
                          padding: "2px 6px",
                          borderRadius: 3,
                          textTransform: "uppercase",
                        }}
                      >
                        {opportunity.potentialValue} value
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {opportunity.opportunities.map((opp, oppIdx) => (
                        <div key={oppIdx} style={{ fontSize: 11, color: theme.colors.textSecondary, paddingLeft: 8, borderLeft: "2px solid rgba(255, 109, 0, 0.3)" }}>
                          • {opp}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: 8,
                  padding: 8,
                  background: "rgba(255, 109, 0, 0.05)",
                  border: "1px solid rgba(255, 109, 0, 0.2)",
                  borderRadius: 4,
                  fontSize: 10,
                  color: theme.colors.textSecondary,
                }}
              >
                <strong style={{ color: theme.colors.textPrimary }}>Pro Tip:</strong> Focus on high-authority domains in your niche for the best backlink opportunities.
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
