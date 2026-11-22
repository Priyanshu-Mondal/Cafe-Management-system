// orders.js - Kitchen display system, active orders pipeline, and bill generator
const Orders = (() => {
    let ordersList = [];
    let activeFilter = 'all';
    let refreshTimer = null;

    const STATUS_FLOW = {
        'pending': { next: 'preparing', label: 'Start Preparing 🍳', badgeClass: 'status-pending', text: 'Pending' },
        'preparing': { next: 'ready', label: 'Mark Ready 🔔', badgeClass: 'status-preparing', text: 'Preparing' },
        'ready': { next: 'delivered', label: 'Mark Delivered ✓', badgeClass: 'status-ready', text: 'Ready to Serve' },
        'delivered': { next: null, label: 'Completed', badgeClass: 'status-delivered', text: 'Delivered' }
    };

    function formatTime(isoString) {
        if (!isoString) return 'Just now';
        try {
            const date = new Date(isoString);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return 'Recent';
        }
    }

    function formatRelativeTime(isoString) {
        if (!isoString) return '';
        try {
            const diffSeconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
            if (diffSeconds < 60) return 'Just now';
            const diffMinutes = Math.floor(diffSeconds / 60);
            if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes > 1 ? 's' : ''} ago`;
            const diffHours = Math.floor(diffMinutes / 60);
            return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
        } catch {
            return '';
        }
    }

    function updateCounts() {
        const counts = {
            all: ordersList.length,
            active: 0,
            pending: 0,
            preparing: 0,
            ready: 0,
            delivered: 0
        };

        ordersList.forEach(o => {
            const status = (o.status || 'pending').toLowerCase();
            if (['pending', 'preparing', 'ready'].includes(status)) {
                counts.active += 1;
            }
            if (counts[status] !== undefined) {
                counts[status] += 1;
            }
        });

        // Update badges
        const setEl = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setEl('count-all', counts.all);
        setEl('count-active', counts.active);
        setEl('count-pending', counts.pending);
        setEl('count-preparing', counts.preparing);
        setEl('count-ready', counts.ready);
        setEl('count-delivered', counts.delivered);

        const navBadge = document.getElementById('orders-badge');
        if (navBadge) {
            navBadge.textContent = counts.active;
            navBadge.classList.toggle('has-active', counts.active > 0);
        }
    }

    function render() {
        const container = document.getElementById('orders-list');
        if (!container) return;

        updateCounts();

        let filtered = ordersList;
        if (activeFilter === 'active') {
            filtered = ordersList.filter(o => ['pending', 'preparing', 'ready'].includes((o.status || '').toLowerCase()));
        } else if (activeFilter !== 'all') {
            filtered = ordersList.filter(o => (o.status || '').toLowerCase() === activeFilter);
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-orders-view">
                    <span class="empty-orders-icon">📋</span>
                    <h3>No ${activeFilter === 'all' ? '' : activeFilter} orders</h3>
                    <p class="text-muted">There are no orders matching the selected filter.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(order => {
            const statusKey = (order.status || 'pending').toLowerCase();
            const config = STATUS_FLOW[statusKey] || STATUS_FLOW['pending'];
            const tableNo = order.tableNo || 'N/A';
            const items = order.items || [];
            const subtotal = order.subtotal || items.reduce((s, i) => s + (i.price * i.qty), 0);
            const tax = order.tax !== undefined ? order.tax : Math.round(subtotal * 0.05 * 100) / 100;
            const total = order.total !== undefined ? order.total : (subtotal + tax);
            const paymentMode = (order.paymentMode || 'cash').toUpperCase();
            const isCompleted = statusKey === 'delivered';

            return `
                <div class="order-card-box ${config.badgeClass}-border" data-order-id="${order.id}">
                    <div class="order-card-top-bar">
                        <div class="order-title-group">
                            <span class="order-table-chip">Table #${tableNo}</span>
                            <span class="order-id-label">#${order.id}</span>
                        </div>
                        <div class="order-status-badge ${config.badgeClass}">
                            <span class="status-pulse-dot"></span>
                            <span>${config.text}</span>
                        </div>
                    </div>

                    <div class="order-time-meta">
                        <span>🕒 ${formatTime(order.createdAt)}</span>
                        <span class="text-muted">(${formatRelativeTime(order.createdAt)})</span>
                        <span class="payment-badge-tag">${paymentMode}</span>
                    </div>

                    ${order.notes ? `
                        <div class="order-note-alert">
                            <strong>Note:</strong> ${order.notes}
                        </div>
                    ` : ''}

                    <div class="order-items-table">
                        ${items.map(item => `
                            <div class="order-item-line">
                                <span class="order-item-qty">${item.qty}×</span>
                                <span class="order-item-name">${item.name}</span>
                                <span class="order-item-amount">${API.formatCurrency(item.price * item.qty)}</span>
                            </div>
                        `).join('')}
                    </div>

                    <div class="order-card-financials">
                        <div class="financial-row small-text">
                            <span>Subtotal:</span>
                            <span>${API.formatCurrency(subtotal)}</span>
                        </div>
                        <div class="financial-row small-text">
                            <span>GST (5%):</span>
                            <span>${API.formatCurrency(tax)}</span>
                        </div>
                        <div class="financial-row total-row">
                            <strong>Total:</strong>
                            <strong class="text-primary">${API.formatCurrency(total)}</strong>
                        </div>
                    </div>

                    <div class="order-card-actions">
                        ${config.next ? `
                            <button class="btn btn-primary btn-sm advance-status-btn" 
                                data-id="${order.id}" 
                                data-next="${config.next}">
                                ${config.label}
                            </button>
                        ` : `
                            <span class="delivered-check-label">✓ Order Complete</span>
                        `}

                        <div class="order-secondary-actions">
                            <select class="status-override-select" data-id="${order.id}" title="Change status manually">
                                <option value="pending" ${statusKey === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="preparing" ${statusKey === 'preparing' ? 'selected' : ''}>Preparing</option>
                                <option value="ready" ${statusKey === 'ready' ? 'selected' : ''}>Ready</option>
                                <option value="delivered" ${statusKey === 'delivered' ? 'selected' : ''}>Delivered</option>
                            </select>

                            <button class="btn btn-outline btn-sm view-bill-btn" data-id="${order.id}" title="View tax invoice & bill">
                                🧾 Bill
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Wire Advance status buttons
        container.querySelectorAll('.advance-status-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const orderId = btn.dataset.id;
                const nextStatus = btn.dataset.next;
                btn.disabled = true;
                btn.textContent = 'Updating...';
                await handleStatusUpdate(orderId, nextStatus);
            });
        });

        // Wire status manual override dropdown
        container.querySelectorAll('.status-override-select').forEach(sel => {
            sel.addEventListener('change', async (e) => {
                const orderId = sel.dataset.id;
                const targetStatus = e.target.value;
                await handleStatusUpdate(orderId, targetStatus);
            });
        });

        // Wire View Bill button
        container.querySelectorAll('.view-bill-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const orderId = btn.dataset.id;
                const order = ordersList.find(o => String(o.id) === String(orderId));
                if (order) showBillModal(order);
            });
        });
    }

    async function handleStatusUpdate(orderId, newStatus) {
        try {
            const res = await API.updateOrderStatus(orderId, newStatus);
            if (res && res.success) {
                App.showToast(`Order #${orderId} marked as ${newStatus.toUpperCase()}`, 'success');
                await refresh();
                await Tables.render();
            } else {
                App.showToast(`Could not update order status.`, 'error');
            }
        } catch (err) {
            console.error('Status update failed:', err);
            App.showToast('Error updating status: ' + err.message, 'error');
        }
    }

    function showBillModal(order) {
        const modal = document.getElementById('bill-modal');
        const content = document.getElementById('receipt-content');
        if (!modal || !content) return;

        const items = order.items || [];
        const subtotal = order.subtotal || items.reduce((s, i) => s + (i.price * i.qty), 0);
        const tax = order.tax !== undefined ? order.tax : Math.round(subtotal * 0.05 * 100) / 100;
        const total = order.total !== undefined ? order.total : (subtotal + tax);
        const cgst = Math.round((tax / 2) * 100) / 100;
        const sgst = Math.round((tax - cgst) * 100) / 100;
        const formattedDate = order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN');

        content.innerHTML = `
            <div class="receipt-header">
                <h2>QuickServe Café</h2>
                <p>Commercial Hub, Main Boulevard</p>
                <p>GSTIN: 29AAAAA0000A1Z5 • FSSAI: 11223344556677</p>
                <div class="receipt-type">TAX INVOICE / CASH BILL</div>
            </div>

            <div class="receipt-meta-grid">
                <div><strong>Invoice #:</strong> ${order.id}</div>
                <div><strong>Table #:</strong> ${order.tableNo}</div>
                <div><strong>Date & Time:</strong> ${formattedDate}</div>
                <div><strong>Status:</strong> ${(order.status || 'pending').toUpperCase()}</div>
                <div><strong>Payment Mode:</strong> ${(order.paymentMode || 'CASH').toUpperCase()}</div>
            </div>

            <table class="receipt-items-table">
                <thead>
                    <tr>
                        <th class="col-item">Item Description</th>
                        <th class="col-qty">Qty</th>
                        <th class="col-rate">Rate</th>
                        <th class="col-total">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(i => `
                        <tr>
                            <td class="col-item">${i.name}</td>
                            <td class="col-qty">${i.qty}</td>
                            <td class="col-rate">${API.formatCurrency(i.price)}</td>
                            <td class="col-total">${API.formatCurrency(i.price * i.qty)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="receipt-calc-summary">
                <div class="calc-row">
                    <span>Subtotal:</span>
                    <span>${API.formatCurrency(subtotal)}</span>
                </div>
                <div class="calc-row">
                    <span>CGST (2.5%):</span>
                    <span>${API.formatCurrency(cgst)}</span>
                </div>
                <div class="calc-row">
                    <span>SGST (2.5%):</span>
                    <span>${API.formatCurrency(sgst)}</span>
                </div>
                <div class="calc-row grand-total-row">
                    <span>NET PAYABLE TOTAL:</span>
                    <span>${API.formatCurrency(total)}</span>
                </div>
            </div>

            <div class="receipt-footer">
                <p>Prices inclusive of applicable taxes.</p>
                <p>Thank you for visiting QuickServe Café!</p>
                <p class="tagline">Visit again • Have a great day!</p>
            </div>
        `;

        modal.classList.remove('hidden');
    }

    function setupFilters() {
        document.querySelectorAll('.order-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.order-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeFilter = btn.dataset.filter;
                render();
            });
        });

        const refreshBtn = document.getElementById('refresh-orders-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                refreshBtn.textContent = 'Refreshing...';
                await refresh();
                refreshBtn.textContent = '🔄 Refresh';
                App.showToast('Orders refreshed', 'info');
            });
        }

        // Bill modal close handlers
        const modal = document.getElementById('bill-modal');
        const closeBtn = document.getElementById('close-bill-btn');
        const dismissBtn = document.getElementById('dismiss-bill-btn');
        const printBtn = document.getElementById('print-bill-btn');

        const closeModal = () => modal && modal.classList.add('hidden');

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (dismissBtn) dismissBtn.addEventListener('click', closeModal);
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        }

        if (printBtn) {
            printBtn.addEventListener('click', () => {
                window.print();
            });
        }
    }

    async function refresh() {
        ordersList = await API.getOrders();
        // Sort newest first
        ordersList.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        render();
    }

    function init() {
        setupFilters();
        refresh();

        // Background polling every 12 seconds so Kitchen screen updates live
        if (refreshTimer) clearInterval(refreshTimer);
        refreshTimer = setInterval(() => {
            refresh();
        }, 12000);
    }

    return {
        init,
        refresh,
        render,
        showBillModal,
        getAllOrders: () => [...ordersList]
    };
})();
