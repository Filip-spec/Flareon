import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare global {
  interface Window {
    electronAPI: {
      captureViewport: () => Promise<string | null>;
      toggleDevTools: () => Promise<void>;
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
