# 🔥 Flareon Dev Browser

[![Electron](https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white)](https://electronjs.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

A powerful, developer-focused web browser built with Electron and React for comprehensive web auditing and development tools. Perfect for SEO specialists, accessibility auditors, and web developers who need to analyze websites across multiple dimensions.

![Flareon Dev Browser](https://github.com/Filip-spec/Flareon/blob/main/public/assets/appIcon.png)

## ✨ Features

### 🔍 Comprehensive Web Auditing
- **SEO Analysis**: Meta tags, structured data, Open Graph, Twitter Cards
- **Accessibility Audit**: WCAG compliance, color contrast, ARIA validation
- **Performance Monitoring**: Network requests, database queries, service workers
- **Security Checks**: HTTPS validation, mixed content detection

### 🛠️ Developer Tools
- **Database Panel**: IndexedDB, localStorage, sessionStorage inspection
- **Network Panel**: Request monitoring, throttling simulation, HAR export
- **Viewport Preview**: Responsive design testing across devices
- **Screenshot Capture**: High-quality page captures with custom settings

### 🎨 Modern UI/UX
- **Dark Theme**: Eye-friendly interface optimized for long development sessions
- **Tabbed Interface**: Multiple websites open simultaneously
- **Real-time Updates**: Live monitoring and instant feedback
- **Customizable Panels**: Expandable dev tools for specific needs

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- macOS, Windows, or Linux

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Filip-spec/flareon---web-browser.git
   cd flareon---web-browser
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development mode**
   ```bash
   npm run dev
   ```

4. **Build for production**
   ```bash
   npm run build
   ```

## 📖 Usage

### Basic Navigation
- Enter URLs in the address bar
- Use tabs to manage multiple websites
- Access dev tools via the toolbar

### Auditing a Website
1. Open the target website
2. Click the dev tools icon to open panels
3. Use individual panels for specific audits:
   - **SEO Panel**: Check meta tags and structured data
   - **Database Panel**: Inspect client-side storage
   - **Network Panel**: Monitor requests and simulate throttling

### Keyboard Shortcuts
- `Ctrl+T` / `Cmd+T`: New tab
- `Ctrl+W` / `Cmd+W`: Close tab
- `Ctrl+R` / `Cmd+R`: Refresh page
- `F12`: Toggle developer tools

## 🏗️ Architecture

```
src/
├── main/                 # Electron main process
│   ├── index.ts         # Window lifecycle, IPC handlers
│   └── preload.ts       # Secure API bridge
└── renderer/            # React UI application
    ├── components/      # Reusable UI components
    │   ├── AddressBar.tsx
    │   ├── DevToolsPanel.tsx
    │   ├── DatabasePanel.tsx
    │   ├── NetworkPanel.tsx
    │   └── ...
    ├── styles/          # Theme and styling
    │   ├── theme.ts
    │   └── global.css
    └── types/           # TypeScript definitions
```

## 🛠️ Technologies

- **Frontend**: React 18, TypeScript, Lucide Icons
- **Backend**: Electron 25+, Node.js
- **Build Tool**: Vite
- **Styling**: CSS-in-JS with custom theme system
- **Testing**: Jest, React Testing Library

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
```bash
# Fork and clone
git clone https://github.com/your-username/flareon---web-browser.git
cd flareon---web-browser

# Install dependencies
npm install

# Start development
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Adding New Features
1. Create a feature branch: `git checkout -b feature/amazing-feature`
2. Add your changes with tests
3. Ensure all tests pass: `npm test`
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Electron](https://electronjs.org/) and [React](https://reactjs.org/)
- Icons by [Lucide](https://lucide.dev/)
- Inspired by modern developer tools and browser dev experiences

## 📞 Support

- 📧 **Email**: kontakt@filipstudio.pl
- 🐛 **Issues**: [GitHub Issues](https://github.com/Filip-spec/flareon---web-browser/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/Filip-spec/flareon---web-browser/discussions)

---

**Made with ❤️ by [Filip Studio](https://filipstudio.pl)**
