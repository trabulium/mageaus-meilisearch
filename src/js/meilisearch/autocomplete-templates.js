/**
 * Meilisearch Autocomplete with Templates
 */

(function() {
    'use strict';

    let config = null;
    let bundle = null;
    let $ = null;
    let templates = {};
    
    // Function to check if dependencies are available
    function checkDependencies() {
        // Check for jQuery from our captured reference
        let jq = window.meilisearchjQuery;
        
        if (!jq) {
            return false;
        }
        
        // Check for Mustache
        if (typeof window.Mustache === 'undefined') {
            return false;
        }
        
        // Check for config
        if (!window.meilisearchConfig || !window.meilisearchConfig.autocomplete || !window.meilisearchConfig.autocomplete.enabled) {
            return false;
        }
        
        // All dependencies available
        $ = jq;
        config = window.meilisearchConfig;
        bundle = window.meilisearchBundle;
        return true;
    }

    // Load templates from the DOM
    function loadTemplates() {
        templates.products = $('#meilisearch-autocomplete-product-template').html();
        templates.categories = $('#meilisearch-autocomplete-category-template').html();
        templates.pages = $('#meilisearch-autocomplete-page-template').html();
        templates.suggestions = $('#meilisearch-autocomplete-suggestion-template').html();
        templates.amasty_pages = $('#meilisearch-autocomplete-amasty-page-template').html();
        
        // Parse templates to speed up rendering
        if (templates.products) Mustache.parse(templates.products);
        if (templates.categories) Mustache.parse(templates.categories);
        if (templates.pages) Mustache.parse(templates.pages);
        if (templates.suggestions) Mustache.parse(templates.suggestions);
        if (templates.amasty_pages) Mustache.parse(templates.amasty_pages);
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
                console.warn('Meilisearch autocomplete: dependencies not found after 5 seconds');
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
                loadTemplates();
                initializeAutocomplete();
            });
        });
    });

    function initializeAutocomplete() {
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
                // For regular page: full width positioning
                // Check viewport width for mobile adjustment
                var topPosition = window.innerWidth <= 1199 ? 62 : 100;
                
                $dropdown.css({
                    position: 'absolute',
                    top: topPosition,
                    left: 0,
                    width: '100%',
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
            
            // Search products
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

            // Search categories
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

            // Search pages
            if (parseInt(config.autocomplete.nbOfPagesSuggestions) > 0) {
                const pageIndex = client.index(config.indexName + '_pages');
                searchPromises.push(
                    pageIndex.search(query, {
                        limit: parseInt(config.autocomplete.nbOfPagesSuggestions) || 2,
                        attributesToHighlight: ['name', 'content']
                    }).then(response => ({
                        type: 'pages',
                        hits: response.hits,
                        query: query
                    }))
                );
            }

            // Search Amasty pages (displayed as Suggestions) - only if enabled
            const amastySection = config.autocomplete.sections && config.autocomplete.sections.find(s => s.name === 'amasty_pages');
            if (amastySection && amastySection.enabled) {
                const amastyPageIndex = client.index(config.indexName + '_amasty_pages');
                searchPromises.push(
                    amastyPageIndex.search(query, {
                        limit: 5,
                        attributesToHighlight: ['name', 'content']
                    }).then(response => ({
                        type: 'amasty_pages',
                        hits: response.hits,
                        query: query
                    })).catch(error => {
                        // If the index doesn't exist or there's an error, just return empty results
                        if (config.autocomplete.isDebugEnabled) {
                            console.log('Meilisearch: Amasty pages index not found or error:', error);
                        }
                        return {
                            type: 'amasty_pages',
                            hits: [],
                            query: query
                        };
                    })
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

        // Render results using templates
        function renderResults(results, query) {
            let html = '<div class="meilisearch-autocomplete-wrapper">';
            
            // Separate products from sidebar sections
            const productsSection = results.find(r => r.type === 'products');
            const sidebarSections = results.filter(r => r.type !== 'products');
            
            // Check if we have any results at all
            const hasProducts = productsSection && productsSection.hits && productsSection.hits.length > 0;
            const hasSidebarResults = sidebarSections.some(section => section.hits && section.hits.length > 0);
            
            // Always render the products section to maintain layout
            if (productsSection && productsSection.hits && productsSection.hits.length > 0) {
                html += renderSection(productsSection);
            } else {
                // Show "No products" message in products section - maintain the same structure
                html += '<div class="meilisearch-autocomplete-section meilisearch-autocomplete-section-products" data-type="products">';
                html += '<div class="meilisearch-autocomplete-section-title">' + (config.translations.products || 'Products') + '</div>';
                html += '<div class="meilisearch-autocomplete-no-results-message">';
                html += config.translations.noProductsFor ? 
                    config.translations.noProductsFor.replace('%s', escapeHtml(query)) : 
                    'No products for query "' + escapeHtml(query) + '"';
                html += '</div>';
                html += '</div>';
            }
            
            // Sidebar: Suggestions and Categories
            html += '<div class="meilisearch-autocomplete-sidebar">';
            
            // Sort sidebar sections - amasty_pages first, then categories, then pages
            const sortedSidebar = sidebarSections.sort((a, b) => {
                const order = { 'amasty_pages': 0, 'categories': 1, 'pages': 2, 'suggestions': 3 };
                return (order[a.type] || 999) - (order[b.type] || 999);
            });
            
            // Debug: log section order
            if (config.autocomplete.isDebugEnabled) {
                console.log('Sidebar sections order:', sortedSidebar.map(s => s.type));
            }
            
            sortedSidebar.forEach(section => {
                if (section.hits && section.hits.length > 0) {
                    html += renderSection(section);
                } else {
                    // Show "No results" for empty sections
                    html += renderEmptySection(section);
                }
            });
            
            html += '</div>';

            // Add footer outside the wrapper
            html += '</div>'; // Close wrapper
            html += '<div class="meilisearch-autocomplete-footer">';
            html += '<a href="' + config.baseUrl + '/catalogsearch/result/?q=' + encodeURIComponent(query) + '">';
            html += config.translations.seeAll + ' (' + query + ')';
            html += '</a>';
            html += '</div>';

            $dropdown.html(html);
            if (!isOpen) {
                showDropdown();
            }
            
            // Bind click events
            bindResultEvents();
        }

        // Render section with template
        function renderSection(section) {
            const sectionClass = 'meilisearch-autocomplete-section-' + section.type;
            let html = '<div class="meilisearch-autocomplete-section ' + sectionClass + '" data-type="' + section.type + '">';
            
            // Section header
            let sectionLabel = getSectionLabel(section.type);
            if (sectionLabel) {
                html += '<div class="meilisearch-autocomplete-section-title">' + sectionLabel + '</div>';
            }

            // Section items using templates
            html += '<div class="meilisearch-autocomplete-hits">';
            
            const template = templates[section.type];
            if (template) {
                section.hits.forEach(hit => {
                    // Prepare data for template
                    const data = prepareHitData(hit, section.type);
                    html += '<div class="meilisearch-autocomplete-hit" data-type="' + section.type + '" data-id="' + hit.objectID + '">';
                    html += Mustache.render(template, data);
                    html += '</div>';
                });
            } else {
                // Fallback if template not found
                section.hits.forEach(hit => {
                    html += '<div class="meilisearch-autocomplete-hit">';
                    html += '<a href="' + hit.url + '">' + hit.name + '</a>';
                    html += '</div>';
                });
            }
            
            html += '</div>';
            html += '</div>';
            
            return html;
        }

        // Render empty section with "No results" message
        function renderEmptySection(section) {
            const sectionClass = 'meilisearch-autocomplete-section-' + section.type;
            let html = '<div class="meilisearch-autocomplete-section ' + sectionClass + ' meilisearch-autocomplete-section-empty" data-type="' + section.type + '">';
            
            // Section header
            let sectionLabel = getSectionLabel(section.type);
            if (sectionLabel) {
                html += '<div class="meilisearch-autocomplete-section-title">' + sectionLabel + '</div>';
            }
            
            // No results message
            html += '<div class="meilisearch-autocomplete-no-results-message">';
            html += config.translations.noResults || 'No results';
            html += '</div>';
            
            html += '</div>';
            return html;
        }

        // Get section label
        function getSectionLabel(type) {
            const sectionConfig = config.autocomplete.sections && config.autocomplete.sections.find(s => s.name === type);
            
            if (sectionConfig && sectionConfig.label) {
                return sectionConfig.label;
            }
            
            // Default labels
            switch (type) {
                case 'products':
                    return config.translations.products || 'Products';
                case 'categories':
                    return config.translations.categories || 'Categories';
                case 'pages':
                    return config.translations.pages || 'Pages';
                case 'suggestions':
                    return config.translations.suggestions || 'Popular searches';
                case 'amasty_pages':
                    return 'Suggestions'; // Display as "Suggestions"
                default:
                    return null;
            }
        }

        // Prepare hit data for template
        function prepareHitData(hit, type) {
            // Convert Meilisearch's _formatted to Algolia's _highlightResult format
            // This ensures compatibility with existing templates
            if (hit._formatted) {
                hit._highlightResult = {};
                for (const key in hit._formatted) {
                    hit._highlightResult[key] = {
                        value: hit._formatted[key]
                    };
                }
            }
            
            // If no highlighting, create basic highlight result
            if (!hit._highlightResult) {
                hit._highlightResult = {};
                if (hit.name) {
                    hit._highlightResult.name = { value: hit.name };
                }
                if (hit.content) {
                    hit._highlightResult.content = { value: hit.content };
                }
            }
            
            // Add price formatting for products
            if (type === 'products' && hit.price) {
                const price = bundle.helpers.getPrice(hit, 'price' + config.priceKey);
                if (price) {
                    hit.price_formatted = bundle.helpers.formatPrice(price, config.priceFormat);
                }
            }
            
            // Fix protocol-relative URLs for images
            if (hit.thumbnail_url && hit.thumbnail_url.indexOf('//') === 0) {
                hit.thumbnail_url = 'https:' + hit.thumbnail_url;
            }
            if (hit.image_url && hit.image_url.indexOf('//') === 0) {
                hit.image_url = 'https:' + hit.image_url;
            }
            
            // Ensure URL is set
            if (!hit.url) {
                switch (type) {
                    case 'products':
                        hit.url = config.baseUrl + '/catalog/product/view/id/' + hit.objectID;
                        break;
                    case 'categories':
                        hit.url = config.baseUrl + '/catalog/category/view/id/' + hit.objectID;
                        break;
                    case 'pages':
                        hit.url = config.baseUrl + '/' + (hit.identifier || '');
                        break;
                }
            }
            
            return hit;
        }

        // Show/hide functions
        function showDropdown() {
            positionDropdown();
            $dropdown.show();
            isOpen = true;
        }

        function hideDropdown() {
            $dropdown.hide();
            isOpen = false;
        }

        function showLoading() {
            // Only show loading if dropdown is not already open with content
            if (!isOpen || $dropdown.html().trim() === '') {
                $dropdown.html('<div class="meilisearch-autocomplete-loading">Searching...</div>');
                showDropdown();
            }
        }

        function showError() {
            $dropdown.html('<div class="meilisearch-autocomplete-error">Search error. Please try again.</div>');
            showDropdown();
        }

        // Event binding
        function bindResultEvents() {
            $dropdown.find('.meilisearch-autocomplete-hit').on('click', function(e) {
                // Track click if analytics enabled
                if (config.analytics && config.analytics.enabled) {
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
                        window.location.href = $active.attr('href');
                    }
                    break;
                    
                case 27: // Escape
                    hideDropdown();
                    break;
            }
        });
    }
    
    // Escape HTML for security
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

})();
