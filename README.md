# 🎨 Glassy Tableau - Beautiful New Tab Extension

A stunning browser extension that transforms your new tab page into a beautiful, glassmorphic interface with unlimited customizable tiles, folders, notes, and more.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-green)
![Browser](https://img.shields.io/badge/browser-Edge%20%7C%20Chrome-orange)

## ✨ Features

### Core Features
- **Unlimited Tiles** - Add as many website shortcuts as you want
- **Drag & Drop Folders** - Create folders by dragging tiles together
- **Quick Add** - Click extension icon to instantly add current website
- **Beautiful Onboarding** - First-time setup with bookmark selection
- **Custom Wallpapers** - Upload images or videos as backgrounds
- **Default Wallpaper** - Set your own default background image
- **Notes & To-Do Lists** - Built-in productivity tools
- **Focus Mode** - Hide non-essential tiles
- **Dark Mode** - Apply dark filter to all websites
- **Keyboard Shortcuts** - Navigate and control with keyboard

### Customization
- **Tile Themes** - Multiple themes including Liquid Glass, gradients, and more
- **Time Display** - 10 different fonts (Orbitron, Outfit, Bebas, etc.)
- **Time Format** - 12-hour or 24-hour format
- **Smart Search** - Search with Google, Bing, or DuckDuckGo
- **Inspirational Quotes** - Random quotes on each new tab
- **Backup & Restore** - Export/import your entire setup

### Default Settings
- **Theme**: Liquid Glass
- **Time Font**: Orbitron (futuristic style)
- **Time Format**: 12-hour (e.g., 7:09 PM)
- **Search Bar**: Included with liquid glass theme
- **Dark Mode**: Off by default

## 🚀 Installation

### Basic Installation
1. **Download** - Clone or download this repository
2. **Open Browser** - Navigate to `edge://extensions/` or `chrome://extensions/`
3. **Enable Developer Mode** - Toggle in bottom-left or top-right corner
4. **Load Extension** - Click "Load unpacked" and select the extension folder
5. **Done!** - Open a new tab to see your beautiful new interface

### First-Time Setup (Onboarding)
When you first install the extension, a beautiful onboarding modal will appear:
1. **Browse Your Bookmarks** - See all your browser bookmarks in a liquid glass UI
2. **Search & Filter** - Find specific bookmarks quickly
3. **Select Tiles** - Choose which bookmarks to add as tiles
4. **Organize by Folders** - Bookmarks in folders stay organized
5. **Skip if Needed** - Start with a clean slate and add tiles manually

The onboarding only appears once. You can always add more tiles later!

### Setting a Default Wallpaper
Want to set your own default background image?

1. **Add Your Image**:
   - Place your image in the `images` folder
   - Rename it to `default-wallpaper.jpg` (or any name)
   - Supported formats: JPG, PNG, WEBP
   - Recommended size: 1920x1080 or higher

2. **Update CSS** (if using different filename):
   - Open `newtab.css`
   - Find line ~38: `background-image: url('images/default-wallpaper.jpg');`
   - Change to your filename: `url('images/your-image.png')`

3. **Reload Extension**:
   - Go to `edge://extensions/` or `chrome://extensions/`
   - Click reload button on the extension
   - Open new tab to see your wallpaper!

**Tips**:
- Keep file size under 2MB for fast loading
- Use 16:9 aspect ratio for best fit
- Ensure text (time, quotes) is readable on your image
- Users can still change wallpaper via settings

## 📁 Project Structure

```
GlassyTableau/
├── manifest.json          # Extension manifest
├── newtab.html           # Main HTML
├── newtab.css            # Styling
├── newtab.js             # Main logic
├── background.js         # Service worker
├── darkmode.js           # Dark mode script
├── popup.html/js         # Extension popup
├── quotes.json           # Quotes data
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── images/               # Default wallpaper folder
│   └── default-wallpaper.jpg  # Your default background
├── README.md             # This file
└── COMPLETE_DOCUMENTATION.txt  # Full documentation
```

## 📖 Quick Start

### First Launch
On your first launch, you'll see a beautiful onboarding modal:
- **Select Bookmarks** - Choose which bookmarks to add as tiles
- **Search** - Find specific bookmarks quickly
- **Select All/Deselect All** - Quick selection options
- **Skip** - Start with a clean slate if preferred

### Adding Tiles
- Click the **+** tile to add manually
- Click the **extension icon** in toolbar to add current website
- Right-click any tile to edit or delete
- Import bookmarks from onboarding (first time only)

### Creating Folders
- Drag one tile over another
- Hold for 0.5 seconds
- Folder created automatically
- Drag tiles in/out of folders

### Customizing Appearance
- Click **⚙️** (settings) to access all options
- **Tile Theme**: Choose from Liquid Glass, gradients, colors
- **Time Display**: 10 different fonts (Orbitron, Outfit, Bebas, etc.)
- **Time Format**: 12-hour or 24-hour
- **Search Engine**: Google, Bing, or DuckDuckGo
- **Wallpaper**: Upload images or videos
- **Quotes**: Toggle and position quotes

### Keyboard Shortcuts
- `N` - New tile
- `F` - Toggle focus mode
- `W` - Random wallpaper
- `Arrow keys` - Navigate tiles
- `Enter` - Open selected tile
- `Delete` - Delete selected tile
- `?` or `H` - Show help

### Notes & To-Do Lists
- Click **📝** (notes) button to open notes
- Create multiple notes with titles
- Click **✓** (todo) button for to-do lists
- Create multiple lists with checkable items
- All data saved automatically

### Backup & Restore
- Click **⚙️** (settings) → Backup & Restore
- **Export State** - Download JSON file with all data
- **Import State** - Restore from backup file
- Includes tiles, settings, wallpaper, notes, todos

## 🛠️ Technical Details

### Browser Compatibility
- Microsoft Edge (Chromium) ✓
- Google Chrome ✓
- Brave, Opera, Vivaldi ✓
- Any Chromium-based browser ✓

### Storage
- **Chrome Storage API** - Tiles, settings, notes, todos
- **IndexedDB** - Large files (wallpapers, custom icons)
- All data stored locally on your device
- No external servers or tracking

### Permissions
- `storage` - Save tiles and settings
- `tabs` - Get current tab info for Quick Add
- `activeTab` - Access current page
- `contextMenus` - "Add to Notes" menu
- `bookmarks` - Import bookmarks during onboarding
- `scripting` - Dark mode content script
- `notifications` - Success/error notifications

### Features Breakdown
- **Onboarding System** - Beautiful first-time setup with bookmark selection
- **Liquid Glass UI** - Modern glassmorphism design throughout
- **Tile Management** - Unlimited tiles with drag-and-drop organization
- **Folder System** - Nested folders with preview grids
- **Focus Mode** - Mark important tiles, hide others
- **Notes System** - Multiple notes with titles and timestamps
- **To-Do Lists** - Multiple lists with checkable items
- **Wallpaper System** - Images, videos, or default wallpaper
- **Theme Engine** - 15+ themes including gradients and liquid glass
- **Search Integration** - Multiple search engines with themed search bar
- **Quote System** - Shuffled deck of inspirational quotes
- **Keyboard Navigation** - Full keyboard control
- **Dark Mode** - Global dark filter for all websites
- **Backup System** - Export/import all data as JSON

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Extension doesn't load | Enable Developer mode, check all files present |
| New tab doesn't show | Restart browser, check extension is enabled |
| Onboarding not showing | Check if already completed, clear extension data to reset |
| Tiles don't save | Check storage permissions, clear cache |
| Bookmarks not loading | Check bookmarks permission in manifest |
| Checkboxes not working | Reload extension, check browser console for errors |
| Drag & drop not working | Click and hold, drag over tile until highlighted |
| Wallpaper won't upload | Check file size (images: 5MB, videos: 3MB) |
| Default wallpaper not showing | Check image path in newtab.css, verify file exists |
| Dark mode not working | Enable in settings, refresh pages |
| Buttons not clickable | Reload extension, check browser console (F12) |

### Debug Mode
Open browser console (F12) to see detailed logs:
- Onboarding events (button clicks, selections)
- Bookmark loading status
- Error messages
- Storage operations

For detailed troubleshooting, see `COMPLETE_DOCUMENTATION.txt`

## 📚 Documentation

- **README.md** (this file) - Quick start guide
- **COMPLETE_DOCUMENTATION.txt** - Full documentation with all features, functions, and technical details

## 🤝 Contributing

Feel free to fork this project and submit pull requests for improvements!

## 📄 License

This project is provided as-is for personal use. All data stays on your device.

## 🙏 Acknowledgments

- Inspired by Yandex Browser's elegant design
- Glassmorphism UI trend
- Google Fonts for beautiful typography
- Material Design Icons

---

**Made with ❤️ for beautiful browsing**

*Privacy-focused • No tracking • All data stays local*
