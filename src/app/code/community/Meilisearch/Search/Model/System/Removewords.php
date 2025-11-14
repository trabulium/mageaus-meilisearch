<?php
/**
 * Source model for meilisearch remove words if no result.
 */
class Meilisearch_Search_Model_System_Removewords
{
    public function toOptionArray()
    {
        return array(
            array('value' => 'none',          'label' => Mage::helper('meilisearch_search')->__('None')),
            array('value' => 'allOptional',   'label' => Mage::helper('meilisearch_search')->__('AllOptional')),
            array('value' => 'lastWords',     'label' => Mage::helper('meilisearch_search')->__('LastWords')),
            array('value' => 'firstWords',    'label' => Mage::helper('meilisearch_search')->__('FirstWords')),
        );
    }
}
