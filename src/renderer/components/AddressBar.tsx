import { type ChangeEvent, type FormEvent } from "react";
import { theme } from "../styles/theme";
import { RotateCw } from "lucide-react";

interface AddressBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onRefresh?: () => void;
  placeholder?: string;
}

const styles = {
  form: {
    display: "flex",
    alignItems: "center",
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: "8px",
    border: `1px solid ${theme.colors.border}`,
    overflow: "hidden",
    transition: "all 0.2s ease"
  },
  input: {
    flex: 1,
    background: "transparent",
    border: "none",
    padding: "9px 14px",
    color: theme.colors.textPrimary,
    fontSize: "13px",
    outline: "none"
  },
  button: {
    padding: "8px 14px",
    border: "none",
    background: theme.colors.accent,
    color: "#000",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "12px",
    transition: "background 0.2s ease",
    display: 'none'
  }
} as const;

const AddressBar = ({ value, onChange, onSubmit, onRefresh, placeholder }: AddressBarProps) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form 
      style={styles.form} 
      onSubmit={handleSubmit} 
      role="search"
      onFocus={(e) => {
        e.currentTarget.style.border = `1px solid ${theme.colors.accent}`;
        e.currentTarget.style.backgroundColor = "rgba(255, 109, 0, 0.06)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.border = `1px solid ${theme.colors.border}`;
        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.03)";
      }}
    >
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          style={{
            background: 'transparent',
            border: 'none',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            transition: 'color 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = theme.colors.accent;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = theme.colors.textSecondary;
          }}
          title="Refresh page"
        >
          <RotateCw size={16} />
        </button>
      )}
      <input
        style={styles.input}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label="Address bar"
        // pressing Enter will submit the form
      />
    </form>
  );
};

export default AddressBar;
