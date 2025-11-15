/**
 * Meilisearch Autocomplete - Vanilla JavaScript
 * No jQuery dependency - Pure modern JavaScript
 */

(function() {
    'use strict';

    // Configuration from PHP template
    const config = window.meilisearchConfig || {};

    if (!config.autocomplete || !config.autocomplete.enabled) {
        console.log('Meilisearch autocomplete not enabled');
        return;
    }

    const AUTOCOMPLETE_SELECTOR = config.autocomplete.selector || '#search';
    const SERVER_URL = config.serverUrl;
    const INDEX_PREFIX = config.indexPrefix || '';
    const STORE_CODE = getStoreCodeFromUrl();
    const INDEX_NAME = INDEX_PREFIX + STORE_CODE + '_products';

    // Debounce helper
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

    // Extract store code from URL or use default
    function getStoreCodeFromUrl() {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        // Common store codes to check
        const storeCodes = ['en', 'fr', 'de', 'default'];
        if (pathParts.length > 0 && storeCodes.includes(pathParts[0])) {
            return pathParts[0];
        }
        return 'default';
    }

    // Search Meilisearch index
    async function search(query) {
        if (!query || query.length < 2) {
            return { hits: [] };
        }

        try {
            const response = await fetch(`${SERVER_URL}/indexes/${INDEX_NAME}/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: query,
                    limit: config.autocomplete.nbOfProductsSuggestions || 10,
                    attributesToRetrieve: ['name', 'sku', 'price', 'image_url', 'url'],
                    attributesToHighlight: ['name'],
                })
            });

            if (!response.ok) {
                throw new Error(`Search failed: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Meilisearch search error:', error);
            return { hits: [] };
        }
    }

    // Format price with currency symbol
    function formatPrice(price) {
        const symbol = config.currencySymbol || '$';
        const formattedPrice = typeof price === 'number' ? price.toFixed(2) : price;
        return `${symbol}${formattedPrice}`;
    }

    // Create autocomplete dropdown HTML
    function createDropdownHTML(results) {
        if (!results.hits || results.hits.length === 0) {
            return '<div class="aa-empty">No products found</div>';
        }

        let html = '<div class="aa-dataset-products">';
        html += '<div class="aa-suggestions">';

        results.hits.forEach(hit => {
            const name = hit._formatted?.name || hit.name || '';
            const price = hit.price ? formatPrice(hit.price) : '';
            const imageUrl = hit.image_url || hit.thumbnail_url || '';
            const productUrl = hit.url || '#';

            html += `
                <div class="aa-suggestion">
                    <a href="${productUrl}" class="aa-suggestion-link">
                        ${imageUrl ? `<div class="aa-suggestion-image"><img src="${imageUrl}" alt="${name}" loading="lazy"></div>` : ''}
                        <div class="aa-suggestion-content">
                            <div class="aa-suggestion-title">${name}</div>
                            ${price ? `<div class="aa-suggestion-price">${price}</div>` : ''}
                        </div>
                    </a>
                </div>
            `;
        });

        html += '</div></div>';

        // Add "View all results" link if there are results
        if (results.hits.length > 0) {
            const searchForm = document.querySelector('form#search_mini_form');
            const searchUrl = searchForm ? searchForm.action : '/catalogsearch/result/';
            const queryParam = searchForm ? (searchForm.querySelector('[name="q"]') || {}).name || 'q' : 'q';
            const query = encodeURIComponent(document.querySelector(AUTOCOMPLETE_SELECTOR).value);

            html += `
                <div class="aa-footer">
                    <a href="${searchUrl}?${queryParam}=${query}" class="aa-see-all">
                        ${config.translations?.seeAll || 'See all products'} (${results.estimatedTotalHits || results.hits.length})
                    </a>
                </div>
            `;
        }

        return html;
    }

    // Create and append dropdown container
    function createDropdownContainer() {
        let dropdown = document.getElementById('meilisearch-autocomplete');
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.id = 'meilisearch-autocomplete';
            dropdown.className = 'meilisearch-autocomplete aa-dropdown-menu';
            dropdown.style.display = 'none';

            const input = document.querySelector(AUTOCOMPLETE_SELECTOR);
            if (input && input.parentNode) {
                input.parentNode.appendChild(dropdown);
            }
        }
        return dropdown;
    }

    // Show dropdown
    function showDropdown(dropdown) {
        dropdown.style.display = 'block';
    }

    // Hide dropdown
    function hideDropdown(dropdown) {
        dropdown.style.display = 'none';
    }

    // Initialize autocomplete
    function initAutocomplete() {
        const input = document.querySelector(AUTOCOMPLETE_SELECTOR);
        if (!input) {
            console.warn('Meilisearch: Input not found:', AUTOCOMPLETE_SELECTOR);
            return;
        }

        console.log('Meilisearch: Initializing vanilla JS autocomplete on', AUTOCOMPLETE_SELECTOR);

        const dropdown = createDropdownContainer();
        let currentQuery = '';

        // Debounced search handler
        const handleSearch = debounce(async function() {
            const query = input.value.trim();
            currentQuery = query;

            if (query.length < 2) {
                hideDropdown(dropdown);
                return;
            }

            const results = await search(query);

            // Only update if query hasn't changed
            if (currentQuery === query) {
                dropdown.innerHTML = createDropdownHTML(results);
                showDropdown(dropdown);
            }
        }, 300);

        // Event listeners
        input.addEventListener('input', handleSearch);

        input.addEventListener('focus', function() {
            if (input.value.trim().length >= 2) {
                handleSearch();
            }
        });

        // Click outside to close
        document.addEventListener('click', function(e) {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                hideDropdown(dropdown);
            }
        });

        // Keyboard navigation
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                hideDropdown(dropdown);
            }
        });

        console.log('Meilisearch: Autocomplete initialized successfully');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAutocomplete);
    } else {
        initAutocomplete();
    }

})();
