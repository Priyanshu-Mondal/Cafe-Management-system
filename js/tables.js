// tables.js - Café Tables (15 Tables) State & Floor Plan Management
const Tables = (() => {
    let tablesList = [];
    let currentSelectedTable = 1;

    function getSelectedTable() {
        return currentSelectedTable;
    }

    function setSelectedTable(tableNo, triggerNav = false) {
        const num = Number(tableNo);
        if (tablesList.some(t => t.id === num)) {
            currentSelectedTable = num;
        }

        // Sync dropdowns
        const globalSelect = document.getElementById('global-table-select');
        const cartSelect = document.getElementById('cart-table-select');
        if (globalSelect) globalSelect.value = currentSelectedTable;
        if (cartSelect) cartSelect.value = currentSelectedTable;

        updateTableBadge();

        if (triggerNav && typeof App !== 'undefined' && App.showSection) {
            App.showSection('menu');
            App.showToast(`Selected Table #${currentSelectedTable}`, 'info');
        }
    }

    function updateTableBadge() {
        const badge = document.getElementById('table-details-badge');
        if (!badge) return;
        const table = tablesList.find(t => t.id === currentSelectedTable);
        if (table) {
            badge.textContent = `${table.seats} Seats • ${table.location}`;
        }
    }

    function populateSelects() {
        const globalSelect = document.getElementById('global-table-select');
        const cartSelect = document.getElementById('cart-table-select');

        const optionsHtml = tablesList.map(t => `
            <option value="${t.id}">Table ${t.id} (${t.seats} Seats - ${t.location})</option>
        `).join('');

        if (globalSelect) {
            globalSelect.innerHTML = optionsHtml;
            globalSelect.value = currentSelectedTable;
            globalSelect.addEventListener('change', (e) => {
                setSelectedTable(e.target.value);
            });
        }

        if (cartSelect) {
            cartSelect.innerHTML = optionsHtml;
            cartSelect.value = currentSelectedTable;
            cartSelect.addEventListener('change', (e) => {
                setSelectedTable(e.target.value);
            });
        }

        updateTableBadge();
    }

    async function render() {
        const container = document.getElementById('tables-grid');
        if (!container) return;

        // Get latest orders to show active table status
        const orders = await API.getOrders();
        const activeOrders = orders.filter(o => ['pending', 'preparing', 'ready'].includes(String(o.status).toLowerCase()));

        container.innerHTML = tablesList.map(table => {
            const tableOrders = activeOrders.filter(o => Number(o.tableNo) === Number(table.id));
            const isOccupied = tableOrders.length > 0;
            const isCurrent = table.id === currentSelectedTable;

            const latestStatus = isOccupied ? tableOrders[0].status.toLowerCase() : 'available';

            let statusClass = 'status-badge-available';
            let statusLabel = 'Available';

            if (latestStatus === 'pending') {
                statusClass = 'status-badge-pending';
                statusLabel = 'Pending Order';
            } else if (latestStatus === 'preparing') {
                statusClass = 'status-badge-preparing';
                statusLabel = 'Kitchen Preparing';
            } else if (latestStatus === 'ready') {
                statusClass = 'status-badge-ready';
                statusLabel = 'Ready to Serve!';
            }

            return `
                <div class="table-card ${isCurrent ? 'selected-table-card' : ''} ${isOccupied ? 'occupied' : 'vacant'}">
                    <div class="table-card-header">
                        <span class="table-number">Table #${table.id}</span>
                        <span class="table-status-pill ${statusClass}">${statusLabel}</span>
                    </div>
                    <div class="table-card-body">
                        <div class="table-meta-row">
                            <span class="table-meta-item">🪑 ${table.seats} Seats</span>
                            <span class="table-meta-item">📍 ${table.location}</span>
                        </div>
                        ${isOccupied ? `
                            <div class="table-active-order-info">
                                <small>Active: ${tableOrders.length} order(s)</small><br>
                                <strong>Order #${tableOrders[0].id}</strong>
                            </div>
                        ` : `
                            <div class="table-vacant-note">
                                <small class="text-muted">No active orders</small>
                            </div>
                        `}
                    </div>
                    <div class="table-card-actions">
                        <button class="btn btn-sm ${isCurrent ? 'btn-primary' : 'btn-outline'} select-table-btn" data-table-id="${table.id}">
                            ${isCurrent ? '✓ Selected' : 'Select Table'}
                        </button>
                        ${isOccupied ? `
                            <button class="btn btn-sm btn-subtle view-table-orders-btn" data-table-id="${table.id}">
                                View Orders
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Attach listeners
        container.querySelectorAll('.select-table-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = Number(btn.dataset.tableId);
                setSelectedTable(id, true);
                render();
            });
        });

        container.querySelectorAll('.view-table-orders-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (typeof App !== 'undefined' && App.showSection) {
                    App.showSection('orders');
                }
            });
        });
    }

    async function init() {
        tablesList = await API.getTables();
        populateSelects();
        render();
    }

    return {
        init,
        render,
        getSelectedTable,
        setSelectedTable,
        getAll: () => [...tablesList]
    };
})();

