import { type ChangeEvent, type FormEvent, useState, useRef, useEffect } from "react";
import { theme } from "../styles/theme";
import { RotateCw, Undo2, Redo2 } from "lucide-react";

interface AddressBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void | Promise<void>;
  onRefresh?: () => void;
  placeholder?: string;
  style?: React.CSSProperties;
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

const AddressBar = ({ value, onChange, onSubmit, onRefresh, placeholder, style }: AddressBarProps) => {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSubmittedValue = useRef<string>('');
  const isUserTypingRef = useRef(false);

  // Add to history only when value changes from outside (new page navigation)
  useEffect(() => {
    const normalized = value?.trim();
    if (!normalized) {
      isUserTypingRef.current = false;
      return;
    }

    if (isUserTypingRef.current) {
      // Skip history updates while user is actively editing the input field
      isUserTypingRef.current = false;
      return;
    }

    if (normalized === lastSubmittedValue.current || normalized.startsWith('http://localhost')) {
      return;
    }

    setHistory((prev) => {
      if (prev.length > 0 && prev[prev.length - 1] === normalized) {
        return prev;
      }

      const nextHistory = [...prev, normalized].slice(-50);
      setHistoryIndex(nextHistory.length - 1);
      lastSubmittedValue.current = normalized;
      return nextHistory;
    });
  }, [value]);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    isUserTypingRef.current = true;
    onChange(event.target.value);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const newValue = history[newIndex];
      lastSubmittedValue.current = newValue;
      onChange(newValue);
      onSubmit(newValue);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const newValue = history[newIndex];
      lastSubmittedValue.current = newValue;
      onChange(newValue);
      onSubmit(newValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Cmd+Z / Ctrl+Z for undo (back)
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
    }
    // Cmd+Shift+Z / Ctrl+Shift+Z or Cmd+Y / Ctrl+Y for redo (forward)
    else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      handleRedo();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    isUserTypingRef.current = false;

    const normalized = value?.trim();

    // Add current value to history when submitting
    if (normalized && normalized !== lastSubmittedValue.current) {
      setHistory((prev) => {
        const trimmedHistory = prev.slice(0, historyIndex + 1);
        const nextHistory = [...trimmedHistory, normalized].slice(-50);
        setHistoryIndex(nextHistory.length - 1);
        lastSubmittedValue.current = normalized;
        return nextHistory;
      });
    } else if (normalized) {
      lastSubmittedValue.current = normalized;
    }
    
    const submitTarget = normalized || value;
    if (submitTarget) {
      onSubmit(submitTarget);
    }
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <form 
      style={{ ...styles.form, ...style }} 
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
        ref={inputRef}
        style={styles.input}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="Address bar"
        // pressing Enter will submit the form
      />
      
      {/* Undo/Redo buttons */}
      <div style={{ display: 'flex', gap: 4, paddingRight: 8 }}>
        <button
          type="button"
          onClick={handleUndo}
          disabled={!canUndo}
          style={{
            background: 'transparent',
            border: 'none',
            color: canUndo ? theme.colors.textSecondary : 'rgba(255, 255, 255, 0.2)',
            cursor: canUndo ? 'pointer' : 'not-allowed',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            transition: 'color 0.2s ease',
            opacity: canUndo ? 1 : 0.4
          }}
          onMouseEnter={(e) => {
            if (canUndo) e.currentTarget.style.color = theme.colors.accent;
          }}
          onMouseLeave={(e) => {
            if (canUndo) e.currentTarget.style.color = theme.colors.textSecondary;
          }}
          title="Undo (Cmd+Z)"
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          onClick={handleRedo}
          disabled={!canRedo}
          style={{
            background: 'transparent',
            border: 'none',
            color: canRedo ? theme.colors.textSecondary : 'rgba(255, 255, 255, 0.2)',
            cursor: canRedo ? 'pointer' : 'not-allowed',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            transition: 'color 0.2s ease',
            opacity: canRedo ? 1 : 0.4
          }}
          onMouseEnter={(e) => {
            if (canRedo) e.currentTarget.style.color = theme.colors.accent;
          }}
          onMouseLeave={(e) => {
            if (canRedo) e.currentTarget.style.color = theme.colors.textSecondary;
          }}
          title="Redo (Cmd+Shift+Z)"
        >
          <Redo2 size={14} />
        </button>
      </div>
    </form>
  );
};

export default AddressBar;
