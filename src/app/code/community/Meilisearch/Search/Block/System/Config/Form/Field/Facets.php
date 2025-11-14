<?php

/**
 * Meilisearch custom sort order field.
 */
class Meilisearch_Search_Block_System_Config_Form_Field_Facets extends Meilisearch_Search_Block_System_Config_Form_Field_AbstractField
{
    protected $_isQueryRulesDisabled;

    public function __construct()
    {
        $this->settings = array(
            'columns' => array(
                'attribute' => array(
                    'label'   => 'Attribute',
                    'options' => function () {
                        $options = array();

                        /** @var Meilisearch_Search_Helper_Entity_Producthelper $product_helper */
                        $product_helper = Mage::helper('meilisearch_search/entity_producthelper');

                        $attributes = $product_helper->getAllAttributes();
                        foreach ($attributes as $key => $label) {
                            $options[$key] = $key ?: $label;
                        }

                        return $options;
                    },
                    'rowMethod' => 'getAttribute',
                    'width'     => 160,
                ),
                'type' => array(
                    'label'   => 'Facet type',
                    'options' => array(
                        'conjunctive' => 'Conjunctive',
                        'disjunctive' => 'Disjunctive',
                        'slider'      => 'Slider',
                        'priceRanges' => 'Price Ranges',
                    ),
                    'rowMethod' => 'getType',
                ),
                'label' => array(
                    'label' => 'Label',
                    'style' => 'width: 100px;',
                ),
                'searchable' => array(
                    'label' => 'Searchable?',
                    'options' => array(
                        '1' => 'Yes',
                        '2' => 'No'
                    ),
                    'rowMethod' => 'getSearchable',
                ),
                'create_rule' => array(
                    'label'  => 'Create Query rule?',
                    'options' => array(
                        '2' => 'No',
                        '1' => 'Yes'
                    ),
                    'rowMethod' => 'getCreateRule',
                    'disabled' => $this->isQueryRulesDisabled()
                ),
            ),
            'buttonLabel' => 'Add Facet',
            'addAfter'    => false,
        );

        parent::__construct();
    }

    /**
     * @return bool
     */
    public function isQueryRulesDisabled()
    {
        if (is_null($this->_isQueryRulesDisabled)) {
            $this->_isQueryRulesDisabled = $this->_disableQueryRules();
        }

        return $this->_isQueryRulesDisabled;
    }

    /**
     * @return bool
     */
    protected function _disableQueryRules()
    {
        $proxyHelper = Mage::helper('meilisearch_search/proxyHelper');
        $info = $proxyHelper->getClientConfigurationData();

        return !isset($info['query_rules']) || $info['query_rules'] == 0;
    }

    protected function _decorateRowHtml($element, $html)
    {
        if (!$this->isQueryRulesDisabled()) {
            return parent::_decorateRowHtml($element, $html);
        }

        $additionalRow = '<tr class="meilisearch-messages"><td></td><td><div class="meilisearch-config-info icon-stars">';
        $additionalRow .= $this->__('To get access to this Meilisearch feature, please consider <a href="%s" target="_blank">upgrading to a higher plan.</a>',
            'https://www.meilisearch.com/pricing/');
        $additionalRow .= '</div></td></tr>';

        return '<tr id="row_' . $element->getHtmlId() . '">' . $html . '</tr>' . $additionalRow;
    }
}
