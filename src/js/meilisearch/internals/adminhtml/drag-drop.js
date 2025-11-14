(function() {
    'use strict';
    
    // Avoid conflicts with Prototype.js
    var _forEach = function(nodeList, callback) {
        for (var i = 0; i < nodeList.length; i++) {
            callback(nodeList[i], i);
        }
    };

    function initMeilisearchDragDrop() {
        // Find all tables with drag handles
        var tables = document.querySelectorAll('table[id*="product_additional_attributes"], table[id*="category_additional_attributes"], table[id*="custom_ranking_product_attributes"], table[id*="custom_ranking_category_attributes"]');
        
        _forEach(tables, function(table) {
            if (!table) return;
            
            var tbody = table.querySelector('tbody');
            if (!tbody) return;
            
            var draggedRow = null;
            
            // Add draggable attribute to all rows except the template
            var rows = tbody.querySelectorAll('tr');
            _forEach(rows, function(row) {
                if (row.id && row.id.indexOf('_add_template') === -1) {
                    row.draggable = true;
                    row.style.cursor = 'move';
                    
                    // Add drag start handler
                    row.addEventListener('dragstart', function(e) {
                        draggedRow = this;
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/html', this.innerHTML);
                        this.style.opacity = '0.5';
                    });
                    
                    // Add drag end handler
                    row.addEventListener('dragend', function(e) {
                        this.style.opacity = '';
                        var allRows = tbody.querySelectorAll('tr');
                        _forEach(allRows, function(r) {
                            r.classList.remove('drag-over');
                        });
                    });
                    
                    // Add drag over handler
                    row.addEventListener('dragover', function(e) {
                        if (e.preventDefault) {
                            e.preventDefault();
                        }
                        e.dataTransfer.dropEffect = 'move';
                        
                        var thisRow = this;
                        if (thisRow !== draggedRow) {
                            thisRow.classList.add('drag-over');
                        }
                        return false;
                    });
                    
                    // Add drag leave handler
                    row.addEventListener('dragleave', function(e) {
                        this.classList.remove('drag-over');
                    });
                    
                    // Add drop handler
                    row.addEventListener('drop', function(e) {
                        if (e.stopPropagation) {
                            e.stopPropagation();
                        }
                        
                        if (draggedRow !== this) {
                            // Insert dragged row before this row
                            tbody.insertBefore(draggedRow, this);
                            
                            // Reindex all input names
                            reindexRows(tbody);
                        }
                        
                        return false;
                    });
                }
            });
            
            // Function to reindex input names after reordering
            function reindexRows(tbody) {
                var index = 0;
                var rows = tbody.querySelectorAll('tr');
                _forEach(rows, function(row) {
                    if (row.id && row.id.indexOf('_add_template') === -1) {
                        var inputs = row.querySelectorAll('input, select');
                        _forEach(inputs, function(input) {
                            if (input.name) {
                                input.name = input.name.replace(/\[\d+\]/, '[' + index + ']');
                            }
                        });
                        index++;
                    }
                });
            }
        });
        
        // Add CSS if not already added
        if (!document.getElementById('meilisearch-drag-drop-styles')) {
            var style = document.createElement('style');
            style.id = 'meilisearch-drag-drop-styles';
            style.textContent = [
                '.drag-handle {',
                '    text-align: center;',
                '    color: #999;',
                '    font-size: 16px;',
                '    padding: 5px;',
                '    cursor: move;',
                '}',
                'tr[draggable="true"] {',
                '    cursor: move;',
                '}',
                'tr.drag-over {',
                '    border-top: 2px solid #3366cc;',
                '}',
                'tbody tr:hover .drag-handle {',
                '    color: #333;',
                '}'
            ].join('\n');
            document.head.appendChild(style);
        }
    }

    // Use native DOM ready instead of DOMContentLoaded to avoid conflicts
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(initMeilisearchDragDrop, 1500);
        });
    } else {
        setTimeout(initMeilisearchDragDrop, 1500);
    }
})();