<?php

/**
 * Meilisearch search observer model.
 */
class Meilisearch_Search_Model_Observer
{
    /** @var Meilisearch_Search_Helper_Config */
    protected $config;

    /** @var Meilisearch_Search_Helper_Entity_Producthelper */
    protected $product_helper;

    /** @var Meilisearch_Search_Helper_Entity_Categoryhelper **/
    protected $category_helper;

    /** @var Meilisearch_Search_Helper_Entity_Suggestionhelper */
    protected $suggestion_helper;

    /** @var Meilisearch_Search_Helper_Data */
    protected $helper;

    public function __construct()
    {
        $this->config = Mage::helper('meilisearch_search/config');
        $this->product_helper = Mage::helper('meilisearch_search/entity_producthelper');
        $this->category_helper = Mage::helper('meilisearch_search/entity_categoryhelper');
        $this->suggestion_helper = Mage::helper('meilisearch_search/entity_suggestionhelper');
        $this->helper = Mage::helper('meilisearch_search');
    }

    /**
     * On configuration save
     *
     * @param Varien_Event_Observer $observer
     */
    public function configSaved(Varien_Event_Observer $observer)
    {
        try {
            $this->saveSettings();
        } catch (\Exception $e) {
            // Let the exception propagate so the admin can see the error
            throw $e;
        }
    }

    public function saveSettings($isFullProductReindex = false)
    {
        if (is_object($isFullProductReindex) && get_class($isFullProductReindex) === 'Varien_Object') {
            $eventData = $isFullProductReindex->getData();
            $isFullProductReindex = $eventData['isFullProductReindex'];
        }

        foreach (Mage::app()->getStores() as $store) {/* @var $store Mage_Core_Model_Store */
            if ($store->getIsActive()) {
                $saveToTmpIndicesToo = ($isFullProductReindex && $this->config->isQueueActive($store->getId()));
                $this->helper->saveConfigurationToMeilisearch($store->getId(), $saveToTmpIndicesToo);
            }
        }
    }

    public function addBundleToAdmin(Varien_Event_Observer $observer)
    {
        $req = Mage::app()->getRequest();

        if (strpos($req->getPathInfo(), 'system_config/edit/section/meilisearch') !== false) {
            $observer->getData('layout')->getUpdate()->addHandle('meilisearch_bundle_handle');
        }
    }

    /**
     * Call meilisearch.xml to load JS / CSS / PHTMLs
     *
     * @param Varien_Event_Observer $observer
     * @return $this
     */
    public function useMeilisearchSearchPopup(Varien_Event_Observer $observer)
    {

        Mage::log('DEBUG: useMeilisearchSearchPopup called', Mage::LOG_DEBUG, 'meilisearch_debug.log');

        if (!$this->config->isEnabledFrontEnd()) {
            Mage::log('DEBUG: Frontend NOT enabled', Mage::LOG_DEBUG, 'meilisearch_debug.log');
            return $this;
        }

        Mage::log('DEBUG: Frontend IS enabled', Mage::LOG_DEBUG, 'meilisearch_debug.log');

        $storeId = Mage::app()->getStore()->getId();
        if (!$this->config->getServerUrl($storeId) || !$this->config->getAPIKey($storeId)) {
            Mage::log('DEBUG: Server URL or API Key missing', Mage::LOG_DEBUG, 'meilisearch_debug.log');
            return $this;
        }

        Mage::log('DEBUG: Server URL and API Key present', Mage::LOG_DEBUG, 'meilisearch_debug.log');

        $this->loadMeilisearchSearchHandle($observer);

        $this->loadSearchFormHandle($observer);

        $this->loadInstantSearchHandle($observer);

        $this->loadAutocompleteHandle($observer);

        $this->loadPreventBackendRenderingHandle($observer);

        $this->loadAnalyticsHandle($observer);

        return $this;
    }

    public function saveProduct(Varien_Event_Observer $observer)
    {
        if ($this->isIndexerInManualMode('meilisearch_search_indexer')) {
            return;
        }

        $product = $observer->getDataObject();
        $product = Mage::getModel('catalog/product')->load($product->getId());

        Meilisearch_Search_Model_Indexer_Meilisearch::$product_categories[$product->getId()] = $product->getCategoryIds();
    }

    /**
     * @event cms_page_save_commit_after
     * @param Varien_Event_Observer $observer
     */
    public function savePage(Varien_Event_Observer $observer)
    {
        if (!$this->config->getServerUrl()
            || !$this->config->getAPIKey()
            || $this->isIndexerInManualMode('meilisearch_search_indexer_pages')) {
            return;
        }

        /** @var Mage_Cms_Model_Page $page */
        $page = $observer->getEvent()->getDataObject();
        $storeIds = $page->getStores();

        /** @var Meilisearch_Search_Model_Resource_Engine $engine */
        $engine = Mage::getResourceModel('meilisearch_search/engine');

        foreach ($storeIds as $storeId) {
            if ($storeId == 0) {
                $storeId = null;
            }
            $engine->rebuildPages($storeId, array($page->getPageId()));
        }
    }

    public function deleteProductsStoreIndices(Varien_Object $event)
    {
        $storeId = $event->getStoreId();

        $this->helper->deleteProductsStoreIndices($storeId);
    }

    public function deleteCategoriesStoreIndices(Varien_Object $event)
    {
        $storeId = $event->getStoreId();

        $this->helper->deleteCategoriesStoreIndices($storeId);
    }

    public function removeCategories(Varien_Object $event)
    {
        $storeId = $event->getStoreId();
        $category_ids = $event->getCategoryIds();

        $this->helper->removeCategories($category_ids, $storeId);
    }

    public function rebuildAdditionalSectionsIndex(Varien_Object $event)
    {
        $storeId = $event->getStoreId();

        $this->helper->rebuildStoreAdditionalSectionsIndex($storeId);
    }

    public function rebuildPageIndex(Varien_Object $event)
    {
        $storeId = $event->getStoreId();
        $pageIds = $event->getPageIds();

        $this->helper->rebuildStorePageIndex($storeId, $pageIds);
    }

    public function rebuildSuggestionIndex(Varien_Object $event)
    {
        $storeId = $event->getStoreId();

        $page = $event->getPage();
        $pageSize = $event->getPageSize();

        if (is_null($storeId) && !empty($categoryIds)) {
            foreach (Mage::app()->getStores() as $storeId => $store) {
                if (!$store->getIsActive()) {
                    continue;
                }

                $this->helper->rebuildStoreSuggestionIndex($storeId);
            }
        } else {
            if (!empty($page) && !empty($pageSize)) {
                $this->helper->rebuildStoreSuggestionIndexPage($storeId,
                    $this->suggestion_helper->getSuggestionCollectionQuery($storeId), $page, $pageSize);
            } else {
                $this->helper->rebuildStoreSuggestionIndex($storeId);
            }
        }

        return $this;
    }

    public function moveStoreSuggestionIndex(Varien_Object $event)
    {
        $storeId = $event->getStoreId();

        $this->helper->moveStoreSuggestionIndex($storeId);
    }

    public function rebuildCategoryIndex(Varien_Object $event)
    {
        $storeId = $event->getStoreId();
        $categoryIds = $event->getCategoryIds();

        $page = $event->getPage();
        $pageSize = $event->getPageSize();

        if (is_null($storeId) && !empty($categoryIds)) {
            foreach (Mage::app()->getStores() as $storeId => $store) {
                if (!$store->getIsActive()) {
                    continue;
                }

                $this->helper->rebuildStoreCategoryIndex($storeId, $categoryIds);
            }
        } else {
            if (!empty($page) && !empty($pageSize)) {
                $this->helper->rebuildStoreCategoryIndexPage($storeId,
                    $this->category_helper->getCategoryCollectionQuery($storeId, $categoryIds), $page, $pageSize);
            } else {
                $this->helper->rebuildStoreCategoryIndex($storeId, $categoryIds);
            }
        }

        return $this;
    }

    public function rebuildProductIndex(Varien_Object $event)
    {
        $storeId = $event->getStoreId();
        $productIds = $event->getProductIds();

        $page = $event->getPage();
        $pageSize = $event->getPageSize();

        $useTmpIndex = (bool) $event->getUseTmpIndex();

        if (is_null($storeId) && !empty($productIds)) {
            foreach (Mage::app()->getStores() as $storeId => $store) {
                if (!$store->getIsActive()) {
                    continue;
                }

                $this->helper->rebuildStoreProductIndex($storeId, $productIds);
            }
        } else {
            if (!empty($page) && !empty($pageSize)) {
                $collection = $this->product_helper->getProductCollectionQuery($storeId, $productIds, $useTmpIndex);
                $this->helper->rebuildStoreProductIndexPage($storeId, $collection, $page, $pageSize, null, $productIds, $useTmpIndex);
            } else {
                $this->helper->rebuildStoreProductIndex($storeId, $productIds);
            }
        }

        return $this;
    }

    public function moveProductsTmpIndex(Varien_Object $event)
    {
        $storeId = $event->getStoreId();

        $this->helper->moveProductsIndex($storeId);
    }

    private function loadMeilisearchSearchHandle(Varien_Event_Observer $observer)
    {
        Mage::log('DEBUG: loadMeilisearchSearchHandle called', Mage::LOG_DEBUG, 'meilisearch_debug.log');
        Mage::log('DEBUG: Popup=' . ($this->config->isPopupEnabled() ? 'YES' : 'NO'), Mage::LOG_DEBUG, 'meilisearch_debug.log');
        Mage::log('DEBUG: Instant=' . ($this->config->isInstantEnabled() ? 'YES' : 'NO'), Mage::LOG_DEBUG, 'meilisearch_debug.log');
        Mage::log('DEBUG: Autocomplete=' . ($this->config->isAutoCompleteEnabled() ? 'YES' : 'NO'), Mage::LOG_DEBUG, 'meilisearch_debug.log');

        if (!$this->config->isPopupEnabled() && !$this->config->isInstantEnabled() && !$this->config->isAutoCompleteEnabled()) {
            Mage::log('DEBUG: None enabled, skipping handle', Mage::LOG_DEBUG, 'meilisearch_debug.log');
            return;
        }

        Mage::log('DEBUG: Adding meilisearch_search_handle', Mage::LOG_DEBUG, 'meilisearch_debug.log');
        $observer->getData('layout')->getUpdate()->addHandle('meilisearch_search_handle');
    }

    private function loadSearchFormHandle(Varien_Event_Observer $observer)
    {
        if (!$this->config->isDefaultSelector()) {
            return;
        }

        $observer->getData('layout')->getUpdate()->addHandle('meilisearch_search_handle_with_topsearch');
    }

    private function loadInstantSearchHandle(Varien_Event_Observer $observer)
    {
        if (!$this->config->isInstantEnabled()) {
            return;
        }

        $category = Mage::registry('current_category');
        if ($this->config->replaceCategories() && $category && $category->getDisplayMode() === 'PAGE') {
            return;
        }

        $observer->getData('layout')->getUpdate()->addHandle('meilisearch_search_handle_instantsearch');
    }

    private function loadAutocompleteHandle(Varien_Event_Observer $observer)
    {
        if ($this->config->isPopupEnabled() || $this->config->isAutoCompleteEnabled()) {
            $observer->getData('layout')->getUpdate()->addHandle('meilisearch_search_handle_autocomplete');
        }
    }

    private function loadPreventBackendRenderingHandle(Varien_Event_Observer $observer)
    {
        if (!$this->config->preventBackendRendering()) {
            return;
        }

        $category = Mage::registry('current_category');
        $backendRenderingDisplayMode = $this->config->getBackendRenderingDisplayMode();
        if ($category && $backendRenderingDisplayMode === 'only_products' && $category->getDisplayMode() === 'PAGE') {
            return;
        }

        $observer->getData('layout')->getUpdate() ->addHandle('meilisearch_search_handle_prevent_backend_rendering');
    }

    private function loadAnalyticsHandle(Varien_Event_Observer $observer)
    {
        // Click & Conversion Analytics removed - was Algolia-specific
        return;
    }

    private function isIndexerInManualMode($indexerCode)
    {
        /** @var $process Mage_Index_Model_Process */
        $process = Mage::getModel('index/process')->load($indexerCode, 'indexer_code');
        if (!is_null($process) && $process->getMode() == Mage_Index_Model_Process::MODE_MANUAL) {
            return true;
        }

        return false;
    }
}
