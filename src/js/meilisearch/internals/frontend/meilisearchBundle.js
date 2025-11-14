/**
 * Meilisearch Bundle for Magento/MahoCommerce
 * Includes Meilisearch client and supporting libraries
 */

(function() {
    'use strict';

    // Create the meilisearchBundle namespace
    window.meilisearchBundle = window.meilisearchBundle || {};

    // Include jQuery if not already present
    if (typeof jQuery === 'undefined') {
        console.error('jQuery is required for Meilisearch integration');
    } else {
        window.meilisearchBundle.$ = jQuery.noConflict(true);
    }

    // Use the global MeiliSearch from the loaded client
    window.meilisearchBundle.MeiliSearch = window.MeiliSearch;

    // Helper functions for Meilisearch integration
    window.meilisearchBundle.helpers = {
        /**
         * Create a Meilisearch client instance
         */
        createClient: function(config) {
            if (!config.serverUrl) {
                console.error('Meilisearch server URL is required');
                return null;
            }

            // Using the Nginx proxy, we don't need an API key in the frontend
            return new window.MeiliSearch({
                host: config.serverUrl,
                apiKey: '' // API key is added by Nginx proxy
            });
        },

        /**
         * Convert Magento/Algolia facet format to Meilisearch filter format
         */
        buildMeilisearchFilters: function(refinements) {
            const filters = [];
            
            for (const key in refinements) {
                if (refinements.hasOwnProperty(key)) {
                    const values = Array.isArray(refinements[key]) ? refinements[key] : [refinements[key]];
                    const attributeFilters = values.map(value => `${key} = "${value}"`);
                    
                    if (attributeFilters.length > 1) {
                        filters.push(`(${attributeFilters.join(' OR ')})`);
                    } else {
                        filters.push(attributeFilters[0]);
                    }
                }
            }
            
            return filters.join(' AND ');
        },

        /**
         * Format price for display
         */
        formatPrice: function(price, priceFormat) {
            if (!price || !priceFormat) return '';
            
            // Use Magento's price formatting
            const formatted = parseFloat(price).toFixed(priceFormat.requiredPrecision);
            return priceFormat.pattern.replace('%s', formatted);
        },

        /**
         * Get price from product hit
         */
        getPrice: function(hit, priceKey) {
            // Navigate through the price object structure
            const keys = priceKey.split('.');
            let value = hit;
            
            for (const key of keys) {
                if (value && typeof value === 'object') {
                    value = value[key];
                } else {
                    return null;
                }
            }
            
            return value;
        },

        /**
         * Highlight search terms in text
         */
        highlightText: function(text, query) {
            if (!query || !text) return text;
            
            const terms = query.split(/\s+/).filter(term => term.length > 0);
            let highlighted = text;
            
            terms.forEach(term => {
                const regex = new RegExp(`(${term})`, 'gi');
                highlighted = highlighted.replace(regex, '<em>$1</em>');
            });
            
            return highlighted;
        },

        /**
         * Build search parameters for Meilisearch
         */
        buildSearchParams: function(options) {
            const params = {
                limit: options.hitsPerPage || 20,
                offset: ((options.page || 0) * (options.hitsPerPage || 20)),
                facets: options.facets || [],
                attributesToHighlight: options.attributesToHighlight || ['name', 'description'],
                attributesToCrop: options.attributesToCrop || ['description:200']
            };

            if (options.filters) {
                params.filter = options.filters;
            }

            if (options.sort) {
                params.sort = [options.sort];
            }

            return params;
        },

        /**
         * Transform Meilisearch response to match expected format
         */
        transformResponse: function(response, query) {
            return {
                hits: response.hits || [],
                nbHits: response.estimatedTotalHits || 0,
                page: response.page || 0,
                nbPages: Math.ceil((response.estimatedTotalHits || 0) / response.limit),
                hitsPerPage: response.limit || 20,
                processingTimeMS: response.processingTimeMs || 0,
                query: query,
                facets: response.facetDistribution || {},
                exhaustiveFacetsCount: true
            };
        }
    };

    // Event system for extensibility
    window.meilisearchBundle.events = {
        listeners: {},

        on: function(event, callback) {
            if (!this.listeners[event]) {
                this.listeners[event] = [];
            }
            this.listeners[event].push(callback);
        },

        trigger: function(event, data) {
            if (this.listeners[event]) {
                this.listeners[event].forEach(function(callback) {
                    callback(data);
                });
            }
        }
    };

    // Hook system (similar to Algolia's)
    window.meilisearchBundle.hooks = {
        _handlers: {},

        registerHook: function(name, handler) {
            if (!this._handlers[name]) {
                this._handlers[name] = [];
            }
            this._handlers[name].push(handler);
        },

        applyHook: function(name, data) {
            if (this._handlers[name]) {
                this._handlers[name].forEach(function(handler) {
                    data = handler(data) || data;
                });
            }
            return data;
        }
    };

})();