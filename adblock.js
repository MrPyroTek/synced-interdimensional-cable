// Ad blocking implementation
class AdBlocker {
    constructor() {
        this.rules = [];
        this.initialized = false;
        // Whitelist for YouTube player
        this.whitelist = [
            'youtube.com/embed/',
            'youtube-nocookie.com/embed/',
            'youtube.com/iframe_api'
        ];
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Load basic ad blocking rules
            const response = await fetch('https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt');
            const text = await response.text();
            
            // Parse basic rules (simplified version)
            this.rules = text
                .split('\n')
                .filter(line => line && !line.startsWith('!') && !line.startsWith('['))
                .map(line => line.trim());

            this.initialized = true;
            console.log('Ad blocker initialized successfully');
        } catch (error) {
            console.error('Failed to initialize ad blocker:', error);
        }
    }

    isWhitelisted(url) {
        return this.whitelist.some(whitelisted => url.includes(whitelisted));
    }

    shouldBlock(url) {
        if (!this.initialized) return false;
        
        // Don't block whitelisted URLs
        if (this.isWhitelisted(url)) return false;
        
        // Check if URL matches any blocking rules
        return this.rules.some(rule => {
            try {
                const regex = new RegExp(rule.replace(/\*/g, '.*'));
                return regex.test(url);
            } catch (e) {
                return false;
            }
        });
    }

    // Block ads in iframes
    blockIframeAds() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeName === 'IFRAME') {
                        const src = node.getAttribute('src');
                        if (src && this.shouldBlock(src)) {
                            node.remove();
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Block ad-related elements
    blockAdElements() {
        const adSelectors = [
            '[class*="ad-"]',
            '[class*="ads-"]',
            '[class*="advertisement"]',
            '[id*="ad-"]',
            '[id*="ads-"]',
            '[id*="advertisement"]',
            'iframe[src*="ad"]',
            'iframe[src*="ads"]',
            'iframe[src*="advertisement"]'
        ];

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        adSelectors.forEach(selector => {
                            const elements = node.querySelectorAll(selector);
                            elements.forEach(element => {
                                const src = element.src || element.href;
                                if (src && this.shouldBlock(src)) {
                                    element.remove();
                                }
                            });
                        });
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

// Initialize ad blocker
const adBlocker = new AdBlocker();
adBlocker.initialize().then(() => {
    adBlocker.blockIframeAds();
    adBlocker.blockAdElements();
}); 