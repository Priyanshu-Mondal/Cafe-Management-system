// menu.js - Menu rendering, category filtering, search, and dietary toggle
const Menu = (() => {
    let allItems = [];
    let activeCategory = 'All';
    let searchQuery = '';
    let vegOnly = false;

    function renderFilters() {
        const container = document.getElementById('category-filters');
        if (!container) return;

        const categoryIcons = {
            'All': '🍽️',
            'Beverages': '☕',
            'Snacks': '🥟',
            'South Indian': '🥘',
            'Main Course': '🍛',
            'Desserts': '🍨'
        };

        const categories = ['All', ...new Set(allItems.map(i => i.category))];

        container.innerHTML = categories.map(cat => {
            const icon = categoryIcons[cat] || '🍴';
            const count = cat === 'All' 
                ? allItems.length 
                : allItems.filter(i => i.category === cat).length;
            const isActive = cat === activeCategory;

            return `
                <button class="cat-pill ${isActive ? 'active' : ''}" data-cat="${cat}">
                    <span class="cat-icon">${icon}</span>
                    <span class="cat-name">${cat}</span>
                    <span class="cat-count">${count}</span>
                </button>
            `;
        }).join('');

        container.querySelectorAll('button[data-cat]').forEach(btn => {
            btn.addEventListener('click', () => {
                activeCategory = btn.dataset.cat;
                renderFilters();
                renderItems();
            });
        });
    }

    function renderItems() {
        const container = document.getElementById('menu-items');
        if (!container) return;

        let filtered = allItems;

        if (activeCategory !== 'All') {
            filtered = filtered.filter(item => item.category === activeCategory);
        }

        if (vegOnly) {
            filtered = filtered.filter(item => item.veg === true);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(item => 
                item.name.toLowerCase().includes(query) ||
                (item.description && item.description.toLowerCase().includes(query)) ||
                item.category.toLowerCase().includes(query)
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state-card">
                    <span class="empty-state-icon">🔍</span>
                    <h3>No items found</h3>
                    <p class="text-muted">No menu items match your search or filter criteria.</p>
                    <button id="reset-filters-btn" class="btn btn-outline btn-sm">Reset Filters</button>
                </div>
            `;
            const resetBtn = document.getElementById('reset-filters-btn');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    activeCategory = 'All';
                    searchQuery = '';
                    vegOnly = false;
                    const searchInput = document.getElementById('menu-search-input');
                    const vegToggle = document.getElementById('veg-only-filter');
                    if (searchInput) searchInput.value = '';
                    if (vegToggle) vegToggle.checked = false;
                    renderFilters();
                    renderItems();
                });
            }
            return;
        }

        const cartItems = Cart.getItems();

        container.innerHTML = filtered.map(item => {
            const inCart = cartItems.find(c => String(c.id) === String(item.id));
            const isAvailable = item.available !== false;
            const isVeg = item.veg === true;

            return `
                <div class="menu-card ${!isAvailable ? 'out-of-stock-card' : ''}" data-id="${item.id}">
                    <div class="menu-card-top">
                        <span class="diet-badge ${isVeg ? 'veg' : 'non-veg'}" title="${isVeg ? 'Vegetarian' : 'Non-Vegetarian'}">
                            <span class="diet-dot"></span>
                        </span>
                        <span class="menu-category-tag">${item.category}</span>
                        ${!isAvailable ? '<span class="stock-badge out">Sold Out</span>' : '<span class="stock-badge in">Available</span>'}
                    </div>

                    <div class="menu-card-body">
                        <h3 class="menu-item-name">${item.name}</h3>
                        <div class="menu-item-price">${API.formatCurrency(item.price)}</div>
                        <p class="menu-item-desc">${item.description || (isVeg ? 'Delicious vegetarian café specialty.' : 'Chef special non-veg preparation.')}</p>
                    </div>

                    <div class="menu-card-actions">
                        ${!isAvailable ? `
                            <button class="btn btn-disabled btn-block" disabled>Sold Out</button>
                        ` : inCart ? `
                            <div class="item-qty-selector">
                                <button class="btn-qty dec-btn" data-id="${item.id}" title="Decrease quantity">−</button>
                                <span class="qty-display">${inCart.qty} in cart</span>
                                <button class="btn-qty inc-btn" data-id="${item.id}" title="Increase quantity">+</button>
                            </div>
                        ` : `
                            <button class="btn btn-primary btn-block add-to-cart-btn" data-id="${item.id}">
                                + Add to Order
                            </button>
                        `}
                    </div>
                </div>
            `;
        }).join('');

        // Wire Add to Cart buttons
        container.querySelectorAll('.add-to-cart-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const item = allItems.find(i => String(i.id) === id);
                if (item) {
                    Cart.addItem(item);
                    App.showToast(`Added ${item.name} to order`, 'success');
                    renderItems();
                }
            });
        });

        // Wire + and - buttons directly on the cards
        container.querySelectorAll('.inc-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                Cart.changeQty(id, 1);
                renderItems();
            });
        });

        container.querySelectorAll('.dec-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                Cart.changeQty(id, -1);
                renderItems();
            });
        });
    }

    function setupSearchAndFilters() {
        const searchInput = document.getElementById('menu-search-input');
        const clearBtn = document.getElementById('clear-search-btn');
        const vegToggle = document.getElementById('veg-only-filter');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                if (clearBtn) {
                    clearBtn.classList.toggle('hidden', searchQuery.length === 0);
                }
                renderItems();
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                searchQuery = '';
                if (searchInput) searchInput.value = '';
                clearBtn.classList.add('hidden');
                renderItems();
            });
        }

        if (vegToggle) {
            vegToggle.addEventListener('change', (e) => {
                vegOnly = e.target.checked;
                renderItems();
            });
        }
    }

    async function init() {
        allItems = await API.getMenu();
        setupSearchAndFilters();
        renderFilters();
        renderItems();
    }

    return {
        init,
        renderItems,
        getAllItems: () => [...allItems]
    };
})();
