export const theme = {
  colors: {
    background: "#1E1E1E",
    accent: "#FF6D00",
    textPrimary: "#E0E0E0",
    textSecondary: "#A0A0A0",
    border: "#333333",
    hover: "#FF8C42",
    link: "#FFA726"
  },
  font: "'Source Code Pro', monospace"
} as const;

export type Theme = typeof theme;
