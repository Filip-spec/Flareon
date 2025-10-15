import { type ViewportPreset } from "../types/viewport";
import { theme } from "../styles/theme";

interface ViewportPreviewProps {
  viewports: ViewportPreset[];
  selectedViewportId: string;
  onSelect: (viewportId: string) => void;
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px"
  },
  list: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
    gap: "8px"
  },
  item: {
    border: `1px solid ${theme.colors.border}`,
    borderRadius: "8px",
    padding: "10px",
    background: "rgba(255, 255, 255, 0.02)",
    color: theme.colors.textSecondary,
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "border 0.2s ease, transform 0.2s ease"
  },
  itemActive: {
    border: `1px solid ${theme.colors.accent}`,
    color: theme.colors.textPrimary,
    transform: "translateY(-1px)"
  },
  title: {
    fontSize: "12px",
    fontWeight: 600
  },
  meta: {
    fontSize: "11px",
    color: theme.colors.textSecondary
  }
} as const;

const ViewportPreview = ({ viewports, selectedViewportId, onSelect }: ViewportPreviewProps) => (
  <div style={styles.container}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <strong>Viewport presets</strong>
      <span style={{ color: theme.colors.textSecondary, fontSize: "11px" }}>Preview breakpoints</span>
    </div>
    <div style={styles.list}>
      {viewports.map((viewport) => {
        const isActive = viewport.id === selectedViewportId;
        const widthLabel = typeof viewport.width === "number" ? `${viewport.width}px` : viewport.width;
        const heightLabel = typeof viewport.height === "number" ? `${viewport.height}px` : viewport.height;
        return (
          <button
            key={viewport.id}
            type="button"
            style={{ ...styles.item, ...(isActive ? styles.itemActive : {}) }}
            onClick={() => onSelect(viewport.id)}
          >
            <div style={styles.title}>{viewport.label}</div>
            <div style={styles.meta}>
              {widthLabel} × {heightLabel}
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

export default ViewportPreview;
