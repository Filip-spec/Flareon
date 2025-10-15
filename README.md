# Flareon Dev Browser

Developer-focused Electron + React prototype for auditing web experiences across SEO, accessibility, structured data, socials, colors, and viewport previews.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start development mode with hot reload for both Electron main process and React renderer:
   ```bash
   npm run dev
   ```
3. Package assets for production:
   ```bash
   npm run build
   ```

## Project structure

```
src/
├─ main/          # Electron main process (window lifecycle, IPC)
└─ renderer/      # React UI (components, theming)
```

Key renderer components live under `src/renderer/components` and share styling tokens from `src/renderer/styles/theme.ts`.

## Next steps

- Wire actual analyzers for SEO, WCAG, Schema.org, Open Graph, and color contrast inside `DevToolsPanel`.
- Persist tabs and history between sessions (e.g., via `electron-store`).
- Implement screenshot previews or file-open prompts after capture.
- Expand viewport presets or allow custom breakpoints.
