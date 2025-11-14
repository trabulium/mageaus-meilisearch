/**
 * Meilisearch Autocomplete for Magento/MahoCommerce
 */

(function() {
    'use strict';

    let config = null;
    let bundle = null;
    let $ = null;
    
    // Function to check if dependencies are available
    function checkDependencies() {
        // Check for jQuery from our captured reference or any available jQuery
        let jq = window.meilisearchjQuery || window.jQuery || window.gtmPro;
        
        // Additional check - if we have something that looks like jQuery
        if (!jq || typeof jq !== 'function') {
            console.log('Meilisearch: jQuery not found. Checking for: window.meilisearchjQuery =', window.meilisearchjQuery, ', window.jQuery =', window.jQuery, ', window.$ =', window.$, ', window.gtmPro =', window.gtmPro);
            return false;
        }
        
        // Check for config
        if (!window.meilisearchConfig) {
            console.log('Meilisearch: window.meilisearchConfig not found');
            return false;
        }
        
        if (!window.meilisearchConfig.autocomplete) {
            console.log('Meilisearch: window.meilisearchConfig.autocomplete not found', window.meilisearchConfig);
            return false;
        }
        
        if (!window.meilisearchConfig.autocomplete.enabled) {
            console.log('Meilisearch: autocomplete is not enabled in config. Current value:', window.meilisearchConfig.autocomplete.enabled);
            return false;
        }
        
        // All dependencies available
        $ = jq;
        config = window.meilisearchConfig;
        bundle = window.meilisearchBundle;
        return true;
    }

    // Wait for all dependencies to be available
    function waitForDependencies(callback) {
        if (checkDependencies()) {
            callback();
            return;
        }

        // Poll every 100ms for up to 5 seconds
        let attempts = 0;
        const maxAttempts = 50;
        
        const checkInterval = setInterval(function() {
            attempts++;
            
            if (checkDependencies()) {
                clearInterval(checkInterval);
                callback();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.warn('Meilisearch autocomplete: dependencies not found after 5 seconds (jQuery: ' + (typeof window.jQuery !== 'undefined') + ', config: ' + (!!window.meilisearchConfig) + ')');
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
    
    // Initialize when DOM is ready and dependencies are available
    domReady(function() {
        waitForDependencies(function() {
            // Now we can use jQuery's ready handler
            $(document).ready(function() {
                initializeAutocomplete();
            });
        });
    });

    function initializeAutocomplete() {
        console.log('autocomplete.js initializeAutocomplete - config.serverUrl:', config.serverUrl);
        console.log('autocomplete.js initializeAutocomplete - window.meilisearchConfig.serverUrl:', window.meilisearchConfig.serverUrl);
        const $searchInput = $(config.autocomplete.selector);
        
        if (!$searchInput.length) {
            if (config.autocomplete.isDebugEnabled) {
                console.log('Meilisearch: Search input not found with selector:', config.autocomplete.selector);
            }
            return;
        }

        // Create Meilisearch client
        const client = bundle.helpers.createClient(config);
        if (!client) {
            console.error('Meilisearch: Failed to create client');
            return;
        }

        // Initialize autocomplete on each search input
        $searchInput.each(function() {
            setupAutocomplete($(this), client);
        });
    }

    function setupAutocomplete($input, client) {
        let searchTimeout;
        let currentRequest;
        let isOpen = false;
        
        // Create dropdown container
        const $dropdown = $('<div class="meilisearch-autocomplete"></div>');
        $dropdown.css({
            'z-index': 99999,
            'position': 'absolute'
        });
        $dropdown.hide();
        $('body').append($dropdown);

        // Position dropdown
        function positionDropdown() {
            // Check if we're inside a modal
            const inModal = $input.closest('#search_modal').length > 0;
            
            if (inModal) {
                // For modal: use relative positioning
                $dropdown.css({
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    width: '100%',
                    'z-index': 99999
                });
            } else {
                // For regular page: use offset positioning
                const offset = $input.offset();
                const inputHeight = $input.outerHeight();
                
                $dropdown.css({
                    position: 'absolute',
                    top: offset.top + inputHeight,
                    left: offset.left,
                    width: $input.outerWidth(),
                    'z-index': 99999
                });
            }
        }

        // Search function
        function performSearch(query) {
            if (config.autocomplete.isDebugEnabled) {
                console.log('Meilisearch autocomplete: performSearch called with query:', query);
            }
            
            if (!query || query.length < 2) {
                hideDropdown();
                return;
            }

            // Cancel previous request
            if (currentRequest && typeof currentRequest.abort === 'function') {
                currentRequest.abort();
            }

            // Show loading state
            showLoading();

            // Prepare search promises for each section
            const searchPromises = [];
            const sections = config.autocomplete.sections || [];
            
            if (config.autocomplete.isDebugEnabled) {
                console.log('Meilisearch autocomplete config:', config.autocomplete);
                console.log('Products enabled:', parseInt(config.autocomplete.nbOfProductsSuggestions) > 0);
                console.log('Categories enabled:', parseInt(config.autocomplete.nbOfCategoriesSuggestions) > 0);
            }

            // Search products - check if nbOfProductsSuggestions > 0
            if (parseInt(config.autocomplete.nbOfProductsSuggestions) > 0) {
                const productIndex = client.index(config.indexName + '_products');
                const productSearchParams = {
                    limit: parseInt(config.autocomplete.nbOfProductsSuggestions) || 6,
                    attributesToHighlight: ['name'],
                    attributesToCrop: ['description:50']
                };
                
                // Only retrieve attributes that should be displayed
                if (config.displayedAttributes && config.displayedAttributes.length > 0) {
                    productSearchParams.attributesToRetrieve = config.displayedAttributes;
                }
                
                searchPromises.push(
                    productIndex.search(query, productSearchParams).then(response => ({
                        type: 'products',
                        hits: response.hits,
                        query: query
                    }))
                );
            }

            // Search categories - check if nbOfCategoriesSuggestions > 0
            if (parseInt(config.autocomplete.nbOfCategoriesSuggestions) > 0) {
                const categoryIndex = client.index(config.indexName + '_categories');
                searchPromises.push(
                    categoryIndex.search(query, {
                        limit: parseInt(config.autocomplete.nbOfCategoriesSuggestions) || 2,
                        attributesToHighlight: ['name']
                    }).then(response => ({
                        type: 'categories',
                        hits: response.hits,
                        query: query
                    }))
                );
            }

            // Search pages - always enabled if pages index has content
            if (true) { // Enable pages search
                const pageIndex = client.index(config.indexName + '_pages');
                searchPromises.push(
                    pageIndex.search(query, {
                        limit: 2,
                        attributesToHighlight: ['name', 'content']
                    }).then(response => ({
                        type: 'pages',
                        hits: response.hits,
                        query: query
                    }))
                );
            }

            // Search suggestions/queries
            if (sections.some(s => s.name === 'suggestions')) {
                const suggestionIndex = client.index(config.indexPrefix + 'default_suggestions');
                searchPromises.push(
                    suggestionIndex.search(query, {
                        limit: config.autocomplete.nbOfQueriesSuggestions || 5,
                        attributesToHighlight: ['query']
                    }).then(response => ({
                        type: 'suggestions',
                        hits: response.hits,
                        query: query
                    }))
                );
            }
            
            // Search Amasty pages (displayed as Suggestions)
            if (sections.some(s => s.name === 'amasty_pages')) {
                const amastyPageIndex = client.index(config.indexName + '_amasty_pages');
                // Use nbOfPagesSuggestions from config, fallback to section's hitsPerPage, then to 5
                const pageLimit = config.autocomplete.nbOfPagesSuggestions || 
                                  sections.find(s => s.name === 'amasty_pages')?.hitsPerPage || 
                                  5;
                searchPromises.push(
                    amastyPageIndex.search(query, {
                        limit: pageLimit,
                        attributesToHighlight: ['name', 'content']
                    }).then(response => ({
                        type: 'amasty_pages',
                        hits: response.hits,
                        query: query
                    }))
                );
            }

            // Execute all searches
            currentRequest = Promise.all(searchPromises)
                .then(results => {
                    renderResults(results, query);
                })
                .catch(error => {
                    if (error.name !== 'AbortError') {
                        console.error('Meilisearch autocomplete error:', error);
                        showError();
                    }
                });
        }

        // Render results
        function renderResults(results, query) {
            let html = '<div class="meilisearch-autocomplete-wrapper">';
            
            // Sort sections to ensure products come first (for layout)
            const sortedResults = results.sort((a, b) => {
                const order = { 'products': 0, 'categories': 1, 'pages': 2, 'suggestions': 3, 'amasty_pages': 4 };
                return (order[a.type] || 999) - (order[b.type] || 999);
            });
            
            sortedResults.forEach(section => {
                if (section.hits && section.hits.length > 0) {
                    html += renderSection(section);
                }
            });

            // Add footer
            html += '<div class="meilisearch-autocomplete-footer">';
            html += '<a href="' + config.baseUrl + '/catalogsearch/result/?q=' + encodeURIComponent(query) + '">';
            html += config.translations.seeAll + ' (' + query + ')';
            html += '</a>';
            html += '</div>';
            
            html += '</div>';

            $dropdown.html(html);
            showDropdown();
            
            // Bind click events
            bindResultEvents();
        }

        // Render individual section
        function renderSection(section) {
            // Add section-specific class for easier styling
            const sectionClass = 'meilisearch-autocomplete-section-' + section.type;
            let html = '<div class="meilisearch-autocomplete-section ' + sectionClass + '" data-type="' + section.type + '">';
            
            // Section header
            const sectionConfig = config.autocomplete.sections.find(s => s.name === section.type);
            let sectionLabel = null;
            
            if (sectionConfig && sectionConfig.label) {
                sectionLabel = sectionConfig.label;
            } else {
                // Default labels if not in config
                switch (section.type) {
                    case 'products':
                        sectionLabel = config.translations.products || 'Products';
                        break;
                    case 'categories':
                        sectionLabel = config.translations.categories || 'Categories';
                        break;
                    case 'pages':
                        sectionLabel = config.translations.pages || 'Pages';
                        break;
                    case 'suggestions':
                        sectionLabel = config.translations.suggestions || 'Popular searches';
                        break;
                    case 'amasty_pages':
                        sectionLabel = 'Suggestions'; // Display as "Suggestions"
                        break;
                }
            }
            
            if (sectionLabel) {
                html += '<div class="meilisearch-autocomplete-section-title">' + sectionLabel + '</div>';
            }

            // Add hits wrapper for easier styling
            html += '<div class="meilisearch-autocomplete-hits">';
            section.hits.forEach(hit => {
                html += renderHit(hit, section.type, section.query);
            });
            html += '</div>';

            html += '</div>';
            return html;
        }

        // Render individual hit
        function renderHit(hit, type, query) {
            let html = '<div class="meilisearch-autocomplete-hit" data-type="' + type + '" data-id="' + hit.objectID + '">';
            
            switch (type) {
                case 'products':
                    html += renderProduct(hit, query);
                    break;
                case 'categories':
                    html += renderCategory(hit, query);
                    break;
                case 'pages':
                    html += renderPage(hit, query);
                    break;
                case 'suggestions':
                    html += renderSuggestion(hit, query);
                    break;
                case 'amasty_pages':
                    html += renderAmastyPage(hit, query);
                    break;
            }
            
            html += '</div>';
            return html;
        }

        // Render product hit
        function renderProduct(hit, query) {
            let html = '<a href="' + hit.url + '" class="meilisearch-autocomplete-product">';
            
            if (hit.image_url || hit.thumbnail_url) {
                html += '<div class="meilisearch-autocomplete-product-image">';
                html += '<img src="' + (hit.thumbnail_url || hit.image_url) + '" alt="' + escapeHtml(hit.name) + '">';
                html += '</div>';
            }
            
            html += '<div class="meilisearch-autocomplete-product-details">';
            html += '<div class="meilisearch-autocomplete-product-name">';
            html += highlightQuery(hit._highlightResult?.name?.value || hit.name, query);
            html += '</div>';
            
            // Price
            const price = bundle.helpers.getPrice(hit, 'price' + config.priceKey);
            if (price) {
                html += '<div class="meilisearch-autocomplete-product-price">';
                html += bundle.helpers.formatPrice(price, config.priceFormat);
                html += '</div>';
            }
            
            html += '</div>';
            html += '</a>';
            
            return html;
        }

        // Render category hit
        function renderCategory(hit, query) {
            let html = '<a href="' + hit.url + '" class="meilisearch-autocomplete-category">';
            html += '<div class="meilisearch-autocomplete-category-name">';
            html += highlightQuery(hit._highlightResult?.name?.value || hit.name, query);
            html += '</div>';
            
            if (hit.product_count) {
                html += '<div class="meilisearch-autocomplete-category-count">';
                html += '(' + hit.product_count + ' ' + config.translations.products.toLowerCase() + ')';
                html += '</div>';
            }
            
            html += '</a>';
            return html;
        }

        // Render page hit
        function renderPage(hit, query) {
            let html = '<a href="' + hit.url + '" class="meilisearch-autocomplete-page">';
            html += '<div class="meilisearch-autocomplete-page-name">';
            html += highlightQuery(hit._highlightResult?.name?.value || hit.name, query);
            html += '</div>';
            
            if (hit._highlightResult?.content?.value) {
                html += '<div class="meilisearch-autocomplete-page-content">';
                html += hit._highlightResult.content.value;
                html += '</div>';
            }
            
            html += '</a>';
            return html;
        }

        // Render suggestion hit
        function renderSuggestion(hit, query) {
            const suggestionQuery = hit.query || hit.value;
            let html = '<a href="' + config.baseUrl + '/catalogsearch/result/?q=' + encodeURIComponent(suggestionQuery) + '" class="meilisearch-autocomplete-suggestion">';
            html += '<div class="meilisearch-autocomplete-suggestion-query">';
            html += highlightQuery(suggestionQuery, query);
            html += '</div>';
            
            if (hit.num_results) {
                html += '<div class="meilisearch-autocomplete-suggestion-count">';
                html += '(' + hit.num_results + ')';
                html += '</div>';
            }
            
            html += '</a>';
            return html;
        }
        
        // Render Amasty page hit (displayed as a suggestion)
        function renderAmastyPage(hit, query) {
            let html = '<a href="' + hit.url + '" class="meilisearch-autocomplete-suggestion meilisearch-autocomplete-amasty-page">';
            html += '<div class="meilisearch-autocomplete-suggestion-query">';
            html += highlightQuery(hit._highlightResult?.name?.value || hit.name, query);
            html += '</div>';
            
            if (hit._highlightResult?.content?.value) {
                html += '<div class="meilisearch-autocomplete-suggestion-description">';
                html += hit._highlightResult.content.value;
                html += '</div>';
            }
            
            html += '</a>';
            return html;
        }

        // Helper functions
        function highlightQuery(text, query) {
            if (!text) return '';
            
            // If already highlighted by Meilisearch
            if (text.indexOf('<em>') !== -1) {
                return text;
            }
            
            // Manual highlighting
            return bundle.helpers.highlightText(text, query);
        }

        function escapeHtml(text) {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, m => map[m]);
        }

        // Show/hide functions
        function showDropdown() {
            positionDropdown();
            $dropdown.fadeIn(200);
            isOpen = true;
        }

        function hideDropdown() {
            $dropdown.fadeOut(200);
            isOpen = false;
        }

        function showLoading() {
            $dropdown.html('<div class="meilisearch-autocomplete-loading">Searching...</div>');
            showDropdown();
        }

        function showError() {
            $dropdown.html('<div class="meilisearch-autocomplete-error">Search error. Please try again.</div>');
            showDropdown();
        }

        // Event binding
        function bindResultEvents() {
            $dropdown.find('.meilisearch-autocomplete-hit').on('click', function(e) {
                // Track click if analytics enabled
                if (config.analytics.enabled) {
                    const $hit = $(this);
                    const type = $hit.data('type');
                    const id = $hit.data('id');
                    
                    // Send to Google Analytics
                    if (typeof ga !== 'undefined') {
                        ga('send', 'event', 'Meilisearch', 'Autocomplete Click', type + ':' + id);
                    }
                }
            });
        }

        // Input events
        $input.on('keyup', function(e) {
            // Ignore special keys
            if ([13, 27, 38, 40].indexOf(e.keyCode) !== -1) {
                return;
            }

            const query = $(this).val();
            
            // Clear timeout
            clearTimeout(searchTimeout);
            
            // Set new timeout
            searchTimeout = setTimeout(function() {
                performSearch(query);
            }, 300); // 300ms delay
        });

        // Focus/blur events
        $input.on('focus', function() {
            const query = $(this).val();
            if (query.length >= 2) {
                performSearch(query);
            }
        });

        // Click outside to close
        $(document).on('click', function(e) {
            if (!$(e.target).closest($input).length && !$(e.target).closest($dropdown).length) {
                hideDropdown();
            }
        });

        // Window resize
        $(window).on('resize', function() {
            if (isOpen) {
                positionDropdown();
            }
        });

        // Keyboard navigation
        $input.on('keydown', function(e) {
            if (!isOpen) return;
            
            const $hits = $dropdown.find('.meilisearch-autocomplete-hit');
            const $active = $hits.filter('.active');
            
            switch (e.keyCode) {
                case 38: // Up
                    e.preventDefault();
                    if ($active.length && $active.prev('.meilisearch-autocomplete-hit').length) {
                        $active.removeClass('active').prev('.meilisearch-autocomplete-hit').addClass('active');
                    } else {
                        $hits.last().addClass('active');
                    }
                    break;
                    
                case 40: // Down
                    e.preventDefault();
                    if ($active.length && $active.next('.meilisearch-autocomplete-hit').length) {
                        $active.removeClass('active').next('.meilisearch-autocomplete-hit').addClass('active');
                    } else {
                        $hits.first().addClass('active');
                    }
                    break;
                    
                case 13: // Enter
                    e.preventDefault();
                    if ($active.length) {
                        const $link = $active.find('a').first();
                        if ($link.length) {
                            window.location.href = $link.attr('href');
                        }
                    }
                    break;
                    
                case 27: // Escape
                    hideDropdown();
                    break;
            }
        });
    }

})();