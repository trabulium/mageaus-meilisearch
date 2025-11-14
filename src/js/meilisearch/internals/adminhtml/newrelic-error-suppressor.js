/**
 * Suppress New Relic errors that don't affect functionality
 * This is a workaround for the known conflict between New Relic and Prototype.js
 */
(function() {
    var originalError = window.onerror;
    window.onerror = function(message, source, lineno, colno, error) {
        // Suppress New Relic related errors that involve _each or toArray
        if (source && source.indexOf('nr-spa') > -1 && 
            (message.indexOf('_each is not a function') > -1 || 
             message.indexOf('toArray is not a function') > -1)) {
            return true; // Prevent error from showing in console
        }
        
        // Call original error handler if it exists
        if (originalError) {
            return originalError.apply(this, arguments);
        }
        return false;
    };
    
    // Also suppress unhandled promise rejections from New Relic
    window.addEventListener('unhandledrejection', function(event) {
        if (event.reason && event.reason.stack && 
            event.reason.stack.indexOf('nr-spa') > -1) {
            event.preventDefault();
        }
    });
})();