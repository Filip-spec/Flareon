import { app, BrowserWindow, ipcMain, shell, nativeImage, webContents } from "electron";
import type { Rectangle } from "electron";
import path from "node:path";
import fs from "node:fs/promises";

let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

async function createWindow() {
  // Create icon from file
  const iconPath = isDev 
    ? path.join(__dirname, "../../public/assets/appIcon.png")
    : path.join(__dirname, "../renderer/assets/appIcon.png");
  
  let icon = nativeImage.createFromPath(iconPath);
  // Resize to standard size with quality
  if (!icon.isEmpty()) {
    icon = icon.resize({ width: 512, height: 512, quality: 'best' });
  }
  
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: "#1E1E1E",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 16 },
    icon: icon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      sandbox: false
    }
  });

  if (isDev) {
    await mainWindow.loadURL("http://localhost:5173");
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("focus", () => {
    mainWindow?.webContents.send("app:focus");
  });

  const handleNewWindow = (details: { url: string }) => {
    shell.openExternal(details.url);
    return { action: "deny" as const };
  };

  mainWindow.webContents.setWindowOpenHandler(handleNewWindow);
}

app.whenReady().then(() => {
  // Set app name
  app.setName('Flareon');
  
  // Set dock icon on macOS
  if (process.platform === 'darwin') {
    const iconPath = path.join(__dirname, isDev ? "../../public/assets/appIcon.png" : "../renderer/assets/appIcon.png");
    let icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) {
      // Resize to standard macOS dock icon size (128x128 for better scaling)
      icon = icon.resize({ width: 128, height: 128, quality: 'best' });
      app.dock.setIcon(icon);
    }
  }
  createWindow();
}).catch(console.error);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});

ipcMain.handle("app:capture-viewport", async (_event, options?: { 
  webContentsId?: number; 
  rect?: Rectangle;
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
  namePrefix?: string;
  includeTimestamp?: boolean;
}) => {
  try {
    const targetId = options?.webContentsId;
    if (!targetId) {
      throw new Error("Missing webContentsId");
    }

    const targetContents = webContents.fromId(targetId);
    if (!targetContents) {
      throw new Error(`No webContents found for id ${targetId}`);
    }

    const image = await targetContents.capturePage(options?.rect);
    
    // Use settings for format and quality
    const format = options?.format || 'png';
    const quality = options?.quality || 90;
    const namePrefix = options?.namePrefix || 'flareon-screenshot';
    const includeTimestamp = options?.includeTimestamp !== false;
    
    let buffer: Buffer;
    let extension: string;
    
    if (format === 'jpeg') {
      buffer = image.toJPEG(quality);
      extension = 'jpg';
    } else if (format === 'webp') {
      buffer = image.toJPEG(quality); // Electron doesn't have toWebP, use JPEG as fallback
      extension = 'jpg';
    } else {
      buffer = image.toPNG();
      extension = 'png';
    }
    
    const timestamp = includeTimestamp 
      ? `-${new Date().toISOString().replace(/[:.]/g, "-")}`
      : '';
    const fileName = `${namePrefix}${timestamp}.${extension}`;
    const filePath = path.join(app.getPath("pictures"), fileName);
    await fs.writeFile(filePath, buffer);
    console.log("Screenshot saved to:", filePath);
    return filePath;
  } catch (error) {
    console.error("Screenshot capture failed:", error);
    return null;
  }
});

ipcMain.handle("app:save-screenshot", async (_event, buffer: Uint8Array) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `flareon-screenshot-${timestamp}.png`;
    const filePath = path.join(app.getPath("pictures"), fileName);
    await fs.writeFile(filePath, buffer);
    console.log("Screenshot saved to:", filePath);
    return filePath;
  } catch (error) {
    console.error("Failed to save screenshot:", error);
    return null;
  }
});

ipcMain.handle("app:toggle-webview-devtools", async () => {
  if (!mainWindow) {
    return { success: false, message: "No main window" };
  }

  try {
    // Find all webview elements and toggle devtools on the first one
    // This uses the webContents API to inspect elements
    const result = await mainWindow.webContents.executeJavaScript(`
      (async () => {
        const webviews = document.querySelectorAll('webview');
        if (webviews.length === 0) {
          return { success: false, message: 'No webview found' };
        }
        
        const webview = webviews[0];
        
        // Try to open DevTools if available
        if (typeof webview.openDevTools === 'function') {
          webview.openDevTools({ mode: 'bottom' });
          return { success: true, message: 'DevTools opened' };
        } else if (typeof webview.toggleDevTools === 'function') {
          webview.toggleDevTools();
          return { success: true, message: 'DevTools toggled' };
        } else {
          return { success: false, message: 'DevTools API not available on webview' };
        }
      })()
    `);
    return result;
  } catch (err) {
    console.error('Failed to toggle webview devtools', err);
    return { success: false, message: String(err) };
  }
});
