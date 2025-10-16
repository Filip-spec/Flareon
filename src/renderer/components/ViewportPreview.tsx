import { type ViewportPreset } from "../types/viewport";
import { theme } from "../styles/theme";

interface ViewportPreviewProps {
  viewports: ViewportPreset[];
  selectedViewportId: string;
  onSelect: (viewportId: string) => void;
  onDelete?: (viewportId: string) => void;
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
    transition: "border 0.2s ease, transform 0.2s ease",
    position: "relative" as const
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

const ViewportPreview = ({ viewports, selectedViewportId, onSelect, onDelete }: ViewportPreviewProps) => (
  <div style={styles.container}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <strong>Viewport presets</strong>
      <span style={{ color: theme.colors.textSecondary, fontSize: "11px" }}>Preview breakpoints</span>
    </div>
    <div style={styles.list}>
      {viewports.map((viewport) => {
        const isActive = viewport.id === selectedViewportId;
        const isCustom = viewport.id.startsWith('custom-');
        const widthLabel = typeof viewport.width === "number" ? `${viewport.width}px` : viewport.width;
        const heightLabel = typeof viewport.height === "number" ? `${viewport.height}px` : viewport.height;
        const metaParts = [`${widthLabel} × ${heightLabel}`];
        if (viewport.description) {
          metaParts.push(viewport.description);
        }
        return (
          <div
            key={viewport.id}
            style={{ ...styles.item, ...(isActive ? styles.itemActive : {}) }}
          >
            <button
              type="button"
              onClick={() => onSelect(viewport.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                padding: 0,
                font: 'inherit'
              }}
            >
              <div style={styles.title}>{viewport.label}</div>
              <div style={styles.meta}>
                {metaParts.join(' • ')}
              </div>
            </button>
            {isCustom && onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(viewport.id);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: theme.colors.textSecondary,
                  cursor: 'pointer',
                  padding: '2px',
                  fontSize: '12px',
                  lineHeight: 1,
                  borderRadius: '2px',
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  width: '16px',
                  height: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.color = '#ff6b6b';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = theme.colors.textSecondary;
                }}
                title="Delete custom viewport"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

export default ViewportPreview;
