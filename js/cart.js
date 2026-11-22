// cart.js - Cart management, automatic tax/bill calculations, and checkout
const Cart = (() => {
    let items = [];
    const GST_RATE = 0.05; // 5% GST

    function loadSavedCart() {
        try {
            const saved = sessionStorage.getItem('quickserve-cart');
            if (saved) items = JSON.parse(saved);
        } catch {
            items = [];
        }
    }

    function saveCart() {
        try {
            sessionStorage.setItem('quickserve-cart', JSON.stringify(items));
        } catch {
            // ignore session storage errors
        }
    }

    function getSubtotal() {
        return items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 1), 0);
    }

    function getTax(subtotal) {
        return Math.round(subtotal * GST_RATE * 100) / 100;
    }

    function getTotal() {
        const subtotal = getSubtotal();
        const tax = getTax(subtotal);
        return Math.round((subtotal + tax) * 100) / 100;
    }

    function updateBadgeAndQuickBar() {
        const totalCount = items.reduce((sum, i) => sum + i.qty, 0);
        const cartCountEl = document.getElementById('cart-count');
        if (cartCountEl) cartCountEl.textContent = totalCount;

        const quickTotalEl = document.getElementById('current-cart-quick-total');
        if (quickTotalEl) {
            quickTotalEl.textContent = `Cart: ${API.formatCurrency(getTotal())} (${totalCount} items)`;
        }
    }

    function render() {
        const container = document.getElementById('cart-items');
        const subtotalEl = document.getElementById('bill-subtotal');
        const taxEl = document.getElementById('bill-tax');
        const totalEl = document.getElementById('bill-total');
        const checkoutBtn = document.getElementById('checkout-btn');

        updateBadgeAndQuickBar();
        saveCart();

        const subtotal = getSubtotal();
        const tax = getTax(subtotal);
        const total = getTotal();

        if (subtotalEl) subtotalEl.textContent = API.formatCurrency(subtotal);
        if (taxEl) taxEl.textContent = API.formatCurrency(tax);
        if (totalEl) totalEl.textContent = API.formatCurrency(total);

        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-cart-view">
                    <span class="empty-cart-icon">🛒</span>
                    <h3>Your cart is empty</h3>
                    <p class="text-muted">Select delicious items from our café menu to begin your order.</p>
                    <button id="cart-start-ordering-btn" class="btn btn-primary btn-sm">Browse Menu</button>
                </div>
            `;
            const browseBtn = document.getElementById('cart-start-ordering-btn');
            if (browseBtn) {
                browseBtn.addEventListener('click', () => {
                    App.showSection('menu');
                });
            }
            if (checkoutBtn) {
                checkoutBtn.disabled = true;
                checkoutBtn.textContent = 'Add Items to Place Order';
            }
            return;
        }

        if (checkoutBtn) {
            checkoutBtn.disabled = false;
            const currentTable = Tables.getSelectedTable();
            checkoutBtn.textContent = `Place Order for Table #${currentTable} • ${API.formatCurrency(total)}`;
        }

        container.innerHTML = items.map(item => {
            const itemTotal = item.price * item.qty;
            const isVeg = item.veg === true;

            return `
                <div class="cart-item-row" data-id="${item.id}">
                    <div class="cart-item-details">
                        <div class="cart-item-name-wrap">
                            <span class="diet-badge ${isVeg ? 'veg' : 'non-veg'}">
                                <span class="diet-dot"></span>
                            </span>
                            <strong>${item.name}</strong>
                        </div>
                        <div class="cart-item-unit-price">${API.formatCurrency(item.price)} each</div>
                    </div>

                    <div class="cart-item-controls">
                        <button class="cart-qty-btn dec-qty" data-id="${item.id}" title="Decrease quantity">−</button>
                        <span class="cart-qty-val">${item.qty}</span>
                        <button class="cart-qty-btn inc-qty" data-id="${item.id}" title="Increase quantity">+</button>
                    </div>

                    <div class="cart-item-line-total">
                        ${API.formatCurrency(itemTotal)}
                    </div>

                    <button class="cart-remove-btn" data-id="${item.id}" title="Remove item">
                        🗑️
                    </button>
                </div>
            `;
        }).join('');

        // Wire event handlers
        container.querySelectorAll('.inc-qty').forEach(btn => {
            btn.addEventListener('click', () => changeQty(btn.dataset.id, 1));
        });

        container.querySelectorAll('.dec-qty').forEach(btn => {
            btn.addEventListener('click', () => changeQty(btn.dataset.id, -1));
        });

        container.querySelectorAll('.cart-remove-btn').forEach(btn => {
            btn.addEventListener('click', () => removeItem(btn.dataset.id));
        });
    }

    function addItem(menuItem) {
        const existing = items.find(i => String(i.id) === String(menuItem.id));
        if (existing) {
            existing.qty += 1;
        } else {
            items.push({
                id: String(menuItem.id),
                name: menuItem.name,
                price: Number(menuItem.price),
                qty: 1,
                veg: Boolean(menuItem.veg),
                category: menuItem.category || 'General'
            });
        }
        render();
    }

    function changeQty(id, delta) {
        const item = items.find(i => String(i.id) === String(id));
        if (!item) return;

        item.qty += delta;
        if (item.qty <= 0) {
            removeItem(id);
        } else {
            render();
            if (typeof Menu !== 'undefined' && Menu.renderItems) {
                Menu.renderItems();
            }
        }
    }

    function removeItem(id) {
        const item = items.find(i => String(i.id) === String(id));
        const itemName = item ? item.name : 'Item';
        items = items.filter(i => String(i.id) !== String(id));
        render();
        if (typeof Menu !== 'undefined' && Menu.renderItems) {
            Menu.renderItems();
        }
        App.showToast(`Removed ${itemName} from cart`, 'info');
    }

    function clear() {
        items = [];
        render();
        if (typeof Menu !== 'undefined' && Menu.renderItems) {
            Menu.renderItems();
        }
    }

    function getItems() {
        return items.map(i => ({ ...i }));
    }

    function setupEventListeners() {
        const clearBtn = document.getElementById('clear-cart-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (items.length === 0) return;
                if (confirm('Are you sure you want to clear your current order cart?')) {
                    clear();
                    App.showToast('Cart cleared', 'info');
                }
            });
        }

        const backBtn = document.getElementById('cart-back-to-menu-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                App.showSection('menu');
            });
        }

        const quickCartBtn = document.getElementById('quick-cart-view-btn');
        if (quickCartBtn) {
            quickCartBtn.addEventListener('click', () => {
                App.showSection('cart');
            });
        }

        const checkoutBtn = document.getElementById('checkout-btn');
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', handleCheckout);
        }
    }

    async function handleCheckout() {
        if (items.length === 0) {
            App.showToast('Your cart is empty! Please add items from the menu.', 'error');
            return;
        }

        const tableNo = Tables.getSelectedTable();
        if (!tableNo || tableNo < 1 || tableNo > 15) {
            App.showToast('Please select a valid table (1-15).', 'error');
            return;
        }

        const paymentRadio = document.querySelector('input[name="payment-mode"]:checked');
        const paymentMode = paymentRadio ? paymentRadio.value : 'cash';

        const notesInput = document.getElementById('order-notes');
        const notes = notesInput ? notesInput.value.trim() : '';

        const subtotal = getSubtotal();
        const tax = getTax(subtotal);
        const total = getTotal();

        const orderPayload = {
            tableNo,
            items: getItems(),
            subtotal,
            tax,
            total,
            paymentMode,
            notes,
        };

        const checkoutBtn = document.getElementById('checkout-btn');
        if (checkoutBtn) {
            checkoutBtn.disabled = true;
            checkoutBtn.textContent = 'Submitting order...';
        }

        try {
            const result = await API.createOrder(orderPayload);
            if (result && result.success) {
                const placedOrder = result.order;
                clear();
                if (notesInput) notesInput.value = '';

                App.showToast(`Order #${placedOrder.id} successfully placed for Table #${tableNo}!`, 'success');

                // Refresh orders & table status
                await Orders.refresh();
                await Tables.render();

                // Show bill modal immediately for confirmation & billing
                Orders.showBillModal(placedOrder);
                App.showSection('orders');
            } else {
                App.showToast('Failed to place order. Please try again.', 'error');
            }
        } catch (err) {
            console.error('Checkout error:', err);
            App.showToast('Error placing order: ' + err.message, 'error');
        } finally {
            if (checkoutBtn) {
                checkoutBtn.disabled = false;
                render();
            }
        }
    }

    function init() {
        loadSavedCart();
        setupEventListeners();
        render();
    }

    return {
        init,
        render,
        addItem,
        changeQty,
        removeItem,
        clear,
        getItems,
        getSubtotal,
        getTax,
        getTotal
    };
})();
