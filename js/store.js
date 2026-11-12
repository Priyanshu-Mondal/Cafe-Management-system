/* ==========================================================
   store.js · Shared data layer
   ----------------------------------------------------------
   Every section reads and writes the same data through Store.
   Data is saved to localStorage, so it survives navigation,
   page reloads, and even switching to another browser tab
   (the storage event refreshes the other tab automatically).
   ========================================================== */

const KEY = "quickserve-pos-v2";
const TAX_RATE = 0.05;          // 5% GST, assumption
const TABLE_COUNT = 15;
const STATUSES = ["Pending", "Preparing", "Ready", "Delivered"];
const NEXT_STATUS = { Pending: "Preparing", Preparing: "Ready", Ready: "Delivered" };

// Starting data. "img" can be set to any image URL; empty shows the icon tile.
const SEED = {
  menu: [
    { id: 1,  name: "Espresso",            category: "Coffee",    price: 80,  icon: "☕",  img: "" },
    { id: 2,  name: "Cappuccino",          category: "Coffee",    price: 150, icon: "☕",  img: "" },
    { id: 3,  name: "Café Latte",          category: "Coffee",    price: 170, icon: "🥛", img: "" },
    { id: 4,  name: "Cold Brew",           category: "Coffee",    price: 190, icon: "🧊", img: "" },
    { id: 5,  name: "Veg Club Sandwich",   category: "Snacks",    price: 180, icon: "🥪", img: "" },
    { id: 6,  name: "Chicken Wrap",        category: "Snacks",    price: 240, icon: "🌯", img: "" },
    { id: 7,  name: "Margherita Pizza",    category: "Snacks",    price: 320, icon: "🍕", img: "" },
    { id: 8,  name: "Masala Fries",        category: "Snacks",    price: 130, icon: "🍟", img: "" },
    { id: 9,  name: "Chocolate Brownie",   category: "Desserts",  price: 120, icon: "🍫", img: "" },
    { id: 10, name: "New York Cheesecake", category: "Desserts",  price: 220, icon: "🍰", img: "" },
    { id: 11, name: "Masala Chai",         category: "Beverages", price: 60,  icon: "🫖", img: "" },
    { id: 12, name: "Fresh Lime Soda",     category: "Beverages", price: 110, icon: "🍋", img: "" },
    { id: 13, name: "Orange Juice",        category: "Beverages", price: 140, icon: "🍊", img: "" },
  ],
  orders: [],                                   // { id, table, items[], total, status, paid, createdAt }
  bills: [],                                    // { id, table, items[], subtotal, discount, tax, total, method, createdAt }
  cart: { items: {}, table: null },             // items: { menuId: qty }
  billing: { table: null, discount: 0, method: "Cash" },
  nextOrderId: 1001,
  nextBillId: 501,
};

const clone = (obj) => JSON.parse(JSON.stringify(obj));

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return saved && saved.menu ? saved : clone(SEED);
  } catch {
    return clone(SEED);
  }
}

const Store = {
  data: loadData(),

  save() {
    localStorage.setItem(KEY, JSON.stringify(this.data));
  },

  // Every change goes through update(): change the data, save it, then re-render.
  update(mutate) {
    mutate(this.data);
    this.save();
    App.render();
  },

  reset() {
    this.data = clone(SEED);
    this.save();
    App.render();
  },

  menuItem(id) {
    return this.data.menu.find((m) => String(m.id) === String(id));
  },

  cartLines() {
    return Object.entries(this.data.cart.items)
      .map(([id, qty]) => ({ ...this.menuItem(id), id, qty }))
      .filter((line) => line.name);
  },

  openOrders(table) {
    return this.data.orders.filter((o) => o.table === table && !o.paid);
  },

  // A table is occupied while it has unpaid orders
  tables() {
    return Array.from({ length: TABLE_COUNT }, (_, i) => {
      const no = i + 1;
      const open = this.openOrders(no);
      return { no, open, status: open.length ? "occupied" : "available" };
    });
  },
};

// Shared maths used by the Cart preview and Billing
function calcTotals(items, discountPct = 0) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const discount = Math.round((subtotal * discountPct) / 100);
  const tax = Math.round((subtotal - discount) * TAX_RATE);
  return { subtotal, discount, tax, total: subtotal - discount + tax };
}

// Another tab changed the data: reload it and re-render
window.addEventListener("storage", (e) => {
  if (e.key === KEY) {
    Store.data = loadData();
    App.render();
  }
});