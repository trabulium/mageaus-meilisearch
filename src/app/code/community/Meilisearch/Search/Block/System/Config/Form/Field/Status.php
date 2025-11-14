<?php
/**
 * MeiliSearch Configuration Status Display
 * 
 * @category    Meilisearch
 * @package     Meilisearch_Search
 * @copyright   Copyright (c) 2025 Maho (https://mahocommerce.com)
 */
class Meilisearch_Search_Block_System_Config_Form_Field_Status extends Mage_Adminhtml_Block_System_Config_Form_Field
{
    /**
     * Get element HTML with MeiliSearch status
     * 
     * @param Varien_Data_Form_Element_Abstract $element
     * @return string
     */
    protected function _getElementHtml(Varien_Data_Form_Element_Abstract $element)
    {
        $helper = Mage::helper('meilisearch_search/config');
        $html = '<div class="meilisearch-status" style="padding: 10px; border-radius: 5px; margin: 10px 0;">';
        
        try {
            // Check if MeiliSearch is enabled
            if (!$helper->isEnabledBackend()) {
                $html .= $this->_getStatusHtml('warning', '⚠️ Indexing is disabled', 'Enable indexing to sync your catalog with MeiliSearch');
            } elseif (!$helper->isEnabledFrontEnd()) {
                $html .= $this->_getStatusHtml('warning', '⚠️ Search is disabled', 'Enable search to use MeiliSearch on your storefront');
            } else {
                // Test connection
                $serverUrl = $helper->getServerUrl();
                $apiKey = $helper->getApiKey();
                
                if (empty($serverUrl) || empty($apiKey)) {
                    $html .= $this->_getStatusHtml('error', '❌ Configuration incomplete', 'Please provide server URL and API key');
                } else {
                    $meilisearchHelper = Mage::helper('meilisearch_search/meilisearchhelper');
                    $client = $meilisearchHelper->getClient();
                    
                    if (!$client) {
                        $html .= $this->_getStatusHtml('error', '❌ MeiliSearch client not initialized', 'Please check your server URL and API key configuration');
                    } else {
                        try {
                            // Get MeiliSearch stats
                            $stats = $client->stats();
                            
                            // Get indexes with proper API call
                            // The getIndexes() method returns an IndexesResults object
                            $indexesResponse = $client->getIndexes();
                            
                            // Convert to array format
                            $indexes = $indexesResponse->toArray();
                            
                            // Get index prefix
                            $indexPrefix = $helper->getIndexPrefix();
                    
                    $html .= $this->_getStatusHtml('success', '✅ Connected to MeiliSearch', '');
                    $html .= '<div style="margin-top: 10px; font-size: 13px;">';
                    $html .= '<strong>📊 Statistics:</strong><br/>';
                    
                    // Check if stats are available
                    if (isset($stats['databaseSize'])) {
                        $html .= '• Database size: ' . $this->_formatBytes($stats['databaseSize']) . '<br/>';
                    }
                    
                    if (!empty($indexPrefix)) {
                        $html .= '• Index prefix: <code>' . $this->escapeHtml($indexPrefix) . '</code><br/>';
                    }
                    
                    // Check if indexes are available
                    if (isset($indexes['results']) && is_array($indexes['results']) && count($indexes['results']) > 0) {
                        // Get total count
                        $totalIndexes = isset($indexes['total']) ? $indexes['total'] : count($indexes['results']);
                        $html .= '• Total indexes in MeiliSearch: ' . $totalIndexes . '<br/>';
                        
                        // Filter indexes by prefix
                        $prefixedIndexes = array();
                        
                        foreach ($indexes['results'] as $indexObject) {
                            try {
                                // Get index UID - the object should have getUid() method
                                $indexUid = $indexObject->getUid();
                                
                                if (empty($indexPrefix) || strpos($indexUid, $indexPrefix) === 0) {
                                    // Get stats for this index
                                    $indexStats = $indexObject->stats();
                                    
                                    $prefixedIndexes[] = array(
                                        'uid' => $indexUid,
                                        'numberOfDocuments' => isset($indexStats['numberOfDocuments']) ? $indexStats['numberOfDocuments'] : 0,
                                        'isIndexing' => isset($indexStats['isIndexing']) ? $indexStats['isIndexing'] : false
                                    );
                                }
                            } catch (Exception $e) {
                                // If we can't get stats, just add basic info
                                if (isset($indexUid) && (empty($indexPrefix) || strpos($indexUid, $indexPrefix) === 0)) {
                                    $prefixedIndexes[] = array(
                                        'uid' => $indexUid,
                                        'numberOfDocuments' => 'N/A',
                                        'isIndexing' => false
                                    );
                                }
                            }
                        }
                        
                        $html .= '• Indexes for this store: ' . count($prefixedIndexes) . '<br/>';
                        
                        // Show index details
                        if (!empty($prefixedIndexes)) {
                            $html .= '<br/><strong>📚 Store Indexes:</strong><br/>';
                            foreach ($prefixedIndexes as $index) {
                                // Extract index type from name
                                $indexType = '';
                                if (strpos($index['uid'], '_products') !== false) {
                                    $indexType = ' (Products)';
                                } elseif (strpos($index['uid'], '_categories') !== false) {
                                    $indexType = ' (Categories)';
                                } elseif (strpos($index['uid'], '_pages') !== false) {
                                    $indexType = ' (Pages)';
                                } elseif (strpos($index['uid'], '_suggestions') !== false) {
                                    $indexType = ' (Suggestions)';
                                }
                                
                                $docCount = is_numeric($index['numberOfDocuments']) ? number_format($index['numberOfDocuments']) : $index['numberOfDocuments'];
                                $indexingStatus = $index['isIndexing'] ? ' 🔄 (indexing)' : '';
                                
                                $html .= '• <code>' . $this->escapeHtml($index['uid']) . '</code>' . $indexType . ': ' . $docCount . ' documents' . $indexingStatus . '<br/>';
                            }
                        } else {
                            $html .= '<br/>⚠️ No indexes found with prefix "<code>' . $this->escapeHtml($indexPrefix) . '</code>"<br/>';
                            $html .= 'You may need to run the indexers to create the indexes.<br/>';
                        }
                    } else {
                        $html .= '• No indexes found in MeiliSearch<br/>';
                        $html .= 'You may need to run the indexers to create indexes.<br/>';
                    }
                            
                            $html .= '</div>';
                        } catch (Exception $e) {
                            $html .= $this->_getStatusHtml('error', '❌ Error getting MeiliSearch data', $e->getMessage());
                        }
                    }
                }
            }
        } catch (Exception $e) {
            $html .= $this->_getStatusHtml('error', '❌ Connection failed', $e->getMessage());
        }
        
        $html .= '</div>';
        
        // Add quick actions - DISABLED due to routing issues
        // $html .= $this->_getQuickActions();
        
        return $html;
    }
    
    /**
     * Get status HTML
     * 
     * @param string $type success|warning|error
     * @param string $title
     * @param string $message
     * @return string
     */
    protected function _getStatusHtml($type, $title, $message)
    {
        $colors = [
            'success' => '#d4edda',
            'warning' => '#fff3cd',
            'error' => '#f8d7da'
        ];
        
        $color = isset($colors[$type]) ? $colors[$type] : '#f8f9fa';
        
        $html = '<div style="background-color: ' . $color . '; padding: 10px; border-radius: 3px; margin-bottom: 5px;">';
        $html .= '<strong>' . $title . '</strong>';
        if ($message) {
            $html .= '<br/><span style="font-size: 12px;">' . $this->escapeHtml($message) . '</span>';
        }
        $html .= '</div>';
        
        return $html;
    }
    
    /**
     * Get quick actions HTML
     * 
     * @return string
     */
    protected function _getQuickActions()
    {
        $html = '<div style="margin-top: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 5px;">';
        $html .= '<strong>🚀 Quick Actions:</strong><br/>';
        $html .= '<div style="margin-top: 5px;">';
        
        // Reindex all button
        $reindexUrl = $this->getUrl('adminhtml/meilisearch_manage/reindexAll');
        $html .= '<button type="button" class="scalable" onclick="if(confirm(\'This will reindex all MeiliSearch indexes. Continue?\')) {setLocation(\'' . $reindexUrl . '\')}" style="margin-right: 5px;">';
        $html .= '<span>Reindex All</span></button>';
        
        // View queue button
        $queueUrl = $this->getUrl('adminhtml/meilisearch_queue/index');
        $html .= '<button type="button" class="scalable" onclick="setLocation(\'' . $queueUrl . '\')" style="margin-right: 5px;">';
        $html .= '<span>View Queue</span></button>';
        
        // Clear indexes button
        $clearUrl = $this->getUrl('adminhtml/meilisearch_manage/clearIndexes');
        $html .= '<button type="button" class="scalable delete" onclick="if(confirm(\'This will clear all MeiliSearch indexes. Are you sure?\')) {setLocation(\'' . $clearUrl . '\')}">';
        $html .= '<span>Clear Indexes</span></button>';
        
        $html .= '</div></div>';
        
        return $html;
    }
    
    /**
     * Format bytes to human readable
     * 
     * @param int $bytes
     * @return string
     */
    protected function _formatBytes($bytes)
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        
        $bytes /= pow(1024, $pow);
        
        return round($bytes, 2) . ' ' . $units[$pow];
    }
}