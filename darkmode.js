// Dark mode content script - applies to all tabs except new tab
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
        // Check if the page already has a dark theme
        const htmlElement = document.documentElement;
        const bodyElement = document.body;

        // Wait a bit for styles to load
        if (!bodyElement) return false;

        // Get computed background color of body and html
        const bodyBg = window.getComputedStyle(bodyElement).backgroundColor;
        const htmlBg = window.getComputedStyle(htmlElement).backgroundColor;

        // Function to check if a color is dark
        const isDarkColor = (color) => {
            if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
                return false;
            }

            // Parse RGB values
            const rgb = color.match(/\d+/g);
            if (!rgb || rgb.length < 3) return false;

            // Calculate brightness (0-255)
            const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;

            // Consider it dark if brightness is less than 128
            return brightness < 128;
        };

        // Check if either body or html has a dark background
        const bodyIsDark = isDarkColor(bodyBg);
        const htmlIsDark = isDarkColor(htmlBg);

        // Also check for common dark mode indicators
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

    function applyDarkMode() {
        // Check if dark mode style already exists
        if (document.getElementById('glassy-dark-mode-style')) {
            return;
        }

        // Check if the site already has a dark theme
        if (isDarkThemeAlready()) {
            console.log('Glassy Tab: Site already has dark theme, skipping filter');
            return;
        }

        const style = document.createElement('style');
        style.id = 'glassy-dark-mode-style';
        style.textContent = `
            /* Dark mode filter for all pages */
            html {
                filter: invert(0.9) hue-rotate(180deg) !important;
                background-color: #1a1a1a !important;
            }
            
            /* Prevent double inversion on images, videos, and iframes */
            img, video, iframe, canvas, [style*="background-image"] {
                filter: invert(1) hue-rotate(180deg) !important;
            }
            
            /* Smooth transition */
            * {
                transition: background-color 0.3s ease, color 0.3s ease !important;
            }
        `;

        // Insert at the beginning of head or body
        (document.head || document.body || document.documentElement).appendChild(style);
        console.log('Glassy Tab: Dark mode applied');
    }

    function removeDarkMode() {
        const style = document.getElementById('glassy-dark-mode-style');
        if (style) {
            style.remove();
            console.log('Glassy Tab: Dark mode removed');
        }
    }

    // Initialize dark mode
    async function initDarkMode() {
        try {
            // Load dark mode setting
            const result = await chrome.storage.local.get('settings');
            const settings = result.settings || {};

            console.log('Glassy Tab: Dark mode setting:', settings.darkModeEnabled);

            if (settings.darkModeEnabled) {
                // Wait a bit for page styles to load before checking if it's already dark
                setTimeout(() => {
                    applyDarkMode();
                }, 100);
            }
        } catch (error) {
            console.error('Glassy Tab: Error loading dark mode setting:', error);
        }
    }

    // Listen for changes to dark mode setting
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.settings) {
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
