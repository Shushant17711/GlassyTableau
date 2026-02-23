// Background service worker for the extension

// Handle extension icon click - directly add current site as tile
chrome.action.onClicked.addListener(async (tab) => {
    // Don't allow adding browser pages
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        // Show notification that browser pages can't be added
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Cannot Add Browser Page',
            message: 'Browser internal pages cannot be added as tiles.'
        });
        return;
    }

    // Get current tab info
    const tabInfo = {
        title: tab.title,
        url: tab.url,
        favIconUrl: tab.favIconUrl
    };

    // Store it directly in storage
    const result = await chrome.storage.sync.get('tiles');
    const tiles = result.tiles || [];

    // Check if this URL is already added
    const exists = tiles.some(tile => tile.url === tabInfo.url);

    if (exists) {
        // Show notification that site already exists
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Site Already Added',
            message: `${tabInfo.title} is already in your tiles.`
        });
        return;
    }

    // Add new tile
    const newTile = {
        id: Date.now().toString(),
        name: tabInfo.title,
        url: tabInfo.url,
        icon: tabInfo.favIconUrl,
        type: 'link'
    };

    tiles.push(newTile);
    await chrome.storage.sync.set({ tiles });

    // Show success notification
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Site Added Successfully',
        message: `${tabInfo.title} has been added to your new tab page.`
    });
});

// Create context menu for adding selected text to notes
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        console.log('Extension installed! Welcome to Glassy Tableau.');

        // Initialize settings with defaults (onboarding will handle bookmark import)
        const result = await chrome.storage.sync.get('settings');
        const settings = result.settings || {};

        // Set default settings
        if (!settings.timeFont) settings.timeFont = 'orbitron';
        if (!settings.timeFormat) settings.timeFormat = '12h';
        if (!settings.tileTheme) settings.tileTheme = 'liquid-glass';
        if (settings.applyThemeToSearchbar === undefined) settings.applyThemeToSearchbar = true;
        if (settings.darkModeEnabled === undefined) settings.darkModeEnabled = false;
        if (settings.onboardingComplete === undefined) settings.onboardingComplete = false;

        await chrome.storage.sync.set({ settings });
    }

    // Create context menu item
    chrome.contextMenus.create({
        id: 'addToNotes',
        title: 'Add to Notes',
        contexts: ['selection']
    });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'addToNotes' && info.selectionText) {
        // Get existing notes
        const result = await chrome.storage.sync.get('userNotes');
        let notes = result.userNotes || [];

        // Ensure notes is an array
        if (!Array.isArray(notes)) {
            notes = [];
        }

        // Create new note with selected text
        const newNote = {
            id: Date.now().toString(),
            title: `Note from ${tab.title || 'Web'}`,
            content: info.selectionText,
            source: tab.url,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        notes.push(newNote);

        // Save to storage
        await chrome.storage.sync.set({ userNotes: notes });
    }
});
