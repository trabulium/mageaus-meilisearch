/**
 * Meilisearch Autocomplete Template Loader - Vanilla JavaScript
 * Loads Mustache-style templates from DOM and makes them available
 */

(function() {
    'use strict';

    let templates = {};

    /**
     * Simple Mustache-style template renderer
     * Supports {{variable}}, {{{unescaped}}}, {{#section}}...{{/section}}, {{^inverted}}...{{/inverted}}
     */
    function renderTemplate(template, data) {
        if (!template) return '';

        let result = template;

        // Handle sections {{#key}}...{{/key}}
        result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, function(match, key, content) {
            const value = data[key];
            if (!value) return '';
            if (Array.isArray(value)) {
                return value.map(item => renderTemplate(content, item)).join('');
            }
            return value ? renderTemplate(content, data) : '';
        });

        // Handle inverted sections {{^key}}...{{/key}}
        result = result.replace(/\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, function(match, key, content) {
            const value = data[key];
            return (!value || (Array.isArray(value) && value.length === 0)) ? content : '';
        });

        // Handle unescaped variables {{{key}}}
        result = result.replace(/\{\{\{(\w+(?:\.\w+)*)\}\}\}/g, function(match, key) {
            return getNestedValue(data, key) || '';
        });

        // Handle escaped variables {{key}}
        result = result.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, function(match, key) {
            const value = getNestedValue(data, key);
            return value ? escapeHtml(String(value)) : '';
        });

        return result;
    }

    /**
     * Get nested object value by dot notation (e.g., "user.name")
     */
    function getNestedValue(obj, path) {
        return path.split('.').reduce((current, prop) => current?.[prop], obj);
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Load template from DOM by ID
     */
    function loadTemplate(templateId) {
        const element = document.getElementById(templateId);
        return element ? element.innerHTML.trim() : null;
    }

    /**
     * Load all templates from the DOM
     */
    function loadAllTemplates() {
        templates.product = loadTemplate('meilisearch-autocomplete-product-template');
        templates.category = loadTemplate('meilisearch-autocomplete-category-template');
        templates.page = loadTemplate('meilisearch-autocomplete-page-template');
        templates.attribute = loadTemplate('meilisearch-autocomplete-attribute-template');
        templates.suggestion = loadTemplate('meilisearch-autocomplete-suggestion-template');
        templates.menu = loadTemplate('meilisearch-autocomplete-menu-template');

        console.log('Meilisearch: Loaded templates:', Object.keys(templates).filter(k => templates[k]));
    }

    /**
     * Render a template with data
     */
    function render(templateName, data) {
        const template = templates[templateName];
        if (!template) {
            console.warn(`Meilisearch: Template "${templateName}" not found`);
            return '';
        }
        return renderTemplate(template, data);
    }

    /**
     * Check if templates are ready
     */
    function checkReady() {
        // Check if config exists
        if (!window.meilisearchConfig || !window.meilisearchConfig.autocomplete || !window.meilisearchConfig.autocomplete.enabled) {
            return false;
        }
        return true;
    }

    /**
     * Wait for config and DOM to be ready
     */
    function waitForReady(callback) {
        if (checkReady() && document.readyState !== 'loading') {
            callback();
            return;
        }

        // Poll every 100ms for up to 5 seconds
        let attempts = 0;
        const maxAttempts = 50;

        const checkInterval = setInterval(function() {
            attempts++;

            if (checkReady() && document.readyState !== 'loading') {
                clearInterval(checkInterval);
                callback();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.log('Meilisearch templates: Config not found after 5 seconds (this is OK if using vanilla autocomplete)');
            }
        }, 100);
    }

    // Initialize when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            waitForReady(function() {
                loadAllTemplates();
            });
        });
    } else {
        waitForReady(function() {
            loadAllTemplates();
        });
    }

    // Export template functions to global scope
    window.meilisearchTemplates = {
        render: render,
        templates: templates,
        renderTemplate: renderTemplate
    };

})();
