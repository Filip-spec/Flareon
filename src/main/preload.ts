import { contextBridge, ipcRenderer } from "electron";

const api = {
  captureViewport: (): Promise<string | null> => ipcRenderer.invoke("app:capture-viewport"),
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
