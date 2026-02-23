// Polyfill for requestIdleCallback
window.requestIdleCallback = window.requestIdleCallback || function (cb, options) {
    const start = Date.now();
    return setTimeout(() => {
        cb({
            didTimeout: false,
            timeRemaining: () => Math.max(0, 50 - (Date.now() - start))
        });
    }, options?.timeout || 1);
};

// Storage keys
const STORAGE_KEYS = {
    TILES: 'tiles',
    WALLPAPER: 'wallpaper',
    SETTINGS: 'settings',
    QUOTES_DECK: 'quotesDeck',
    QUOTES_INDEX: 'quotesIndex',
    NOTES: 'userNotes',
    TODOS: 'userTodos'
};

// Time fonts array for cycling
const TIME_FONTS = [
    'outfit', 'orbitron', 'righteous', 'bebas', 'audiowide',
    'monoton', 'bungee', 'russo', 'rajdhani', 'exo'
];

// IndexedDB for large files (wallpapers, custom icons)
const DB_NAME = 'GlassyTabDB';
const DB_VERSION = 2;
const WALLPAPER_STORE = 'wallpapers';
const CUSTOM_ICONS_STORE = 'customIcons';
const WALLPAPER_FOLDER_STORE = 'wallpaperFolder';

// Initialize IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Create wallpapers store if it doesn't exist (for backward compatibility)
            if (!db.objectStoreNames.contains(WALLPAPER_STORE)) {
                db.createObjectStore(WALLPAPER_STORE);
            }

            // Create customIcons store for storing custom tile icons
            if (!db.objectStoreNames.contains(CUSTOM_ICONS_STORE)) {
                db.createObjectStore(CUSTOM_ICONS_STORE);
            }

            // Create wallpaperFolder store for storing wallpaper folder references
            if (!db.objectStoreNames.contains(WALLPAPER_FOLDER_STORE)) {
                db.createObjectStore(WALLPAPER_FOLDER_STORE);
            }
        };
    });
}

// Save wallpaper to IndexedDB
async function saveWallpaperToDB(dataUrl, type) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([WALLPAPER_STORE], 'readwrite');
        const store = transaction.objectStore(WALLPAPER_STORE);

        store.put(dataUrl, 'wallpaper');
        store.put(type, 'wallpaperType');

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

// Load wallpaper from IndexedDB
async function loadWallpaperFromDB() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([WALLPAPER_STORE], 'readonly');
            const store = transaction.objectStore(WALLPAPER_STORE);

            const wallpaperRequest = store.get('wallpaper');
            const typeRequest = store.get('wallpaperType');

            transaction.oncomplete = () => {
                resolve({
                    wallpaper: wallpaperRequest.result,
                    wallpaperType: typeRequest.result
                });
            };
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (error) {
        console.log('No wallpaper in IndexedDB');
        return { wallpaper: null, wallpaperType: null };
    }
}

// Remove wallpaper from IndexedDB
async function removeWallpaperFromDB() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([WALLPAPER_STORE], 'readwrite');
            const store = transaction.objectStore(WALLPAPER_STORE);

            store.delete('wallpaper');
            store.delete('wallpaperType');

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (error) {
        console.error('Error removing wallpaper from IndexedDB:', error);
    }
}

// Save custom icon to IndexedDB
async function saveCustomIconToDB(tileId, dataUrl) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([CUSTOM_ICONS_STORE], 'readwrite');
        const store = transaction.objectStore(CUSTOM_ICONS_STORE);

        store.put(dataUrl, tileId);

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

// Load custom icon from IndexedDB
async function loadCustomIconFromDB(tileId) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CUSTOM_ICONS_STORE], 'readonly');
            const store = transaction.objectStore(CUSTOM_ICONS_STORE);

            const request = store.get(tileId);

            transaction.oncomplete = () => {
                resolve(request.result);
            };
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (error) {
        console.log('No custom icon in IndexedDB for tile:', tileId);
        return null;
    }
}

// Remove custom icon from IndexedDB
async function removeCustomIconFromDB(tileId) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CUSTOM_ICONS_STORE], 'readwrite');
            const store = transaction.objectStore(CUSTOM_ICONS_STORE);

            store.delete(tileId);

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (error) {
        console.error('Error removing custom icon from IndexedDB:', error);
    }
}

// Global state
let tiles = [];
let settings = {
    tileSize: 'medium',
    showQuotes: true,
    quotePosition: 'both',
    quoteTextColor: 'white',
    timeFont: 'orbitron',
    searchEngine: 'google',
    timeFormat: '12h',
    tileTheme: 'liquid-glass',
    applyThemeToSearchbar: true,
    focusModeActive: false,
    darkModeEnabled: false,
    onboardingComplete: false,
    keyboardShortcuts: {
        newTile: 'n',
        focusMode: 'f',
        changeWallpaper: 'w',
        navigateUp: 'ArrowUp',
        navigateDown: 'ArrowDown',
        navigateLeft: 'ArrowLeft',
        navigateRight: 'ArrowRight',
        openTile: 'Enter',
        deleteTile: 'Delete',
        showHelp: '?'
    }
};
let draggedTile = null;
let currentFolder = null;
let contextMenuTile = null;
let folderCreationTimer = null;
let folderCreationTarget = null;
let draggedElement = null;
let lastDropTarget = null;
let pendingDropPosition = null;
let pendingDropTile = null;
let quotes = [];
let quotesDeck = [];
let quotesIndex = 0;
let deletedTiles = []; // Undo stack for deleted tiles
let notes = []; // Array of note objects
let currentNoteId = null; // Currently selected note ID
let todos = []; // Array of to-do list objects
let currentTodoListId = null; // Currently selected to-do list ID
let selectedTileIndex = -1; // Currently selected tile index for keyboard navigation (-1 means no selection)

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Run migration from local to sync storage (one-time operation)
    if (typeof migrateToSync === 'function') {
        await migrateToSync();
    }

    // Load critical data in parallel
    const [dataLoaded, quotesLoaded] = await Promise.all([
        loadData(),
        loadQuotes()
    ]);

    // Initialize critical UI immediately
    initializeClock();
    renderTiles();
    displayQuotes();

    // Apply saved quote color immediately after displaying quotes
    applyQuoteColor(settings.quoteTextColor || 'white');

    // Apply focus mode state if it was active
    if (settings.focusModeActive) {
        applyFocusMode();
    }

    // Defer non-critical initializations
    requestIdleCallback(() => {
        initializeSearch();
        initializeSearchEngine();
        initializeModals();
        initializeContextMenu();
        initializeMainGridDropZone();
        initializeUndoShortcut();
        initializeNotes();
        initializeTodos();
        initializeQuoteColorToggle();
        initializeTimeFontCycling();
        initializeKeyboardShortcuts();
        initializeWallpaperFolder();
    }, { timeout: 100 });

    // Auto-focus search bar - override browser's default focus
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.focus();

        // Defer additional focus attempts
        requestIdleCallback(() => {
            setTimeout(() => searchInput.focus(), 50);
            setTimeout(() => searchInput.focus(), 150);
        });
    }

    // Also focus on any click on the page (except on tiles)
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.tile') &&
            !e.target.closest('.modal') &&
            !e.target.closest('.settings-sidebar') &&
            !e.target.closest('.floating-notes-btn') &&
            !e.target.closest('.floating-settings-btn')) {
            searchInput.focus();
        }
    });

    // Listen for storage changes from sync
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync') {
            if (changes[STORAGE_KEYS.TILES]) {
                tiles = changes[STORAGE_KEYS.TILES].newValue || [];
                renderTiles();
            }
            if (changes[STORAGE_KEYS.NOTES]) {
                const oldNotes = changes[STORAGE_KEYS.NOTES].oldValue || [];
                const newNotes = changes[STORAGE_KEYS.NOTES].newValue || [];
                notes = newNotes;

                // Only update UI if notes modal is open or a new note was added
                const notesModal = document.getElementById('notesModal');
                if (notesModal && notesModal.style.display === 'block') {
                    renderNotesList();
                } else if (newNotes.length > oldNotes.length) {
                    // New note added from context menu
                    showToast('New note added from context menu!', 'success');
                }
            }
        }
    });
});

// Load data from storage
async function loadData() {
    try {
        // Load data with chunking support
        const tiles_data = await getChunkedData(STORAGE_KEYS.TILES);
        const settings_data = await getChunkedData(STORAGE_KEYS.SETTINGS);
        const quotesDeck_data = await getChunkedData(STORAGE_KEYS.QUOTES_DECK);
        const notes_data = await getChunkedData(STORAGE_KEYS.NOTES);
        const todos_data = await getChunkedData(STORAGE_KEYS.TODOS);

        // Get non-chunked data
        const result = await chrome.storage.sync.get([
            STORAGE_KEYS.QUOTES_INDEX
        ]);

        tiles = tiles_data || [];
        settings = settings_data || {
            tileSize: 'medium',
            showQuotes: true,
            quotePosition: 'both',
            quoteTextColor: 'white',
            timeFont: 'orbitron',
            searchEngine: 'google',
            timeFormat: '12h',
            tileTheme: 'liquid-glass',
            applyThemeToSearchbar: true,
            darkModeEnabled: false,
            onboardingComplete: false
        };

        // Ensure keyboard shortcuts exist with defaults
        if (!settings.keyboardShortcuts) {
            settings.keyboardShortcuts = {
                newTile: 'n',
                focusMode: 'f',
                changeWallpaper: 'w',
                navigateUp: 'ArrowUp',
                navigateDown: 'ArrowDown',
                navigateLeft: 'ArrowLeft',
                navigateRight: 'ArrowRight',
                openTile: 'Enter',
                deleteTile: 'Delete',
                showHelp: '?'
            };
        }

        // Ensure darkModeEnabled exists (for backward compatibility)
        if (settings.darkModeEnabled === undefined) {
            settings.darkModeEnabled = false;
        }

        quotesDeck = quotesDeck_data || [];
        quotesIndex = result[STORAGE_KEYS.QUOTES_INDEX] || 0;

        // Ensure notes is always an array (handle old string format)
        const loadedNotes = notes_data;
        if (Array.isArray(loadedNotes)) {
            notes = loadedNotes;
        } else if (typeof loadedNotes === 'string' && loadedNotes) {
            // Convert old string format to new array format
            notes = [{
                id: Date.now().toString(),
                title: getDefaultNoteTitle(),
                content: loadedNotes,
                createdAt: Date.now(),
                updatedAt: Date.now()
            }];
            // Save in new format
            await setWithChunking(STORAGE_KEYS.NOTES, notes);
        } else {
            notes = [];
        }

        // Load to-do lists
        const loadedTodos = todos_data;
        if (Array.isArray(loadedTodos)) {
            todos = loadedTodos;
        } else {
            todos = [];
        }

        console.log('Loaded tiles:', tiles);

        // Load wallpaper from IndexedDB (supports large files)
        const { wallpaper, wallpaperType } = await loadWallpaperFromDB();

        if (wallpaper) {
            if (wallpaperType === 'video') {
                const videoElement = document.getElementById('wallpaperVideo');
                videoElement.src = wallpaper;
                videoElement.style.display = 'block';
            } else {
                document.getElementById('wallpaper').style.backgroundImage = `url(${wallpaper})`;
            }
        }

        // Apply settings
        document.getElementById('tileSize').value = settings.tileSize;
        document.getElementById('tileTheme').value = settings.tileTheme || 'custom';
        document.getElementById('applyThemeToSearchbar').checked = settings.applyThemeToSearchbar !== false;
        document.getElementById('showQuotes').checked = settings.showQuotes !== false;
        document.getElementById('quotePosition').value = settings.quotePosition || 'both';
        document.getElementById('timeFont').value = settings.timeFont || 'outfit';
        document.getElementById('timeFormat').value = settings.timeFormat || '24h';
        applyTimeFont(settings.timeFont || 'outfit');
        applyTimeColor(settings.timeColor || '#ffffff'); // Apply saved time color
        applyDateColor(settings.dateColor || 'rgba(255, 255, 255, 0.8)'); // Apply saved date color
        applyThemeToSearchbar(); // Apply theme to searchbar on load
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Save data to storage
async function saveData() {
    try {
        await setWithChunking(STORAGE_KEYS.TILES, tiles);
        console.log('Saved tiles:', tiles);
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

async function saveSettings() {
    try {
        await setWithChunking(STORAGE_KEYS.SETTINGS, settings);
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

// Clock
function initializeClock() {
    function updateClock() {
        const now = new Date();
        const timeFormat = settings.timeFormat || '24h';

        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');

        let timeString;
        if (timeFormat === '12h') {
            // 12-hour format with AM/PM
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // Convert 0 to 12
            timeString = `${hours}:${minutes} ${ampm}`;
        } else {
            // 24-hour format
            timeString = `${String(hours).padStart(2, '0')}:${minutes}`;
        }

        document.getElementById('time').textContent = timeString;

        const options = { weekday: 'short', month: 'short', day: 'numeric' };
        const dateStr = now.toLocaleDateString('en-US', options);
        const hour = now.getHours();
        const icon = hour >= 6 && hour < 18 ? '☀️' : '🌙';
        document.getElementById('date').textContent = `${dateStr} ${icon}`;
    }

    updateClock();
    setInterval(updateClock, 1000);
}

// Apply time font
function applyTimeFont(fontName) {
    const timeElement = document.getElementById('time');
    // Remove all font classes
    timeElement.className = 'time';
    // Add the selected font class
    if (fontName) {
        timeElement.classList.add(`font-${fontName}`);
    }
}

// Initialize quote color toggle
function initializeQuoteColorToggle() {
    const quoteBoxes = document.querySelectorAll('.quote-box');
    quoteBoxes.forEach(box => {
        // Double-click to change only this quote
        box.addEventListener('dblclick', (e) => {
            e.preventDefault();
            changeIndividualQuote(box);
        });
        // Right-click to show color menu
        box.addEventListener('contextmenu', showQuoteColorPicker);
    });
}

// Toggle quote text color between black and white
async function toggleQuoteColor() {
    try {
        const currentColor = settings.quoteTextColor || 'white';
        const newColor = currentColor === 'white' ? 'black' : 'white';
        settings.quoteTextColor = newColor;
        await saveSettings();
        applyQuoteColor(newColor);
        showToast(`Quote color: ${newColor}`, 'success');
    } catch (error) {
        console.error('Error toggling quote color:', error);
        showToast('Error changing quote color. Please try again.', 'error');
    }
}

// Show quote color picker context menu
function showQuoteColorPicker(event) {
    event.preventDefault();
    event.stopPropagation();

    // Remove existing color picker if any
    const existingPicker = document.getElementById('quoteColorPicker');
    if (existingPicker) {
        existingPicker.remove();
    }

    // Create color picker menu
    const colorPicker = document.createElement('div');
    colorPicker.id = 'quoteColorPicker';
    colorPicker.className = 'time-color-picker';

    // Predefined color options
    const colors = [
        { name: 'White', value: 'white' },
        { name: 'Dark', value: 'black' }
    ];

    colors.forEach(color => {
        const colorOption = document.createElement('div');
        colorOption.className = 'time-color-option';
        colorOption.innerHTML = `
            <div class="color-preview" style="background-color: ${color.value}; ${color.value === 'white' ? 'border: 1px solid rgba(0,0,0,0.2);' : ''}"></div>
            <span>${color.name}</span>
        `;
        colorOption.addEventListener('click', async () => {
            await setQuoteColor(color.value);
            colorPicker.remove();
        });
        colorPicker.appendChild(colorOption);
    });

    // Add custom color option
    const customOption = document.createElement('div');
    customOption.className = 'time-color-option';
    customOption.innerHTML = `
        <div class="color-preview" style="background: linear-gradient(45deg, #ff0000, #00ff00, #0000ff)"></div>
        <span>Custom...</span>
    `;
    customOption.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'color';
        input.value = settings.quoteTextColor === 'white' ? '#ffffff' : (settings.quoteTextColor === 'black' ? '#000000' : settings.quoteTextColor);
        input.addEventListener('change', async (e) => {
            await setQuoteColor(e.target.value);
            colorPicker.remove();
        });
        input.click();
    });
    colorPicker.appendChild(customOption);

    // Position the menu
    document.body.appendChild(colorPicker);

    const x = event.clientX;
    const y = event.clientY;

    colorPicker.style.left = x + 'px';
    colorPicker.style.top = y + 'px';

    // Adjust if menu goes off screen
    setTimeout(() => {
        const rect = colorPicker.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            colorPicker.style.left = (x - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            colorPicker.style.top = (y - rect.height) + 'px';
        }
    }, 0);

    // Close menu when clicking outside
    const closeHandler = (e) => {
        if (!colorPicker.contains(e.target)) {
            colorPicker.remove();
            document.removeEventListener('click', closeHandler);
        }
    };
    setTimeout(() => {
        document.addEventListener('click', closeHandler);
    }, 0);
}

// Set quote color
async function setQuoteColor(color) {
    settings.quoteTextColor = color;
    await saveSettings();
    applyQuoteColor(color);
    showToast(`Quote color updated`, 'success');
}

// Apply quote text color
function applyQuoteColor(color) {
    document.querySelectorAll('.quote-text').forEach(el => {
        el.style.color = color;
    });
}

// Initialize time font cycling
function initializeTimeFontCycling() {
    const timeElement = document.getElementById('time');
    const dateElement = document.getElementById('date');

    if (timeElement) {
        timeElement.addEventListener('dblclick', cycleTimeFont);
        // Add right-click context menu for time color picker
        timeElement.addEventListener('contextmenu', (e) => showClockColorPicker(e, 'time'));
    }

    if (dateElement) {
        // Add right-click context menu for date color picker
        dateElement.addEventListener('contextmenu', (e) => showClockColorPicker(e, 'date'));
    }
}

// Show time color picker context menu
// Show clock color picker context menu (for time or date)
function showClockColorPicker(event, type) {
    event.preventDefault();
    event.stopPropagation();

    // Remove existing color picker if any
    const existingPicker = document.getElementById('clockColorPicker');
    if (existingPicker) {
        existingPicker.remove();
    }

    // Create color picker menu
    const colorPicker = document.createElement('div');
    colorPicker.id = 'clockColorPicker';
    colorPicker.className = 'time-color-picker';

    // Predefined colors
    const colors = [
        { name: 'White', value: '#ffffff' },
        { name: 'Black', value: '#000000' },
        { name: 'Red', value: '#ff4444' },
        { name: 'Blue', value: '#4169E1' },
        { name: 'Green', value: '#4caf50' },
        { name: 'Yellow', value: '#ffd700' },
        { name: 'Purple', value: '#9c27b0' },
        { name: 'Orange', value: '#ff9800' },
        { name: 'Pink', value: '#e91e63' },
        { name: 'Cyan', value: '#00bcd4' }
    ];

    colors.forEach(color => {
        const colorOption = document.createElement('div');
        colorOption.className = 'time-color-option';
        colorOption.innerHTML = `
            <div class="color-preview" style="background-color: ${color.value}"></div>
            <span>${color.name}</span>
        `;
        colorOption.addEventListener('click', async () => {
            await setClockColor(color.value, type);
            colorPicker.remove();
        });
        colorPicker.appendChild(colorOption);
    });

    // Add custom color option
    const customOption = document.createElement('div');
    customOption.className = 'time-color-option';
    customOption.innerHTML = `
        <div class="color-preview" style="background: linear-gradient(45deg, #ff0000, #00ff00, #0000ff)"></div>
        <span>Custom...</span>
    `;
    customOption.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'color';
        input.value = type === 'time' ? (settings.timeColor || '#ffffff') : (settings.dateColor || '#ffffff');
        input.addEventListener('change', async (e) => {
            await setClockColor(e.target.value, type);
            colorPicker.remove();
        });
        input.click();
    });
    colorPicker.appendChild(customOption);

    // Position the menu
    document.body.appendChild(colorPicker);

    const x = event.clientX;
    const y = event.clientY;

    colorPicker.style.left = x + 'px';
    colorPicker.style.top = y + 'px';

    // Adjust if menu goes off screen
    setTimeout(() => {
        const rect = colorPicker.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            colorPicker.style.left = (x - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            colorPicker.style.top = (y - rect.height) + 'px';
        }
    }, 0);

    // Close menu when clicking outside
    const closeHandler = (e) => {
        if (!colorPicker.contains(e.target)) {
            colorPicker.remove();
            document.removeEventListener('click', closeHandler);
        }
    };
    setTimeout(() => {
        document.addEventListener('click', closeHandler);
    }, 0);
}

// Set clock color (time or date)
async function setClockColor(color, type) {
    if (type === 'time') {
        settings.timeColor = color;
        applyTimeColor(color);
        showToast(`Time color updated`, 'success');
    } else if (type === 'date') {
        settings.dateColor = color;
        applyDateColor(color);
        showToast(`Date color updated`, 'success');
    }
    await saveSettings();
}

// Apply time color
function applyTimeColor(color) {
    const timeElement = document.getElementById('time');
    if (timeElement) {
        timeElement.style.color = color;
    }
}

// Apply date color
function applyDateColor(color) {
    const dateElement = document.getElementById('date');
    if (dateElement) {
        dateElement.style.color = color;
    }
}
// Initialize keyboard shortcuts
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', handleGlobalKeydown);
}

// Global keydown event handler
function handleGlobalKeydown(event) {
    // Don't handle shortcuts when user is typing in an input field
    const activeElement = document.activeElement;
    const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
    );

    // Allow shortcuts in search input for specific keys
    const isSearchInput = activeElement && activeElement.id === 'searchInput';

    // Get the pressed key
    const key = event.key;
    const shortcuts = settings.keyboardShortcuts || {};

    // Special handling for help shortcut - allow both '?' and 'h'/'H'
    if ((key === '?' || key === 'h' || key === 'H') && !isTyping) {
        event.preventDefault();
        showKeyboardShortcutsHelp();
        return;
    }

    // Check if this key matches any of our shortcuts
    let matchedAction = null;
    for (const [action, shortcutKey] of Object.entries(shortcuts)) {
        if (key === shortcutKey) {
            matchedAction = action;
            break;
        }
    }

    // If no match, return early
    if (!matchedAction) return;

    // Handle navigation keys even in search input
    const navigationKeys = ['navigateUp', 'navigateDown', 'navigateLeft', 'navigateRight', 'openTile', 'deleteTile'];
    if (isSearchInput && navigationKeys.includes(matchedAction)) {
        // Allow navigation from search input
        event.preventDefault();
    } else if (isTyping && matchedAction !== 'showHelp') {
        // Don't handle other shortcuts when typing (except help)
        return;
    }

    // Prevent default browser behavior for our shortcuts
    // Check for potential conflicts with browser shortcuts
    const isBrowserShortcut = (
        (event.ctrlKey || event.metaKey) && ['n', 'w', 't', 'r', 'f'].includes(key.toLowerCase())
    );

    // Only prevent default if it's not a browser shortcut with modifier keys
    if (!isBrowserShortcut) {
        event.preventDefault();
    } else {
        // If it's a browser shortcut, don't handle it
        return;
    }

    // Execute the action based on the matched shortcut
    switch (matchedAction) {
        case 'newTile':
            openEditModal();
            break;
        case 'focusMode':
            toggleFocusMode();
            break;
        case 'changeWallpaper':
            changeRandomWallpaper();
            break;
        case 'navigateUp':
            navigateTiles('up');
            break;
        case 'navigateDown':
            navigateTiles('down');
            break;
        case 'navigateLeft':
            navigateTiles('left');
            break;
        case 'navigateRight':
            navigateTiles('right');
            break;
        case 'openTile':
            openSelectedTile();
            break;
        case 'deleteTile':
            deleteSelectedTile();
            break;
        case 'showHelp':
            showKeyboardShortcutsHelp();
            break;
    }
}

// Placeholder functions for actions (to be implemented in other tasks)
async function toggleFocusMode() {
    try {
        // Toggle focus mode state
        settings.focusModeActive = !settings.focusModeActive;

        // Save settings
        await saveSettings();

        // Apply focus mode visual effects
        applyFocusMode();

        // Show feedback
        const message = settings.focusModeActive ? 'Focus mode activated' : 'Focus mode deactivated';
        showToast(message, 'success');
    } catch (error) {
        console.error('Error toggling focus mode:', error);
        showToast('Error toggling focus mode. Please try again.', 'error');
    }
}

// Apply focus mode visual effects// Apply focus mode visual effects
function applyFocusMode() {
    const isActive = settings.focusModeActive;
    const focusModeBtn = document.getElementById('focusModeBtn');

    // Update button state
    if (isActive) {
        focusModeBtn.classList.add('active');
    } else {
        focusModeBtn.classList.remove('active');
    }

    // Helper function to check if a folder contains any focus-enabled tiles
    function folderHasFocusTiles(folder) {
        if (folder.type !== 'folder' || !folder.items) return false;
        return folder.items.some(item => {
            if (item.type === 'folder') {
                return folderHasFocusTiles(item); // Recursive check for nested folders
            }
            return item.focusEnabled;
        });
    }

    // Helper function to find a tile by ID (including nested in folders)
    function findTileById(tileId, tilesList = tiles) {
        for (const tile of tilesList) {
            if (tile.id === tileId) {
                return tile;
            }
            if (tile.type === 'folder' && tile.items) {
                const found = findTileById(tileId, tile.items);
                if (found) return found;
            }
        }
        return null;
    }

    // Get all tile elements (both in main grid and inside folders)
    const tileElements = document.querySelectorAll('.tile:not(.add-tile)');

    tileElements.forEach(tileEl => {
        const tileId = tileEl.dataset.id;
        const tile = findTileById(tileId);

        if (!tile) return;

        if (isActive) {
            // Focus mode is active
            if (tile.focusEnabled) {
                // Show focus-enabled tiles at full opacity
                tileEl.style.opacity = '1';
                tileEl.style.filter = 'none';
            } else if (tile.type === 'folder' && folderHasFocusTiles(tile)) {
                // Show folders that contain focus-enabled tiles
                tileEl.style.opacity = '1';
                tileEl.style.filter = 'none';
            } else {
                // Dim non-focus-enabled tiles and empty folders
                tileEl.style.opacity = '0.2';
                tileEl.style.filter = 'grayscale(50%)';
            }
        } else {
            // Focus mode is inactive - restore all tiles
            tileEl.style.opacity = '1';
            tileEl.style.filter = 'none';
        }
    });

    // Show/hide focus mode indicator banner
    showFocusModeIndicator(isActive);
}


// Show/hide focus mode indicator banner
function showFocusModeIndicator(show) {
    let indicator = document.getElementById('focusModeIndicator');

    if (show) {
        if (!indicator) {
            // Create indicator if it doesn't exist
            indicator = document.createElement('div');
            indicator.id = 'focusModeIndicator';
            indicator.className = 'focus-mode-indicator';
            indicator.innerHTML = '<span>🎯</span> Focus Mode Active';
            document.body.appendChild(indicator);
        }
        indicator.style.display = 'flex';
    } else {
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
}

// Select wallpaper folder using File System Access API (with fallback)
async function selectWallpaperFolder() {
    try {
        // Check if File System Access API is supported
        if ('showDirectoryPicker' in window) {
            await selectWallpaperFolderModern();
        } else {
            // Fallback to multiple file input
            await selectWallpaperFolderFallback();
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Folder selection cancelled');
        } else {
            console.error('Error selecting wallpaper folder:', error);
            showToast('Error selecting wallpaper folder', 'error');
        }
    }
}

// Modern approach: File System Access API (Chrome/Edge)
async function selectWallpaperFolderModern() {
    // Show directory picker
    const directoryHandle = await window.showDirectoryPicker({
        mode: 'read',
        startIn: 'pictures'
    });

    // Read all files from the directory (metadata only)
    const wallpaperFiles = [];
    const validImageFormats = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    const validVideoFormats = ['video/mp4', 'video/webm', 'video/ogg'];
    const validExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.webm', '.ogg'];

    showToast('Scanning wallpapers...', 'info');

    for await (const entry of directoryHandle.values()) {
        // Only process files (not subdirectories)
        if (entry.kind === 'file') {
            const file = await entry.getFile();

            // Check if file is a valid image or video format
            const isValidType = [...validImageFormats, ...validVideoFormats].includes(file.type);
            const hasValidExtension = validExtensions.some(ext =>
                file.name.toLowerCase().endsWith(ext)
            );

            if (isValidType || hasValidExtension) {
                // Determine media type
                const isVideo = validVideoFormats.includes(file.type) ||
                    ['.mp4', '.webm', '.ogg'].some(ext => file.name.toLowerCase().endsWith(ext));

                // Store file reference with metadata (no caching yet)
                wallpaperFiles.push({
                    name: file.name,
                    type: isVideo ? 'video' : 'image',
                    mimeType: file.type,
                    size: file.size,
                    lastModified: file.lastModified
                });
            }
        }
    }

    if (wallpaperFiles.length === 0) {
        showToast('No valid image or video files found in folder', 'error');
        return;
    }

    // Save wallpaper folder metadata to IndexedDB (with directory handle for on-demand loading)
    await saveWallpaperFolderMetadata({
        folderName: directoryHandle.name,
        fileCount: wallpaperFiles.length,
        files: wallpaperFiles,
        selectedAt: Date.now(),
        useFileSystemAPI: true
    });

    // Store the directory handle for future access (as backup)
    await saveDirectoryHandle(directoryHandle);

    showToast(`Found ${wallpaperFiles.length} wallpaper(s)`, 'success');

    // Update the folder status display
    await displayWallpaperFolderStatus();

    // Automatically set a random wallpaper from the folder
    await changeRandomWallpaper();
}

// Fallback approach: Multiple file input (Firefox/Safari)
async function selectWallpaperFolderFallback() {
    return new Promise((resolve, reject) => {
        // Create a temporary file input
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'image/*,video/*';

        input.onchange = async (e) => {
            try {
                const files = Array.from(e.target.files);

                if (files.length === 0) {
                    showToast('No files selected', 'error');
                    reject(new Error('No files selected'));
                    return;
                }

                const wallpaperFiles = [];
                const validImageFormats = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
                const validVideoFormats = ['video/mp4', 'video/webm', 'video/ogg'];

                // Process each file and store in IndexedDB
                for (const file of files) {
                    const isImage = validImageFormats.includes(file.type);
                    const isVideo = validVideoFormats.includes(file.type);

                    if (isImage || isVideo) {
                        // Store file metadata
                        wallpaperFiles.push({
                            name: file.name,
                            type: isVideo ? 'video' : 'image',
                            mimeType: file.type,
                            size: file.size,
                            lastModified: file.lastModified
                        });

                        // Read and store the actual file data (fallback mode stores all files)
                        const reader = new FileReader();
                        await new Promise((resolveRead, rejectRead) => {
                            reader.onload = async (event) => {
                                try {
                                    await saveWallpaperToFolder(file.name, event.target.result);
                                    resolveRead();
                                } catch (error) {
                                    rejectRead(error);
                                }
                            };
                            reader.onerror = rejectRead;
                            reader.readAsDataURL(file);
                        });
                    }
                }

                if (wallpaperFiles.length === 0) {
                    showToast('No valid image or video files selected', 'error');
                    reject(new Error('No valid files'));
                    return;
                }

                // Save wallpaper folder metadata
                await saveWallpaperFolderMetadata({
                    folderName: 'Selected Files',
                    fileCount: wallpaperFiles.length,
                    files: wallpaperFiles,
                    selectedAt: Date.now(),
                    useFileSystemAPI: false
                });

                showToast(`Loaded ${wallpaperFiles.length} wallpaper(s)`, 'success');

                // Update the folder status display
                await displayWallpaperFolderStatus();

                // Automatically set a random wallpaper from the folder
                await changeRandomWallpaper();

                resolve();
            } catch (error) {
                reject(error);
            }
        };

        input.oncancel = () => {
            reject(new Error('AbortError'));
        };

        input.click();
    });
}

// Save individual wallpaper to IndexedDB wallpaperFolder store
async function saveWallpaperToFolder(fileName, dataUrl) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([WALLPAPER_FOLDER_STORE], 'readwrite');
        const store = transaction.objectStore(WALLPAPER_FOLDER_STORE);

        store.put(dataUrl, `wallpaper_${fileName}`);

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

// Save wallpaper folder metadata to IndexedDB
async function saveWallpaperFolderMetadata(metadata) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([WALLPAPER_FOLDER_STORE], 'readwrite');
        const store = transaction.objectStore(WALLPAPER_FOLDER_STORE);

        store.put(metadata, 'folderMetadata');

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

// Save directory handle for File System Access API
async function saveDirectoryHandle(directoryHandle) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([WALLPAPER_FOLDER_STORE], 'readwrite');
            const store = transaction.objectStore(WALLPAPER_FOLDER_STORE);

            store.put(directoryHandle, 'directoryHandle');

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (error) {
        console.error('Error saving directory handle:', error);
    }
}

// Load directory handle from IndexedDB
async function loadDirectoryHandle() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([WALLPAPER_FOLDER_STORE], 'readonly');
            const store = transaction.objectStore(WALLPAPER_FOLDER_STORE);

            const request = store.get('directoryHandle');

            transaction.oncomplete = () => {
                resolve(request.result);
            };
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (error) {
        console.log('No directory handle in IndexedDB');
        return null;
    }
}

// Load wallpaper folder metadata from IndexedDB
async function loadWallpaperFolderMetadata() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([WALLPAPER_FOLDER_STORE], 'readonly');
            const store = transaction.objectStore(WALLPAPER_FOLDER_STORE);

            const request = store.get('folderMetadata');

            transaction.oncomplete = () => {
                resolve(request.result);
            };
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (error) {
        console.log('No wallpaper folder metadata in IndexedDB');
        return null;
    }
}

// Load wallpaper from folder by filename
async function loadWallpaperFromFolder(fileName) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([WALLPAPER_FOLDER_STORE], 'readonly');
            const store = transaction.objectStore(WALLPAPER_FOLDER_STORE);

            const request = store.get(`wallpaper_${fileName}`);

            transaction.oncomplete = () => {
                resolve(request.result);
            };
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (error) {
        console.error('Error loading wallpaper from folder:', error);
        return null;
    }
}

// Remove cached wallpaper from IndexedDB
async function removeCachedWallpaper(fileName) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([WALLPAPER_FOLDER_STORE], 'readwrite');
            const store = transaction.objectStore(WALLPAPER_FOLDER_STORE);

            store.delete(`wallpaper_${fileName}`);

            transaction.oncomplete = () => {
                console.log(`Removed cached wallpaper: ${fileName}`);
                resolve();
            };
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (error) {
        console.error('Error removing cached wallpaper:', error);
    }
}

async function changeRandomWallpaper() {
    try {
        // Load wallpaper folder metadata
        const metadata = await loadWallpaperFolderMetadata();

        if (!metadata || !metadata.files || metadata.files.length === 0) {
            showToast('No wallpaper folder selected. Please select a folder first.', 'error');
            return;
        }

        // Get the last selected wallpaper from settings (if any)
        const lastWallpaper = settings.lastRandomWallpaper;

        let selectedFile;

        // If there's only one wallpaper, use it
        if (metadata.files.length === 1) {
            selectedFile = metadata.files[0];
        } else {
            // Generate random index, ensuring it's different from the last one
            let randomIndex;
            do {
                randomIndex = Math.floor(Math.random() * metadata.files.length);
                selectedFile = metadata.files[randomIndex];
            } while (metadata.files.length > 1 && selectedFile.name === lastWallpaper);
        }

        console.log('Loading wallpaper:', selectedFile.name);

        // Remove previous cached wallpaper to save resources
        if (lastWallpaper && lastWallpaper !== selectedFile.name) {
            await removeCachedWallpaper(lastWallpaper);
        }

        let wallpaperDataUrl;

        // Try to load from cache first
        wallpaperDataUrl = await loadWallpaperFromFolder(selectedFile.name);

        if (!wallpaperDataUrl) {
            // Not cached yet, load on-demand and cache it
            console.log('Wallpaper not cached, loading on-demand...');
            showToast('Loading wallpaper...', 'info');

            wallpaperDataUrl = await loadWallpaperOnDemand(selectedFile.name);

            if (!wallpaperDataUrl) {
                console.error('Failed to load wallpaper:', selectedFile.name);
                showToast('Failed to load wallpaper. Please reselect your wallpaper folder.', 'error');
                return;
            }

            console.log('Wallpaper loaded and cached successfully');
        } else {
            console.log('Wallpaper loaded from cache');
        }

        // Apply the wallpaper based on type
        if (selectedFile.type === 'video') {
            // Apply video wallpaper
            const videoElement = document.getElementById('wallpaperVideo');
            const wallpaperElement = document.getElementById('wallpaper');

            videoElement.src = wallpaperDataUrl;
            videoElement.style.display = 'block';
            wallpaperElement.style.backgroundImage = 'none';

            // Save to main wallpaper storage
            await saveWallpaperToDB(wallpaperDataUrl, 'video');
        } else {
            // Apply image wallpaper
            const wallpaperElement = document.getElementById('wallpaper');
            const videoElement = document.getElementById('wallpaperVideo');

            wallpaperElement.style.backgroundImage = `url(${wallpaperDataUrl})`;
            videoElement.style.display = 'none';

            // Save to main wallpaper storage
            await saveWallpaperToDB(wallpaperDataUrl, 'image');
        }

        // Remember this wallpaper to avoid selecting it next time
        settings.lastRandomWallpaper = selectedFile.name;
        await saveSettings();

        showToast(`Wallpaper changed: ${selectedFile.name}`, 'success');
    } catch (error) {
        console.error('Error changing random wallpaper:', error);
        showToast('Error changing wallpaper. Try reselecting the folder.', 'error');
    }
}

// Load wallpaper on-demand using File System Access API
async function loadWallpaperOnDemand(fileName) {
    try {
        // First, try to load from IndexedDB cache
        const cachedWallpaper = await loadWallpaperFromFolder(fileName);
        if (cachedWallpaper) {
            return cachedWallpaper;
        }

        // If not cached, load from directory handle
        const directoryHandle = await loadDirectoryHandle();

        if (!directoryHandle) {
            throw new Error('Directory handle not found');
        }

        // Check permission and request if needed
        let permission = await directoryHandle.queryPermission({ mode: 'read' });
        if (permission !== 'granted') {
            // Request permission again
            permission = await directoryHandle.requestPermission({ mode: 'read' });
            if (permission !== 'granted') {
                throw new Error('Permission not granted - please reselect folder');
            }
        }

        // Get the file handle
        const fileHandle = await directoryHandle.getFileHandle(fileName);
        const file = await fileHandle.getFile();

        // Read file as data URL
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        // Cache it in IndexedDB for future use
        await saveWallpaperToFolder(fileName, dataUrl);

        return dataUrl;
    } catch (error) {
        console.error('Error loading wallpaper on-demand:', error);
        // Fallback: try loading from IndexedDB if it was cached
        return await loadWallpaperFromFolder(fileName);
    }
}

// Display wallpaper folder status in the UI
async function displayWallpaperFolderStatus() {
    try {
        const statusElement = document.getElementById('wallpaperFolderStatus');
        if (!statusElement) return;

        // Load wallpaper folder metadata
        const metadata = await loadWallpaperFolderMetadata();

        if (metadata && metadata.files && metadata.files.length > 0) {
            // Count images and videos
            const imageCount = metadata.files.filter(f => f.type === 'image').length;
            const videoCount = metadata.files.filter(f => f.type === 'video').length;

            let countText = '';
            if (imageCount > 0 && videoCount > 0) {
                countText = `${imageCount} image${imageCount !== 1 ? 's' : ''}, ${videoCount} video${videoCount !== 1 ? 's' : ''}`;
            } else if (imageCount > 0) {
                countText = `${imageCount} image${imageCount !== 1 ? 's' : ''}`;
            } else {
                countText = `${videoCount} video${videoCount !== 1 ? 's' : ''}`;
            }

            const methodText = metadata.useFileSystemAPI ? '(On-demand loading)' : '(Stored locally)';

            // Display folder information
            statusElement.innerHTML = `
                <div class="folder-name">📁 ${metadata.folderName || 'Wallpaper Folder'}</div>
                <div class="folder-count">${countText} available ${methodText}</div>
            `;
            statusElement.classList.add('active');
        } else {
            // No folder selected
            statusElement.innerHTML = '';
            statusElement.classList.remove('active');
        }
    } catch (error) {
        console.error('Error displaying wallpaper folder status:', error);
        // Silently fail - don't show error to user for this non-critical feature
    }
}

// Initialize wallpaper folder status on startup
async function initializeWallpaperFolder() {
    try {
        // Display the folder status if a folder was previously selected
        await displayWallpaperFolderStatus();

        // Verify that wallpaper data is still accessible
        const metadata = await loadWallpaperFolderMetadata();
        if (metadata && metadata.files && metadata.files.length > 0) {
            // Data is persisted and accessible - no action needed
            console.log(`Wallpaper folder loaded: ${metadata.folderName} with ${metadata.fileCount} images`);
        }
    } catch (error) {
        console.error('Error initializing wallpaper folder:', error);
        // Handle permission errors gracefully by clearing the status
        const statusElement = document.getElementById('wallpaperFolderStatus');
        if (statusElement) {
            statusElement.classList.remove('active');
        }
    }
}

function navigateTiles(direction) {
    // Get all visible tiles (excluding the add-tile button)
    const tileElements = Array.from(document.querySelectorAll('.tile:not(.add-tile)'));

    if (tileElements.length === 0) return;

    // If no tile is selected, select the first one
    if (selectedTileIndex === -1) {
        selectedTileIndex = 0;
        updateTileSelection(tileElements);
        return;
    }

    // Calculate grid dimensions
    const gridElement = document.getElementById('tilesGrid');
    const gridStyles = window.getComputedStyle(gridElement);
    const gridTemplateColumns = gridStyles.gridTemplateColumns.split(' ').length;
    const columns = gridTemplateColumns;
    const rows = Math.ceil(tileElements.length / columns);

    // Calculate current row and column
    const currentRow = Math.floor(selectedTileIndex / columns);
    const currentCol = selectedTileIndex % columns;

    let newIndex = selectedTileIndex;

    switch (direction) {
        case 'up':
            if (currentRow > 0) {
                newIndex = selectedTileIndex - columns;
            }
            break;
        case 'down':
            if (currentRow < rows - 1) {
                newIndex = selectedTileIndex + columns;
                // Make sure we don't go beyond the last tile
                if (newIndex >= tileElements.length) {
                    newIndex = tileElements.length - 1;
                }
            }
            break;
        case 'left':
            if (currentCol > 0) {
                newIndex = selectedTileIndex - 1;
            }
            break;
        case 'right':
            if (currentCol < columns - 1 && selectedTileIndex < tileElements.length - 1) {
                newIndex = selectedTileIndex + 1;
            }
            break;
    }

    // Update selection if index changed
    if (newIndex !== selectedTileIndex) {
        selectedTileIndex = newIndex;
        updateTileSelection(tileElements);
    }
}

function updateTileSelection(tileElements) {
    // Remove selection from all tiles
    tileElements.forEach(el => el.classList.remove('tile-selected'));

    // Add selection to current tile
    if (selectedTileIndex >= 0 && selectedTileIndex < tileElements.length) {
        const selectedElement = tileElements[selectedTileIndex];
        selectedElement.classList.add('tile-selected');

        // Scroll into view if needed
        selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function openSelectedTile() {
    const tileElements = Array.from(document.querySelectorAll('.tile:not(.add-tile)'));

    if (selectedTileIndex === -1 || selectedTileIndex >= tileElements.length) {
        showToast('No tile selected', 'info');
        return;
    }

    const selectedElement = tileElements[selectedTileIndex];
    const tileId = selectedElement.dataset.id;

    // Find the tile object
    const tile = tiles.find(t => t.id === tileId);

    if (!tile) return;

    // If it's a folder, open the folder
    if (tile.type === 'folder') {
        openFolder(tile);
    } else {
        // Open the URL in current tab
        window.location.href = tile.url;
    }
}

async function deleteSelectedTile() {
    const tileElements = Array.from(document.querySelectorAll('.tile:not(.add-tile)'));

    if (selectedTileIndex === -1 || selectedTileIndex >= tileElements.length) {
        showToast('No tile selected', 'info');
        return;
    }

    const selectedElement = tileElements[selectedTileIndex];
    const tileId = selectedElement.dataset.id;

    // Find the tile object
    const tile = tiles.find(t => t.id === tileId);

    if (!tile) return;

    // Confirm deletion
    if (tile.type === 'folder') {
        const confirmDelete = await showConfirmModal(
            `Delete folder "${tile.name}" and all its contents?`,
            'Delete Folder',
            true
        );
        if (!confirmDelete) return;
    }

    // Remove the tile
    removeTile(tileId);

    // Adjust selected index after deletion
    if (selectedTileIndex >= tileElements.length - 1) {
        selectedTileIndex = Math.max(0, tileElements.length - 2);
    }

    // Update selection after re-render
    setTimeout(() => {
        const updatedTileElements = Array.from(document.querySelectorAll('.tile:not(.add-tile)'));
        if (updatedTileElements.length > 0) {
            updateTileSelection(updatedTileElements);
        } else {
            selectedTileIndex = -1;
        }
    }, 50);
}

function showKeyboardShortcutsHelp() {
    const modal = document.getElementById('keyboardHelpModal');
    const shortcutsGrid = document.getElementById('shortcutsGrid');

    // Clear existing content
    shortcutsGrid.innerHTML = '';

    // Define shortcut descriptions
    const shortcutDescriptions = {
        newTile: 'Create new tile',
        focusMode: 'Toggle focus mode',
        changeWallpaper: 'Change wallpaper',
        navigateUp: 'Navigate up',
        navigateDown: 'Navigate down',
        navigateLeft: 'Navigate left',
        navigateRight: 'Navigate right',
        openTile: 'Open selected tile',
        deleteTile: 'Delete selected tile',
        showHelp: 'Show this help'
    };

    // Get shortcuts from settings
    const shortcuts = settings.keyboardShortcuts || {};

    // Render each shortcut
    Object.entries(shortcuts).forEach(([action, key]) => {
        const description = shortcutDescriptions[action] || action;

        const shortcutItem = document.createElement('div');
        shortcutItem.className = 'shortcut-item';

        const descriptionEl = document.createElement('span');
        descriptionEl.className = 'shortcut-description';
        descriptionEl.textContent = description;

        const keyEl = document.createElement('kbd');
        keyEl.className = 'shortcut-key';
        // Format key display (e.g., ArrowUp -> ↑)
        const displayKey = formatKeyDisplay(key);
        keyEl.textContent = displayKey;

        shortcutItem.appendChild(descriptionEl);
        shortcutItem.appendChild(keyEl);
        shortcutsGrid.appendChild(shortcutItem);
    });

    // Show the modal
    modal.style.display = 'block';
}

// Helper function to format key display
function formatKeyDisplay(key) {
    const keyMap = {
        'ArrowUp': '↑',
        'ArrowDown': '↓',
        'ArrowLeft': '←',
        'ArrowRight': '→',
        'Enter': '↵',
        'Delete': 'Del',
        '?': '?',
        'Escape': 'Esc'
    };

    return keyMap[key] || key.toUpperCase();
}

// Cycle through time fonts
async function cycleTimeFont() {
    try {
        const currentFont = settings.timeFont || 'outfit';
        const currentIndex = TIME_FONTS.indexOf(currentFont);
        const nextIndex = (currentIndex + 1) % TIME_FONTS.length;
        const nextFont = TIME_FONTS[nextIndex];

        settings.timeFont = nextFont;
        await saveSettings();
        applyTimeFont(nextFont);
        showToast(`Time font: ${nextFont}`, 'success');
    } catch (error) {
        console.error('Error cycling time font:', error);
        showToast('Error changing font. Please try again.', 'error');
    }
}

// Apply theme to searchbar
function applyThemeToSearchbar() {
    const searchContainer = document.querySelector('.search-container');
    const searchInput = document.getElementById('searchInput');

    if (!searchContainer || !searchInput) return;

    // Reset styles first
    searchContainer.style.background = '';
    searchContainer.style.backdropFilter = '';
    searchContainer.style.webkitBackdropFilter = '';
    searchContainer.style.border = '';
    searchContainer.style.boxShadow = '';
    searchInput.style.color = '';
    searchInput.style.background = '';
    searchInput.style.border = '';
    searchInput.style.boxShadow = '';
    searchInput.style.backdropFilter = '';
    searchInput.style.webkitBackdropFilter = '';

    // Apply theme if checkbox is checked
    if (settings.applyThemeToSearchbar && settings.tileTheme !== 'custom') {
        const themeColor = getThemeColor(settings.tileTheme);

        if (themeColor === 'glassmorphism') {
            searchInput.style.background = 'rgba(255, 255, 255, 0.1)';
            searchInput.style.backdropFilter = 'blur(10px)';
            searchInput.style.webkitBackdropFilter = 'blur(10px)';
            searchInput.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            searchInput.style.boxShadow = '0 8px 32px 0 rgba(0, 0, 0, 0.37)';
            searchInput.style.color = '#ffffff';
        } else if (themeColor === 'liquid-glass') {
            searchInput.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)';
            searchInput.style.backdropFilter = 'blur(20px) saturate(180%)';
            searchInput.style.webkitBackdropFilter = 'blur(20px) saturate(180%)';
            searchInput.style.border = '1px solid rgba(255, 255, 255, 0.3)';
            searchInput.style.boxShadow = '0 8px 32px 0 rgba(31, 38, 135, 0.37), inset 0 1px 0 0 rgba(255, 255, 255, 0.5)';
            searchInput.style.color = '#ffffff';
        } else if (themeColor && themeColor.includes('gradient')) {
            searchInput.style.background = themeColor;
            searchInput.style.color = '#ffffff';
            searchInput.style.border = '1px solid rgba(255, 255, 255, 0.3)';
        } else if (themeColor) {
            searchInput.style.background = themeColor;

            const rgb = hexToRgb(themeColor);
            if (rgb) {
                const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                if (brightness < 128) {
                    searchInput.style.color = '#ffffff';
                } else {
                    searchInput.style.color = '#000000';
                }
            }
        }

        // Update placeholder color
        const style = document.createElement('style');
        style.id = 'searchbar-theme-style';
        const existingStyle = document.getElementById('searchbar-theme-style');
        if (existingStyle) {
            existingStyle.remove();
        }

        if (themeColor === 'glassmorphism' || themeColor === 'liquid-glass' || (themeColor && themeColor.includes('gradient'))) {
            style.textContent = `
                #searchInput::placeholder {
                    color: rgba(255, 255, 255, 0.6);
                }
            `;
        } else if (themeColor) {
            const rgb = hexToRgb(themeColor);
            if (rgb) {
                const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                if (brightness < 128) {
                    style.textContent = `
                        #searchInput::placeholder {
                            color: rgba(255, 255, 255, 0.6);
                        }
                    `;
                }
            }
        }

        if (style.textContent) {
            document.head.appendChild(style);
        }
    } else {
        // Remove custom placeholder style
        const existingStyle = document.getElementById('searchbar-theme-style');
        if (existingStyle) {
            existingStyle.remove();
        }
    }
}

// Search
function initializeSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchContainer = document.querySelector('.search-container');
    const searchButton = document.getElementById('searchButton');

    // Double-click to collapse/expand search bar
    searchInput.addEventListener('dblclick', (e) => {
        e.preventDefault();
        toggleSearchBar();
    });

    // Click search button to expand
    searchButton.addEventListener('click', (e) => {
        e.preventDefault();
        toggleSearchBar();
    });

    // Function to toggle search bar collapse/expand
    function toggleSearchBar() {
        searchContainer.classList.toggle('collapsed');

        // If expanding, focus the input after animation
        if (!searchContainer.classList.contains('collapsed')) {
            setTimeout(() => {
                searchInput.focus();
            }, 600); // Match the CSS transition duration
        }
    }

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query) {
                // Check if it's a URL
                if (query.includes('.') && !query.includes(' ')) {
                    const url = query.startsWith('http') ? query : `https://${query}`;
                    window.open(url, '_blank');
                } else {
                    // Search with selected search engine
                    const searchEngine = settings.searchEngine || 'google';
                    const searchUrls = {
                        google: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
                        bing: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
                        duckduckgo: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
                    };
                    window.open(searchUrls[searchEngine], '_blank');
                }
                // Clear search input after opening
                searchInput.value = '';
            }
        }
    });
}

// Initialize search engine dropdown
function initializeSearchEngine() {
    const searchEngineBtn = document.getElementById('searchEngineBtn');
    const searchEngineMenu = document.getElementById('searchEngineMenu');
    const searchEngineIcon = document.getElementById('searchEngineIcon');
    const searchEngineItems = document.querySelectorAll('.search-engine-item');

    // Set initial icon
    updateSearchEngineIcon(settings.searchEngine || 'google');

    // Toggle dropdown
    searchEngineBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        searchEngineMenu.classList.toggle('active');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-engine-dropdown')) {
            searchEngineMenu.classList.remove('active');
        }
    });

    // Handle search engine selection
    searchEngineItems.forEach(item => {
        item.addEventListener('click', async () => {
            const engine = item.dataset.engine;
            settings.searchEngine = engine;
            await saveSettings();
            updateSearchEngineIcon(engine);
            searchEngineMenu.classList.remove('active');
            showToast(`Search engine changed to ${engine.charAt(0).toUpperCase() + engine.slice(1)}`, 'success');
        });
    });

    function updateSearchEngineIcon(engine) {
        const icons = {
            google: 'https://www.google.com/favicon.ico',
            bing: 'https://www.bing.com/favicon.ico',
            duckduckgo: 'https://duckduckgo.com/favicon.ico'
        };
        searchEngineIcon.src = icons[engine] || icons.google;

        // Update active state
        searchEngineItems.forEach(item => {
            if (item.dataset.engine === engine) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
}


// Modals
function initializeModals() {
    // Settings sidebar
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsSidebar = document.getElementById('settingsSidebar');
    const settingsOverlay = document.getElementById('settingsOverlay');
    const closeSidebar = document.getElementById('closeSidebar');
    const wallpaperInput = document.getElementById('wallpaperInput');
    const removeWallpaper = document.getElementById('removeWallpaper');
    const tileSizeSelect = document.getElementById('tileSize');

    // Focus mode button
    const focusModeBtn = document.getElementById('focusModeBtn');
    focusModeBtn.addEventListener('click', toggleFocusMode);

    // Open sidebar
    settingsBtn.addEventListener('click', () => {
        settingsSidebar.classList.add('open');
        settingsOverlay.classList.add('active');
    });

    // Close sidebar
    const closeSidebarFunc = () => {
        settingsSidebar.classList.remove('open');
        settingsOverlay.classList.remove('active');
    };

    closeSidebar.addEventListener('click', closeSidebarFunc);
    settingsOverlay.addEventListener('click', closeSidebarFunc);

    wallpaperInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            const isVideo = file.type.startsWith('video/');

            const reader = new FileReader();

            reader.onerror = () => {
                console.error('Error reading file. Please try again.');
                e.target.value = '';
            };

            reader.onload = async (event) => {
                try {
                    const dataUrl = event.target.result;

                    if (isVideo) {
                        // Set video wallpaper
                        const videoElement = document.getElementById('wallpaperVideo');
                        videoElement.src = dataUrl;
                        videoElement.style.display = 'block';
                        document.getElementById('wallpaper').style.backgroundImage = '';

                        try {
                            await saveWallpaperToDB(dataUrl, 'video');
                        } catch (storageError) {
                            // Storage quota exceeded
                            videoElement.style.display = 'none';
                            videoElement.src = '';
                            console.error('Storage quota exceeded. The video file is too large for browser storage.');
                            e.target.value = '';
                            return;
                        }
                    } else {
                        // Set image wallpaper
                        document.getElementById('wallpaper').style.backgroundImage = `url(${dataUrl})`;
                        document.getElementById('wallpaperVideo').style.display = 'none';

                        try {
                            await saveWallpaperToDB(dataUrl, 'image');
                        } catch (storageError) {
                            // Storage quota exceeded
                            document.getElementById('wallpaper').style.backgroundImage = '';
                            console.error('Storage quota exceeded. The image file is too large for browser storage.');
                            e.target.value = '';
                            return;
                        }
                    }
                } catch (error) {
                    console.error('Error setting wallpaper:', error);
                    e.target.value = '';
                }
            };

            reader.readAsDataURL(file);
        }
    });

    removeWallpaper.addEventListener('click', async () => {
        document.getElementById('wallpaper').style.backgroundImage = '';
        document.getElementById('wallpaperVideo').style.display = 'none';
        document.getElementById('wallpaperVideo').src = '';
        await removeWallpaperFromDB();
    });

    // Select wallpaper folder button
    const selectWallpaperFolderBtn = document.getElementById('selectWallpaperFolder');
    selectWallpaperFolderBtn.addEventListener('click', selectWallpaperFolder);

    // Floating wallpaper button
    const wallpaperBtn = document.getElementById('wallpaperBtn');
    wallpaperBtn.addEventListener('click', changeRandomWallpaper);

    tileSizeSelect.addEventListener('change', async (e) => {
        settings.tileSize = e.target.value;
        await saveSettings();
        renderTiles();
    });

    // Tile theme selector
    const tileThemeSelect = document.getElementById('tileTheme');
    tileThemeSelect.addEventListener('change', async (e) => {
        settings.tileTheme = e.target.value;
        await saveSettings();
        renderTiles();
        applyThemeToSearchbar();
        const themeName = e.target.options[e.target.selectedIndex].text;
        showToast(`Tile theme changed to ${themeName}`, 'success');
    });

    // Apply theme to searchbar checkbox
    const applyThemeToSearchbarCheckbox = document.getElementById('applyThemeToSearchbar');
    applyThemeToSearchbarCheckbox.addEventListener('change', async (e) => {
        settings.applyThemeToSearchbar = e.target.checked;
        await saveSettings();
        applyThemeToSearchbar();
        showToast(e.target.checked ? 'Theme applied to search bar' : 'Search bar theme removed', 'success');
    });

    // Time font selector
    const timeFontSelect = document.getElementById('timeFont');
    timeFontSelect.addEventListener('change', async (e) => {
        settings.timeFont = e.target.value;
        await saveSettings();
        applyTimeFont(e.target.value);
    });

    // Time format selector
    const timeFormatSelect = document.getElementById('timeFormat');
    timeFormatSelect.addEventListener('change', async (e) => {
        settings.timeFormat = e.target.value;
        await saveSettings();
        initializeClock(); // Reinitialize clock to apply new format immediately
        showToast(`Time format changed to ${e.target.value === '24h' ? '24-hour' : '12-hour'}`, 'success');
    });

    // Show quotes toggle
    const showQuotesCheckbox = document.getElementById('showQuotes');
    showQuotesCheckbox.addEventListener('change', async (e) => {
        settings.showQuotes = e.target.checked;
        await saveSettings();
        displayQuotes();
    });

    // Quote position selector
    const quotePositionSelect = document.getElementById('quotePosition');
    quotePositionSelect.addEventListener('change', async (e) => {
        settings.quotePosition = e.target.value;
        await saveSettings();
        displayQuotes();
    });

    // Export/Import state
    const exportStateBtn = document.getElementById('exportState');
    const importStateBtn = document.getElementById('importState');
    const importStateFile = document.getElementById('importStateFile');

    exportStateBtn.addEventListener('click', exportState);
    importStateBtn.addEventListener('click', () => importStateFile.click());
    importStateFile.addEventListener('change', importState);

    // Dark mode toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    darkModeToggle.checked = settings.darkModeEnabled || false;
    darkModeToggle.addEventListener('change', async (e) => {
        settings.darkModeEnabled = e.target.checked;
        await saveSettings();
        showToast(e.target.checked ? 'Dark mode enabled on all tabs' : 'Dark mode disabled', 'success');
    });

    // Edit modal
    const editModal = document.getElementById('editModal');
    const editForm = document.getElementById('editForm');
    const cancelEdit = document.getElementById('cancelEdit');
    const deleteTile = document.getElementById('deleteTile');

    editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveTileEdit();
    });

    cancelEdit.addEventListener('click', () => {
        editModal.style.display = 'none';
    });

    deleteTile.addEventListener('click', async () => {
        const confirmed = await showConfirmModal(
            'Are you sure you want to delete this tile?',
            'Delete Tile',
            true
        );
        if (confirmed) {
            const tileId = editForm.dataset.tileId;
            await removeTile(tileId);
            editModal.style.display = 'none';
        }
    });

    // Custom icon upload handler
    const customIconInput = document.getElementById('customIconInput');
    customIconInput.addEventListener('change', handleCustomIconUpload);

    // Folder modal
    const folderModal = document.getElementById('folderModal');
    const folderNameInput = document.getElementById('folderName');

    folderNameInput.addEventListener('change', () => {
        if (currentFolder) {
            currentFolder.name = folderNameInput.value;
            saveData();
            renderTiles();
        }
    });

    // Close modals
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            closeBtn.closest('.modal').style.display = 'none';
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });

    // ESC key handler for keyboard help modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const keyboardHelpModal = document.getElementById('keyboardHelpModal');
            if (keyboardHelpModal && keyboardHelpModal.style.display === 'block') {
                keyboardHelpModal.style.display = 'none';
            }
        }
    });
}

// Initialize context menu
function initializeContextMenu() {
    const contextMenu = document.getElementById('contextMenu');
    const contextEdit = document.getElementById('contextEdit');
    const contextFocus = document.getElementById('contextFocus');
    const contextFocusText = document.getElementById('contextFocusText');
    const contextUnpin = document.getElementById('contextUnpin');
    const contextRemove = document.getElementById('contextRemove');

    // Edit tile
    contextEdit.addEventListener('click', () => {
        if (contextMenuTile) {
            openEditModal(contextMenuTile);
            contextMenu.style.display = 'none';
        }
    });

    // Toggle focus mode for tile
    contextFocus.addEventListener('click', async () => {
        if (contextMenuTile) {
            await toggleTileFocus(contextMenuTile.id);
            contextMenu.style.display = 'none';
        }
    });

    // Unpin (same as remove for now)
    contextUnpin.addEventListener('click', async () => {
        if (contextMenuTile) {
            await removeTile(contextMenuTile.id);
            contextMenu.style.display = 'none';
        }
    });

    // Remove tile
    contextRemove.addEventListener('click', async () => {
        if (contextMenuTile) {
            const confirmed = await showConfirmModal(
                'Are you sure you want to remove this tile?',
                'Remove Tile',
                true
            );
            if (confirmed) {
                await removeTile(contextMenuTile.id);
            }
            contextMenu.style.display = 'none';
        }
    });

    // Close context menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.context-menu') && !e.target.closest('.delete-btn')) {
            contextMenu.style.display = 'none';
        }
    });
}

// Show context menu
function showContextMenu(tile, event) {
    event.preventDefault();
    event.stopPropagation();

    const contextMenu = document.getElementById('contextMenu');
    const contextFocusText = document.getElementById('contextFocusText');
    contextMenuTile = tile;

    // Update focus mode text based on tile's focus state
    if (tile.focusEnabled) {
        contextFocusText.textContent = 'Unmark for Focus';
    } else {
        contextFocusText.textContent = 'Mark for Focus';
    }

    // Get the tile element that triggered the menu
    const tileElement = event.currentTarget.closest('.tile');

    // Position the menu
    let x, y;

    if (tileElement) {
        // Use the tile's position for more accurate placement
        const tileRect = tileElement.getBoundingClientRect();
        x = tileRect.right - 10; // Position near the right edge of the tile
        y = tileRect.top + 10; // Position near the top of the tile
    } else {
        // Fallback to click position
        x = event.clientX;
        y = event.clientY;
    }

    contextMenu.style.display = 'block';
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';
    contextMenu.style.transform = '';

    // Adjust if menu goes off screen
    setTimeout(() => {
        const rect = contextMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            contextMenu.style.left = (x - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            contextMenu.style.top = (y - rect.height) + 'px';
        }
        if (rect.top < 0) {
            contextMenu.style.top = '10px';
        }
        if (rect.left < 0) {
            contextMenu.style.left = '10px';
        }
    }, 0);
}

// Render tiles
function renderTiles(container = null, tilesToRender = null, isInsideFolder = false) {
    const grid = container || document.getElementById('tilesGrid');
    const items = tilesToRender || tiles;

    console.log('Rendering tiles:', items);

    if (!grid) {
        console.error('Grid element not found');
        return;
    }

    grid.innerHTML = '';

    // Apply tile size class to main grid only
    if (!container) {
        grid.className = 'tiles-grid';
        grid.classList.add(`size-${settings.tileSize}`);

        // Clear keyboard selection when re-rendering main grid
        selectedTileIndex = -1;
    }

    // Render tiles
    items.forEach(tile => {
        const tileElement = createTileElement(tile, isInsideFolder);
        grid.appendChild(tileElement);
    });

    // Add "+" button (only on main grid, not inside folders)
    if (!container) {
        const addTile = document.createElement('div');
        addTile.className = 'tile add-tile';
        addTile.innerHTML = '<div class="add-icon">+</div>';
        addTile.addEventListener('click', () => openEditModal());

        // Make add-tile a valid drop target
        addTile.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (draggedTile) {
                addTile.style.opacity = '0.5';
            }
        });

        addTile.addEventListener('dragleave', () => {
            addTile.style.opacity = '';
        });

        addTile.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            addTile.style.opacity = '';

            console.log('=== DROP ON ADD TILE BUTTON ===');

            if (draggedTile) {
                // Find which folder the tile is in
                let sourceFolder = null;
                tiles.forEach(tile => {
                    if (tile.type === 'folder' && tile.items.some(item => item.id === draggedTile.id)) {
                        sourceFolder = tile;
                    }
                });

                if (sourceFolder) {
                    // Remove from source folder
                    sourceFolder.items = sourceFolder.items.filter(item => item.id !== draggedTile.id);

                    // Add to main tiles
                    tiles.push(draggedTile);

                    // Check if folder is now empty and delete it
                    checkAndDeleteEmptyFolder(sourceFolder);

                    // Close the folder modal if it's open
                    const folderModal = document.getElementById('folderModal');
                    if (folderModal && folderModal.style.display !== 'none') {
                        folderModal.style.display = 'none';
                        currentFolder = null;
                    }

                    saveData();
                    renderTiles();

                    showToast('Moved to main page', 'success');
                    console.log('Tile moved to main page via add button');
                }
            }
        });

        grid.appendChild(addTile);
    }

    // Reapply focus mode if active (only on main grid)
    if (!container && settings.focusModeActive) {
        // Use setTimeout to ensure DOM is updated
        setTimeout(() => applyFocusMode(), 0);
    }
}

// Create tile element
function createTileElement(tile, isInsideFolder = false) {
    const tileEl = document.createElement('div');
    tileEl.className = 'tile';
    tileEl.draggable = true;
    tileEl.dataset.id = tile.id;

    if (tile.type === 'folder') {
        tileEl.classList.add('folder');

        // Apply theme to folder tile
        const themeColor = getThemeColor(settings.tileTheme || 'custom');
        if (themeColor) {
            if (themeColor === 'glassmorphism') {
                tileEl.style.background = 'rgba(255, 255, 255, 0.1)';
                tileEl.style.backdropFilter = 'blur(10px)';
                tileEl.style.webkitBackdropFilter = 'blur(10px)';
                tileEl.style.border = '1px solid rgba(255, 255, 255, 0.2)';
                tileEl.style.boxShadow = '0 8px 32px 0 rgba(0, 0, 0, 0.37)';
                tileEl.style.color = '#ffffff';
            } else if (themeColor === 'liquid-glass') {
                tileEl.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)';
                tileEl.style.backdropFilter = 'blur(20px) saturate(180%)';
                tileEl.style.webkitBackdropFilter = 'blur(20px) saturate(180%)';
                tileEl.style.border = '1px solid rgba(255, 255, 255, 0.3)';
                tileEl.style.boxShadow = '0 8px 32px 0 rgba(31, 38, 135, 0.37), inset 0 1px 0 0 rgba(255, 255, 255, 0.5)';
                tileEl.style.color = '#ffffff';
            } else if (themeColor.includes('gradient')) {
                tileEl.style.background = themeColor;
                tileEl.style.color = '#ffffff';
            } else {
                tileEl.style.background = themeColor;
                const rgb = hexToRgb(themeColor);
                if (rgb) {
                    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                    if (brightness < 128) {
                        tileEl.style.color = '#ffffff';
                    }
                }
            }
        } else {
            // Default folder background when no theme is selected
            tileEl.style.background = 'rgba(255, 255, 255, 0.85)';
        }

        // Create folder preview grid (2x2)
        const folderPreview = document.createElement('div');
        folderPreview.className = 'folder-preview';

        // Show up to 4 items in the folder
        const previewItems = tile.items.slice(0, 4);
        previewItems.forEach(item => {
            const previewTile = document.createElement('div');
            previewTile.className = 'folder-preview-tile';

            // Set background color if available
            if (item.color) {
                previewTile.style.background = item.color;
            }

            const previewIcon = document.createElement('img');
            previewIcon.className = 'folder-preview-icon';

            // Load custom icon from IndexedDB if available
            loadCustomIconFromDB(item.id).then(customIconDataUrl => {
                if (customIconDataUrl) {
                    // Use custom icon if present
                    previewIcon.src = customIconDataUrl;
                    previewIcon.onerror = () => {
                        // Fall back to favicon if custom icon fails to load
                        if (item.icon) {
                            previewIcon.src = item.icon;
                        } else {
                            previewIcon.src = `https://www.google.com/s2/favicons?domain=${item.url}&sz=32`;
                        }
                    };
                } else {
                    // Fall back to default icon logic if no custom icon
                    if (item.icon) {
                        previewIcon.src = item.icon;
                        previewIcon.onerror = () => {
                            previewIcon.src = `https://www.google.com/s2/favicons?domain=${item.url}&sz=32`;
                        };
                    } else {
                        previewIcon.src = `https://www.google.com/s2/favicons?domain=${item.url}&sz=32`;
                    }
                }
            }).catch(error => {
                console.log('Error loading custom icon for folder preview:', error);
                // Fall back to default icon logic on error
                if (item.icon) {
                    previewIcon.src = item.icon;
                    previewIcon.onerror = () => {
                        previewIcon.src = `https://www.google.com/s2/favicons?domain=${item.url}&sz=32`;
                    };
                } else {
                    previewIcon.src = `https://www.google.com/s2/favicons?domain=${item.url}&sz=32`;
                }
            });

            previewTile.appendChild(previewIcon);
            folderPreview.appendChild(previewTile);
        });

        // Fill empty slots if less than 4 items
        for (let i = previewItems.length; i < 4; i++) {
            const emptyTile = document.createElement('div');
            emptyTile.className = 'folder-preview-tile empty';
            folderPreview.appendChild(emptyTile);
        }

        tileEl.appendChild(folderPreview);

        // Folder name (optional, only if folder has a custom name)
        if (tile.name && tile.name !== 'New Folder') {
            const name = document.createElement('div');
            name.className = 'tile-name';
            name.textContent = tile.name;

            // Apply text color based on theme
            if (themeColor) {
                if (themeColor === 'glassmorphism' || themeColor === 'liquid-glass') {
                    name.style.color = '#ffffff';
                    name.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
                } else if (themeColor.includes('gradient')) {
                    name.style.color = '#ffffff';
                } else {
                    const rgb = hexToRgb(themeColor);
                    if (rgb) {
                        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                        if (brightness < 128) {
                            name.style.color = '#ffffff';
                        }
                    }
                }
            }

            tileEl.appendChild(name);
        }

        // Folder badge
        if (tile.items && tile.items.length > 0) {
            const badge = document.createElement('div');
            badge.className = 'folder-badge';
            badge.textContent = tile.items.length;
            tileEl.appendChild(badge);
        }
    } else {
        // Regular tile (not folder)
        // Set background color based on theme or individual tile color
        const themeColor = getThemeColor(settings.tileTheme || 'custom');
        const tileColor = themeColor || tile.color;

        if (tileColor) {
            // Handle special glass themes
            if (tileColor === 'glassmorphism') {
                tileEl.style.background = 'rgba(255, 255, 255, 0.1)';
                tileEl.style.backdropFilter = 'blur(10px)';
                tileEl.style.webkitBackdropFilter = 'blur(10px)';
                tileEl.style.border = '1px solid rgba(255, 255, 255, 0.2)';
                tileEl.style.boxShadow = '0 8px 32px 0 rgba(0, 0, 0, 0.37)';
                tileEl.style.color = '#ffffff';
            } else if (tileColor === 'liquid-glass') {
                tileEl.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)';
                tileEl.style.backdropFilter = 'blur(20px) saturate(180%)';
                tileEl.style.webkitBackdropFilter = 'blur(20px) saturate(180%)';
                tileEl.style.border = '1px solid rgba(255, 255, 255, 0.3)';
                tileEl.style.boxShadow = '0 8px 32px 0 rgba(31, 38, 135, 0.37), inset 0 1px 0 0 rgba(255, 255, 255, 0.5)';
                tileEl.style.color = '#ffffff';
            } else {
                tileEl.style.background = tileColor;

                // Determine if we need light or dark text based on background
                // For gradients, use a default light text
                if (tileColor.includes('gradient')) {
                    tileEl.style.color = '#ffffff';
                } else {
                    const rgb = hexToRgb(tileColor);
                    if (rgb) {
                        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                        if (brightness < 128) {
                            tileEl.style.color = '#ffffff';
                        }
                    }
                }
            }
        }

        // Icon
        const icon = document.createElement('img');
        icon.className = 'tile-icon';

        // Load custom icon from IndexedDB if available
        loadCustomIconFromDB(tile.id).then(customIconDataUrl => {
            if (customIconDataUrl) {
                // Use custom icon if present
                icon.src = customIconDataUrl;
                icon.onerror = () => {
                    // Fall back to favicon if custom icon fails to load
                    if (tile.icon) {
                        icon.src = tile.icon;
                    } else {
                        icon.src = `https://www.google.com/s2/favicons?domain=${tile.url}&sz=64`;
                    }
                };
            } else {
                // Fall back to default icon logic if no custom icon
                if (tile.icon) {
                    icon.src = tile.icon;
                    icon.onerror = () => {
                        icon.src = `https://www.google.com/s2/favicons?domain=${tile.url}&sz=64`;
                    };
                } else {
                    icon.src = `https://www.google.com/s2/favicons?domain=${tile.url}&sz=64`;
                }
            }
        }).catch(error => {
            console.log('Error loading custom icon:', error);
            // Fall back to default icon logic on error
            if (tile.icon) {
                icon.src = tile.icon;
                icon.onerror = () => {
                    icon.src = `https://www.google.com/s2/favicons?domain=${tile.url}&sz=64`;
                };
            } else {
                icon.src = `https://www.google.com/s2/favicons?domain=${tile.url}&sz=64`;
            }
        });

        tileEl.appendChild(icon);

        // Name
        const name = document.createElement('div');
        name.className = 'tile-name';
        name.textContent = tile.name;

        // Apply text color if background is dark
        if (tileColor) {
            if (tileColor === 'glassmorphism' || tileColor === 'liquid-glass') {
                name.style.color = '#ffffff';
                name.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
            } else if (tileColor.includes('gradient')) {
                name.style.color = '#ffffff';
            } else {
                const rgb = hexToRgb(tileColor);
                if (rgb) {
                    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                    if (brightness < 128) {
                        name.style.color = '#ffffff';
                    }
                }
            }
        }
        tileEl.appendChild(name);
    }

    // Three-dot menu button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '⋯';

    // Adjust delete button color based on tile background
    const tileThemeColor = getThemeColor(settings.tileTheme || 'custom');
    const finalColor = tileThemeColor || tile.color;
    if (finalColor) {
        if (finalColor === 'glassmorphism' || finalColor === 'liquid-glass' || finalColor.includes('gradient')) {
            deleteBtn.style.color = 'rgba(255, 255, 255, 0.8)';
        } else if (finalColor.includes('#')) {
            const rgb = hexToRgb(finalColor);
            if (rgb) {
                const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                deleteBtn.style.color = brightness < 128 ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.6)';
            }
        }
    } else {
        deleteBtn.style.color = 'rgba(0, 0, 0, 0.6)';
    }
    deleteBtn.addEventListener('click', (e) => {
        showContextMenu(tile, e);
    });
    tileEl.appendChild(deleteBtn);

    // Event listeners
    if (tile.type === 'folder') {
        tileEl.addEventListener('click', () => openFolder(tile));
    } else {
        tileEl.addEventListener('click', (e) => {
            if (e.ctrlKey || e.metaKey) {
                openEditModal(tile);
            } else {
                window.open(tile.url, '_blank');
            }
        });

        tileEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            openEditModal(tile);
        });
    }

    // Drag and drop
    tileEl.addEventListener('dragstart', (e) => {
        draggedTile = tile;
        draggedElement = tileEl;
        tileEl.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';

        // Store the initial position for folder detection
        if (isInsideFolder && currentFolder) {
            tileEl.dataset.startedInFolder = 'true';
        }
    });

    tileEl.addEventListener('drag', (e) => {
        // Check if dragging outside folder modal
        if (isInsideFolder && currentFolder && e.clientX !== 0 && e.clientY !== 0) {
            const folderModal = document.getElementById('folderModal');
            const modalContent = folderModal.querySelector('.modal-content');

            if (modalContent) {
                const rect = modalContent.getBoundingClientRect();
                const isOutside = e.clientX < rect.left || e.clientX > rect.right ||
                    e.clientY < rect.top || e.clientY > rect.bottom;

                if (isOutside && tileEl.dataset.startedInFolder === 'true') {
                    // Close folder when dragging outside (works for both tiles and folders)
                    folderModal.style.display = 'none';
                    tileEl.dataset.startedInFolder = 'false';

                    // Show visual feedback on main grid
                    const tilesGrid = document.getElementById('tilesGrid');
                    if (tilesGrid) {
                        tilesGrid.style.outline = '2px dashed rgba(255, 255, 255, 0.3)';
                    }
                }
            }
        }
    });

    tileEl.addEventListener('dragend', () => {
        tileEl.classList.remove('dragging');
        delete tileEl.dataset.startedInFolder;

        // Clean up any folder creation state
        clearTimeout(folderCreationTimer);
        folderCreationTarget = null;

        // Remove highlights and placeholders from all tiles
        document.querySelectorAll('.tile').forEach(t => {
            t.classList.remove('drag-over-edge');
            t.classList.remove('drag-over-center');
            t.classList.remove('folder-highlight');
            t.classList.remove('slide-left');
            t.classList.remove('slide-right');
            delete t.dataset.createFolder;
        });

        // Remove any placeholder
        const placeholder = document.querySelector('.tile-placeholder');
        if (placeholder) {
            placeholder.remove();
        }

        draggedTile = null;
        draggedElement = null;
        lastDropTarget = null;
        pendingDropPosition = null;
        pendingDropTile = null;
    });

    tileEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (draggedTile && draggedTile.id !== tile.id) {
            const rect = tileEl.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            // Calculate distance from center
            const distanceX = Math.abs(e.clientX - centerX);
            const distanceY = Math.abs(e.clientY - centerY);
            const maxDistance = Math.min(rect.width, rect.height) / 4.5; // Smaller dead center zone for folders

            const isInCenter = distanceX < maxDistance && distanceY < maxDistance;

            if (isInCenter && tile.type === 'folder') {
                // Hovering center of folder - prepare to add to folder
                tileEl.classList.add('drag-over-center');
                tileEl.classList.remove('drag-over-edge');
                tileEl.classList.remove('slide-left');
                tileEl.classList.remove('slide-right');

                // Clear dropPosition so we know to add to folder, not reorder
                delete tileEl.dataset.dropPosition;
                pendingDropPosition = null;
                pendingDropTile = null;

                // Remove placeholder when hovering center
                const placeholder = document.querySelector('.tile-placeholder');
                if (placeholder) {
                    placeholder.remove();
                }

                // Clear folder creation timer
                clearTimeout(folderCreationTimer);
                folderCreationTarget = null;
            } else if (isInCenter && !isInsideFolder && tile.type !== 'folder') {
                // In dead center - prepare for folder creation (only for non-folder tiles)
                tileEl.classList.add('drag-over-center');
                tileEl.classList.remove('drag-over-edge');
                tileEl.classList.remove('slide-left');
                tileEl.classList.remove('slide-right');

                // Remove placeholder when hovering center
                const placeholder = document.querySelector('.tile-placeholder');
                if (placeholder) {
                    placeholder.remove();
                }

                // Start timer for folder creation if not already started
                if (folderCreationTarget !== tile.id) {
                    clearTimeout(folderCreationTimer);
                    folderCreationTarget = tile.id;
                    folderCreationTimer = setTimeout(() => {
                        tileEl.classList.add('folder-highlight');
                        tileEl.dataset.createFolder = 'true';
                    }, 400); // 400ms hover to create folder
                }
            } else {
                // In outer margin - reorder mode
                tileEl.classList.remove('drag-over-center');
                tileEl.classList.remove('folder-highlight');
                delete tileEl.dataset.createFolder;

                // Clear folder creation timer
                clearTimeout(folderCreationTimer);
                folderCreationTarget = null;

                // Determine drop position for reordering based on horizontal position
                const dropPosition = e.clientX < centerX ? 'before' : 'after';
                tileEl.dataset.dropPosition = dropPosition;

                // Store in global variables as backup
                pendingDropPosition = dropPosition;
                pendingDropTile = tile;

                console.log('Setting dropPosition:', dropPosition, 'for tile:', tile.id, tile.name, 'type:', tile.type);

                // Create live preview with sliding effect
                createLivePreview(tileEl, tile, dropPosition, isInsideFolder);
            }
        }
    });

    tileEl.addEventListener('dragleave', (e) => {
        // Only clear if we're actually leaving the tile (not entering a child element)
        const rect = tileEl.getBoundingClientRect();
        const isStillOver = e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom;

        if (!isStillOver) {
            tileEl.classList.remove('drag-over-edge');
            tileEl.classList.remove('drag-over-center');
            tileEl.classList.remove('folder-highlight');
            tileEl.classList.remove('slide-left');
            tileEl.classList.remove('slide-right');
            delete tileEl.dataset.createFolder;
            // DON'T delete dropPosition here - it's needed for the drop event
            // delete tileEl.dataset.dropPosition;

            // Clear folder creation timer when leaving tile
            if (folderCreationTarget === tile.id) {
                clearTimeout(folderCreationTimer);
                folderCreationTarget = null;
            }
        }
    });

    tileEl.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        console.log('=== DROP EVENT FIRED ===');
        console.log('Target tile:', tile.id, tile.name);
        console.log('Dragged tile:', draggedTile?.id, draggedTile?.name);

        const shouldCreateFolder = tileEl.dataset.createFolder === 'true';
        let dropPosition = tileEl.dataset.dropPosition;

        // Use backup if dataset was cleared
        if (!dropPosition && pendingDropTile && pendingDropTile.id === tile.id) {
            dropPosition = pendingDropPosition;
            console.log('Using backup dropPosition:', dropPosition);
        }

        console.log('Drop event:', {
            draggedTile: draggedTile?.id,
            draggedName: draggedTile?.name,
            targetTile: tile.id,
            targetName: tile.name,
            targetType: tile.type,
            shouldCreateFolder,
            dropPosition,
            isInsideFolder,
            datasetDropPosition: tileEl.dataset.dropPosition,
            backupDropPosition: pendingDropPosition
        });

        // Clean up classes and data
        tileEl.classList.remove('drag-over-edge');
        tileEl.classList.remove('drag-over-center');
        tileEl.classList.remove('folder-highlight');
        tileEl.classList.remove('slide-left');
        tileEl.classList.remove('slide-right');
        delete tileEl.dataset.createFolder;
        delete tileEl.dataset.dropPosition;

        // Clear timer
        clearTimeout(folderCreationTimer);
        folderCreationTarget = null;

        // Remove placeholder
        const placeholder = document.querySelector('.tile-placeholder');
        if (placeholder) {
            placeholder.remove();
        }

        if (draggedTile && draggedTile.id !== tile.id) {
            // Check if dragging from a folder
            let isDraggingFromFolder = false;
            tiles.forEach(t => {
                if (t.type === 'folder' && t.items.some(item => item.id === draggedTile.id)) {
                    isDraggingFromFolder = true;
                }
            });

            console.log('isDraggingFromFolder:', isDraggingFromFolder, 'dropPosition:', dropPosition, 'targetType:', tile.type);

            if (shouldCreateFolder) {
                // Create new folder
                console.log('ACTION: Creating folder');
                await handleTileDrop(draggedTile, tile);
            } else if (dropPosition) {
                // Has dropPosition = reorder mode (takes priority over folder type)
                console.log('ACTION: Reordering with position:', dropPosition);
                if (isInsideFolder && currentFolder) {
                    console.log('Reordering inside folder');
                    handleTileReorder(draggedTile, tile, currentFolder.items, dropPosition);
                } else {
                    console.log('Reordering on main grid');
                    handleTileReorder(draggedTile, tile, tiles, dropPosition);
                }
            } else if (tile.type === 'folder' && !isDraggingFromFolder) {
                // No dropPosition + folder + NOT dragging from folder = add to folder
                // (Only add to folder if dragging from main grid, not from another folder)
                console.log('ACTION: Adding to existing folder');
                await handleTileDrop(draggedTile, tile);
            } else if (tile.type === 'folder' && isDraggingFromFolder) {
                // Dragging from folder to folder without dropPosition = default to reorder after
                console.log('ACTION: Reordering after folder (dragging from folder, no dropPosition)');
                handleTileReorder(draggedTile, tile, tiles, 'after');
            } else {
                console.log('ERROR: No action determined');
            }
        } else {
            console.log('ERROR: No draggedTile or same tile');
        }

        // Clear backup variables
        pendingDropPosition = null;
        pendingDropTile = null;

        console.log('=== DROP EVENT COMPLETE ===');
    }, true); // Use capture phase to catch event before grid handler

    // Add focus indicator badge if tile is marked for focus
    if (tile.focusEnabled) {
        const focusBadge = document.createElement('div');
        focusBadge.className = 'focus-badge';
        focusBadge.textContent = '🎯';
        focusBadge.title = 'Marked for focus';
        tileEl.appendChild(focusBadge);
    }

    return tileEl;
}

// Helper function to convert hex to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// Get theme color for tiles
function getThemeColor(theme) {
    const themes = {
        'custom': null, // Use individual tile colors
        'blue': '#4169E1',
        'purple': '#9370DB',
        'green': '#3CB371',
        'orange': '#FF8C00',
        'red': '#DC143C',
        'pink': '#FF69B4',
        'teal': '#20B2AA',
        'dark': '#2C3E50',
        'light': '#ECF0F1',
        'glassmorphism': 'glassmorphism', // Special handling
        'liquid-glass': 'liquid-glass', // Special handling
        'gradient-sunset': 'linear-gradient(135deg, #FF6B6B 0%, #FFE66D 100%)',
        'gradient-ocean': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'gradient-forest': 'linear-gradient(135deg, #134E5E 0%, #71B280 100%)',
        'gradient-purple': 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
        'gradient-fire': 'linear-gradient(135deg, #f12711 0%, #f5af19 100%)'
    };
    return themes[theme] || null;
}

// Handle tile drop (create folder or add to folder)
async function handleTileDrop(droppedTile, targetTile) {
    try {
        if (targetTile.type === 'folder') {
            // Add to existing folder
            if (!targetTile.items.some(item => item.id === droppedTile.id)) {
                console.log('Adding tile to folder:', targetTile.name);

                // Find and remove from source folder BEFORE adding to target
                let sourceFolder = null;
                tiles.forEach(tile => {
                    if (tile.type === 'folder' && tile.id !== targetTile.id && tile.items.some(item => item.id === droppedTile.id)) {
                        sourceFolder = tile;
                    }
                });

                console.log('Source folder:', sourceFolder?.name || 'none');

                if (sourceFolder) {
                    sourceFolder.items = sourceFolder.items.filter(item => item.id !== droppedTile.id);
                    console.log('Removed from source folder, checking if empty');
                    checkAndDeleteEmptyFolder(sourceFolder);
                }

                // Remove from main tiles array if it's there
                const mainIndex = tiles.findIndex(t => t.id === droppedTile.id && t.type !== 'folder');
                if (mainIndex !== -1) {
                    console.log('Removing from main tiles at index:', mainIndex);
                    tiles.splice(mainIndex, 1);
                }

                // NOW add to target folder
                targetTile.items.push(droppedTile);
                console.log('Added to target folder, new count:', targetTile.items.length);

                saveData();
                renderTiles();
                showToast('Added to folder', 'success');
            }
        } else {
            // Create new folder
            console.log('Creating new folder');
            const folder = {
                id: Date.now().toString(),
                name: 'New Folder',
                type: 'folder',
                items: [targetTile, droppedTile]
            };

            // Find and remove droppedTile from its source folder if it was in one
            let droppedTileSourceFolder = null;
            tiles.forEach(tile => {
                if (tile.type === 'folder' && tile.items.some(item => item.id === droppedTile.id)) {
                    droppedTileSourceFolder = tile;
                }
            });

            if (droppedTileSourceFolder) {
                droppedTileSourceFolder.items = droppedTileSourceFolder.items.filter(item => item.id !== droppedTile.id);
                checkAndDeleteEmptyFolder(droppedTileSourceFolder);
            }

            // Find and remove targetTile from its source folder if it was in one
            let targetTileSourceFolder = null;
            tiles.forEach(tile => {
                if (tile.type === 'folder' && tile.items.some(item => item.id === targetTile.id)) {
                    targetTileSourceFolder = tile;
                }
            });

            if (targetTileSourceFolder) {
                targetTileSourceFolder.items = targetTileSourceFolder.items.filter(item => item.id === targetTile.id);
                checkAndDeleteEmptyFolder(targetTileSourceFolder);
            }

            // Find the position of the target tile to insert folder at that position
            const targetIndex = tiles.findIndex(t => t.id === targetTile.id);

            await removeTile(targetTile.id, false);
            await removeTile(droppedTile.id, false);

            // Insert folder at the target tile's original position
            if (targetIndex !== -1 && targetIndex < tiles.length) {
                tiles.splice(targetIndex, 0, folder);
            } else {
                tiles.push(folder);
            }

            saveData();
            renderTiles();
            showToast('Folder created', 'success');
        }
    } catch (error) {
        console.error('Error handling tile drop:', error);
        showToast('Error organizing tiles. Please try again.', 'error');
    }
}

// Open folder
function openFolder(folder) {
    currentFolder = folder;
    const folderModal = document.getElementById('folderModal');
    const folderNameInput = document.getElementById('folderName');
    const folderGrid = document.getElementById('folderGrid');

    folderNameInput.value = folder.name;
    folderModal.style.display = 'block';

    renderTiles(folderGrid, folder.items, true);

    // Apply focus mode to folder contents if focus mode is active
    if (settings.focusModeActive) {
        setTimeout(() => applyFocusMode(), 0);
    }

    // Make the folder grid a drop zone for tiles from outside
    folderGrid.addEventListener('dragover', handleFolderGridDragOver);
    folderGrid.addEventListener('drop', handleFolderGridDrop);
}


// Open edit modal
function openEditModal(tile = null) {
    const modal = document.getElementById('editModal');
    const form = document.getElementById('editForm');
    const title = document.getElementById('editTitle');
    const deleteBtn = document.getElementById('deleteTile');

    if (tile) {
        title.textContent = 'Edit Tile';
        document.getElementById('tileName').value = tile.name;
        document.getElementById('tileUrl').value = tile.url;
        document.getElementById('tileIcon').value = tile.icon || '';
        document.getElementById('tileColor').value = tile.color || '#4169E1';
        form.dataset.tileId = tile.id;
        deleteBtn.style.display = 'block';
    } else {
        title.textContent = 'Add New Tile';
        document.getElementById('tileName').value = '';
        document.getElementById('tileUrl').value = '';
        document.getElementById('tileIcon').value = '';
        document.getElementById('tileColor').value = '#4169E1';
        form.dataset.tileId = '';
        deleteBtn.style.display = 'none';
    }

    modal.style.display = 'block';
}
// Handle custom icon upload with validation
async function handleCustomIconUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type against allowed image formats
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
        showToast('Invalid file type. Please use PNG, JPG, JPEG, or SVG.', 'error');
        event.target.value = ''; // Clear the input
        return;
    }

    // Read file as data URL using FileReader
    const reader = new FileReader();
    reader.onload = async (e) => {
        const dataUrl = e.target.result;

        // Get the tileId from the form
        const form = document.getElementById('editForm');
        const tileId = form.dataset.tileId;

        if (tileId) {
            // Save data URL to IndexedDB customIcons store with tileId as key
            await saveCustomIconToDB(tileId, dataUrl);

            // Update the icon input field to show the custom icon
            document.getElementById('tileIcon').value = dataUrl;

            showToast('Custom icon uploaded', 'success');
        } else {
            // For new tiles, store temporarily and will be saved when tile is created
            document.getElementById('tileIcon').value = dataUrl;
            showToast('Custom icon selected', 'success');
        }
    };

    reader.onerror = () => {
        showToast('Error reading file', 'error');
        event.target.value = ''; // Clear the input
    };

    reader.readAsDataURL(file);
}


// Save tile edit
async function saveTileEdit() {
    try {
        const form = document.getElementById('editForm');
        const tileId = form.dataset.tileId;
        const iconValue = document.getElementById('tileIcon').value;

        const tileData = {
            id: tileId || Date.now().toString(),
            name: document.getElementById('tileName').value,
            url: document.getElementById('tileUrl').value,
            icon: iconValue,
            color: document.getElementById('tileColor').value,
            type: 'link'
        };

        // Check if the icon is a data URL (custom icon)
        if (iconValue && iconValue.startsWith('data:')) {
            // Save custom icon to IndexedDB
            await saveCustomIconToDB(tileData.id, iconValue);
            // Store reference in tile object
            tileData.customIcon = iconValue;
        }

        if (tileId) {
            // Edit existing tile
            const index = tiles.findIndex(t => t.id === tileId);
            if (index !== -1) {
                tiles[index] = { ...tiles[index], ...tileData };
            }
            showToast('Tile updated', 'success');
        } else {
            // Add new tile
            tiles.push(tileData);
            showToast('Tile added', 'success');
        }

        await saveData();
        renderTiles();
        document.getElementById('editModal').style.display = 'none';
    } catch (error) {
        console.error('Error saving tile:', error);
        showToast('Error saving tile. Please try again.', 'error');
    }
}

// Toggle tile focus mode
async function toggleTileFocus(tileId) {
    try {
        // Find the tile in main tiles array
        let tile = tiles.find(t => t.id === tileId);

        // If not found in main tiles, search inside folders
        if (!tile) {
            for (const folderTile of tiles) {
                if (folderTile.type === 'folder' && folderTile.items) {
                    tile = folderTile.items.find(item => item.id === tileId);
                    if (tile) break;
                }
            }
        }

        if (!tile) {
            showToast('Tile not found', 'error');
            return;
        }

        // Toggle focus enabled state
        tile.focusEnabled = !tile.focusEnabled;

        // Save and re-render
        await saveData();
        renderTiles();

        // If we're inside a folder, also re-render the folder
        if (currentFolder) {
            renderTiles(document.getElementById('folderGrid'), currentFolder.items, true);
        }

        // Show feedback
        const message = tile.focusEnabled ? 'Tile marked for focus' : 'Tile unmarked for focus';
        showToast(message, 'success');
    } catch (error) {
        console.error('Error toggling tile focus:', error);
        showToast('Error updating focus mode. Please try again.', 'error');
    }
}

// Remove tile
async function removeTile(tileId, shouldSave = true) {
    // Find the tile before removing
    const tileToRemove = tiles.find(t => t.id === tileId);

    if (tileToRemove) {
        // Add to undo stack
        deletedTiles.push({
            type: 'tile',
            tile: JSON.parse(JSON.stringify(tileToRemove))
        });

        // Keep only last 10 deletions
        if (deletedTiles.length > 10) {
            deletedTiles.shift();
        }

        // Remove custom icon from IndexedDB if it exists
        if (tileToRemove.customIcon) {
            await removeCustomIconFromDB(tileId);
        }
    }

    tiles = tiles.filter(t => t.id !== tileId);

    // Also remove from folders and track for undo
    tiles.forEach(tile => {
        if (tile.type === 'folder') {
            const itemToRemove = tile.items.find(item => item.id === tileId);
            if (itemToRemove) {
                deletedTiles.push({
                    type: 'folder-item',
                    tile: JSON.parse(JSON.stringify(itemToRemove)),
                    folderId: tile.id
                });
            }
            tile.items = tile.items.filter(item => item.id !== tileId);
        }
    });

    if (shouldSave) {
        await saveData();
        renderTiles();
        showToast('Tile removed (Ctrl+Z to undo)', 'info');
    }
}


// Handle drag over folder grid
function handleFolderGridDragOver(e) {
    e.preventDefault();
    if (draggedTile && currentFolder) {
        // Check if the dragged tile is not already in this folder
        const isInFolder = currentFolder.items.some(item => item.id === draggedTile.id);
        if (!isInFolder) {
            e.currentTarget.style.background = 'rgba(65, 105, 225, 0.1)';
        }
    }
}

// Handle drop on folder grid
function handleFolderGridDrop(e) {
    e.preventDefault();
    e.currentTarget.style.background = '';

    console.log('=== FOLDER GRID DROP EVENT ===');

    // Remove placeholder
    const placeholder = document.querySelector('.tile-placeholder');
    if (placeholder) {
        placeholder.remove();
    }

    if (draggedTile && currentFolder) {
        // Check if we have a pending drop target (reordering inside folder)
        if (pendingDropTile && pendingDropPosition) {
            console.log('Reordering inside folder, target:', pendingDropTile.id, 'position:', pendingDropPosition);
            handleTileReorder(draggedTile, pendingDropTile, currentFolder.items, pendingDropPosition);

            // Clear pending data
            pendingDropPosition = null;
            pendingDropTile = null;
            return;
        }

        // Check if the dragged tile is not already in this folder
        const isInFolder = currentFolder.items.some(item => item.id === draggedTile.id);

        if (!isInFolder) {
            console.log('Adding tile to folder from outside');
            // Add tile to folder
            currentFolder.items.push(draggedTile);

            // Remove from main tiles if it was there
            const mainIndex = tiles.findIndex(t => t.id === draggedTile.id);
            if (mainIndex !== -1) {
                tiles.splice(mainIndex, 1);
            }

            // Remove from other folders
            tiles.forEach(tile => {
                if (tile.type === 'folder' && tile.id !== currentFolder.id) {
                    tile.items = tile.items.filter(item => item.id !== draggedTile.id);
                }
            });

            saveData();
            renderTiles(); // Re-render main grid
            renderTiles(document.getElementById('folderGrid'), currentFolder.items, true); // Re-render folder
        }
    }
}

// Handle tile reorder (inside folder or main grid)
function handleTileReorder(draggedTile, targetTile, tileArray, dropPosition = 'after') {
    // Find indices
    const draggedIndex = tileArray.findIndex(t => t.id === draggedTile.id);
    const targetIndex = tileArray.findIndex(t => t.id === targetTile.id);

    console.log('Reordering:', {
        draggedId: draggedTile.id,
        targetId: targetTile.id,
        draggedIndex,
        targetIndex,
        dropPosition,
        arrayLength: tileArray.length
    });

    // If dragged tile is not in the array, it might be from another location
    if (draggedIndex === -1) {
        console.log('Dragged tile not in array, might be from folder or main grid');

        // Remove from other locations
        let sourceFolder = null;
        tiles.forEach(tile => {
            if (tile.type === 'folder' && tile.items.some(item => item.id === draggedTile.id)) {
                sourceFolder = tile;
            }
        });

        if (sourceFolder) {
            // Remove from source folder
            sourceFolder.items = sourceFolder.items.filter(item => item.id !== draggedTile.id);
            checkAndDeleteEmptyFolder(sourceFolder);

            // If moving to main grid, close folder modal and show toast
            if (tileArray === tiles) {
                const folderModal = document.getElementById('folderModal');
                if (folderModal && folderModal.style.display !== 'none') {
                    folderModal.style.display = 'none';
                    currentFolder = null;
                }
                showToast('Moved to main page', 'success');
            }
        } else {
            // Remove from main tiles if it's there
            const mainIndex = tiles.findIndex(t => t.id === draggedTile.id);
            if (mainIndex !== -1 && tileArray !== tiles) {
                tiles.splice(mainIndex, 1);
            }
        }

        // Insert at target position
        let insertIndex = targetIndex;
        if (dropPosition === 'after') {
            insertIndex = targetIndex + 1;
        }
        tileArray.splice(insertIndex, 0, draggedTile);

        saveData();
        if (currentFolder) {
            renderTiles(document.getElementById('folderGrid'), currentFolder.items, true);
        } else {
            renderTiles();
        }
        return;
    }

    // Both tiles are in the same array
    if (targetIndex !== -1 && draggedIndex !== targetIndex) {
        // Remove dragged tile from its current position
        tileArray.splice(draggedIndex, 1);

        // Recalculate target index after removal
        let newTargetIndex = tileArray.findIndex(t => t.id === targetTile.id);

        // Adjust insertion position
        if (dropPosition === 'after') {
            newTargetIndex += 1;
        }

        // Insert at new position
        tileArray.splice(newTargetIndex, 0, draggedTile);

        console.log('Reordered successfully, new index:', newTargetIndex);

        saveData();

        if (currentFolder) {
            renderTiles(document.getElementById('folderGrid'), currentFolder.items, true);
        } else {
            renderTiles();
        }
    }
}


// Create live preview with sliding effect
function createLivePreview(targetElement, targetTile, dropPosition, isInsideFolder) {
    // Prevent duplicate processing
    const targetKey = `${targetTile.id}-${dropPosition}`;
    if (lastDropTarget === targetKey) {
        return;
    }
    lastDropTarget = targetKey;

    // Remove all previous slide effects and placeholders
    document.querySelectorAll('.tile').forEach(t => {
        t.classList.remove('slide-left');
        t.classList.remove('slide-right');
        t.classList.remove('drag-over-edge');
    });

    const existingPlaceholder = document.querySelector('.tile-placeholder');
    if (existingPlaceholder) {
        existingPlaceholder.remove();
    }

    // Add visual indicator to target
    targetElement.classList.add('drag-over-edge');

    // Get the appropriate tile array
    const tileArray = isInsideFolder && currentFolder ? currentFolder.items : tiles;

    // Find indices
    const draggedIndex = tileArray.findIndex(t => t.id === draggedTile.id);
    const targetIndex = tileArray.findIndex(t => t.id === targetTile.id);

    // Calculate where to insert the placeholder
    let insertIndex = targetIndex;
    if (dropPosition === 'after') {
        insertIndex = targetIndex + 1;
    }

    // If dragged tile is in the same array, adjust for its removal
    let adjustedInsertIndex = insertIndex;
    if (draggedIndex !== -1 && draggedIndex < insertIndex) {
        adjustedInsertIndex--;
    }

    // Create placeholder
    const placeholder = document.createElement('div');
    placeholder.className = 'tile tile-placeholder';
    placeholder.style.opacity = '0.5';
    placeholder.style.border = '2px dashed rgba(65, 105, 225, 0.8)';
    placeholder.style.background = 'rgba(65, 105, 225, 0.1)';

    // Get the grid container
    const grid = isInsideFolder ? document.getElementById('folderGrid') : document.getElementById('tilesGrid');
    const allTiles = Array.from(grid.querySelectorAll('.tile:not(.dragging):not(.add-tile)'));

    // Insert placeholder at the correct position
    if (adjustedInsertIndex >= allTiles.length) {
        grid.appendChild(placeholder);
    } else {
        grid.insertBefore(placeholder, allTiles[adjustedInsertIndex]);
    }

    // Apply slide animations to surrounding tiles
    const placeholderIndex = Array.from(grid.children).indexOf(placeholder);
    const tilesPerRow = Math.floor(grid.offsetWidth / (allTiles[0]?.offsetWidth || 100));

    Array.from(grid.children).forEach((child, index) => {
        if (child.classList.contains('tile-placeholder') || child.classList.contains('dragging')) {
            return;
        }

        // Determine if tile should slide based on grid position
        const childRow = Math.floor(index / tilesPerRow);
        const placeholderRow = Math.floor(placeholderIndex / tilesPerRow);
        const childCol = index % tilesPerRow;
        const placeholderCol = placeholderIndex % tilesPerRow;

        if (childRow === placeholderRow) {
            if (index > placeholderIndex) {
                child.classList.add('slide-right');
            }
        }
    });
}

// Check and delete folder if empty
function checkAndDeleteEmptyFolder(folder) {
    if (folder && folder.items && folder.items.length === 0) {
        // Remove the empty folder from tiles
        tiles = tiles.filter(t => t.id !== folder.id);

        // Close folder modal if it's open
        const folderModal = document.getElementById('folderModal');
        if (folderModal && folderModal.style.display === 'block') {
            folderModal.style.display = 'none';
        }

        // Reset current folder
        if (currentFolder && currentFolder.id === folder.id) {
            currentFolder = null;
        }

        console.log('Deleted empty folder:', folder.name);
        return true;
    }
    return false;
}

// Initialize main grid as drop zone
function initializeMainGridDropZone() {
    const body = document.body;
    const tilesGrid = document.getElementById('tilesGrid');

    // Add drop zone to tiles grid
    tilesGrid.addEventListener('dragover', (e) => {
        // Only handle if not over a specific tile
        if (e.target === tilesGrid || e.target.classList.contains('tiles-grid')) {
            e.preventDefault();

            if (draggedTile) {
                // Check if we're dragging from a folder
                let isDraggingFromFolder = false;
                tiles.forEach(tile => {
                    if (tile.type === 'folder' && tile.items.some(item => item.id === draggedTile.id)) {
                        isDraggingFromFolder = true;
                    }
                });

                if (isDraggingFromFolder) {
                    tilesGrid.style.outline = '2px dashed rgba(255, 255, 255, 0.3)';
                }
            }
        }
    });

    tilesGrid.addEventListener('dragleave', (e) => {
        if (e.target === tilesGrid) {
            tilesGrid.style.outline = '';
        }
    });

    tilesGrid.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        tilesGrid.style.outline = '';

        console.log('=== GRID DROP EVENT ===');

        // Remove placeholder
        const placeholder = document.querySelector('.tile-placeholder');
        if (placeholder) {
            placeholder.remove();
        }

        // Check if we have a pending drop target (from dragover)
        if (pendingDropTile && pendingDropPosition && draggedTile) {
            console.log('Using pending drop target:', pendingDropTile.id, 'position:', pendingDropPosition);

            // Check if it's a folder creation
            const targetElement = document.querySelector(`[data-id="${pendingDropTile.id}"]`);
            const shouldCreateFolder = targetElement?.dataset.createFolder === 'true';

            if (shouldCreateFolder) {
                console.log('ACTION: Creating folder');
                await handleTileDrop(draggedTile, pendingDropTile);
            } else if (pendingDropTile.type === 'folder') {
                console.log('ACTION: Adding to folder');
                await handleTileDrop(draggedTile, pendingDropTile);
            } else {
                console.log('ACTION: Reordering with position:', pendingDropPosition);
                handleTileReorder(draggedTile, pendingDropTile, tiles, pendingDropPosition);
            }

            // Clear pending data
            pendingDropPosition = null;
            pendingDropTile = null;
            return;
        }

        console.log('Dropped on grid empty space, draggedTile:', draggedTile);

        if (draggedTile) {
            // Find which folder the tile/folder is in
            let sourceFolder = null;
            tiles.forEach(tile => {
                if (tile.type === 'folder' && tile.items.some(item => item.id === draggedTile.id)) {
                    sourceFolder = tile;
                }
            });

            console.log('Source folder:', sourceFolder);

            if (sourceFolder) {
                // Check if tile/folder is not already in main tiles
                const isInMainTiles = tiles.some(t => t.id === draggedTile.id);

                console.log('Is in main tiles:', isInMainTiles);

                if (!isInMainTiles) {
                    // Remove from source folder
                    sourceFolder.items = sourceFolder.items.filter(item => item.id !== draggedTile.id);

                    console.log('Removed from folder, adding to main tiles');

                    // Add to main tiles
                    tiles.push(draggedTile);

                    // Check if folder is now empty and delete it
                    checkAndDeleteEmptyFolder(sourceFolder);

                    // Close the folder modal if it's open
                    const folderModal = document.getElementById('folderModal');
                    if (folderModal && folderModal.style.display !== 'none') {
                        folderModal.style.display = 'none';
                        currentFolder = null;
                    }

                    saveData();
                    renderTiles();

                    showToast('Moved to main page', 'success');
                    console.log('Tile/folder moved to main page');
                }
            }
        }
    });
}


// Export state to JSON file
async function exportState() {
    try {
        showToast('Preparing export...', 'info');

        // Load data with chunking support
        const tiles_data = await getChunkedData(STORAGE_KEYS.TILES);
        const settings_data = await getChunkedData(STORAGE_KEYS.SETTINGS);
        const quotesDeck_data = await getChunkedData(STORAGE_KEYS.QUOTES_DECK);

        const result = await chrome.storage.sync.get([
            STORAGE_KEYS.QUOTES_INDEX
        ]);

        // Get wallpaper from IndexedDB
        const { wallpaper, wallpaperType } = await loadWallpaperFromDB();

        const exportData = {
            tiles: tiles_data || [],
            settings: settings_data || { tileSize: 'medium', showQuotes: true, quotePosition: 'both', timeFont: 'outfit', searchEngine: 'google', timeFormat: '24h', tileTheme: 'custom', applyThemeToSearchbar: false },
            wallpaper: wallpaper || null,
            wallpaperType: wallpaperType || 'image',
            quotesDeck: quotesDeck_data || [],
            quotesIndex: result[STORAGE_KEYS.QUOTES_INDEX] || 0,
            exportDate: new Date().toISOString(),
            version: '1.0.0'
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `tableau-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast('State exported successfully!', 'success');
    } catch (error) {
        console.error('Error exporting state:', error);
        showToast('Error exporting state', 'error');
    }
}

// Import state from JSON file
async function importState(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        showToast('Importing state...', 'info');

        const text = await file.text();
        const importData = JSON.parse(text);

        // Validate the imported data
        if (!importData.tiles || !Array.isArray(importData.tiles)) {
            throw new Error('Invalid backup file format');
        }

        // Confirm before importing
        const confirmed = await showConfirmModal(
            'This will replace your current tiles and settings. Continue?',
            'Import State',
            false
        );
        if (!confirmed) {
            event.target.value = ''; // Reset file input
            return;
        }

        // Import data to chrome storage with chunking for large items
        await setWithChunking(STORAGE_KEYS.TILES, importData.tiles);
        await setWithChunking(STORAGE_KEYS.SETTINGS, importData.settings || { tileSize: 'medium', showQuotes: true, quotePosition: 'both', timeFont: 'outfit', searchEngine: 'google', timeFormat: '24h', tileTheme: 'custom', applyThemeToSearchbar: false });
        await setWithChunking(STORAGE_KEYS.QUOTES_DECK, importData.quotesDeck || []);
        await chrome.storage.sync.set({ [STORAGE_KEYS.QUOTES_INDEX]: importData.quotesIndex || 0 });

        // Import wallpaper to IndexedDB if present
        if (importData.wallpaper) {
            await saveWallpaperToDB(importData.wallpaper, importData.wallpaperType || 'image');
        } else {
            await removeWallpaperFromDB();
        }

        // Reload the page to apply changes
        showToast('State imported successfully! Reloading...', 'success');
        setTimeout(() => {
            location.reload();
        }, 1000);
    } catch (error) {
        console.error('Error importing state:', error);
        showToast('Error importing state: ' + error.message, 'error');
    } finally {
        event.target.value = ''; // Reset file input
    }
}

// Load quotes from quotes.json
async function loadQuotes() {
    try {
        const response = await fetch('quotes.json');
        quotes = await response.json();
        console.log('Loaded quotes:', quotes.length);

        // Initialize deck if empty or if quotes were updated
        if (quotesDeck.length === 0 || quotesDeck.length !== quotes.length) {
            await shuffleDeck();
        }
    } catch (error) {
        console.error('Error loading quotes:', error);
        quotes = [];
    }
}

// Shuffle deck using Fisher-Yates algorithm (deck of cards approach)
async function shuffleDeck() {
    if (quotes.length === 0) {
        quotesDeck = [];
        quotesIndex = 0;
        return;
    }

    // Create a new deck with all quote indices
    quotesDeck = quotes.map((_, index) => index);

    // Fisher-Yates shuffle
    for (let i = quotesDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [quotesDeck[i], quotesDeck[j]] = [quotesDeck[j], quotesDeck[i]];
    }

    quotesIndex = 0;

    // Save shuffled deck to storage (only save indices, not the actual quotes)
    try {
        await setWithChunking(STORAGE_KEYS.QUOTES_DECK, quotesDeck);
        await chrome.storage.sync.set({
            [STORAGE_KEYS.QUOTES_INDEX]: quotesIndex
        });
        console.log('Deck shuffled:', quotesDeck.length, 'quotes');
    } catch (error) {
        console.error('Error saving quotes deck:', error);
        // If storage fails, continue anyway - quotes will work but won't persist
    }
}

// Get next two quotes from the deck
async function getNextQuotes() {
    if (quotes.length === 0) {
        return [null, null];
    }

    // If we've gone through all quotes, reshuffle
    if (quotesIndex >= quotesDeck.length) {
        await shuffleDeck();
    }

    // Get two quotes
    const quote1Index = quotesDeck[quotesIndex];
    quotesIndex++;

    // If we need to reshuffle for the second quote
    if (quotesIndex >= quotesDeck.length) {
        await shuffleDeck();
    }

    const quote2Index = quotesDeck[quotesIndex];
    quotesIndex++;

    // Save current index
    try {
        await chrome.storage.sync.set({
            [STORAGE_KEYS.QUOTES_INDEX]: quotesIndex
        });
    } catch (error) {
        console.error('Error saving quotes index:', error);
        // Continue anyway - quotes will work but position won't persist
    }

    return [quotes[quote1Index], quotes[quote2Index]];
}

// Display quotes on the page
async function displayQuotes() {
    const quoteLeft = document.getElementById('quoteLeft');
    const quoteRight = document.getElementById('quoteRight');

    console.log('displayQuotes called, settings.showQuotes:', settings.showQuotes);
    console.log('quotePosition:', settings.quotePosition);
    console.log('quotes array length:', quotes.length);

    // Check if quotes should be shown
    if (settings.showQuotes === false) {
        quoteLeft.classList.remove('visible');
        quoteRight.classList.remove('visible');
        return;
    }

    // If no quotes available, hide boxes
    if (quotes.length === 0) {
        console.log('No quotes available');
        quoteLeft.classList.remove('visible');
        quoteRight.classList.remove('visible');
        return;
    }

    const position = settings.quotePosition || 'both';

    // Get quotes based on position setting
    if (position === 'left') {
        // Show only left quote
        const [leftQuote] = await getNextQuotes();
        console.log('Left quote:', leftQuote);

        if (leftQuote) {
            quoteLeft.querySelector('.quote-text').textContent = `"${leftQuote}"`;
            quoteLeft.classList.add('visible');
        } else {
            quoteLeft.classList.remove('visible');
        }
        quoteRight.classList.remove('visible');

    } else if (position === 'right') {
        // Show only right quote
        const [rightQuote] = await getNextQuotes();
        console.log('Right quote:', rightQuote);

        if (rightQuote) {
            quoteRight.querySelector('.quote-text').textContent = `"${rightQuote}"`;
            quoteRight.classList.add('visible');
        } else {
            quoteRight.classList.remove('visible');
        }
        quoteLeft.classList.remove('visible');

    } else {
        // Show both quotes
        const [leftQuote, rightQuote] = await getNextQuotes();
        console.log('Left quote:', leftQuote);
        console.log('Right quote:', rightQuote);

        if (leftQuote) {
            quoteLeft.querySelector('.quote-text').textContent = `"${leftQuote}"`;
            quoteLeft.classList.add('visible');
        } else {
            quoteLeft.classList.remove('visible');
        }

        if (rightQuote) {
            quoteRight.querySelector('.quote-text').textContent = `"${rightQuote}"`;
            quoteRight.classList.add('visible');
        } else {
            quoteRight.classList.remove('visible');
        }
    }
}

// Change individual quote (for double-click on specific quote box)
async function changeIndividualQuote(quoteBox) {
    if (quotes.length === 0) {
        console.log('No quotes available');
        return;
    }

    // Check if quotes should be shown
    if (settings.showQuotes === false) {
        return;
    }

    // If we've gone through all quotes, reshuffle
    if (quotesIndex >= quotesDeck.length) {
        await shuffleDeck();
    }

    // Get next quote from deck
    const quoteIndex = quotesDeck[quotesIndex];
    quotesIndex++;

    // Save current index
    try {
        await chrome.storage.sync.set({
            [STORAGE_KEYS.QUOTES_INDEX]: quotesIndex
        });
    } catch (error) {
        console.error('Error saving quotes index:', error);
    }

    const newQuote = quotes[quoteIndex];

    if (newQuote) {
        quoteBox.querySelector('.quote-text').textContent = `"${newQuote}"`;
        quoteBox.classList.add('visible');
    }
}


// Toast notification system with queue management
const toastQueue = [];
const MAX_VISIBLE_TOASTS = 3;

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');

    // Remove oldest toast if we've reached the limit
    if (toastQueue.length >= MAX_VISIBLE_TOASTS) {
        const oldestToast = toastQueue.shift();
        if (oldestToast && oldestToast.parentElement) {
            oldestToast.style.animation = 'toastSlideOut 0.2s ease';
            setTimeout(() => oldestToast.remove(), 200);
        }
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);
    toastQueue.push(toast);

    // Remove toast after 3 seconds
    setTimeout(() => {
        const index = toastQueue.indexOf(toast);
        if (index > -1) {
            toastQueue.splice(index, 1);
        }
        toast.remove();
    }, 3000);
}

// Initialize undo shortcut (Ctrl+Z or Cmd+Z)
function initializeUndoShortcut() {
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undoDelete();
        }
    });
}

// Undo delete functionality
function undoDelete() {
    if (deletedTiles.length === 0) {
        showToast('Nothing to undo', 'info');
        return;
    }

    const lastDeleted = deletedTiles.pop();

    if (lastDeleted.type === 'tile') {
        // Restore a single tile
        tiles.push(lastDeleted.tile);
        saveData();
        renderTiles();
        showToast('Tile restored', 'success');
    } else if (lastDeleted.type === 'folder-item') {
        // Restore item to folder
        const folder = tiles.find(t => t.id === lastDeleted.folderId);
        if (folder && folder.type === 'folder') {
            folder.items.push(lastDeleted.tile);
            saveData();
            if (currentFolder && currentFolder.id === folder.id) {
                renderTiles(document.getElementById('folderGrid'), currentFolder.items, true);
            }
            renderTiles();
            showToast('Item restored to folder', 'success');
        } else {
            showToast('Folder not found', 'error');
        }
    }
}


// Initialize notes functionality
function initializeNotes() {
    const notesBtn = document.getElementById('notesBtn');
    const notesModal = document.getElementById('notesModal');
    const notesList = document.getElementById('notesList');
    const notesTextarea = document.getElementById('notesTextarea');
    const noteTitleInput = document.getElementById('noteTitle');
    const newNoteBtn = document.getElementById('newNoteBtn');
    const deleteNoteBtn = document.getElementById('deleteNote');
    const closeBtn = document.querySelector('.close-notes-modal');
    const noteTimestamp = document.getElementById('noteTimestamp');

    console.log('Initializing notes...', {
        notesCount: notes.length,
        newNoteBtn: newNoteBtn,
        newNoteBtnExists: !!newNoteBtn
    });

    // Open notes modal
    notesBtn.addEventListener('click', () => {
        notesModal.style.display = 'block';
        renderNotesList();
        if (notes.length > 0 && !currentNoteId) {
            selectNote(notes[0].id);
        } else if (notes.length === 0) {
            showEmptyState();
        }
    });

    // Close notes modal
    closeBtn.addEventListener('click', () => {
        notesModal.style.display = 'none';
        saveCurrentNote();
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === notesModal) {
            notesModal.style.display = 'none';
            saveCurrentNote();
        }
    });

    // Create new note
    newNoteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('New note button clicked!');
        createNewNote();
    });

    // Delete current note
    deleteNoteBtn.addEventListener('click', () => {
        if (currentNoteId) {
            deleteNote(currentNoteId);
        }
    });

    // Auto-save on title change
    noteTitleInput.addEventListener('input', () => {
        if (currentNoteId) {
            const note = notes.find(n => n.id === currentNoteId);
            if (note) {
                note.title = noteTitleInput.value || getDefaultNoteTitle();
                note.updatedAt = Date.now();
                saveNotes();
                renderNotesList();
            }
        }
    });

    // Auto-save on content change (debounced)
    let saveTimeout;
    notesTextarea.addEventListener('input', () => {
        if (currentNoteId) {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                const note = notes.find(n => n.id === currentNoteId);
                if (note) {
                    note.content = notesTextarea.value;
                    note.updatedAt = Date.now();
                    saveNotes();
                    renderNotesList();
                }
            }, 500);
        }
    });

    // Keyboard shortcut: Ctrl/Cmd + S to save
    notesTextarea.addEventListener('keydown', async (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveCurrentNote();
            showToast('Note saved!', 'success');
        }
    });
}

// Create a new note
function createNewNote() {
    console.log('Creating new note...');

    // Ensure notes is an array
    if (!Array.isArray(notes)) {
        console.error('Notes is not an array, resetting to empty array');
        notes = [];
    }

    // Save current note first
    saveCurrentNote();

    const newNote = {
        id: Date.now().toString(),
        title: getDefaultNoteTitle(),
        content: '',
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    notes.unshift(newNote);
    saveNotes();
    renderNotesList();
    selectNote(newNote.id);

    console.log('New note created:', newNote);
    showToast('New note created', 'success');

    // Focus on title input
    setTimeout(() => {
        const titleInput = document.getElementById('noteTitle');
        if (titleInput) {
            titleInput.select();
        }
    }, 100);
}

// Get default note title (current date/time)
function getDefaultNoteTitle() {
    const now = new Date();
    const options = {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return now.toLocaleDateString('en-US', options);
}

// Select a note
function selectNote(noteId) {
    currentNoteId = noteId;
    const note = notes.find(n => n.id === noteId);

    if (note) {
        document.getElementById('noteTitle').value = note.title;
        document.getElementById('notesTextarea').value = note.content;
        updateTimestamp(note.updatedAt);
        renderNotesList();

        // Show editor, hide empty state
        document.querySelector('.notes-editor').style.display = 'flex';
        const emptyState = document.querySelector('.notes-empty-state');
        if (emptyState) {
            emptyState.remove();
        }
    }
}

// Delete a note
function deleteNote(noteId) {
    notes = notes.filter(n => n.id !== noteId);
    saveNotes();

    if (notes.length > 0) {
        selectNote(notes[0].id);
    } else {
        currentNoteId = null;
        showEmptyState();
    }

    renderNotesList();
    showToast('Note deleted', 'info');
}

// Save current note
function saveCurrentNote() {
    if (currentNoteId) {
        const note = notes.find(n => n.id === currentNoteId);
        if (note) {
            note.title = document.getElementById('noteTitle').value || getDefaultNoteTitle();
            note.content = document.getElementById('notesTextarea').value;
            note.updatedAt = Date.now();
            saveNotes();
        }
    }
}

// Save all notes to storage
async function saveNotes() {
    try {
        await setWithChunking(STORAGE_KEYS.NOTES, notes);
    } catch (error) {
        console.error('Error saving notes:', error);
    }
}

// Render notes list
function renderNotesList() {
    const notesList = document.getElementById('notesList');
    if (!notesList) return;

    notesList.innerHTML = '';

    // Ensure notes is an array
    if (!Array.isArray(notes)) {
        console.error('Notes is not an array:', notes);
        notes = [];
        return;
    }

    notes.forEach(note => {
        const noteItem = document.createElement('div');
        noteItem.className = 'note-item';
        if (note.id === currentNoteId) {
            noteItem.classList.add('active');
        }

        const title = document.createElement('div');
        title.className = 'note-item-title';
        title.textContent = note.title;

        const preview = document.createElement('div');
        preview.className = 'note-item-preview';
        preview.textContent = note.content.substring(0, 50) || 'No content';

        const date = document.createElement('div');
        date.className = 'note-item-date';
        date.textContent = formatDate(note.updatedAt);

        noteItem.appendChild(title);
        noteItem.appendChild(preview);
        noteItem.appendChild(date);

        noteItem.addEventListener('click', () => {
            selectNote(note.id);
        });

        notesList.appendChild(noteItem);
    });
}

// Show empty state
function showEmptyState() {
    const editor = document.querySelector('.notes-editor');
    editor.style.display = 'none';

    const container = document.querySelector('.notes-container');
    let emptyState = container.querySelector('.notes-empty-state');

    if (!emptyState) {
        emptyState = document.createElement('div');
        emptyState.className = 'notes-empty-state';
        emptyState.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                <path d="M8 15h8v2H8zm0-4h8v2H8zm0-4h5v2H8z"/>
            </svg>
            <h3>No notes yet</h3>
            <p>Click the + button to create your first note</p>
        `;
        container.appendChild(emptyState);
    }
}

// Update timestamp display
function updateTimestamp(timestamp) {
    const noteTimestamp = document.getElementById('noteTimestamp');
    noteTimestamp.textContent = `Last edited: ${formatDate(timestamp)}`;
}

// Format date for display
function formatDate(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================
// TO-DO LIST FUNCTIONALITY
// ============================================

// Initialize to-do list functionality
function initializeTodos() {
    console.log('Initializing to-do lists...');
    const todoBtn = document.getElementById('todoBtn');
    const todoModal = document.getElementById('todoModal');
    const todoListsList = document.getElementById('todoListsList');
    const todoListTitle = document.getElementById('todoListTitle');
    const newTodoListBtn = document.getElementById('newTodoListBtn');
    const deleteTodoListBtn = document.getElementById('deleteTodoList');
    const closeBtn = document.querySelector('.close-todo-modal');
    const todoTimestamp = document.getElementById('todoTimestamp');
    const newTodoInput = document.getElementById('newTodoInput');
    const addTodoBtn = document.getElementById('addTodoBtn');

    // Open to-do modal
    todoBtn.addEventListener('click', () => {
        todoModal.style.display = 'block';
        renderTodoListsList();
        if (todos.length > 0 && !currentTodoListId) {
            selectTodoList(todos[0].id);
        } else if (todos.length === 0) {
            showTodoEmptyState();
        }
    });

    // Close to-do modal
    closeBtn.addEventListener('click', () => {
        todoModal.style.display = 'none';
        saveCurrentTodoList();
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === todoModal) {
            todoModal.style.display = 'none';
            saveCurrentTodoList();
        }
    });

    // Create new to-do list
    newTodoListBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        createNewTodoList();
    });

    // Delete current to-do list
    deleteTodoListBtn.addEventListener('click', () => {
        if (currentTodoListId) {
            deleteTodoList(currentTodoListId);
        }
    });

    // Auto-save on title change
    todoListTitle.addEventListener('input', () => {
        if (currentTodoListId) {
            const todoList = todos.find(t => t.id === currentTodoListId);
            if (todoList) {
                todoList.title = todoListTitle.value || getDefaultTodoListTitle();
                todoList.updatedAt = Date.now();
                saveTodos();
                renderTodoListsList();
            }
        }
    });

    // Add new to-do item
    const addTodoItem = () => {
        const text = newTodoInput.value.trim();
        if (text && currentTodoListId) {
            const todoList = todos.find(t => t.id === currentTodoListId);
            if (todoList) {
                todoList.items.push({
                    id: Date.now().toString(),
                    text: text,
                    completed: false
                });
                todoList.updatedAt = Date.now();
                saveTodos();
                renderTodoItems();
                newTodoInput.value = '';
                newTodoInput.focus();
            }
        }
    };

    addTodoBtn.addEventListener('click', addTodoItem);
    newTodoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTodoItem();
        }
    });
}

// Create a new to-do list
function createNewTodoList() {
    saveCurrentTodoList();

    const newTodoList = {
        id: Date.now().toString(),
        title: getDefaultTodoListTitle(),
        items: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    todos.unshift(newTodoList);
    saveTodos();
    renderTodoListsList();
    selectTodoList(newTodoList.id);

    showToast('New to-do list created', 'success');

    setTimeout(() => {
        const titleInput = document.getElementById('todoListTitle');
        if (titleInput) {
            titleInput.select();
        }
    }, 100);
}

// Get default to-do list title
function getDefaultTodoListTitle() {
    const now = new Date();
    const options = {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return now.toLocaleDateString('en-US', options);
}

// Select a to-do list
function selectTodoList(todoListId) {
    currentTodoListId = todoListId;
    const todoList = todos.find(t => t.id === todoListId);

    if (todoList) {
        document.getElementById('todoListTitle').value = todoList.title;
        renderTodoItems();
        updateTodoTimestamp(todoList.updatedAt);
        renderTodoListsList();

        document.querySelector('.notes-editor').style.display = 'flex';
        const emptyState = document.querySelector('.todo-empty-state');
        if (emptyState) {
            emptyState.remove();
        }
    }
}

// Delete a to-do list
function deleteTodoList(todoListId) {
    todos = todos.filter(t => t.id !== todoListId);
    saveTodos();

    if (todos.length > 0) {
        selectTodoList(todos[0].id);
    } else {
        currentTodoListId = null;
        // Clear the tasks container
        const todoItemsContainer = document.getElementById('todoItemsContainer');
        if (todoItemsContainer) {
            todoItemsContainer.innerHTML = '';
        }
        // Clear the title
        const todoListTitle = document.getElementById('todoListTitle');
        if (todoListTitle) {
            todoListTitle.value = '';
        }
        showTodoEmptyState();
    }

    renderTodoListsList();
    showToast('To-do list deleted', 'info');
}

// Save current to-do list
function saveCurrentTodoList() {
    if (currentTodoListId) {
        const todoList = todos.find(t => t.id === currentTodoListId);
        if (todoList) {
            todoList.title = document.getElementById('todoListTitle').value || getDefaultTodoListTitle();
            todoList.updatedAt = Date.now();
            saveTodos();
        }
    }
}

// Save all to-do lists to storage
async function saveTodos() {
    try {
        await setWithChunking(STORAGE_KEYS.TODOS, todos);
    } catch (error) {
        console.error('Error saving to-do lists:', error);
    }
}

// Render to-do lists list
function renderTodoListsList() {
    const todoListsList = document.getElementById('todoListsList');
    if (!todoListsList) return;

    todoListsList.innerHTML = '';

    if (!Array.isArray(todos)) {
        todos = [];
    }

    todos.forEach(todoList => {
        const listItem = document.createElement('div');
        listItem.className = 'note-item';
        if (todoList.id === currentTodoListId) {
            listItem.classList.add('active');
        }

        const completedCount = todoList.items.filter(item => item.completed).length;
        const totalCount = todoList.items.length;

        listItem.innerHTML = `
            <div class="note-item-title">${todoList.title}</div>
            <div class="note-item-preview">${completedCount}/${totalCount} completed</div>
            <div class="note-item-date">${formatDate(todoList.updatedAt)}</div>
        `;

        listItem.addEventListener('click', () => {
            selectTodoList(todoList.id);
        });

        todoListsList.appendChild(listItem);
    });
}

// Render to-do items
function renderTodoItems() {
    const container = document.getElementById('todoItemsContainer');
    if (!container) return;

    const todoList = todos.find(t => t.id === currentTodoListId);
    if (!todoList) return;

    container.innerHTML = '';

    todoList.items.forEach(item => {
        const todoItem = document.createElement('div');
        todoItem.className = 'todo-item';
        if (item.completed) {
            todoItem.classList.add('completed');
        }

        todoItem.innerHTML = `
            <div class="todo-checkbox ${item.completed ? 'checked' : ''}" data-id="${item.id}"></div>
            <div class="todo-text">${item.text}</div>
            <button class="todo-delete" data-id="${item.id}">×</button>
        `;

        const checkbox = todoItem.querySelector('.todo-checkbox');
        checkbox.addEventListener('click', () => {
            item.completed = !item.completed;
            todoList.updatedAt = Date.now();
            saveTodos();
            renderTodoItems();
            renderTodoListsList();
        });

        const deleteBtn = todoItem.querySelector('.todo-delete');
        deleteBtn.addEventListener('click', () => {
            todoList.items = todoList.items.filter(i => i.id !== item.id);
            todoList.updatedAt = Date.now();
            saveTodos();
            renderTodoItems();
            renderTodoListsList();
        });

        container.appendChild(todoItem);
    });
}

// Show empty state for to-do lists
function showTodoEmptyState() {
    const editor = document.querySelector('.notes-editor');
    editor.style.display = 'none';

    const container = document.querySelector('.notes-container');
    let emptyState = container.querySelector('.todo-empty-state');

    if (!emptyState) {
        emptyState = document.createElement('div');
        emptyState.className = 'notes-empty-state todo-empty-state';
        emptyState.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
            <h3>No to-do lists yet</h3>
            <p>Click the + button to create your first list</p>
        `;
        container.appendChild(emptyState);
    }
}

// Update timestamp display for to-do list
function updateTodoTimestamp(timestamp) {
    const todoTimestamp = document.getElementById('todoTimestamp');
    todoTimestamp.textContent = `Last edited: ${formatDate(timestamp)}`;
}


// Liquid Glass Confirmation Modal
function showConfirmModal(message, title = 'Confirm Action', isDanger = false) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const modalContent = modal.querySelector('.confirm-modal-content');
        const titleElement = document.getElementById('confirmTitle');
        const messageElement = document.getElementById('confirmMessage');
        const cancelBtn = document.getElementById('confirmCancel');
        const okBtn = document.getElementById('confirmOk');

        // Set content
        titleElement.textContent = title;
        messageElement.textContent = message;

        // Add or remove danger class
        if (isDanger) {
            modalContent.classList.add('danger');
        } else {
            modalContent.classList.remove('danger');
        }

        // Show modal
        modal.classList.add('active');

        // Handle button clicks
        const handleCancel = () => {
            modal.classList.remove('active');
            cleanup();
            resolve(false);
        };

        const handleOk = () => {
            modal.classList.remove('active');
            cleanup();
            resolve(true);
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                handleCancel();
            }
        };

        const cleanup = () => {
            cancelBtn.removeEventListener('click', handleCancel);
            okBtn.removeEventListener('click', handleOk);
            document.removeEventListener('keydown', handleEscape);
        };

        // Add event listeners
        cancelBtn.addEventListener('click', handleCancel);
        okBtn.addEventListener('click', handleOk);
        document.addEventListener('keydown', handleEscape);
    });
}


// ==================== ONBOARDING FUNCTIONALITY ====================

let allBookmarks = [];
let selectedBookmarkIds = new Set();

// Check if onboarding should be shown
async function checkOnboarding() {
    try {
        // Check if onboarding is complete
        if (settings.onboardingComplete) {
            return;
        }

        // Check if bookmarks permission is available
        const hasPermission = await chrome.permissions.contains({
            permissions: ['bookmarks']
        });

        if (!hasPermission) {
            // No bookmarks permission, mark onboarding as complete
            settings.onboardingComplete = true;
            await saveSettings();
            return;
        }

        // Get bookmarks
        const bookmarkTree = await chrome.bookmarks.getTree();
        allBookmarks = flattenBookmarks(bookmarkTree);

        if (allBookmarks.length === 0) {
            // No bookmarks to show, mark onboarding as complete
            settings.onboardingComplete = true;
            await saveSettings();
            return;
        }

        // Show onboarding modal
        showOnboardingModal();
    } catch (error) {
        console.error('Error checking onboarding:', error);
        // Mark as complete to avoid showing again
        settings.onboardingComplete = true;
        await saveSettings();
    }
}

// Flatten bookmark tree into a list
function flattenBookmarks(bookmarkTree, parentFolder = null) {
    const bookmarks = [];

    function traverse(nodes, parent = null) {
        if (!nodes) return;

        for (const node of nodes) {
            // Skip special Chrome folders
            const isSpecialFolder = node.title === '' ||
                node.title === 'Bookmarks Bar' ||
                node.title === 'Other Bookmarks' ||
                node.title === 'Mobile Bookmarks';

            if (node.children) {
                // This is a folder
                if (!isSpecialFolder && node.title) {
                    const folder = {
                        id: node.id,
                        title: node.title,
                        type: 'folder',
                        children: [],
                        parent: parent
                    };
                    bookmarks.push(folder);
                    traverse(node.children, folder);
                } else {
                    // Skip special folders but process their children
                    traverse(node.children, parent);
                }
            } else if (node.url) {
                // This is a bookmark
                const bookmark = {
                    id: node.id,
                    title: node.title || 'Untitled',
                    url: node.url,
                    type: 'bookmark',
                    parent: parent
                };

                if (parent) {
                    parent.children.push(bookmark);
                } else {
                    bookmarks.push(bookmark);
                }
            }
        }
    }

    traverse(bookmarkTree);
    return bookmarks;
}

// Show onboarding modal
function showOnboardingModal() {
    const modal = document.getElementById('onboardingModal');
    modal.classList.add('active');
    renderOnboardingBookmarks();
    initializeOnboardingButtonEvents(); // Initialize button events once
}

// Render bookmarks in onboarding modal
function renderOnboardingBookmarks(searchQuery = '') {
    const container = document.getElementById('onboardingBookmarks');

    if (allBookmarks.length === 0) {
        container.innerHTML = `
            <div class="onboarding-empty">
                <div class="onboarding-empty-icon">📚</div>
                <div class="onboarding-empty-text">No bookmarks found</div>
                <div class="onboarding-empty-subtext">You can add tiles manually later</div>
            </div>
        `;
        return;
    }

    const filteredBookmarks = searchQuery
        ? filterBookmarks(allBookmarks, searchQuery.toLowerCase())
        : allBookmarks;

    if (filteredBookmarks.length === 0) {
        container.innerHTML = `
            <div class="onboarding-empty">
                <div class="onboarding-empty-icon">🔍</div>
                <div class="onboarding-empty-text">No bookmarks match your search</div>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredBookmarks.map(item => {
        if (item.type === 'folder') {
            return renderFolderItem(item);
        } else {
            return renderBookmarkItem(item);
        }
    }).join('');

    // Re-attach event listeners to newly rendered items
    attachOnboardingItemListeners();
}

// Filter bookmarks by search query
function filterBookmarks(bookmarks, query) {
    const results = [];

    for (const item of bookmarks) {
        if (item.type === 'folder') {
            const matchingChildren = item.children.filter(child =>
                child.title.toLowerCase().includes(query) ||
                (child.url && child.url.toLowerCase().includes(query))
            );

            if (matchingChildren.length > 0 || item.title.toLowerCase().includes(query)) {
                results.push({
                    ...item,
                    children: matchingChildren.length > 0 ? matchingChildren : item.children
                });
            }
        } else if (item.title.toLowerCase().includes(query) ||
            (item.url && item.url.toLowerCase().includes(query))) {
            results.push(item);
        }
    }

    return results;
}

// Render folder item
function renderFolderItem(folder) {
    const childCount = folder.children.length;
    const selectedCount = folder.children.filter(child => selectedBookmarkIds.has(child.id)).length;

    return `
        <div class="folder-item" data-folder-id="${folder.id}">
            <div class="folder-header" data-folder-id="${folder.id}">
                <div class="folder-toggle">▼</div>
                <div class="folder-icon">📁</div>
                <div class="folder-name">${escapeHtml(folder.title)}</div>
                <div class="folder-count">${selectedCount}/${childCount}</div>
            </div>
            <div class="folder-contents">
                ${folder.children.map(child => renderBookmarkItem(child)).join('')}
            </div>
        </div>
    `;
}

// Render bookmark item
function renderBookmarkItem(bookmark) {
    const isSelected = selectedBookmarkIds.has(bookmark.id);
    const domain = bookmark.url ? new URL(bookmark.url).hostname : '';
    const iconUrl = bookmark.url ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : '';

    return `
        <div class="bookmark-item ${isSelected ? 'selected' : ''}" data-bookmark-id="${bookmark.id}">
            <input type="checkbox" class="bookmark-checkbox" ${isSelected ? 'checked' : ''} data-bookmark-id="${bookmark.id}">
            <img class="bookmark-icon" src="${iconUrl}" alt="" onerror="this.style.display='none'">
            <div class="bookmark-info">
                <div class="bookmark-name">${escapeHtml(bookmark.title)}</div>
                <div class="bookmark-url">${escapeHtml(bookmark.url || '')}</div>
            </div>
        </div>
    `;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Attach event listeners to onboarding items
function attachOnboardingItemListeners() {
    // Folder toggle
    document.querySelectorAll('.folder-header').forEach(header => {
        header.addEventListener('click', (e) => {
            const folderId = e.currentTarget.dataset.folderId;
            const folderItem = document.querySelector(`.folder-item[data-folder-id="${folderId}"]`);
            folderItem.classList.toggle('collapsed');
        });
    });

    // Checkbox direct click - handle this first with stopPropagation
    document.querySelectorAll('.bookmark-checkbox').forEach(checkbox => {
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the item click

            const bookmarkId = checkbox.dataset.bookmarkId;
            const item = document.querySelector(`.bookmark-item[data-bookmark-id="${bookmarkId}"]`);

            if (checkbox.checked) {
                selectedBookmarkIds.add(bookmarkId);
                item.classList.add('selected');
            } else {
                selectedBookmarkIds.delete(bookmarkId);
                item.classList.remove('selected');
            }

            updateFolderCounts();
        });
    });

    // Bookmark item click (clicking anywhere on the item)
    document.querySelectorAll('.bookmark-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Don't handle if clicking on checkbox (it has its own handler)
            if (e.target.classList.contains('bookmark-checkbox')) {
                return;
            }

            const bookmarkId = item.dataset.bookmarkId;
            const checkbox = item.querySelector('.bookmark-checkbox');

            // Toggle selection
            if (selectedBookmarkIds.has(bookmarkId)) {
                selectedBookmarkIds.delete(bookmarkId);
                item.classList.remove('selected');
                checkbox.checked = false;
            } else {
                selectedBookmarkIds.add(bookmarkId);
                item.classList.add('selected');
                checkbox.checked = true;
            }

            updateFolderCounts();
        });
    });
}

// Update folder counts
function updateFolderCounts() {
    document.querySelectorAll('.folder-item').forEach(folderItem => {
        const folderId = folderItem.dataset.folderId;
        const folder = allBookmarks.find(b => b.id === folderId && b.type === 'folder');

        if (folder) {
            const selectedCount = folder.children.filter(child => selectedBookmarkIds.has(child.id)).length;
            const totalCount = folder.children.length;
            const countElement = folderItem.querySelector('.folder-count');
            if (countElement) {
                countElement.textContent = `${selectedCount}/${totalCount}`;
            }
        }
    });
}

// Initialize onboarding button event listeners (called once)
let onboardingButtonsInitialized = false;

function initializeOnboardingButtonEvents() {
    // Prevent double initialization
    if (onboardingButtonsInitialized) return;
    onboardingButtonsInitialized = true;

    // Search
    const searchInput = document.getElementById('onboardingSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderOnboardingBookmarks(e.target.value);
        });
    }

    // Select all
    const selectAllBtn = document.getElementById('selectAllBookmarks');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            allBookmarks.forEach(item => {
                if (item.type === 'bookmark') {
                    selectedBookmarkIds.add(item.id);
                } else if (item.type === 'folder') {
                    item.children.forEach(child => selectedBookmarkIds.add(child.id));
                }
            });
            const searchInput = document.getElementById('onboardingSearch');
            renderOnboardingBookmarks(searchInput ? searchInput.value : '');
        });
    }

    // Deselect all
    const deselectAllBtn = document.getElementById('deselectAllBookmarks');
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => {
            selectedBookmarkIds.clear();
            const searchInput = document.getElementById('onboardingSearch');
            renderOnboardingBookmarks(searchInput ? searchInput.value : '');
        });
    }

    // Skip
    const skipBtn = document.getElementById('skipOnboarding');
    if (skipBtn) {
        console.log('Skip button found, attaching listener');
        skipBtn.addEventListener('click', async () => {
            console.log('Skip button clicked');
            try {
                settings.onboardingComplete = true;
                await saveSettings();
                document.getElementById('onboardingModal').classList.remove('active');
                showToast('Onboarding skipped. You can add tiles manually.', 'info');
            } catch (error) {
                console.error('Error skipping onboarding:', error);
                showToast('Error skipping onboarding', 'error');
            }
        });
    } else {
        console.error('Skip button not found!');
    }

    // Finish
    const finishBtn = document.getElementById('finishOnboarding');
    if (finishBtn) {
        console.log('Finish button found, attaching listener');
        finishBtn.addEventListener('click', async () => {
            console.log('Finish button clicked');
            try {
                await finishOnboarding();
            } catch (error) {
                console.error('Error finishing onboarding:', error);
                showToast('Error adding tiles. Please try again.', 'error');
            }
        });
    } else {
        console.error('Finish button not found!');
    }
}

// Finish onboarding and add selected bookmarks
async function finishOnboarding() {
    console.log('finishOnboarding called, selected IDs:', selectedBookmarkIds);

    // Disable button to prevent double-clicks
    const finishBtn = document.getElementById('finishOnboarding');
    if (finishBtn) {
        finishBtn.disabled = true;
        finishBtn.textContent = 'Adding Tiles...';
    }

    try {
        const selectedBookmarks = [];

        // Collect selected bookmarks
        allBookmarks.forEach(item => {
            if (item.type === 'folder') {
                const selectedChildren = item.children.filter(child => selectedBookmarkIds.has(child.id));
                if (selectedChildren.length > 0) {
                    // Create folder tile
                    const folderTile = {
                        id: item.id,
                        name: item.title,
                        type: 'folder',
                        items: selectedChildren.map(child => ({
                            id: child.id,
                            name: child.title,
                            url: child.url,
                            icon: `https://www.google.com/s2/favicons?domain=${new URL(child.url).hostname}&sz=64`,
                            type: 'link'
                        }))
                    };
                    selectedBookmarks.push(folderTile);
                }
            } else if (item.type === 'bookmark' && selectedBookmarkIds.has(item.id)) {
                // Create regular tile
                const tile = {
                    id: item.id,
                    name: item.title,
                    url: item.url,
                    icon: `https://www.google.com/s2/favicons?domain=${new URL(item.url).hostname}&sz=64`,
                    type: 'link'
                };
                selectedBookmarks.push(tile);
            }
        });

        console.log('Selected bookmarks to add:', selectedBookmarks);

        // Save tiles
        tiles = selectedBookmarks;
        await saveData();

        // Mark onboarding as complete
        settings.onboardingComplete = true;
        await saveSettings();

        // Close modal and render tiles
        document.getElementById('onboardingModal').classList.remove('active');
        renderTiles();

        const count = selectedBookmarks.length;
        showToast(`Successfully added ${count} tile${count !== 1 ? 's' : ''}!`, 'success');
    } catch (error) {
        console.error('Error finishing onboarding:', error);
        showToast('Error adding tiles. Please try again.', 'error');

        // Re-enable button on error
        if (finishBtn) {
            finishBtn.disabled = false;
            finishBtn.textContent = 'Add Selected Tiles';
        }
    }
}

// Call checkOnboarding after data is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Wait a bit for the main initialization to complete
    setTimeout(async () => {
        await checkOnboarding();
    }, 500);
});
