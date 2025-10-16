import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare global {
  interface Window {
    electronAPI: {
      captureViewport: (options: { 
        webContentsId: number; 
        rect?: { x: number; y: number; width: number; height: number };
        format?: 'png' | 'jpeg' | 'webp';
        quality?: number;
        namePrefix?: string;
        includeTimestamp?: boolean;
      }) => Promise<string | null>;
      saveScreenshot: (buffer: Uint8Array) => Promise<string | null>;
      toggleDevTools: () => Promise<void>;
      toggleWebviewDevTools: () => Promise<{ success: boolean; message: string }>;
      onAppFocus: (listener: () => void) => () => void;
    };
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
        src?: string;
        allowpopups?: boolean;
      };
    }
  }
}

export {};
