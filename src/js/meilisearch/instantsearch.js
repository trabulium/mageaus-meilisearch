/**
 * Meilisearch Instant Search for Magento/MahoCommerce
 */

(function($) {
    'use strict';

    if (!window.meilisearchConfig || !window.meilisearchConfig.instant.enabled) {
        return;
    }

    const config = window.meilisearchConfig;
    const bundle = window.meilisearchBundle;
    
    // State management
    const searchState = {
        query: config.request.query || '',
        page: 0,
        filters: {},
        sort: '',
        hitsPerPage: config.hitsPerPage
    };

    // Meilisearch client
    let client;
    let productIndex;
    
    // DOM elements
    let $searchContainer;
    let $resultsContainer;
    let $facetsContainer;
    let $statsContainer;
    let $paginationContainer;
    
    // Initialize on DOM ready
    $(document).ready(function() {
        if (!config.isSearchPage && !config.isCategoryPage) {
            return;
        }
        
        initializeInstantSearch();
    });

    function initializeInstantSearch() {
        // Create client
        client = bundle.helpers.createClient(config);
        if (!client) {
            console.error('Meilisearch: Failed to create client');
            return;
        }
        
        productIndex = client.index(config.indexPrefix + 'default_products');
        
        // Initialize containers
        $searchContainer = $(config.instant.selector);
        if (!$searchContainer.length) {
            console.error('Meilisearch: Search container not found:', config.instant.selector);
            return;
        }
        
        // Replace backend content with instant search
        createSearchInterface();
        
        // Initialize from URL parameters
        parseUrlParameters();
        
        // Perform initial search
        performSearch();
        
        // Bind events
        bindEvents();
    }

    function createSearchInterface() {
        const html = `
            <div class="meilisearch-instantsearch-container">
                <div class="meilisearch-instantsearch-left">
                    <div class="meilisearch-instantsearch-facets"></div>
                </div>
                <div class="meilisearch-instantsearch-right">
                    <div class="meilisearch-instantsearch-header">
                        <div class="meilisearch-instantsearch-stats"></div>
                        <div class="meilisearch-instantsearch-sort">
                            <select class="meilisearch-instantsearch-sort-select">
                                <option value="">${config.translations.relevance}</option>
                                ${config.sortingIndices.map(idx => 
                                    `<option value="${idx.name}">${idx.label}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="meilisearch-instantsearch-current-refinements"></div>
                    <div class="meilisearch-instantsearch-results"></div>
                    <div class="meilisearch-instantsearch-pagination"></div>
                </div>
            </div>
        `;
        
        $searchContainer.html(html);
        
        // Cache containers
        $facetsContainer = $('.meilisearch-instantsearch-facets');
        $resultsContainer = $('.meilisearch-instantsearch-results');
        $statsContainer = $('.meilisearch-instantsearch-stats');
        $paginationContainer = $('.meilisearch-instantsearch-pagination');
    }

    function parseUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Query
        if (urlParams.has('q')) {
            searchState.query = urlParams.get('q');
        }
        
        // Page
        if (urlParams.has('page')) {
            searchState.page = parseInt(urlParams.get('page')) - 1; // 0-indexed
        }
        
        // Filters
        config.facets.forEach(facet => {
            const param = 'attribute:' + facet.attribute;
            if (urlParams.has(param)) {
                const values = urlParams.getAll(param);
                searchState.filters[facet.attribute] = values;
            }
        });
        
        // Sort
        if (urlParams.has('index')) {
            searchState.sort = urlParams.get('index');
        }
    }

    function updateUrl() {
        const params = new URLSearchParams();
        
        // Query
        if (searchState.query) {
            params.set('q', searchState.query);
        }
        
        // Page
        if (searchState.page > 0) {
            params.set('page', searchState.page + 1);
        }
        
        // Filters
        Object.keys(searchState.filters).forEach(attribute => {
            const values = searchState.filters[attribute];
            values.forEach(value => {
                params.append('attribute:' + attribute, value);
            });
        });
        
        // Sort
        if (searchState.sort) {
            params.set('index', searchState.sort);
        }
        
        // Update URL without reload
        const newUrl = window.location.pathname + '?' + params.toString();
        window.history.pushState({}, '', newUrl);
    }

    function performSearch() {
        // Show loading state
        $resultsContainer.html('<div class="meilisearch-loading">Loading...</div>');
        
        // Build search parameters
        const searchParams = {
            limit: searchState.hitsPerPage,
            offset: searchState.page * searchState.hitsPerPage,
            facets: config.facets.map(f => f.attribute),
            attributesToHighlight: ['name', 'description'],
            attributesToCrop: ['description:200']
        };
        
        // Only retrieve attributes that should be displayed
        if (config.displayedAttributes && config.displayedAttributes.length > 0) {
            searchParams.attributesToRetrieve = config.displayedAttributes;
        }
        
        // Add filters
        const filters = [];
        Object.keys(searchState.filters).forEach(attribute => {
            const values = searchState.filters[attribute];
            if (values.length > 0) {
                const attributeFilters = values.map(value => `${attribute} = "${value}"`);
                filters.push(values.length > 1 ? `(${attributeFilters.join(' OR ')})` : attributeFilters[0]);
            }
        });
        
        // Add category filter for category pages
        if (config.isCategoryPage && config.request.path) {
            filters.push(`categories.level${config.request.level} = "${config.request.path}"`);
        }
        
        if (filters.length > 0) {
            searchParams.filter = filters.join(' AND ');
        }
        
        // Use appropriate index for sorting
        const indexName = searchState.sort || (config.indexPrefix + 'default_products');
        const index = client.index(indexName);
        
        // Perform search
        index.search(searchState.query, searchParams)
            .then(response => {
                renderResults(response);
                renderFacets(response);
                renderStats(response);
                renderPagination(response);
                renderCurrentRefinements();
            })
            .catch(error => {
                console.error('Meilisearch search error:', error);
                $resultsContainer.html('<div class="meilisearch-error">Search error. Please try again.</div>');
            });
    }

    function renderResults(response) {
        if (!response.hits || response.hits.length === 0) {
            renderNoResults();
            return;
        }
        
        let html = '<div class="meilisearch-instantsearch-hits">';
        
        response.hits.forEach(hit => {
            html += renderHit(hit);
        });
        
        html += '</div>';
        
        $resultsContainer.html(html);
        
        // Bind product events
        bindProductEvents();
    }

    function renderHit(hit) {
        const price = bundle.helpers.getPrice(hit, 'price' + config.priceKey);
        const specialPrice = bundle.helpers.getPrice(hit, 'price' + config.priceKey + '_special');
        
        let priceHtml = '';
        if (specialPrice && specialPrice < price) {
            priceHtml = `
                <span class="old-price">${bundle.helpers.formatPrice(price, config.priceFormat)}</span>
                <span class="special-price">${bundle.helpers.formatPrice(specialPrice, config.priceFormat)}</span>
            `;
        } else if (price) {
            priceHtml = `<span class="price">${bundle.helpers.formatPrice(price, config.priceFormat)}</span>`;
        }
        
        return `
            <div class="meilisearch-instantsearch-hit" data-product-id="${hit.objectID}">
                <div class="hit-image">
                    <a href="${hit.url}">
                        <img src="${hit.image_url || hit.thumbnail_url}" alt="${escapeHtml(hit.name)}" />
                    </a>
                </div>
                <div class="hit-content">
                    <h3 class="hit-name">
                        <a href="${hit.url}">
                            ${hit._formatted?.name || hit.name}
                        </a>
                    </h3>
                    ${hit.rating_summary ? `
                        <div class="hit-rating">
                            <div class="rating-box">
                                <div class="rating" style="width:${hit.rating_summary}%"></div>
                            </div>
                        </div>
                    ` : ''}
                    <div class="hit-price">
                        ${priceHtml}
                    </div>
                    ${config.instant.isAddToCartEnabled && hit.in_stock ? `
                        <button class="button btn-cart" data-product-id="${hit.objectID}">
                            <span><span>${config.translations.addToCart || 'Add to Cart'}</span></span>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    function renderFacets(response) {
        if (!response.facetDistribution || !config.instant.hasFacets) {
            return;
        }
        
        let html = '<div class="block-title"><strong><span>' + config.translations.refine + '</span></strong></div>';
        html += '<div class="block-content">';
        
        config.facets.forEach(facetConfig => {
            const facetData = response.facetDistribution[facetConfig.attribute];
            if (!facetData || Object.keys(facetData).length === 0) {
                return;
            }
            
            html += renderFacet(facetConfig, facetData);
        });
        
        html += '</div>';
        
        $facetsContainer.html(html);
        
        // Bind facet events
        bindFacetEvents();
    }

    function renderFacet(facetConfig, facetData) {
        const isExpanded = true; // Could be made configurable
        const selectedValues = searchState.filters[facetConfig.attribute] || [];
        
        let html = `
            <div class="meilisearch-facet" data-attribute="${facetConfig.attribute}">
                <div class="facet-title ${isExpanded ? 'expanded' : ''}">
                    ${facetConfig.label}
                </div>
                <div class="facet-content" ${!isExpanded ? 'style="display:none"' : ''}>
        `;
        
        // Sort facet values
        const sortedValues = Object.entries(facetData).sort((a, b) => b[1] - a[1]);
        
        // Limit displayed values
        const maxValues = config.maxValuesPerFacet;
        const displayedValues = sortedValues.slice(0, maxValues);
        const hasMore = sortedValues.length > maxValues;
        
        displayedValues.forEach(([value, count]) => {
            const isSelected = selectedValues.includes(value);
            html += `
                <div class="facet-value ${isSelected ? 'selected' : ''}" data-value="${escapeHtml(value)}">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} />
                    <label>
                        <span class="facet-value-name">${escapeHtml(value)}</span>
                        <span class="facet-value-count">(${count})</span>
                    </label>
                </div>
            `;
        });
        
        if (hasMore) {
            html += `<div class="facet-show-more">${config.translations.showMore}</div>`;
        }
        
        html += '</div></div>';
        
        return html;
    }

    function renderStats(response) {
        const start = searchState.page * searchState.hitsPerPage + 1;
        const end = Math.min(start + searchState.hitsPerPage - 1, response.estimatedTotalHits);
        
        let html = '';
        if (searchState.query) {
            html = `Showing ${start}-${end} of ${response.estimatedTotalHits} results for "<strong>${escapeHtml(searchState.query)}</strong>"`;
        } else {
            html = `Showing ${start}-${end} of ${response.estimatedTotalHits} results`;
        }
        
        $statsContainer.html(html);
    }

    function renderPagination(response) {
        const totalPages = Math.ceil(response.estimatedTotalHits / searchState.hitsPerPage);
        const currentPage = searchState.page;
        
        if (totalPages <= 1) {
            $paginationContainer.empty();
            return;
        }
        
        let html = '<div class="pages"><ol>';
        
        // Previous
        if (currentPage > 0) {
            html += `<li><a class="previous" href="#" data-page="${currentPage - 1}">${config.translations.previousPage}</a></li>`;
        }
        
        // Page numbers
        const range = 2; // Pages to show on each side
        for (let i = 0; i < totalPages; i++) {
            if (i === 0 || i === totalPages - 1 || (i >= currentPage - range && i <= currentPage + range)) {
                if (i === currentPage) {
                    html += `<li class="current">${i + 1}</li>`;
                } else {
                    html += `<li><a href="#" data-page="${i}">${i + 1}</a></li>`;
                }
            } else if (i === currentPage - range - 1 || i === currentPage + range + 1) {
                html += '<li>...</li>';
            }
        }
        
        // Next
        if (currentPage < totalPages - 1) {
            html += `<li><a class="next" href="#" data-page="${currentPage + 1}">${config.translations.nextPage}</a></li>`;
        }
        
        html += '</ol></div>';
        
        $paginationContainer.html(html);
        
        // Bind pagination events
        bindPaginationEvents();
    }

    function renderCurrentRefinements() {
        const refinements = [];
        
        Object.keys(searchState.filters).forEach(attribute => {
            const values = searchState.filters[attribute];
            const facetConfig = config.facets.find(f => f.attribute === attribute);
            
            values.forEach(value => {
                refinements.push({
                    attribute: attribute,
                    label: facetConfig ? facetConfig.label : attribute,
                    value: value
                });
            });
        });
        
        if (refinements.length === 0) {
            $('.meilisearch-instantsearch-current-refinements').empty();
            return;
        }
        
        let html = `
            <div class="current-refinements">
                <span class="label">${config.translations.selectedFilters}:</span>
        `;
        
        refinements.forEach(refinement => {
            html += `
                <span class="refinement" data-attribute="${refinement.attribute}" data-value="${escapeHtml(refinement.value)}">
                    ${escapeHtml(refinement.label)}: ${escapeHtml(refinement.value)}
                    <span class="remove">×</span>
                </span>
            `;
        });
        
        html += `
                <a href="#" class="clear-all">${config.translations.clearAll}</a>
            </div>
        `;
        
        $('.meilisearch-instantsearch-current-refinements').html(html);
        
        // Bind refinement events
        bindRefinementEvents();
    }

    function renderNoResults() {
        let html = `
            <div class="meilisearch-no-results">
                <p>${config.translations.noProducts} "${escapeHtml(searchState.query)}"</p>
        `;
        
        if (config.showSuggestionsOnNoResultsPage) {
            html += `<p>${config.translations.popularQueries}:</p><ul>`;
            config.popularQueries.forEach(query => {
                html += `<li><a href="?q=${encodeURIComponent(query)}">${escapeHtml(query)}</a></li>`;
            });
            html += '</ul>';
        }
        
        html += '</div>';
        
        $resultsContainer.html(html);
    }

    // Event handlers
    function bindEvents() {
        // Search input (if on search page)
        $('#search').on('keyup', debounce(function() {
            searchState.query = $(this).val();
            searchState.page = 0;
            performSearch();
            updateUrl();
        }, 300));
        
        // Sort select
        $('.meilisearch-instantsearch-sort-select').on('change', function() {
            searchState.sort = $(this).val();
            searchState.page = 0;
            performSearch();
            updateUrl();
        });
        
        // Browser back/forward
        window.addEventListener('popstate', function() {
            parseUrlParameters();
            performSearch();
        });
    }

    function bindFacetEvents() {
        // Facet value click
        $('.facet-value').on('click', function(e) {
            e.preventDefault();
            const $facet = $(this).closest('.meilisearch-facet');
            const attribute = $facet.data('attribute');
            const value = $(this).data('value');
            
            if (!searchState.filters[attribute]) {
                searchState.filters[attribute] = [];
            }
            
            const index = searchState.filters[attribute].indexOf(value);
            if (index > -1) {
                searchState.filters[attribute].splice(index, 1);
                if (searchState.filters[attribute].length === 0) {
                    delete searchState.filters[attribute];
                }
            } else {
                searchState.filters[attribute].push(value);
            }
            
            searchState.page = 0;
            performSearch();
            updateUrl();
        });
        
        // Facet title click (expand/collapse)
        $('.facet-title').on('click', function() {
            $(this).toggleClass('expanded');
            $(this).next('.facet-content').slideToggle(200);
        });
    }

    function bindPaginationEvents() {
        $paginationContainer.find('a').on('click', function(e) {
            e.preventDefault();
            searchState.page = parseInt($(this).data('page'));
            performSearch();
            updateUrl();
            
            // Scroll to top
            $('html, body').animate({ scrollTop: 0 }, 300);
        });
    }

    function bindRefinementEvents() {
        // Remove individual refinement
        $('.refinement .remove').on('click', function() {
            const $refinement = $(this).parent();
            const attribute = $refinement.data('attribute');
            const value = $refinement.data('value');
            
            if (searchState.filters[attribute]) {
                const index = searchState.filters[attribute].indexOf(value);
                if (index > -1) {
                    searchState.filters[attribute].splice(index, 1);
                    if (searchState.filters[attribute].length === 0) {
                        delete searchState.filters[attribute];
                    }
                }
            }
            
            searchState.page = 0;
            performSearch();
            updateUrl();
        });
        
        // Clear all refinements
        $('.clear-all').on('click', function(e) {
            e.preventDefault();
            searchState.filters = {};
            searchState.page = 0;
            performSearch();
            updateUrl();
        });
    }

    function bindProductEvents() {
        // Add to cart
        $('.btn-cart').on('click', function() {
            const productId = $(this).data('product-id');
            const formKey = config.request.formKey;
            
            // Simple add to cart - you may need to adjust based on your Magento setup
            $.post(config.baseUrl + '/checkout/cart/add/', {
                product: productId,
                qty: 1,
                form_key: formKey
            })
            .done(function() {
                // Reload mini cart or show success message
                window.location.reload();
            })
            .fail(function() {
                alert('Failed to add product to cart');
            });
        });
    }

    // Utility functions
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

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

})(jQuery);