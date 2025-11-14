<?php

/**
 * Meilisearch custom sort order field.
 */
class Meilisearch_Search_Block_System_Config_Form_Field_AdditionalSections extends Meilisearch_Search_Block_System_Config_Form_Field_AbstractField
{
    public function __construct()
    {
        $this->settings = array(
            'columns' => array(
                'name' => array(
                    'label'   => 'Section',
                    'options' => function () {
                        $options = array();

                        $sections = array(
                            array('name' => 'pages', 'label' => 'Pages'),
                        );

                        /** @var Meilisearch_Search_Helper_Config $config */
                        $config = Mage::helper('meilisearch_search/config');

                        $attributes = $config->getFacets();
                        foreach ($attributes as $attribute) {
                            if ($attribute['attribute'] == 'price' || $attribute['attribute'] == 'category' || $attribute['attribute'] == 'categories') {
                                continue;
                            }

                            $sections[] = array(
                                'name'  => $attribute['attribute'],
                                'label' => $attribute['label'] ? $attribute['label'] : $attribute['attribute']
                            );
                        }

                        foreach ($sections as $section) {
                            $options[$section['name']] = $section['label'];
                        }

                        return $options;
                    },
                    'rowMethod' => 'getName',
                    'width'     => 130,
                ),
                'label' => array(
                    'label' => 'Label',
                    'style' => 'width: 100px;',
                ),
                'hitsPerPage' => array(
                    'label' => 'Hits per page',
                    'style' => 'width: 100px;',
                    'class' => 'required-entry input-text validate-number',
                ),
            ),
            'buttonLabel' => 'Add Section',
            'addAfter'    => false,
        );

        parent::__construct();
    }
}
