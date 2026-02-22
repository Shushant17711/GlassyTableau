document.getElementById('addSite').addEventListener('click', async () => {
    const statusEl = document.getElementById('status');
    const button = document.getElementById('addSite');

    try {
        // Disable button during processing
        button.disabled = true;
        button.textContent = 'Adding...';

        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        console.log('Current tab:', tab);

        if (!tab) {
            showStatus('Could not get current tab', 'error');
            button.disabled = false;
            button.textContent = 'Add Current Site';
            return;
        }

        // Don't allow adding browser pages
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
            showStatus('Cannot add browser pages', 'error');
            button.disabled = false;
            button.textContent = 'Add Current Site';
            return;
        }

        // Get existing tiles
        const result = await chrome.storage.local.get('tiles');
        const tiles = result.tiles || [];

        console.log('Existing tiles:', tiles);

        // Check if already exists
        const exists = tiles.some(tile => tile.url === tab.url);

        if (exists) {
            showStatus('✓ Site already added!', 'success');
            setTimeout(() => window.close(), 1500);
            return;
        }

        // Add new tile
        const newTile = {
            id: Date.now().toString(),
            name: tab.title,
            url: tab.url,
            icon: tab.favIconUrl,
            type: 'link'
        };

        tiles.push(newTile);

        console.log('Saving tiles:', tiles);

        await chrome.storage.local.set({ tiles });

        // Verify it was saved
        const verifyResult = await chrome.storage.local.get('tiles');
        console.log('Verified saved tiles:', verifyResult.tiles);

        showStatus('✓ Site added successfully!', 'success');

        // Close popup after 1.5 seconds
        setTimeout(() => {
            window.close();
        }, 1500);

    } catch (error) {
        console.error('Error adding site:', error);
        showStatus('Error: ' + error.message, 'error');
        button.disabled = false;
        button.textContent = 'Add Current Site';
    }
});

function showStatus(message, type) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.display = 'block';
}
