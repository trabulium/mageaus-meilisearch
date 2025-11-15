<?php
/**
 * Meilisearch Search extension
 *
 * NOTICE OF LICENSE
 *
 * This source file is subject to the Open Software License (OSL 3.0)
 * that is bundled with this package in the file LICENSE.txt.
 * It is also available through the world-wide-web at this URL:
 * http://opensource.org/licenses/osl-3.0.php
 *
 * @category   Meilisearch
 * @package    Meilisearch_Search
 * @copyright  Copyright (c) 2024 Meilisearch (https://www.meilisearch.com/)
 * @license    http://opensource.org/licenses/osl-3.0.php  Open Software License (OSL 3.0)
 */

// Check if Meilisearch SDK is already autoloaded (happens when installed via Composer)
if (class_exists('\Meilisearch\Client', false)) {
    // Already loaded, nothing to do
    return;
}

// Try to load Composer autoloader
// When installed via Composer, Maho's vendor/autoload.php is already loaded and handles everything
// This code is primarily for manual installations

// Method 1: Use Mage base directory (works for both Composer and manual installations in running Maho)
if (class_exists('Mage', false) && method_exists('Mage', 'getBaseDir')) {
    $vendorAutoload = Mage::getBaseDir() . '/vendor/autoload.php';
    if (file_exists($vendorAutoload)) {
        require_once $vendorAutoload;
        return;
    }
}

// Method 2: Relative path from module directory (for manual installation)
$vendorAutoload = dirname(dirname(dirname(dirname(dirname(dirname(__FILE__)))))) . '/vendor/autoload.php';
if (file_exists($vendorAutoload)) {
    require_once $vendorAutoload;
    return;
}

// Method 3: One more level up (alternative manual installation location)
$alternativeAutoload = dirname(dirname(dirname(dirname(dirname(dirname(dirname(__FILE__))))))) . '/vendor/autoload.php';
if (file_exists($alternativeAutoload)) {
    require_once $alternativeAutoload;
    return;
}

// Method 4: Try common Maho installation paths
$possiblePaths = [
    $_SERVER['DOCUMENT_ROOT'] . '/../vendor/autoload.php',
    $_SERVER['DOCUMENT_ROOT'] . '/vendor/autoload.php',
    '/var/www/html/vendor/autoload.php',
];

foreach ($possiblePaths as $path) {
    if (file_exists($path)) {
        require_once $path;
        return;
    }
}

// If we get here, autoloader not found
throw new Exception(
    'Meilisearch PHP SDK not found. ' .
    'Please install it using: composer require meilisearch/meilisearch-php php-http/guzzle7-adapter'
);
