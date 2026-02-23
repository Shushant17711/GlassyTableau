// Storage checker - paste this in the browser console on the new tab page
// This will check if there's any data in sync or local storage

(async function checkStorage() {
    console.log('=== STORAGE CHECKER ===\n');

    // Check sync storage
    console.log('📦 Checking chrome.storage.sync...');
    try {
        const syncData = await chrome.storage.sync.get(null);
        const syncKeys = Object.keys(syncData);

        if (syncKeys.length > 0) {
            console.log('✅ Found data in sync storage:');
            console.log('Keys:', syncKeys);
            console.log('Data:', syncData);

            // Calculate size
            const syncSize = new Blob([JSON.stringify(syncData)]).size;
            console.log(`Size: ${syncSize} bytes (${(syncSize / 1024).toFixed(2)} KB)`);
        } else {
            console.log('❌ No data in sync storage');
        }
    } catch (error) {
        console.error('Error reading sync storage:', error);
    }

    console.log('\n---\n');

    // Check local storage
    console.log('💾 Checking chrome.storage.local...');
    try {
        const localData = await chrome.storage.local.get(null);
        const localKeys = Object.keys(localData);

        if (localKeys.length > 0) {
            console.log('✅ Found data in local storage:');
            console.log('Keys:', localKeys);
            console.log('Data:', localData);

            // Calculate size
            const localSize = new Blob([JSON.stringify(localData)]).size;
            console.log(`Size: ${localSize} bytes (${(localSize / 1024).toFixed(2)} KB)`);
        } else {
            console.log('❌ No data in local storage');
        }
    } catch (error) {
        console.error('Error reading local storage:', error);
    }

    console.log('\n---\n');

    // Check IndexedDB
    console.log('🗄️ Checking IndexedDB...');
    try {
        const dbs = await indexedDB.databases();
        console.log('Available databases:', dbs);

        // Try to open GlassyTabDB
        const dbRequest = indexedDB.open('GlassyTabDB', 2);

        dbRequest.onsuccess = (event) => {
            const db = event.target.result;
            console.log('✅ GlassyTabDB found');
            console.log('Object stores:', Array.from(db.objectStoreNames));
            db.close();
        };

        dbRequest.onerror = () => {
            console.log('❌ GlassyTabDB not found');
        };
    } catch (error) {
        console.error('Error checking IndexedDB:', error);
    }

    console.log('\n=== END STORAGE CHECK ===');
})();
