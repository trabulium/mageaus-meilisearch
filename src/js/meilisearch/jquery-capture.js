/**
 * Capture jQuery reference before noConflict removes it
 * This must be loaded immediately after jQuery
 */
window.meilisearchjQuery = window.jQuery || window.$;