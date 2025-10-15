import { type MouseEvent } from "react";
import { theme } from "../styles/theme";

export interface BrowserTab {
  id: string;
  title: string;
  url: string;
}

interface TabManagerProps {
  tabs: BrowserTab[];
  activeTabId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: () => void;
}

const styles = {
  container: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    overflowX: "auto" as const
  },
  tab: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 8px",
    borderRadius: "6px",
    border: `1px solid ${theme.colors.border}`,
    background: "rgba(255, 255, 255, 0.03)",
    color: theme.colors.textSecondary,
    transition: "all 0.2s ease",
    whiteSpace: "nowrap" as const
  },
  tabActive: {
    color: theme.colors.textPrimary,
    border: `1px solid ${theme.colors.accent}`,
    background: "rgba(255, 109, 0, 0.12)"
  },
  tabButton: {
    border: "none",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 600,
    padding: "0 4px"
  },
  closeButton: {
    border: "none",
    background: "transparent",
    color: theme.colors.textSecondary,
    cursor: "pointer",
    fontSize: "12px",
    padding: "0 4px"
  },
  addButton: {
    minWidth: "28px",
    height: "28px",
    borderRadius: "6px",
    border: `1px dashed ${theme.colors.border}`,
    background: "transparent",
    color: theme.colors.textSecondary,
    cursor: "pointer"
  }
} as const;

const TabManager = ({ tabs, activeTabId, onSelect, onClose, onAdd }: TabManagerProps) => (
  <div style={styles.container}>
    {tabs.map((tab) => {
      const isActive = tab.id === activeTabId;
      return (
        <div
          key={tab.id}
          style={{ ...styles.tab, ...(isActive ? styles.tabActive : {}) }}
        >
          <button
            type="button"
            style={styles.tabButton}
            onClick={() => onSelect(tab.id)}
          >
            {tab.title}
          </button>
          {tabs.length > 1 && (
            <button
              type="button"
              style={styles.closeButton}
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation();
                onClose(tab.id);
              }}
              aria-label={`Close ${tab.title}`}
            >
              ×
            </button>
          )}
        </div>
      );
    })}
    <button type="button" style={styles.addButton} onClick={onAdd} aria-label="New tab">
      +
    </button>
  </div>
);

export default TabManager;
