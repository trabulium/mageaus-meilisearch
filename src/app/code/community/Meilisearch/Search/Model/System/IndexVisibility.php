<?php

/**
 * Source model for meilisearch remove words if no result.
 */

class Meilisearch_Search_Model_System_IndexVisibility
{
    public function toOptionArray()
    {
        return array(
            array('value' => 'all',           'label' => Mage::helper('meilisearch_search')->__('All visible products')),
            array('value' => 'only_search',   'label' => Mage::helper('meilisearch_search')->__('Only products visible in Search')),
            array('value' => 'only_catalog',  'label' => Mage::helper('meilisearch_search')->__('Only products visible in Catalog')),
        );
    }
}
