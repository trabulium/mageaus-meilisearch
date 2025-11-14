<?php

/**
 * Meilisearch custom sort order field.
 */
class Meilisearch_Search_Block_System_Config_Form_Field_CategoryAdditionalAttributes extends Meilisearch_Search_Block_System_Config_Form_Field_AbstractField
{
    public function __construct()
    {
        $this->settings = array(
            'columns' => array(
                'attribute' => array(
                    'label'   => 'Attribute',
                    'options' => function () {
                        $options = array();

                        /** @var Meilisearch_Search_Helper_Entity_Categoryhelper $category_helper */
                        $category_helper = Mage::helper('meilisearch_search/entity_categoryhelper');

                        $searchableAttributes = $category_helper->getAllAttributes();
                        foreach ($searchableAttributes as $key => $label) {
                            $options[$key] = $key ? $key : $label;
                        }

                        return $options;
                    },
                    'rowMethod' => 'getAttribute',
                    'width'     => 160,
                ),
                'searchable' => array(
                    'label'   => 'Searchable',
                    'options' => array(
                        '1' => 'Yes',
                        '0' => 'No',
                    ),
                    'rowMethod' => 'getSearchable',
                ),
                'retrievable' => array(
                    'label'   => 'Retrievable',
                    'options' => array(
                        '1' => 'Yes',
                        '0' => 'No',
                    ),
                    'rowMethod' => 'getRetrievable',
                ),
                'order' => array(
                    'label'   => 'Ordered',
                    'options' => array(
                        'unordered' => 'Unordered',
                        'ordered'   => 'Ordered',
                    ),
                    'rowMethod' => 'getOrder',
                ),
            ),
            'buttonLabel' => 'Add Attribute',
            'addAfter'    => false,
        );

        parent::__construct();
    }
    
    /**
     * Add drag and drop functionality
     */
    protected function _prepareToRender()
    {
        parent::_prepareToRender();
        
        // Add drag handle column at the beginning
        $this->addColumn('drag_handle', array(
            'label' => '',
            'style' => 'width:20px; cursor:move;',
            'class' => 'drag-handle'
        ));
        
        // Reorder columns to put drag handle first
        $columns = $this->_columns;
        $dragHandle = array_pop($columns);
        array_unshift($columns, $dragHandle);
        $this->_columns = $columns;
    }
    
    /**
     * Render array cell for drag handle column
     */
    protected function _renderCellTemplate($columnName)
    {
        if ($columnName == 'drag_handle') {
            return '<td class="drag-handle" style="cursor:move;">☰</td>';
        }
        return parent::_renderCellTemplate($columnName);
    }
    
    /**
     * Add JavaScript for drag and drop
     */
    protected function _toHtml()
    {
        $html = parent::_toHtml();
        
        $html .= '<script type="text/javascript">
        (function() {
            function initDragAndDrop() {
                var table = document.getElementById("' . $this->getHtmlId() . '");
                if (!table) return;
                
                var tbody = table.querySelector("tbody");
                if (!tbody) return;
                
                var draggedRow = null;
                
                // Add draggable attribute to all rows except the template
                var rows = tbody.querySelectorAll("tr");
                rows.forEach(function(row) {
                    if (row.id && row.id.indexOf("_add_template") === -1) {
                        row.draggable = true;
                        
                        // Add drag start handler
                        row.addEventListener("dragstart", function(e) {
                            draggedRow = this;
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/html", this.innerHTML);
                            this.style.opacity = "0.5";
                        });
                        
                        // Add drag end handler
                        row.addEventListener("dragend", function(e) {
                            this.style.opacity = "";
                            rows.forEach(function(row) {
                                row.classList.remove("drag-over");
                            });
                        });
                        
                        // Add drag over handler
                        row.addEventListener("dragover", function(e) {
                            if (e.preventDefault) {
                                e.preventDefault();
                            }
                            e.dataTransfer.dropEffect = "move";
                            
                            var thisRow = this;
                            if (thisRow !== draggedRow) {
                                thisRow.classList.add("drag-over");
                            }
                            return false;
                        });
                        
                        // Add drag leave handler
                        row.addEventListener("dragleave", function(e) {
                            this.classList.remove("drag-over");
                        });
                        
                        // Add drop handler
                        row.addEventListener("drop", function(e) {
                            if (e.stopPropagation) {
                                e.stopPropagation();
                            }
                            
                            if (draggedRow !== this) {
                                // Insert dragged row before this row
                                tbody.insertBefore(draggedRow, this);
                                
                                // Reindex all input names
                                reindexRows();
                            }
                            
                            return false;
                        });
                    }
                });
                
                // Function to reindex input names after reordering
                function reindexRows() {
                    var index = 0;
                    var rows = tbody.querySelectorAll("tr");
                    rows.forEach(function(row) {
                        if (row.id && row.id.indexOf("_add_template") === -1) {
                            var inputs = row.querySelectorAll("input, select");
                            inputs.forEach(function(input) {
                                if (input.name) {
                                    input.name = input.name.replace(/\[\d+\]/, "[" + index + "]");
                                }
                            });
                            index++;
                        }
                    });
                }
                
                // Add CSS
                var style = document.createElement("style");
                style.textContent = `
                    #' . $this->getHtmlId() . ' .drag-handle {
                        text-align: center;
                        color: #999;
                        font-size: 16px;
                        padding: 5px;
                        cursor: move;
                    }
                    #' . $this->getHtmlId() . ' tr[draggable="true"] {
                        cursor: move;
                    }
                    #' . $this->getHtmlId() . ' tr.drag-over {
                        border-top: 2px solid #3366cc;
                    }
                    #' . $this->getHtmlId() . ' tbody tr:hover .drag-handle {
                        color: #333;
                    }
                `;
                document.head.appendChild(style);
            }
            
            // Initialize when DOM is ready
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", initDragAndDrop);
            } else {
                initDragAndDrop();
            }
        })();
        </script>';
        
        return $html;
    }
}
