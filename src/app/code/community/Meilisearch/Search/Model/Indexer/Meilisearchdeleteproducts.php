<?php

class Meilisearch_Search_Model_Indexer_Meilisearchdeleteproducts extends Meilisearch_Search_Model_Indexer_Abstract
{
    /** @var Meilisearch_Search_Model_Resource_Engine */
    protected $engine;

    /** @var Meilisearch_Search_Helper_Config */
    protected $config;

    public function __construct()
    {
        parent::__construct();

        $this->engine = new Meilisearch_Search_Model_Resource_Engine();
        $this->config = Mage::helper('meilisearch_search/config');
    }

    public function getName()
    {
        return Mage::helper('meilisearch_search')->__('Meilisearch Search - Remove inactive products from Meilisearch');
    }

    public function getDescription()
    {
        /** @var Meilisearch_Search_Helper_Data $helper */
        $helper = Mage::helper('meilisearch_search');
        $decription = $helper->__('Run this indexer only when you want to remove inactive / deleted products from Meilisearch.');

        return $decription;
    }

    public function matchEvent(Mage_Index_Model_Event $event)
    {
        return false;
    }

    protected function _registerEvent(Mage_Index_Model_Event $event)
    {
        return $this;
    }

    protected function _registerCatalogProductEvent(Mage_Index_Model_Event $event)
    {
        return $this;
    }

    protected function _registerCatalogCategoryEvent(Mage_Index_Model_Event $event)
    {
        return $this;
    }

    protected function _processEvent(Mage_Index_Model_Event $event)
    {
    }

    /**
     * Rebuild all index data.
     */
    public function reindexAll()
    {
        if ($this->config->isModuleOutputEnabled() === false) {
            return $this;
        }

        if (!$this->config->getServerUrl() || !$this->config->getAPIKey()) {
            /** @var Mage_Adminhtml_Model_Session $session */
            $session = Mage::getSingleton('adminhtml/session');
            $session->addError('Meilisearch reindexing failed: You need to configure your Meilisearch credentials (Server URL and API Key) in System > Configuration > Meilisearch Search.');

            return $this;
        }

        $this->engine->deleteInactiveProducts();

        return $this;
    }
}
