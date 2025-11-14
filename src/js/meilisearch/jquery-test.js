console.log('jQuery test - typeof jQuery:', typeof jQuery);
console.log('jQuery test - typeof window.jQuery:', typeof window.jQuery);
console.log('jQuery test - typeof $:', typeof $);
console.log('jQuery test - typeof window.$:', typeof window.$);

// Try to detect if jQuery.noConflict() was called
if (typeof jQuery !== 'undefined') {
    console.log('jQuery version:', jQuery.fn.jquery);
}