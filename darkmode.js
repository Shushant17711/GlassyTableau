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

    // Helper: Calculate brightness of an RGB color (0-255)
    function getBrightness(r, g, b) {
        return (r * 299 + g * 587 + b * 114) / 1000;
    }

    // Helper: Parse RGB/RGBA color string to [r, g, b, a]
    function parseColor(colorStr) {
        if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') {
            return null;
        }
        const match = colorStr.match(/\d+/g);
        if (!match || match.length < 3) return null;
        return [parseInt(match[0]), parseInt(match[1]), parseInt(match[2]), match[3] ? parseFloat(match[3]) : 1];
    }

    // Helper: Convert light color to dark equivalent
    function convertToDark(r, g, b, a = 1) {
        const brightness = getBrightness(r, g, b);

        // If it's already dark, leave it alone
        if (brightness < 128) {
            return `rgba(${r}, ${g}, ${b}, ${a})`;
        }

        // Convert light to dark by inverting and adjusting
        const newR = Math.max(0, 255 - r - 30);
        const newG = Math.max(0, 255 - g - 30);
        const newB = Math.max(0, 255 - b - 30);

        return `rgba(${newR}, ${newG}, ${newB}, ${a})`;
    }

    // Helper: Convert dark text to light text
    function convertTextToDark(r, g, b, a = 1) {
        const brightness = getBrightness(r, g, b);

        // If text is already light, leave it
        if (brightness > 128) {
            return `rgba(${r}, ${g}, ${b}, ${a})`;
        }

        // Convert dark text to light
        const newR = Math.min(255, 255 - r + 30);
        const newG = Math.min(255, 255 - g + 30);
        const newB = Math.min(255, 255 - b + 30);

        return `rgba(${newR}, ${newG}, ${newB}, ${a})`;
    }

    // Main function: Traverse DOM and apply dark mode intelligently
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

        // Add base styles for images and media (preserve them)
        const style = document.createElement('style');
        style.id = 'glassy-dark-mode-style';
        style.textContent = `
            /* Preserve images and media */
            img, picture, video, canvas, svg, iframe {
                opacity: 1 !important;
            }
            
            /* Force white placeholder text for all input fields */
            input::placeholder,
            textarea::placeholder {
                color: #ffffff !important;
                opacity: 0.8 !important;
            }
            
            /* Force white text in input fields */
            input:not([type="image"]):not([type="checkbox"]):not([type="radio"]),
            textarea,
            select {
                color: #ffffff !important;
            }
            
            /* Smooth transitions */
            * {
                transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease !important;
            }
        `;
        (document.head || document.body || document.documentElement).appendChild(style);

        // Process all elements
        function processElement(element) {
            // Skip certain elements
            if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE' || element.tagName === 'NOSCRIPT') {
                return;
            }

            // Skip images and media elements
            if (element.tagName === 'IMG' || element.tagName === 'VIDEO' ||
                element.tagName === 'CANVAS' || element.tagName === 'SVG' ||
                element.tagName === 'IFRAME' || element.tagName === 'PICTURE') {
                return;
            }

            try {
                const computed = window.getComputedStyle(element);

                // Get background color
                const bgColor = computed.backgroundColor;
                const bgImage = computed.backgroundImage;

                // Only modify background if there's no background image
                if (bgImage === 'none' || !bgImage) {
                    const bgParsed = parseColor(bgColor);
                    if (bgParsed) {
                        const [r, g, b, a] = bgParsed;
                        const brightness = getBrightness(r, g, b);

                        // Convert light backgrounds to dark
                        if (brightness > 128 && a > 0.1) {
                            const newColor = convertToDark(r, g, b, a);
                            element.style.setProperty('background-color', newColor, 'important');
                        }
                    }
                }

                // Get text color
                const textColor = computed.color;
                const textParsed = parseColor(textColor);
                if (textParsed) {
                    const [r, g, b, a] = textParsed;
                    const brightness = getBrightness(r, g, b);

                    // Convert dark text to light
                    if (brightness < 128) {
                        const newColor = convertTextToDark(r, g, b, a);
                        element.style.setProperty('color', newColor, 'important');
                    }
                }

                // Handle borders
                const borderColor = computed.borderTopColor;
                const borderParsed = parseColor(borderColor);
                if (borderParsed) {
                    const [r, g, b, a] = borderParsed;
                    const brightness = getBrightness(r, g, b);

                    if (brightness > 128) {
                        const newColor = convertToDark(r, g, b, a);
                        element.style.setProperty('border-color', newColor, 'important');
                    }
                }

            } catch (e) {
                // Ignore errors for inaccessible elements
            }
        }

        // Process all elements in the document
        function processAllElements() {
            const allElements = document.querySelectorAll('*');
            allElements.forEach(processElement);
        }

        // Initial processing
        processAllElements();

        // Watch for new elements added to the page
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        processElement(node);
                        // Process children too
                        node.querySelectorAll && node.querySelectorAll('*').forEach(processElement);
                    }
                });
            });
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        // Store observer for cleanup
        window._glassyDarkModeObserver = observer;

        console.log('Glassy Tab: Intelligent dark mode applied');
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

        // Remove all inline styles we added
        document.querySelectorAll('[data-glassy-dark-mode]').forEach(el => {
            el.style.removeProperty('background-color');
            el.style.removeProperty('color');
            el.style.removeProperty('border-color');
        });

        console.log('Glassy Tab: Dark mode removed');
    }

    // Initialize dark mode
    async function initDarkMode() {
        try {
            // Load dark mode setting
            const result = await chrome.storage.sync.get('settings');
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
