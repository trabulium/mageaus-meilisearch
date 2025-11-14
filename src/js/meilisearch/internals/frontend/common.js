/**
 * Meilisearch Common JavaScript
 * Initializes Meilisearch components and provides common functionality
 */

(function() {
    'use strict';

    // Ensure meilisearchBundle is available
    if (!window.meilisearchBundle) {
        console.error('Meilisearch Bundle not loaded');
        return;
    }

    let config = null;

    // Function to initialize Meilisearch when config is available
    function initializeMeilisearch() {
        config = window.meilisearchConfig;
        
        if (!config) {
            console.error('Meilisearch configuration not found');
            return false;
        }

        // Log configuration in debug mode
        if (config.autocomplete && config.autocomplete.isDebugEnabled) {
            console.log('Meilisearch Configuration:', config);
        }

        return true;
    }

    // Wait for config to be available - check immediately, then poll if needed
    function waitForConfig(callback) {
        if (initializeMeilisearch()) {
            callback();
            return;
        }

        // Poll every 100ms for up to 5 seconds
        let attempts = 0;
        const maxAttempts = 50;
        
        const checkConfig = setInterval(function() {
            attempts++;
            
            if (initializeMeilisearch()) {
                clearInterval(checkConfig);
                callback();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkConfig);
                console.warn('Meilisearch configuration not found after 5 seconds');
            }
        }, 100);
    }

    // Wait for DOM ready
    function domReady(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback);
        } else {
            callback();
        }
    }

    // Initialize components based on configuration
    domReady(function() {
        waitForConfig(function() {
        // Analytics initialization
        if (config.analytics.enabled) {
            initializeAnalytics();
        }

        // Fix for IE
        if (!String.prototype.startsWith) {
            String.prototype.startsWith = function(searchString, position) {
                position = position || 0;
                return this.substr(position, searchString.length) === searchString;
            };
        }

        if (!String.prototype.endsWith) {
            String.prototype.endsWith = function(searchString, position) {
                var subjectString = this.toString();
                if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
                    position = subjectString.length;
                }
                position -= searchString.length;
                var lastIndex = subjectString.indexOf(searchString, position);
                return lastIndex !== -1 && lastIndex === position;
            };
        }

        // Set up form key updates for AJAX requests
        setupFormKeyUpdates();
        });
    });

    /**
     * Initialize analytics tracking
     */
    function initializeAnalytics() {
        // Track search queries
        if (config.isSearchPage && config.request.query) {
            trackSearch(config.request.query);
        }

        // Set up click tracking
        document.addEventListener('click', function(event) {
            const target = event.target;
            const link = target.closest('.meilisearch-instantsearch-hit a, .meilisearch-autocomplete-hit a');
            
            if (link) {
                const hit = link.closest('[data-product-id], [data-id]');
                if (hit) {
                    const productId = hit.getAttribute('data-product-id') || hit.getAttribute('data-id');
                    const position = Array.prototype.indexOf.call(hit.parentElement.children, hit);
                    
                    trackClick(productId, position);
                }
            }
        });
    }

    /**
     * Track search query
     */
    function trackSearch(query) {
        if (config.analytics.delay > 0) {
            setTimeout(function() {
                sendAnalytics('search', { query: query });
            }, config.analytics.delay);
        } else {
            sendAnalytics('search', { query: query });
        }
    }

    /**
     * Track product click
     */
    function trackClick(productId, position) {
        sendAnalytics('click', {
            productId: productId,
            position: position,
            query: config.request.query
        });
    }

    /**
     * Send analytics data
     */
    function sendAnalytics(eventType, data) {
        // Google Analytics
        if (typeof ga !== 'undefined') {
            ga('send', 'event', 'Meilisearch', eventType, JSON.stringify(data));
        }

        // Google Tag Manager
        if (typeof dataLayer !== 'undefined') {
            dataLayer.push({
                'event': 'meilisearch.' + eventType,
                'meilisearchData': data
            });
        }
    }

    /**
     * Setup form key updates for AJAX add to cart
     */
    function setupFormKeyUpdates() {
        // Update form keys in case they're stale
        setInterval(function() {
            fetch(config.baseUrl + '/meilisearch/ajax/getformkey')
                .then(function(response) {
                    return response.json();
                })
                .then(function(data) {
                    if (data.formKey) {
                        config.request.formKey = data.formKey;
                        const formKeyInputs = document.querySelectorAll('input[name="form_key"]');
                        formKeyInputs.forEach(function(input) {
                            input.value = data.formKey;
                        });
                    }
                })
                .catch(function(error) {
                    console.warn('Failed to update form key:', error);
                });
        }, 300000); // Every 5 minutes
    }

    /**
     * Helper function to format currency
     */
    window.meilisearchBundle.formatCurrency = function(amount) {
        const currentConfig = window.meilisearchConfig || config;
        if (currentConfig && currentConfig.currencySymbol) {
            return currentConfig.currencySymbol + parseFloat(amount).toFixed(2);
        }
        return '$' + parseFloat(amount).toFixed(2); // fallback
    };

    /**
     * Helper function to get product URL
     */
    window.meilisearchBundle.getProductUrl = function(product) {
        if (product.url) {
            return product.url;
        }
        const currentConfig = window.meilisearchConfig || config;
        if (currentConfig && currentConfig.baseUrl) {
            return currentConfig.baseUrl + '/catalog/product/view/id/' + product.objectID;
        }
        return '/catalog/product/view/id/' + product.objectID; // fallback
    };

    /**
     * Helper function for translations
     */
    window.meilisearchBundle.translate = function(key) {
        const currentConfig = window.meilisearchConfig || config;
        if (currentConfig && currentConfig.translations && currentConfig.translations[key]) {
            return currentConfig.translations[key];
        }
        return key; // fallback to key itself
    };

    /**
     * Export config for other modules - getter function to ensure config is available
     */
    window.meilisearchBundle.getConfig = function() {
        return window.meilisearchConfig || null;
    };
    
    // Also set the config property once it's available
    domReady(function() {
        waitForConfig(function() {
            window.meilisearchBundle.config = config;
        });
    });

})();