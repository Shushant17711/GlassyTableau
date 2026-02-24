// Dark mode content script - applies to all tabs except new tab
// Uses a lenient CSS filter approach with smart background-image preservation
(function () {
    'use strict';

    // Check if this is the new tab page or extension page
    if (window.location.href.includes('newtab.html') ||
        window.location.href.includes('chrome-extension://') ||
        window.location.href.includes('moz-extension://') ||
        window.location.href.includes('edge://') ||
        window.location.href.includes('chrome://')) {
        return; // Don't apply dark mode to the extension's own pages or browser pages
    }

    function isDarkThemeAlready() {
        const htmlElement = document.documentElement;
        const bodyElement = document.body;

        if (!bodyElement) return false;

        const bodyBg = window.getComputedStyle(bodyElement).backgroundColor;
        const htmlBg = window.getComputedStyle(htmlElement).backgroundColor;

        const isDarkColor = (color) => {
            if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
                return false;
            }
            const rgb = color.match(/\d+/g);
            if (!rgb || rgb.length < 3) return false;
            const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
            return brightness < 128;
        };

        const bodyIsDark = isDarkColor(bodyBg);
        const htmlIsDark = isDarkColor(htmlBg);

        const hasDarkModeClass = htmlElement.classList.contains('dark') ||
            htmlElement.classList.contains('dark-mode') ||
            htmlElement.classList.contains('dark-theme') ||
            bodyElement.classList.contains('dark') ||
            bodyElement.classList.contains('dark-mode') ||
            bodyElement.classList.contains('dark-theme');

        const hasDarkModeAttribute = htmlElement.getAttribute('data-theme') === 'dark' ||
            htmlElement.getAttribute('data-color-mode') === 'dark' ||
            bodyElement.getAttribute('data-theme') === 'dark';

        return bodyIsDark || htmlIsDark || hasDarkModeClass || hasDarkModeAttribute;
    }

    // The counter-filter to "undo" the root inversion so media looks normal
    const COUNTER_FILTER = 'invert(1) hue-rotate(180deg)';

    /**
     * Scan the DOM for elements that have CSS background-image set (not 'none')
     * and apply a counter-filter so those background images are NOT inverted.
     */
    function preserveBackgroundImages() {
        const allElements = document.querySelectorAll('*');
        allElements.forEach((el) => {
            // Skip already-handled media tags (handled by CSS rules)
            const tag = el.tagName;
            if (tag === 'IMG' || tag === 'VIDEO' || tag === 'CANVAS' ||
                tag === 'IFRAME' || tag === 'PICTURE' || tag === 'SCRIPT' ||
                tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'LINK') {
                return;
            }

            // Already processed
            if (el.hasAttribute('data-glassy-bg-preserved')) return;

            try {
                const computed = window.getComputedStyle(el);
                const bgImage = computed.backgroundImage;

                // Check if the element has a real background image (not just 'none' or gradients-only)
                if (bgImage && bgImage !== 'none') {
                    // Check if it contains an actual image URL (not just CSS gradients)
                    const hasImageUrl = bgImage.includes('url(');
                    if (hasImageUrl) {
                        el.style.setProperty('filter', COUNTER_FILTER, 'important');
                        el.setAttribute('data-glassy-bg-preserved', 'true');
                    }
                }
            } catch (e) {
                // Ignore inaccessible elements
            }
        });
    }

    function applyDarkMode() {
        // Check if dark mode already applied
        if (document.documentElement.hasAttribute('data-glassy-dark-mode')) {
            return;
        }

        // Check if the site already has a dark theme
        if (isDarkThemeAlready()) {
            console.log('Glassy Tab: Site already has dark theme, skipping');
            return;
        }

        // Mark as processed
        document.documentElement.setAttribute('data-glassy-dark-mode', 'true');

        const style = document.createElement('style');
        style.id = 'glassy-dark-mode-style';
        style.textContent = `
            /* Lenient dark mode: soft inversion on the root */
            html[data-glassy-dark-mode="true"] {
                filter: invert(0.85) hue-rotate(180deg) !important;
            }

            /* Re-invert media elements so images/videos look normal */
            html[data-glassy-dark-mode="true"] img,
            html[data-glassy-dark-mode="true"] picture,
            html[data-glassy-dark-mode="true"] picture > source,
            html[data-glassy-dark-mode="true"] video,
            html[data-glassy-dark-mode="true"] canvas,
            html[data-glassy-dark-mode="true"] iframe,
            html[data-glassy-dark-mode="true"] svg image,
            html[data-glassy-dark-mode="true"] [role="img"],
            html[data-glassy-dark-mode="true"] .avatar,
            html[data-glassy-dark-mode="true"] .thumbnail,
            html[data-glassy-dark-mode="true"] .logo,
            html[data-glassy-dark-mode="true"] .emoji {
                filter: invert(1) hue-rotate(180deg) !important;
            }

            /* Elements with inline background-image style */
            html[data-glassy-dark-mode="true"] [style*="background-image"],
            html[data-glassy-dark-mode="true"] [style*="background:url"],
            html[data-glassy-dark-mode="true"] [style*="background: url"] {
                filter: invert(1) hue-rotate(180deg) !important;
            }

            /* Smooth transition when toggling */
            html {
                transition: filter 0.3s ease !important;
            }
        `;
        (document.head || document.body || document.documentElement).appendChild(style);

        // Scan for elements with CSS class-based background-image and preserve them
        preserveBackgroundImages();

        // Watch for new elements added to the page and preserve their bg images too
        const observer = new MutationObserver((mutations) => {
            let needsScan = false;
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) { // Element node
                        needsScan = true;
                        break;
                    }
                }
                if (needsScan) break;
            }
            if (needsScan) {
                // Debounce: wait a tiny bit for batch DOM changes to settle
                clearTimeout(window._glassyBgScanTimer);
                window._glassyBgScanTimer = setTimeout(preserveBackgroundImages, 150);
            }
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        window._glassyDarkModeObserver = observer;

        console.log('Glassy Tab: Lenient dark mode applied (with bg-image preservation)');
    }

    function removeDarkMode() {
        // Remove the marker attribute
        document.documentElement.removeAttribute('data-glassy-dark-mode');

        // Remove the style tag
        const style = document.getElementById('glassy-dark-mode-style');
        if (style) {
            style.remove();
        }

        // Stop the mutation observer
        if (window._glassyDarkModeObserver) {
            window._glassyDarkModeObserver.disconnect();
            delete window._glassyDarkModeObserver;
        }

        // Clean up preserved background image filters
        document.querySelectorAll('[data-glassy-bg-preserved]').forEach(el => {
            el.style.removeProperty('filter');
            el.removeAttribute('data-glassy-bg-preserved');
        });

        // Clear any pending scan timer
        if (window._glassyBgScanTimer) {
            clearTimeout(window._glassyBgScanTimer);
            delete window._glassyBgScanTimer;
        }

        console.log('Glassy Tab: Dark mode removed');
    }

    // Initialize dark mode
    async function initDarkMode() {
        try {
            const result = await chrome.storage.sync.get('settings');
            const settings = result.settings || {};

            console.log('Glassy Tab: Dark mode setting:', settings.darkModeEnabled);

            if (settings.darkModeEnabled) {
                // Wait a brief moment for page styles to load
                setTimeout(() => {
                    applyDarkMode();
                }, 150);
            }
        } catch (error) {
            console.error('Glassy Tab: Error loading dark mode setting:', error);
        }
    }

    // Listen for changes to dark mode setting
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes.settings) {
            const newSettings = changes.settings.newValue || {};
            console.log('Glassy Tab: Settings changed, dark mode:', newSettings.darkModeEnabled);

            if (newSettings.darkModeEnabled) {
                applyDarkMode();
            } else {
                removeDarkMode();
            }
        }
    });

    // Run initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDarkMode);
    } else {
        initDarkMode();
    }
})();
