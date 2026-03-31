# XtreamFlow Pro

XtreamFlow Pro is a high-performance, modern IPTV player designed with the **Windows 11 Fluent Design** aesthetic. It provides a seamless experience for streaming live TV, VOD, and series from Xtream Codes and M3U playlists, with advanced features like local downloads and multi-account management.

## ✨ Features

- **🪟 Windows 11 Aesthetic**: Beautifully crafted UI using Acrylic and Mica-like effects, consistent with the modern Windows 11 design language.
- **📺 Multi-Source Support**: Seamlessly integrate Xtream Codes API and M3U playlists.
- **📥 Download Manager**: Download your favorite VODs and series episodes for offline viewing.
- **👥 Account Management**: Manage multiple IPTV accounts and servers in one place.
- **🔍 Advanced Search & Filtering**: Quickly find content across all your providers.
- **🚀 High Performance**: Built with React and optimized for smooth navigation even with large playlists.
- **💾 Local Storage**: Uses IndexedDB (via Dexie) to securely store your accounts and download metadata locally.

## 🛠️ Tech Stack

- **Frontend**: React 18+ with TypeScript
- **Styling**: Tailwind CSS (Utility-first styling)
- **Animations**: Framer Motion (Smooth transitions and UI effects)
- **Icons**: Lucide React
- **Database**: Dexie.js (IndexedDB wrapper for local data persistence)
- **Build Tool**: Vite

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/xtreamflow-pro.git
   cd xtreamflow-pro
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

## 📂 Project Structure

- `src/`: Core application logic and services.
- `components/`: Reusable UI components (Win11-style buttons, panels, etc.).
- `views/`: Main application views (Dashboard, Account Management, Downloads).
- `db/`: Database schema and configuration using Dexie.
- `public/`: Static assets.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

*Built with ❤️ for the IPTV community.*
