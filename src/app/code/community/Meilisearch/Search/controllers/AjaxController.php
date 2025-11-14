<?php
/**
 * 2025 Maho
 *
 * NOTICE OF LICENSE
 *
 * This source file is subject to the Open Software License (OSL 3.0)
 * that is bundled with this package in the file LICENSE.txt.
 * It is also available through the world-wide-web at this URL:
 * https://opensource.org/licenses/osl-3.0.php
 * If you did not receive a copy of the license and are unable to
 * obtain it through the world-wide-web, please send an email
 * to license@maho.org so we can send you a copy immediately.
 *
 * @category   Meilisearch
 * @package    Meilisearch_Search
 * @copyright  Copyright (c) 2025 Maho (https://www.maho.org)
 * @license    https://opensource.org/licenses/osl-3.0.php  Open Software License (OSL 3.0)
 */

class Meilisearch_Search_AjaxController extends Mage_Core_Controller_Front_Action
{
    /**
     * Get form key for AJAX requests
     */
    public function getformkeyAction()
    {
        $formKey = Mage::getSingleton('core/session')->getFormKey();
        
        $this->getResponse()
            ->setHeader('Content-Type', 'application/json')
            ->setBody(json_encode(['formKey' => $formKey]));
    }
}