<?php

// Include Meilisearch autoloader for OpenMage
require_once dirname(dirname(__FILE__)) . '/Model/Autoloader.php';

class Meilisearch_Search_Helper_Meilisearchhelper extends Mage_Core_Helper_Abstract
{
    /** @var \Meilisearch\Client */
    protected $client;

    /** @var Meilisearch_Search_Helper_Config */
    protected $config;

    /** @var int */
    protected $maxRecordSize;

    /** @var array */
    protected $potentiallyLongAttributes = array('description', 'short_description', 'meta_description', 'content');

    /** @var string */
    private $lastUsedIndexName;

    /** @var int */
    private $lastTaskId;

    public function __construct()
    {
        $this->config = Mage::helper('meilisearch_search/config');
        $this->resetCredentialsFromConfig();
    }

    public function resetCredentialsFromConfig()
    {
        $serverUrl = trim($this->config->getServerUrl());
        $apiKey = trim($this->config->getAPIKey());
        
        if ($serverUrl && $apiKey) {
            try {
                $this->client = new \Meilisearch\Client($serverUrl, $apiKey);
                // Don't test connection immediately - it may fail during indexer enumeration
            } catch (\Exception $e) {
                Mage::log('Meilisearch client creation error: ' . $e->getMessage(), null, 'meilisearch_error.log');
                $this->client = null;
            }
        }
    }

    public function getClient()
    {
        return $this->client;
    }

    public function generateSearchSecuredApiKey($key, $params = array())
    {
        // Meilisearch doesn't have the same secured API key concept
        // We'll return the regular search key for now
        return $this->config->getSearchOnlyAPIKey() ?: $key;
    }

    public function getIndex($name)
    {
        // Create index if it doesn't exist
        try {
            $this->client->getIndex($name);
        } catch (\Exception $e) {
            $this->client->createIndex($name, ['primaryKey' => 'objectID']);
        }
        
        return $this->client->index($name);
    }

    public function listIndexes()
    {
        $indexes = $this->client->getIndexes();
        $result = ['items' => []];
        
        foreach ($indexes as $index) {
            $result['items'][] = [
                'name' => $index->getUid(),
                'entries' => $index->getNumberOfDocuments(),
                'dataSize' => 0, // Meilisearch doesn't provide this directly
                'fileSize' => 0,
                'lastBuildTimeS' => 0,
                'numberOfPendingTasks' => 0,
                'pendingTask' => false,
            ];
        }
        
        return $result;
    }

    public function query($indexName, $q, $params)
    {
        $index = $this->client->index($indexName);
        
        // Convert Algolia params to Meilisearch params
        $meilisearchParams = $this->convertSearchParams($params);
        
        // Store the index name for use in convertSearchParams
        $this->lastUsedIndexName = $indexName;
        
        $searchResult = $index->search($q, $meilisearchParams);
        
        // Convert Meilisearch SearchResult object to Algolia-compatible array format
        return [
            'hits' => $searchResult->getHits(),
            'nbHits' => $searchResult->getEstimatedTotalHits(),
            'page' => $searchResult->getPage() ?? 0,
            'nbPages' => ceil($searchResult->getEstimatedTotalHits() / ($meilisearchParams['limit'] ?? 20)),
            'hitsPerPage' => $meilisearchParams['limit'] ?? 20,
            'processingTimeMS' => $searchResult->getProcessingTimeMs(),
            'query' => $searchResult->getQuery(),
            'params' => http_build_query($params),
        ];
    }

    public function getObjects($indexName, $objectIds)
    {
        $index = $this->client->index($indexName);
        
        // Meilisearch getDocuments() expects a DocumentsQuery object or null
        $results = [];
        foreach ($objectIds as $objectId) {
            try {
                $doc = $index->getDocument($objectId);
                $results[] = $doc;
            } catch (\Exception $e) {
                // Document not found, skip
            }
        }
        
        return ['results' => $results];
    }

    public function setSettings($indexName, $settings, $forwardToReplicas = false)
    {
        // Create index if it doesn't exist
        try {
            $this->client->getIndex($indexName);
        } catch (\Exception $e) {
            $this->client->createIndex($indexName, ['primaryKey' => 'objectID']);
        }
        
        $index = $this->client->index($indexName);
        
        // Convert Algolia settings to Meilisearch settings
        $meilisearchSettings = $this->convertIndexSettings($settings);
        
        // Debug logging
        Mage::log('Meilisearch settings for ' . $indexName . ': ' . json_encode($meilisearchSettings), null, 'meilisearch_debug.log');
        
        // Additional check for empty arrays that should be objects
        foreach ($meilisearchSettings as $key => &$value) {
            if (is_array($value) && empty($value) && in_array($key, ['synonyms', 'stopWords'])) {
                $value = new \stdClass();
            }
        }
        
        // If settings is empty array, don't update
        if (empty($meilisearchSettings)) {
            return ['taskID' => 0];
        }
        
        $res = $index->updateSettings($meilisearchSettings);
        
        $this->lastUsedIndexName = $indexName;
        $this->lastTaskId = $res['taskUid'];
        
        return ['taskID' => $res['taskUid']];
    }

    public function clearIndex($indexName)
    {
        $index = $this->client->index($indexName);
        $res = $index->deleteAllDocuments();
        
        $this->lastUsedIndexName = $indexName;
        $this->lastTaskId = $res['taskUid'];
        
        return ['taskID' => $res['taskUid']];
    }

    public function deleteIndex($indexName)
    {
        $res = $this->client->deleteIndex($indexName);
        
        $this->lastUsedIndexName = $indexName;
        $this->lastTaskId = $res['taskUid'];
        
        return ['taskID' => $res['taskUid']];
    }

    public function deleteObjects($ids, $indexName)
    {
        $index = $this->client->index($indexName);
        $res = $index->deleteDocuments($ids);
        
        $this->lastUsedIndexName = $indexName;
        $this->lastTaskId = $res['taskUid'];
        
        return ['taskID' => $res['taskUid']];
    }

    public function deleteObject($indexName, $objectId)
    {
        return $this->deleteObjects([$objectId], $indexName);
    }

    public function moveIndex($tmpIndexName, $indexName)
    {
        // Meilisearch doesn't have a direct moveIndex method
        // We'll use a different approach: delete old index and rename
        
        try {
            // Delete the target index if it exists
            $res = $this->client->deleteIndex($indexName);
            // Wait for deletion to complete
            $this->client->waitForTask($res['taskUid']);
        } catch (\Exception $e) {
            // Index might not exist, continue
        }
        
        // Now we need to recreate the index with data from tmp index
        // Since Meilisearch doesn't support renaming, we'll copy data
        try {
            // Get all documents from tmp index
            $tmpIndex = $this->client->index($tmpIndexName);
            
            // Create new index with the target name
            $this->client->createIndex($indexName, ['primaryKey' => 'objectID']);
            $targetIndex = $this->client->index($indexName);
            
            // Copy settings
            $settings = $tmpIndex->getSettings();
            if (!empty($settings)) {
                $targetIndex->updateSettings($settings);
            }
            
            // Copy all documents in batches
            $offset = 0;
            $limit = 1000; // Get 1000 documents at a time
            
            do {
                // Create DocumentsQuery object for the new API
                $query = new \Meilisearch\Contracts\DocumentsQuery();
                $query->setOffset($offset);
                $query->setLimit($limit);
                
                $documents = $tmpIndex->getDocuments($query);
                $results = $documents->getResults();
                
                if (!empty($results)) {
                    $targetIndex->addDocuments($results);
                    $offset += count($results);
                }
            } while (count($results) == $limit); // Continue if we got a full batch
            
            // Delete tmp index
            $res = $this->client->deleteIndex($tmpIndexName);
            
            return ['taskID' => $res['taskUid']];
        } catch (\Exception $e) {
            // If something went wrong, still try to delete tmp index
            try {
                $res = $this->client->deleteIndex($tmpIndexName);
                return ['taskID' => $res['taskUid']];
            } catch (\Exception $e2) {
                return ['taskID' => 0];
            }
        }
    }

    public function mergeSettings($indexName, $settings)
    {
        $onlineSettings = [];
        
        try {
            $index = $this->client->index($indexName);
            $onlineSettings = $index->getSettings();
        } catch (\Exception $e) {
            // Index might not exist yet
        }

        $settings = $this->castSettings($settings);
        
        foreach ($settings as $key => $value) {
            $onlineSettings[$key] = $value;
        }

        return $onlineSettings;
    }

    public function addObjects($objects, $indexName)
    {
        // Create index if it doesn't exist
        try {
            $this->client->getIndex($indexName);
        } catch (\Exception $e) {
            $this->client->createIndex($indexName, ['primaryKey' => 'objectID']);
        }
        
        $index = $this->client->index($indexName);
        
        // Debug log the first object to check structure
        if (!empty($objects) && isset($objects[0])) {
            Mage::log('First document being indexed: ' . json_encode($objects[0]), null, 'meilisearch_debug.log');
        }
        
        // Meilisearch needs to know the primary key is 'objectID'
        $res = $index->addDocuments($objects, 'objectID');
        
        $this->lastUsedIndexName = $indexName;
        $this->lastTaskId = $res['taskUid'];
        
        return ['taskID' => $res['taskUid']];
    }

    public function saveObjects($objects, $indexName)
    {
        return $this->addObjects($objects, $indexName);
    }

    public function waitLastTask()
    {
        if (!isset($this->lastUsedIndexName) || !isset($this->lastTaskId)) {
            return;
        }

        $this->client->waitForTask($this->lastTaskId);
    }

    public function setExtraHeader($key, $value)
    {
        // Meilisearch client doesn't support extra headers the same way
        // This is mostly used for analytics in Algolia
    }

    public function getIndexSettings($indexName)
    {
        $index = $this->client->index($indexName);
        return $index->getSettings();
    }

    public function copySynonyms($fromIndexName, $toIndexName)
    {
        $fromIndex = $this->client->index($fromIndexName);
        $toIndex = $this->client->index($toIndexName);
        
        $synonyms = $fromIndex->getSynonyms();
        if (!empty($synonyms)) {
            $toIndex->updateSynonyms($synonyms);
        }
    }

    public function copyRules($fromIndexName, $toIndexName)
    {
        // Meilisearch doesn't have query rules like Algolia
        // We might implement this differently based on requirements
    }

    public function setQueryRules($rules, $indexName)
    {
        // Meilisearch doesn't have query rules like Algolia
        // We might implement this differently based on requirements
    }

    /**
     * Convert Algolia search params to Meilisearch format
     */
    protected function convertSearchParams($params)
    {
        $meilisearchParams = [];
        
        if (isset($params['hitsPerPage'])) {
            $meilisearchParams['limit'] = $params['hitsPerPage'];
        }
        
        if (isset($params['page'])) {
            $meilisearchParams['offset'] = $params['page'] * ($params['hitsPerPage'] ?? 20);
        }
        
        if (isset($params['filters'])) {
            $meilisearchParams['filter'] = $this->convertFilters($params['filters']);
        }
        
        if (isset($params['facetFilters'])) {
            $meilisearchParams['filter'] = $this->convertFacetFilters($params['facetFilters']);
        }
        
        if (isset($params['numericFilters'])) {
            // Convert numeric filters to Meilisearch format
            $numericFilter = $this->convertNumericFilters($params['numericFilters']);
            if (isset($meilisearchParams['filter'])) {
                $meilisearchParams['filter'] .= ' AND ' . $numericFilter;
            } else {
                $meilisearchParams['filter'] = $numericFilter;
            }
        }
        
        if (isset($params['attributesToRetrieve'])) {
            // Ensure it's always an array
            if (is_string($params['attributesToRetrieve'])) {
                $meilisearchParams['attributesToRetrieve'] = [$params['attributesToRetrieve']];
            } else {
                $meilisearchParams['attributesToRetrieve'] = $params['attributesToRetrieve'];
            }
        }
        
        if (isset($params['attributesToHighlight']) && !empty($params['attributesToHighlight'])) {
            // Ensure it's always an array
            if (is_string($params['attributesToHighlight'])) {
                $meilisearchParams['attributesToHighlight'] = [$params['attributesToHighlight']];
            } else {
                $meilisearchParams['attributesToHighlight'] = $params['attributesToHighlight'];
            }
        }
        
        // Handle facets
        if (isset($params['facets']) && $params['facets'] === '*') {
            // Get all filterable attributes from settings
            try {
                $settings = $this->client->index($this->lastUsedIndexName)->getSettings();
                if (isset($settings['filterableAttributes'])) {
                    $meilisearchParams['facets'] = $settings['filterableAttributes'];
                }
            } catch (\Exception $e) {
                // Default to empty if we can't get settings
                $meilisearchParams['facets'] = [];
            }
        } elseif (isset($params['facets'])) {
            $meilisearchParams['facets'] = is_array($params['facets']) ? $params['facets'] : [$params['facets']];
        }
        
        // Handle sort
        if (isset($params['sort'])) {
            $meilisearchParams['sort'] = is_array($params['sort']) ? $params['sort'] : [$params['sort']];
        }
        
        // Handle attributesToRetrieve
        if (isset($params['attributesToRetrieve'])) {
            if (is_string($params['attributesToRetrieve']) && $params['attributesToRetrieve'] !== '') {
                $meilisearchParams['attributesToRetrieve'] = [$params['attributesToRetrieve']];
            } elseif (is_array($params['attributesToRetrieve'])) {
                $meilisearchParams['attributesToRetrieve'] = $params['attributesToRetrieve'];
            }
        }
        
        return $meilisearchParams;
    }

    /**
     * Convert Algolia numeric filters to Meilisearch format
     */
    protected function convertNumericFilters($numericFilters)
    {
        if (is_string($numericFilters)) {
            // Simple string like "visibility_search=1"
            return $numericFilters;
        }
        
        if (is_array($numericFilters)) {
            // Array of numeric filters
            return implode(' AND ', $numericFilters);
        }
        
        return '';
    }

    /**
     * Convert Algolia index settings to Meilisearch format
     */
    protected function convertIndexSettings($settings)
    {
        $meilisearchSettings = [];
        
        if (isset($settings['searchableAttributes'])) {
            // Remove "unordered()" prefix as Meilisearch doesn't support it
            $meilisearchSettings['searchableAttributes'] = array_map(function($attr) {
                return preg_replace('/^unordered\((.*)\)$/', '$1', $attr);
            }, $settings['searchableAttributes']);
        }
        
        if (isset($settings['attributesForFaceting'])) {
            $meilisearchSettings['filterableAttributes'] = array_map(function($attr) {
                return str_replace('searchable(', '', str_replace(')', '', $attr));
            }, $settings['attributesForFaceting']);
        }
        
        if (isset($settings['customRanking'])) {
            // Extract attributes for sortableAttributes
            $meilisearchSettings['sortableAttributes'] = array_map(function($attr) {
                return str_replace(['asc(', 'desc(', ')'], '', $attr);
            }, $settings['customRanking']);
            
            // Build custom ranking rules for Meilisearch
            $customRankingRules = array();
            foreach ($settings['customRanking'] as $ranking) {
                // Convert desc(ordered_qty) to ordered_qty:desc
                if (preg_match('/^(asc|desc)\(([^)]+)\)$/', $ranking, $matches)) {
                    $customRankingRules[] = $matches[2] . ':' . $matches[1];
                }
            }
            
            // Set Meilisearch ranking rules with custom attributes at the end
            $meilisearchSettings['rankingRules'] = array(
                'words',
                'typo',
                'proximity',
                'attribute',
                'sort',
                'exactness'
            );
            
            // Add custom ranking rules after the default rules
            foreach ($customRankingRules as $rule) {
                $meilisearchSettings['rankingRules'][] = $rule;
            }
        }
        
        // Handle rankingRules if directly provided (from Magento settings)
        if (isset($settings['rankingRules'])) {
            // Convert Algolia-style ranking rules to Meilisearch format
            $convertedRules = array();
            $sortableAttrs = array();
            
            foreach ($settings['rankingRules'] as $rule) {
                // Check if it's a custom ranking rule in Algolia format: desc(attribute) or asc(attribute)
                if (preg_match('/^(asc|desc)\(([^)]+)\)$/', $rule, $matches)) {
                    // Convert to Meilisearch format: attribute:desc or attribute:asc
                    $convertedRules[] = $matches[2] . ':' . $matches[1];
                    $sortableAttrs[] = $matches[2];
                } else {
                    // Keep standard rules as-is (words, typo, proximity, etc.)
                    $convertedRules[] = $rule;
                }
            }
            
            $meilisearchSettings['rankingRules'] = $convertedRules;
            
            if (!empty($sortableAttrs)) {
                if (!isset($meilisearchSettings['sortableAttributes'])) {
                    $meilisearchSettings['sortableAttributes'] = array();
                }
                $meilisearchSettings['sortableAttributes'] = array_unique(array_merge(
                    $meilisearchSettings['sortableAttributes'],
                    $sortableAttrs
                ));
            }
        }
        
        if (isset($settings['attributesToRetrieve'])) {
            $meilisearchSettings['displayedAttributes'] = $settings['attributesToRetrieve'];
        }
        
        if (isset($settings['displayedAttributes'])) {
            $meilisearchSettings['displayedAttributes'] = $settings['displayedAttributes'];
        }
        
        if (isset($settings['synonyms'])) {
            $meilisearchSettings['synonyms'] = $this->convertSynonyms($settings['synonyms']);
        }
        
        // Remove Algolia-specific settings that Meilisearch doesn't support
        unset($meilisearchSettings['replicas']);
        
        return $meilisearchSettings;
    }

    /**
     * Convert Algolia filters to Meilisearch format
     */
    protected function convertFilters($filters)
    {
        // This is a simplified conversion - may need to be enhanced based on actual usage
        return $filters;
    }

    /**
     * Convert Algolia facet filters to Meilisearch format
     */
    protected function convertFacetFilters($facetFilters)
    {
        $filters = [];
        
        foreach ($facetFilters as $filter) {
            if (is_array($filter)) {
                // OR condition
                $orFilters = [];
                foreach ($filter as $f) {
                    $orFilters[] = $this->parseFacetFilter($f);
                }
                $filters[] = '(' . implode(' OR ', $orFilters) . ')';
            } else {
                // Single filter
                $filters[] = $this->parseFacetFilter($filter);
            }
        }
        
        return implode(' AND ', $filters);
    }

    /**
     * Parse a single facet filter
     */
    protected function parseFacetFilter($filter)
    {
        if (strpos($filter, ':') !== false) {
            list($attribute, $value) = explode(':', $filter, 2);
            
            // Handle negative filters
            if (strpos($attribute, '-') === 0) {
                $attribute = substr($attribute, 1);
                return $attribute . ' != "' . $value . '"';
            }
            
            return $attribute . ' = "' . $value . '"';
        }
        
        return $filter;
    }

    /**
     * Set synonyms for an index
     */
    public function setSynonyms($indexName, $synonyms)
    {
        $index = $this->getIndex($indexName);
        
        if (!$index) {
            throw new Exception('Index not found: ' . $indexName);
        }
        
        // Convert synonyms to Meilisearch format
        $meilisearchSynonyms = $this->convertSynonyms($synonyms);
        
        // Update synonyms in index settings
        try {
            $index->updateSynonyms($meilisearchSynonyms);
        } catch (Exception $e) {
            Mage::logException($e);
            throw new Exception('Failed to update synonyms: ' . $e->getMessage());
        }
    }
    
    /**
     * Convert Algolia synonyms to Meilisearch format
     */
    protected function convertSynonyms($synonyms)
    {
        if (empty($synonyms)) {
            return []; // Return empty array for Meilisearch
        }

        $meilisearchSynonyms = [];

        foreach ($synonyms as $synonym) {
            if (isset($synonym['type']) && $synonym['type'] === 'oneWaySynonym') {
                $meilisearchSynonyms[$synonym['input']] = $synonym['synonyms'];
            } else {
                // Multi-way synonym
                $words = $synonym['synonyms'] ?? [];
                foreach ($words as $word) {
                    $others = array_filter($words, function($w) use ($word) {
                        return $w !== $word;
                    });
                    if (!empty($others)) {
                        $meilisearchSynonyms[$word] = array_values($others);
                    }
                }
            }
        }

        return $meilisearchSynonyms;
    }

    /**
     * Cast settings to proper types
     */
    protected function castSettings($settings)
    {
        if (isset($settings['hitsPerPage'])) {
            $settings['hitsPerPage'] = (int) $settings['hitsPerPage'];
        }

        if (isset($settings['maxValuesPerFacet'])) {
            $settings['maxValuesPerFacet'] = (int) $settings['maxValuesPerFacet'];
        }

        // Ensure synonyms is an object if empty
        if (isset($settings['synonyms']) && is_array($settings['synonyms']) && empty($settings['synonyms'])) {
            $settings['synonyms'] = new \stdClass();
        }

        return $settings;
    }
}