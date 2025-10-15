import { Camera } from "lucide-react";
import { theme } from "../styles/theme";

interface ScreenshotButtonProps {
  onCapture: () => void;
  loading?: boolean;
}

const styles = {
  button: {
    background: "transparent",
    border: "none",
    color: theme.colors.textSecondary,
    cursor: "pointer",
    padding: "8px",
    borderRadius: "4px",
    transition: "all 0.2s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  loading: {
    opacity: 0.6,
    cursor: "progress"
  }
} as const;

const ScreenshotButton = ({ onCapture, loading = false }: ScreenshotButtonProps) => (
  <button
    type="button"
    onClick={onCapture}
    disabled={loading}
    style={{ ...styles.button, ...(loading ? styles.loading : {}) }}
    title="Capture screenshot"
  >
    <Camera size={20} />
  </button>
);

export default ScreenshotButton;
