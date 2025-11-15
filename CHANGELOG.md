# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2025-01-15

### Fixed
- **CRITICAL**: Fixed PHP 8.3+ compatibility issue with currency symbol retrieval
- Fixed `ArgumentCountError: NumberFormatter::getSymbol() expects exactly 1 argument`
- Changed to use `Mage::getModel('directory/currency')->getCurrencySymbol()` for PHP 8.3+ compatibility
- Fixed `serverUrl` configuration to point to actual Meilisearch API server instead of Maho search results page
- Added separate `searchResultsUrl` field for Maho search results page URL

## [2.0.0] - 2025-01-15

### BREAKING CHANGES
- **Complete removal of jQuery dependency**
- Frontend autocomplete completely rewritten in vanilla JavaScript
- Old jQuery-based JavaScript files no longer loaded
- Modern ES6+ JavaScript using native fetch() API
- Cleaner, faster, more maintainable codebase

### Added
- `autocomplete-vanilla.js`: Pure vanilla JavaScript autocomplete implementation
- `autocomplete-vanilla.css`: Clean, modern CSS for autocomplete dropdown
- Debounced search input for better performance
- Native DOM manipulation (no jQuery selectors)
- Keyboard navigation support (Escape to close)
- Click-outside-to-close functionality
- Loading states and animations
- Mobile-responsive design
- Highlighted search terms in results
- "See all results" footer link with result count

### Changed
- Layout XML simplified - only loads necessary scripts
- Autocomplete now uses native fetch() instead of jQuery AJAX
- Dropdown positioning and styling completely redesigned
- Search results display with product images, names, and prices
- Configuration still provided via `window.meilisearchConfig`

### Removed
- jQuery dependency (all references removed)
- Old autocomplete.js (jQuery-based)
- Old instantsearch.js (jQuery-based)
- meilisearchBundle.js (jQuery wrapper)
- jquery-capture.js (no longer needed)
- jquery-test.js (no longer needed)
- All jQuery-specific code and workarounds

### Performance
- Smaller JavaScript bundle size (removed ~85KB jQuery)
- Faster page load times
- Reduced DOM manipulation overhead
- Modern browser APIs for better performance

## [1.19.11] - 2025-01-15

### Fixed
- **CRITICAL**: Moved frontend templates to correct directory structure
- Templates moved from `app/design/frontend/base/default/meilisearch/` to `app/design/frontend/base/default/template/meilisearch/`
- Fixes search box disappearing and autocomplete not rendering
- Removed hardcoded Moogento jQuery dependency from layout XML
- Frontend now uses theme's jQuery or CDN jQuery instead

### Changed
- Reorganized frontend template structure to match Maho/Magento conventions
- Removed vendor-specific JavaScript dependencies

## [1.19.10] - 2025-01-15

### Fixed
- **CRITICAL**: Fixed missing frontend layout file
- Moved meilisearch.xml to correct location: `app/design/frontend/base/default/layout/`
- Fixes frontend Meilisearch autocomplete and instant search not loading
- Layout file was incorrectly placed directly in `app/design/frontend/base/default/` instead of `layout/` subdirectory

### Changed
- Reorganized package structure to match Maho/Magento layout conventions

## [1.19.9] - 2025-01-15

### Fixed
- **CRITICAL**: Removed calls to non-existent `closeConnection()` method
- Fixed fatal error during queue processing and reindexing
- Fixes: Call to undefined method Maho\Db\Adapter\Pdo\Mysql::closeConnection()
- Removed closeConnection() calls at lines 122 and 268 in Queue.php

### Changed
- Database connections now managed automatically by Maho
- No manual connection closing required after transactions

## [1.19.8] - 2025-01-15

### Removed
- Removed admin menu icon CSS styling
- Removed meilisearch-admin-menu class from system configuration
- Removed background SVG icons from notification and head icon styles
- Cleaned up label to just "Meilisearch Search" without version number

### Changed
- Simplified admin menu appearance to use default Maho styling

## [1.19.7] - 2025-01-15

### Fixed
- **CRITICAL**: Fixed type error in `updateSynonyms()` method
- Changed return type from `stdClass` to `array` when synonyms are empty
- Fixes: TypeError: updateSynonyms(): Argument #1 ($synonyms) must be of type array, stdClass given
- Removed unnecessary `stdClass` object creation in `convertSynonyms()` method

## [1.19.6] - 2025-01-15

### Fixed
- **CRITICAL**: Removed hard dependency on `maho_pos` helper
- POS barcode functionality is now optional and won't crash if POS module isn't installed
- Wrapped all `Mage::helper('maho_pos')` calls in try-catch blocks with proper checks
- Fixed fatal error: "Call to a member function getBarcodeAttributeCode() on false"

### Changed
- POS barcode indexing now gracefully skips if POS module is not available
- Added method existence checks before calling POS helper methods

## [1.19.5] - 2025-01-15

### Fixed
- **CRITICAL**: Fixed autoloader to work correctly when installed via Composer
- Autoloader now checks if classes are already loaded before trying to require vendor/autoload.php
- Added multiple fallback methods for finding Composer autoloader
- Uses `Mage::getBaseDir()` when available for reliable path detection
- Fixes "Meilisearch PHP SDK not found" error when module is in vendor directory
- Added `modman` file for better compatibility with maho-composer-plugin

### Added
- Proper modman file for traditional Maho/OpenMage package structure
- Improved autoloader with better Composer package support

## [1.19.4] - 2025-01-15

### Fixed
- Changed Maho version constraint to `*` to support all installation types
- Fixes "root package cannot be modified" error when Maho is the root package
- Works with tagged releases, dev-main, and any custom Maho installations
- Previous attempts with specific version constraints failed due to Composer root package limitations

## [1.19.3] - 2025-01-15

### Fixed
- Attempted fix for dev-main installations (superseded by 1.19.4)

## [1.19.2] - 2025-01-15

### Added
- **nginx-meilisearch.conf**: Complete Nginx proxy configuration for Meilisearch
- **apache-meilisearch.conf**: Complete Apache proxy configuration for Meilisearch
- Web server configuration section in README with setup instructions

### Documentation
- Added step-by-step web server configuration to Quick Start guide
- Included security notes about API key handling
- Added examples for both Nginx and Apache setups

## [1.19.1] - 2025-01-15

### Fixed
- Added missing public assets (JavaScript internals, CSS, and SVG files)
- Added complete skin/frontend/base/default CSS and images
- Added skin/adminhtml CSS files
- Updated composer.json mappings for all asset directories

### Assets Added
**JavaScript**:
- `mustache.min.js` - Mustache template engine
- `jquery-test.js` and `jquery-capture.js` - jQuery compatibility helpers
- `internals/frontend/` - Frontend JavaScript bundles and utilities
- `internals/adminhtml/` - Admin panel JavaScript bundles

**CSS**:
- `skin/frontend/base/default/css/meilisearch/` - Autocomplete and main CSS
- `skin/frontend/base/default/meilisearch/` - Additional frontend CSS
- `skin/adminhtml/base/default/meilisearch/` - Admin panel CSS

**Images**:
- `meilisearch-admin-menu.svg` - Admin menu icon
- `stars-icon.svg` - Rating stars icon

## [1.19.0] - 2025-01-14

### Initial Release

This is the first packaged release of Maho Meilisearch, extracted and cleaned for distribution via Composer.

#### Features

**🚀 Lightning-Fast Search**
- Sub-50ms search responses for instant user experience
- Automatic typo tolerance and fuzzy matching
- Real-time indexing when products change

**🔍 Advanced Search Capabilities**
- As-you-type autocomplete for products, categories, and pages
- Faceted navigation with filtering by price, category, and attributes
- Configurable smart ranking and relevancy rules
- Multi-language support for international stores
- Synonym support for improved search relevance

**📊 Powerful Indexing**
- Product, category, and CMS page indexing
- Queue-based background processing for large catalogs (10,000+ products)
- Partial reindexing for faster updates
- Automatic reindexing when content changes

**⚙️ Flexible Configuration**
- Index prefixes for environment separation (dev/staging/prod)
- Custom ranking rules and searchable attributes
- Configurable faceting controls and stop words
- Index settings export/import for configuration sharing

#### Admin Interface
- **Indexing Queue Management**: View and monitor queued items
- **Reindex by SKU**: Manually reindex specific products
- **Index Management**: Control all Meilisearch indexes from System → Index Management
- **System Configuration**: Comprehensive settings in System → Configuration → Meilisearch

#### Frontend Integration
- **Autocomplete**: Dropdown with product suggestions, images, and prices
- **Instant Search**: Full-page search with real-time results
- **Faceted Navigation**: Filter and sort search results
- **Customizable Templates**: Override in your theme

#### Technical Details
- Built for Maho Commerce 25.x+
- Requires PHP 8.3+
- Meilisearch server 1.0+
- Encrypted API key storage
- Queue system for large catalogs
- Event-driven architecture
- Proper error handling and fallbacks

#### Security
- Encrypted API key storage in database
- Separate search-only API keys for frontend
- HTTPS support for production environments

#### Database Tables
- `meilisearch_queue`: Background indexing queue
- `meilisearch_queue_archive`: Archived queue items for history

### Configuration Options
- Server URL and API key configuration
- Search-only API key for frontend security
- Index prefix customization
- Autocomplete and instant search toggles
- Result count configuration
- Minimum character threshold
- Ranking rules customization
- Searchable attributes configuration
- Faceting attribute selection
- Connection timeout settings

### Installation Methods
- Composer installation (recommended): `composer require mageaus/meilisearch`
- Manual installation with file extraction
- Automatic cache flushing and autoload generation

### Documentation
- Comprehensive README with installation guide
- Configuration reference tables
- Troubleshooting section
- Advanced usage examples
- Performance optimization tips
- Security best practices

---

## Future Roadmap

Potential features for future releases:

- Multi-currency support in search results
- Advanced analytics and search insights
- A/B testing for ranking rules
- Machine learning-based relevancy tuning
- Category-specific ranking rules
- Geo-search capabilities
- Voice search integration
- Search query history and trending searches
