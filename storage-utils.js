// Storage utility module for chrome.storage.sync
// Handles automatic sync across devices with quota management

// Note: STORAGE_KEYS is defined in newtab.js

// chrome.storage.sync quotas:
// - QUOTA_BYTES: 102,400 bytes (100KB total)
// - QUOTA_BYTES_PER_ITEM: 8,192 bytes (8KB per item)
// - MAX_ITEMS: 512 items
// - MAX_WRITE_OPERATIONS_PER_HOUR: 1,800
// - MAX_WRITE_OPERATIONS_PER_MINUTE: 120

const SYNC_QUOTA = {
    TOTAL: 102400,
    PER_ITEM: 8192,
    MAX_ITEMS: 512
};

// Storage wrapper that uses chrome.storage.sync
const storage = {
    async get(keys) {
        try {
            return await chrome.storage.sync.get(keys);
        } catch (error) {
            console.error('Error reading from sync storage:', error);
            throw error;
        }
    },

    async set(items) {
        try {
            // Check if data fits within sync quota
            const dataSize = new Blob([JSON.stringify(items)]).size;

            if (dataSize > SYNC_QUOTA.TOTAL) {
                console.warn('Data exceeds sync storage quota, falling back to local storage');
                await chrome.storage.local.set(items);
                return;
            }

            await chrome.storage.sync.set(items);
        } catch (error) {
            console.error('Error writing to sync storage:', error);
            // Fallback to local storage if sync fails
            try {
                await chrome.storage.local.set(items);
                console.log('Saved to local storage as fallback');
            } catch (localError) {
                console.error('Error writing to local storage:', localError);
                throw localError;
            }
        }
    },

    async remove(keys) {
        try {
            await chrome.storage.sync.remove(keys);
        } catch (error) {
            console.error('Error removing from sync storage:', error);
            throw error;
        }
    },

    async clear() {
        try {
            await chrome.storage.sync.clear();
        } catch (error) {
            console.error('Error clearing sync storage:', error);
            throw error;
        }
    },

    // Listen for changes in sync storage
    onChanged: chrome.storage.onChanged
};

// Helper function to chunk large data items
function chunkData(key, data, maxChunkSize = 7000) {
    const jsonString = JSON.stringify(data);
    const chunks = [];

    for (let i = 0; i < jsonString.length; i += maxChunkSize) {
        chunks.push(jsonString.slice(i, i + maxChunkSize));
    }

    return chunks;
}

// Helper function to reassemble chunked data
async function getChunkedData(key) {
    try {
        // First check if data is chunked
        const metaResult = await chrome.storage.sync.get(`${key}_meta`);

        if (!metaResult[`${key}_meta`]) {
            // Not chunked, try to get directly
            const result = await chrome.storage.sync.get(key);
            return result[key];
        }

        const meta = metaResult[`${key}_meta`];
        const chunkKeys = [];

        for (let i = 0; i < meta.chunks; i++) {
            chunkKeys.push(`${key}_chunk_${i}`);
        }

        const chunksResult = await chrome.storage.sync.get(chunkKeys);
        let reassembled = '';

        for (let i = 0; i < meta.chunks; i++) {
            reassembled += chunksResult[`${key}_chunk_${i}`] || '';
        }

        return JSON.parse(reassembled);
    } catch (error) {
        console.error(`Error getting chunked data for ${key}:`, error);
        return null;
    }
}

// Helper function to save data with automatic chunking if needed
async function setWithChunking(key, data) {
    const jsonString = JSON.stringify(data);
    const dataSize = new Blob([jsonString]).size;

    // If data fits in one item, save directly
    if (dataSize < SYNC_QUOTA.PER_ITEM - 500) { // 500 byte safety margin
        try {
            await chrome.storage.sync.set({ [key]: data });
            // Clean up any old chunks
            await cleanupChunks(key);
            return;
        } catch (error) {
            console.warn(`Failed to save ${key} directly, trying chunking:`, error);
        }
    }

    // Data is too large, chunk it
    console.log(`Chunking ${key} (${dataSize} bytes)`);
    const chunks = chunkData(key, data);

    // Save chunks
    const chunksToSave = {};
    for (let i = 0; i < chunks.length; i++) {
        chunksToSave[`${key}_chunk_${i}`] = chunks[i];
    }

    // Save metadata
    chunksToSave[`${key}_meta`] = {
        chunks: chunks.length,
        originalSize: dataSize
    };

    // Save chunks FIRST before removing the original key
    await chrome.storage.sync.set(chunksToSave);

    // Now remove the original key if it exists
    try {
        await chrome.storage.sync.remove(key);
    } catch (e) {
        // Ignore if key doesn't exist
    }

    console.log(`Saved ${key} in ${chunks.length} chunks`);
}

// Helper function to clean up old chunks
async function cleanupChunks(key) {
    try {
        const allKeys = await chrome.storage.sync.get(null);
        const keysToRemove = Object.keys(allKeys).filter(k =>
            k.startsWith(`${key}_chunk_`) || k === `${key}_meta`
        );

        if (keysToRemove.length > 0) {
            await chrome.storage.sync.remove(keysToRemove);
        }
    } catch (error) {
        console.error(`Error cleaning up chunks for ${key}:`, error);
    }
}

// Migration function to move data from local to sync storage
async function migrateToSync() {
    try {
        console.log('Starting migration from local to sync storage...');

        // Check if migration already completed
        const syncData = await chrome.storage.sync.get('migrationComplete');
        if (syncData.migrationComplete) {
            console.log('Migration already completed');
            return;
        }

        // Get all data from local storage
        // Use string keys directly since STORAGE_KEYS is defined in newtab.js
        const localData = await chrome.storage.local.get([
            'tiles',
            'settings',
            'quotesDeck',
            'quotesIndex',
            'userNotes',
            'userTodos'
        ]);

        // Calculate total size
        const dataSize = new Blob([JSON.stringify(localData)]).size;
        console.log(`Local data size: ${dataSize} bytes`);

        if (dataSize > SYNC_QUOTA.TOTAL) {
            console.warn(`Data size (${dataSize} bytes) exceeds sync quota (${SYNC_QUOTA.TOTAL} bytes)`);
            console.warn('Keeping data in local storage');
            return;
        }

        // Migrate to sync storage with chunking for large items
        for (const [key, value] of Object.entries(localData)) {
            if (value !== undefined) {
                await setWithChunking(key, value);
            }
        }

        // Mark migration as complete
        await chrome.storage.sync.set({ migrationComplete: true });

        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
        console.log('Continuing with local storage');
    }
}
