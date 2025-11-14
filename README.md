# Maho Meilisearch

Ultra-fast, typo-tolerant search integration for Maho Commerce powered by Meilisearch - Deliver instant search results with autocomplete, faceted navigation, and intelligent ranking.

## Features

### 🚀 Lightning-Fast Search
- **Instant Results**: Sub-50ms search responses for blazing-fast user experience
- **Typo Tolerance**: Automatically handles typos and misspellings
- **Fuzzy Matching**: Finds results even with incomplete or incorrect queries
- **Real-time Indexing**: Updates search index automatically when products change

### 🔍 Advanced Search Capabilities
- **Autocomplete**: As-you-type suggestions for products, categories, and pages
- **Faceted Navigation**: Filter by price, category, attributes, and custom fields
- **Smart Ranking**: Configurable relevancy rules for optimal result ordering
- **Multi-Language Support**: Full support for multiple languages and locales
- **Synonym Support**: Define synonyms to improve search relevance

### 📊 Powerful Indexing
- **Product Indexing**: Index all product data including attributes, prices, and stock
- **Category Indexing**: Search through your category structure
- **CMS Page Indexing**: Find content pages in search results
- **Queue-Based Indexing**: Efficient background processing for large catalogs
- **Partial Reindexing**: Update only changed products for faster indexing

### ⚙️ Flexible Configuration
- **Index Prefixes**: Separate environments (dev, staging, prod) on same Meilisearch server
- **Custom Ranking Rules**: Define your own relevancy criteria
- **Searchable Attributes**: Choose which fields to search
- **Faceting Controls**: Configure which attributes are filterable
- **Stop Words**: Define words to exclude from search
- **Index Settings Export/Import**: Share configurations across instances

## Installation

### Prerequisites

1. **Install and run Meilisearch server**:
   ```bash
   # Using Docker (recommended)
   docker run -d -p 7700:7700 \
     -v $(pwd)/meili_data:/meili_data \
     getmeili/meilisearch:latest

   # Or download binary from https://www.meilisearch.com/
   ```

2. **Install PHP dependencies**:
   ```bash
   composer require meilisearch/meilisearch-php php-http/guzzle7-adapter guzzlehttp/guzzle
   ```

### Via Composer (Recommended)

```bash
composer require mageaus/meilisearch
composer dump-autoload
./maho cache:flush
```

### Manual Installation

1. Download the latest release
2. Extract to your Maho root directory
3. Run:
```bash
composer dump-autoload
./maho cache:flush
```

## Requirements

- Maho Commerce 25.x or higher
- PHP 8.3 or higher
- Meilisearch server 1.0 or higher
- MySQL/MariaDB

## Quick Start

### 1. Configure Meilisearch Connection

Navigate to **System → Configuration → Meilisearch → Credentials**:

- **Server URL**: `http://localhost:7700` (or your Meilisearch server URL)
- **API Key**: Your Meilisearch admin API key
- **Search-Only API Key**: Public API key for frontend searches
- **Index Prefix**: `maho_` (prefix for all index names)

### 2. Configure Search Settings

Navigate to **System → Configuration → Meilisearch → Settings**:

- **Enable Autocomplete**: Enable instant autocomplete dropdown
- **Enable Instant Search**: Enable instant search results page
- **Number of Products in Autocomplete**: 10 (default)
- **Number of Categories in Autocomplete**: 5 (default)
- **Number of Pages in Autocomplete**: 2 (default)

### 3. Index Your Catalog

Index your products, categories, and pages:

```bash
# Index all products
./maho index:reindex meilisearch_index

# Or use the admin interface
# Navigate to: System → Index Management
# Select "Meilisearch" indexes and click "Reindex"
```

### 4. Test Your Search

Visit your store and try searching - you should see instant autocomplete results!

## Configuration

### Credentials Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Server URL | Meilisearch server endpoint | `http://localhost:7700` |
| API Key | Admin API key (encrypted in DB) | - |
| Search-Only API Key | Public API key for frontend | - |
| Index Prefix | Prefix for index names | `maho_` |
| Connection Timeout | HTTP timeout in seconds | 5 |

### Search Behavior

| Setting | Description | Default |
|---------|-------------|---------|
| Enable Autocomplete | Show autocomplete dropdown | Yes |
| Enable Instant Search | Enable instant search results | Yes |
| Products in Autocomplete | Number of product suggestions | 10 |
| Categories in Autocomplete | Number of category suggestions | 5 |
| Pages in Autocomplete | Number of page suggestions | 2 |
| Minimum Characters | Min chars to trigger autocomplete | 3 |

### Ranking Rules

Define the order of ranking criteria (one per line):

```
words
typo
proximity
attribute
sort
exactness
```

Learn more: [Meilisearch Ranking Rules](https://docs.meilisearch.com/learn/core_concepts/relevancy.html#ranking-rules)

### Searchable Attributes

Define which product attributes are searchable (in order of priority):

```
name
sku
description
short_description
categories
```

### Faceting

Configure which attributes can be used as filters:

```
price
categories
color
size
manufacturer
```

## Indexing

### Automatic Indexing

The extension automatically reindexes when:
- Products are created, updated, or deleted
- Categories are modified
- CMS pages are changed
- Attributes values are updated

### Manual Indexing

**Via Command Line**:
```bash
# Reindex all Meilisearch indexes
./maho index:reindex meilisearch_index

# Reindex specific index
./maho index:reindex meilisearch_products
./maho index:reindex meilisearch_categories
./maho index:reindex meilisearch_pages
```

**Via Admin Panel**:
1. Navigate to **System → Index Management**
2. Select Meilisearch indexes
3. Click **"Reindex"**

### Queue Management

For large catalogs, indexing uses a queue system:

**View Queue Status**:
- Navigate to **Meilisearch → Indexing Queue**
- View pending items and processing status

**Reindex Specific SKUs**:
- Navigate to **Meilisearch → Reindex by SKU**
- Enter SKUs (one per line) to reindex specific products

### Index Naming Convention

Indexes are named using the pattern: `{prefix}{store_code}_{type}`

Examples:
- `maho_default_products`
- `maho_default_categories`
- `maho_default_pages`
- `maho_french_products`

## Frontend Integration

### Autocomplete

The extension provides autocomplete dropdown with:
- Product suggestions with images and prices
- Category suggestions
- CMS page suggestions
- Query suggestions

**Customization**:
- Templates: `app/design/frontend/base/default/template/meilisearch/autocomplete/`
- JavaScript: `js/meilisearch/autocomplete.js`

### Instant Search

Full-page instant search with:
- Real-time results as you type
- Faceted navigation
- Sorting options
- Pagination

**Customization**:
- Templates: `app/design/frontend/base/default/template/meilisearch/instantsearch/`
- JavaScript: `js/meilisearch/instantsearch.js`

## Admin Interface

### Indexing Queue

**Meilisearch → Indexing Queue**

- View queued items waiting to be indexed
- Monitor processing status
- Clear queue if needed

### Reindex by SKU

**Meilisearch → Reindex by SKU**

- Enter specific SKUs to reindex
- Useful for troubleshooting or partial updates
- Processes immediately without queue

### Index Management

**System → Index Management**

Available indexes:
- **Meilisearch Products**: Main product catalog
- **Meilisearch Categories**: Category structure
- **Meilisearch Pages**: CMS pages
- **Meilisearch Suggestions**: Query suggestions
- **Meilisearch Queue Runner**: Background queue processor

## Troubleshooting

### Search Not Working

1. **Check Meilisearch server is running**:
   ```bash
   curl http://localhost:7700/health
   ```

2. **Verify API keys are correct**:
   - System → Configuration → Meilisearch → Credentials
   - Test connection status

3. **Check indexes exist**:
   ```bash
   curl http://localhost:7700/indexes \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

4. **Reindex all data**:
   ```bash
   ./maho index:reindex meilisearch_index
   ```

### Autocomplete Not Showing

1. Enable autocomplete in configuration
2. Clear cache: `./maho cache:flush`
3. Check browser console for JavaScript errors
4. Verify search input has class `algolia-search-input`

### Slow Indexing

1. **Increase queue batch size**:
   - System → Configuration → Meilisearch → Queue
   - Increase "Items per Batch"

2. **Run queue manually**:
   ```bash
   ./maho index:reindex meilisearch_queue_runner
   ```

3. **Check Meilisearch server resources**:
   - Ensure adequate RAM (recommended: 2GB+)
   - Check CPU usage

### Index Out of Sync

1. **Clear and reindex**:
   ```bash
   # Delete all indexes
   curl -X DELETE http://localhost:7700/indexes/maho_default_products \
     -H "Authorization: Bearer YOUR_API_KEY"

   # Reindex
   ./maho index:reindex meilisearch_products
   ```

2. **Check queue for errors**:
   - Meilisearch → Indexing Queue
   - Look for failed items

## Advanced Usage

### Custom Ranking Rules

Add business logic to ranking:

```
words
typo
proximity
attribute
sort:desc(created_at)      # Newest products first
sort:asc(price)            # Cheapest first
sort:desc(sales_count)     # Best sellers first
exactness
```

### Synonyms

Define synonyms to improve search:

```
# In Meilisearch admin
PUT /indexes/maho_default_products/settings/synonyms
{
  "tv": ["television", "telly"],
  "phone": ["smartphone", "mobile"],
  "sneakers": ["trainers", "runners"]
}
```

### Stop Words

Exclude common words from search:

```
# In Meilisearch admin
PUT /indexes/maho_default_products/settings/stop-words
["the", "a", "an", "and", "or", "but"]
```

### Filtering

Configure filterable attributes:

```
# System → Configuration → Meilisearch → Faceting
price
categories
color
size
manufacturer
in_stock
```

## Performance Tips

1. **Use Index Prefixes**: Separate dev/staging/prod on same server
2. **Optimize Searchable Attributes**: Only index what you need to search
3. **Limit Facets**: Too many facets can slow down results
4. **Use Queue System**: For catalogs > 10,000 products
5. **Monitor Server Resources**: Ensure Meilisearch has adequate RAM

## Security

- **API Keys**: Use encrypted API keys (stored encrypted in database)
- **Search-Only Keys**: Use separate read-only key for frontend
- **Rate Limiting**: Configure in Meilisearch server settings
- **HTTPS**: Always use HTTPS in production

## Database Tables

The module creates these tables:

- `meilisearch_queue`: Indexing queue for background processing
- `meilisearch_queue_archive`: Archived queue items

## Development

### File Structure

```
app/code/community/Meilisearch/Search/
├── Block/                    # Admin blocks and system config
├── controllers/              # Frontend and admin controllers
├── etc/
│   ├── config.xml           # Module configuration
│   ├── system.xml           # Admin system config
│   └── adminhtml.xml        # ACL and admin menu
├── Helper/
│   ├── Config.php           # Configuration helper
│   ├── Data.php             # General helper
│   └── Entity/              # Entity-specific helpers
├── Model/
│   ├── Indexer/             # Indexing logic
│   ├── Queue/               # Queue management
│   └── Source/              # Config source models
└── sql/
    └── meilisearch_setup/   # Database setup scripts

app/design/frontend/base/default/
├── layout/meilisearch.xml    # Layout configuration
└── template/meilisearch/     # Frontend templates

js/meilisearch/               # JavaScript files
├── autocomplete.js           # Autocomplete functionality
└── instantsearch.js          # Instant search functionality
```

### Events

The module observes these events:

- `catalog_product_save_after`: Index updated products
- `catalog_product_delete_after`: Remove from index
- `catalog_category_save_after`: Index updated categories
- `cms_page_save_after`: Index updated pages

## Support

For issues, feature requests, or questions:

- **GitHub Issues**: https://github.com/mageaus/meilisearch/issues
- **Email**: support@mageaus.com
- **Meilisearch Docs**: https://docs.meilisearch.com

## License

Open Software License v. 3.0 (OSL-3.0)

## Credits

Developed for the Maho Commerce ecosystem.
Based on the official Meilisearch search engine.

## Changelog

### Version 1.19.0

**Current Release**

- ✅ Real-time product indexing
- ✅ Autocomplete with products, categories, and pages
- ✅ Instant search results page
- ✅ Faceted navigation
- ✅ Queue-based indexing for large catalogs
- ✅ Configurable ranking rules
- ✅ Typo tolerance and fuzzy matching
- ✅ Multi-language support
- ✅ Admin queue management interface
- ✅ Reindex by SKU functionality
- ✅ Comprehensive configuration options
- ✅ Encrypted API key storage
- ✅ Index prefix support for multi-environment setups
