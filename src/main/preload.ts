import { contextBridge, ipcRenderer } from "electron";

const api = {
  captureViewport: (options: { 
    webContentsId: number; 
    rect?: { x: number; y: number; width: number; height: number };
    format?: 'png' | 'jpeg' | 'webp';
    quality?: number;
    namePrefix?: string;
    includeTimestamp?: boolean;
  }): Promise<string | null> =>
    ipcRenderer.invoke("app:capture-viewport", options),
  saveScreenshot: (buffer: Uint8Array): Promise<string | null> => ipcRenderer.invoke("app:save-screenshot", buffer),
  toggleDevTools: (): Promise<void> => ipcRenderer.invoke("app:toggle-devtools"),
  toggleWebviewDevTools: (): Promise<{ success: boolean; message: string }> => 
    ipcRenderer.invoke("app:toggle-webview-devtools"),
  onAppFocus: (listener: () => void) => {
    const channel = "app:focus";
    const handler = () => listener();
    ipcRenderer.on(channel, handler);
    return () => {
      ipcRenderer.removeListener(channel, handler);
    };
  }
};

contextBridge.exposeInMainWorld("electronAPI", api);

declare global {
  interface Window {
    electronAPI: typeof api;
  }
}

// For CommonJS compatibility
export {};
