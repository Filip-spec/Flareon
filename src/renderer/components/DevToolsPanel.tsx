import ViewportPreview from "./ViewportPreview";
import { theme } from "../styles/theme";
import type { ViewportPreset } from "../types/viewport";

interface DevToolsPanelProps {
  activeUrl: string;
  history: string[];
  viewports: ViewportPreset[];
  selectedViewportId: string;
  onViewportSelect: (viewportId: string) => void;
}

const analysisSections = [
  {
    title: "SEO",
    description: "Meta tags, headings, canonical and robots diagnostics."
  },
  {
    title: "WCAG",
    description: "Accessibility checks including contrast and ARIA usage."
  },
  {
    title: "Schema.org",
    description: "Structured data validation for rich results."
  },
  {
    title: "Open Graph",
    description: "Social previews for OG and Twitter cards."
  },
  {
    title: "Color",
    description: "Palette extraction and contrast ratios."
  }
] as const;

const styles = {
  panel: {
    background: "linear-gradient(180deg, rgba(20,20,20,0.95) 0%, rgba(15,15,15,0.98) 100%)",
    borderLeft: `1px solid ${theme.colors.border}`,
    padding: "20px 18px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "20px"
  },
  header: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px"
  },
  label: {
    fontSize: "12px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: theme.colors.textSecondary
  },
  url: {
    fontSize: "13px",
    color: theme.colors.textPrimary,
    overflowWrap: "anywhere" as const
  },
  sectionList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px"
  },
  card: {
    border: `1px solid ${theme.colors.border}`,
    borderRadius: "10px",
    padding: "12px",
    background: "rgba(255, 255, 255, 0.03)"
  },
  cardTitle: {
    fontSize: "13px",
    fontWeight: 600,
    marginBottom: "4px"
  },
  cardDescription: {
    fontSize: "12px",
    color: theme.colors.textSecondary,
    lineHeight: 1.4
  },
  history: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px"
  },
  historyItem: {
    fontSize: "11px",
    color: theme.colors.textSecondary
  }
} as const;

const DevToolsPanel = ({
  activeUrl,
  history,
  viewports,
  selectedViewportId,
  onViewportSelect
}: DevToolsPanelProps) => (
  <aside style={styles.panel}>
    <div style={styles.header}>
      <span style={styles.label}>Inspecting</span>
      <span style={styles.url}>{activeUrl || "No page loaded"}</span>
    </div>

    <section>
      <h3 style={{ margin: "0 0 8px", fontSize: "14px" }}>Automation suite</h3>
      <div style={styles.sectionList}>
        {analysisSections.map((section) => (
          <div key={section.title} style={styles.card}>
            <div style={styles.cardTitle}>{section.title}</div>
            <p style={styles.cardDescription}>{section.description}</p>
            <span style={{ fontSize: "11px", color: theme.colors.hover }}>Pending • Hook up analyzers</span>
          </div>
        ))}
      </div>
    </section>

    <section>
      <ViewportPreview
        viewports={viewports}
        selectedViewportId={selectedViewportId}
        onSelect={onViewportSelect}
      />
    </section>

    <section>
      <h3 style={{ margin: "0 0 8px", fontSize: "14px" }}>Recent history</h3>
      <div style={styles.history}>
        {history.length === 0 ? (
          <span style={styles.historyItem}>History will appear after your first navigation.</span>
        ) : (
          history.slice(0, 5).map((item) => (
            <span key={item} style={styles.historyItem}>
              {item}
            </span>
          ))
        )}
      </div>
    </section>
  </aside>
);

export default DevToolsPanel;
