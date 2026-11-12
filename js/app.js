/* ==========================================================
   app.js · Routing, sections, and actions
   ----------------------------------------------------------
   Sections: Dashboard · Menu · Cart · Orders · Kitchen
             Tables · Billing
   Each section is a view function that returns HTML from Store.
   Actions change data through Store.update(), so every section
   stays in sync automatically.
   ========================================================== */

/* ---------- Helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const D = () => Store.data;
const money = (n) => "₹" + Number(n).toLocaleString("en-IN");
const esc = (text) => String(text).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const timeOf = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const pill = (status) => `<span class="pill p-${status}">${status}</span>`;
const itemImage = (item) =>
  item.img ? `<img src="${esc(item.img)}" alt="${esc(item.name)}">` : `<div class="tile">${item.icon || "🍽️"}</div>`;

// Filters are view-only, so they are kept here rather than in saved data
const ui = { category: "All", q: "", orderFilter: "All" };

let toastTimer;
function toast(message, type = "") {
  const el = $("#toast");
  el.textContent = message;
  el.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

// Combine several orders into one list of items (same name and price are merged)
function mergeItems(orders) {
  const map = {};
  orders.forEach((o) => o.items.forEach((i) => {
    const key = `${i.name}|${i.price}`;
    map[key] = map[key] ? { ...map[key], qty: map[key].qty + i.qty } : { ...i };
  }));
  return Object.values(map);
}

/* ---------- 1. Dashboard ---------- */
function viewDashboard() {
  const today = new Date().toDateString();
  const salesToday = D().bills
    .filter((b) => new Date(b.createdAt).toDateString() === today)
    .reduce((sum, b) => sum + b.total, 0);
  const pending = D().orders.filter((o) => o.status === "Pending").length;
  const available = Store.tables().filter((t) => t.status === "available").length;

  const stats = [
    ["📋", "Total orders", D().orders.length, "grad-brand"],
    ["💰", "Sales today", money(salesToday), "grad-warm"],
    ["🪑", "Available tables", `${available} / 15`, "grad-cool"],
    ["⏳", "Pending orders", pending, "grad-mint"],
  ];

  const recent = [...D().orders].reverse().slice(0, 6);
  const total = D().orders.length || 1;
  const bars = STATUSES.map((s) => {
    const n = D().orders.filter((o) => o.status === s).length;
    return `<div class="bar-row"><span>${pill(s)}</span>
      <div class="bar"><i style="width:${Math.round((n / total) * 100)}%"></i></div><b>${n}</b></div>`;
  }).join("");

  return `
  <div class="stats">
    ${stats.map(([icon, label, value, grad]) => `
      <div class="stat ${grad}"><span class="stat-icon">${icon}</span>
        <div><small>${label}</small><strong>${value}</strong></div></div>`).join("")}
  </div>
  <div class="split">
    <section class="card recent">
      <h2>Recent orders</h2>
      ${recent.length ? `<ul>${recent.map((o) => `
        <li><span><b>#${o.id}</b> · Table ${o.table} · ${o.items.reduce((s, i) => s + i.qty, 0)} items</span>${pill(o.status)}</li>`).join("")}</ul>`
        : `<p class="empty">No orders yet. Start from the Menu.</p>`}
    </section>
    <aside class="card">
      <h2>Order status</h2>
      ${bars}
      <div style="margin-top:18px;display:grid;gap:8px">
        <a class="btn" href="#/menu">Take an order</a>
        <a class="btn outline" href="#/kitchen">Open kitchen</a>
        <a class="btn outline" href="#/billing">Go to billing</a>
      </div>
    </aside>
  </div>`;
}

/* ---------- 2. Menu ---------- */
function viewMenu() {
  const cats = ["All", ...new Set(D().menu.map((m) => m.category))];
  return `
  <div class="toolbar">
    <div class="chips">${cats.map((c) =>
      `<button class="chip ${c === ui.category ? "on" : ""}" data-act="cat" data-v="${esc(c)}">${esc(c)}</button>`).join("")}</div>
    <input id="search" class="input" type="search" placeholder="Search items…" value="${esc(ui.q)}" aria-label="Search menu">
  </div>
  <div class="grid" id="grid">${menuCards()}</div>`;
}

function menuCards() {
  const q = ui.q.trim().toLowerCase();
  const items = D().menu.filter((m) =>
    (ui.category === "All" || m.category === ui.category) && m.name.toLowerCase().includes(q));
  if (!items.length) return `<p class="empty">No items match your search.</p>`;

  return items.map((m) => {
    const inCart = D().cart.items[m.id] || 0;
    return `
    <article class="menu-card">
      <div class="media">${itemImage(m)}</div>
      <div class="body">
        <span class="tag">${esc(m.category)}</span>
        <h3>${esc(m.name)}</h3>
        <div class="row">
          <strong class="price">${money(m.price)}</strong>
          <button class="btn small ${inCart ? "ok" : ""}" style="width:auto;margin:0"
            data-act="add" data-v="${m.id}">${inCart ? `In cart · ${inCart}` : "Add to cart"}</button>
        </div>
      </div>
    </article>`;
  }).join("");
}

/* ---------- 3. Cart ---------- */
function viewCart() {
  const lines = Store.cartLines();
  if (!lines.length) {
    return `<div class="card empty-state">
      <p>Your cart is empty.</p>
      <a class="btn" href="#/menu">Browse the menu</a></div>`;
  }
  const t = calcTotals(lines);
  const table = D().cart.table;

  return `
  <div class="split">
    <section class="card">
      <h2>Selected items</h2>
      ${lines.map((l) => `
        <div class="line">
          <div class="line-media">${itemImage(l)}</div>
          <div class="grow"><strong>${esc(l.name)}</strong><small>${money(l.price)} each</small></div>
          <div class="stepper">
            <button data-act="dec" data-v="${l.id}" aria-label="Decrease">−</button>
            <span>${l.qty}</span>
            <button data-act="inc" data-v="${l.id}" aria-label="Increase">+</button>
          </div>
          <strong class="amt">${money(l.price * l.qty)}</strong>
          <button class="icon-btn" data-act="remove" data-v="${l.id}" aria-label="Remove ${esc(l.name)}">✕</button>
        </div>`).join("")}
    </section>

    <aside class="card summary">
      <h2>Order summary</h2>
      <label class="field">Table
        <select class="input" data-input="cart-table">
          <option value="">Choose a table…</option>
          ${Store.tables().map((tb) => `<option value="${tb.no}" ${table === tb.no ? "selected" : ""}>
            Table ${tb.no}${tb.status === "occupied" ? " (has open order)" : ""}</option>`).join("")}
        </select>
      </label>
      <div class="row"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
      <div class="row"><span>GST (5%)</span><span>${money(t.tax)}</span></div>
      <div class="row total"><span>Total</span><span>${money(t.total)}</span></div>
      <button class="btn big" data-act="place">Place order</button>
      <button class="btn outline" data-act="clear-cart">Clear cart</button>
    </aside>
  </div>`;
}

function placeOrder() {
  const lines = Store.cartLines();
  if (!D().cart.table) return toast("Choose a table first", "error");
  if (!lines.length) return toast("Your cart is empty", "error");

  let id;
  Store.update((x) => {
    id = x.nextOrderId++;
    x.orders.push({
      id,
      table: x.cart.table,
      items: lines.map(({ name, price, qty }) => ({ name, price, qty })),
      total: lines.reduce((s, l) => s + l.price * l.qty, 0), // before tax
      status: "Pending",
      paid: false,
      createdAt: Date.now(),
    });
    x.cart = { items: {}, table: null };
  });
  toast(`Order #${id} sent to the kitchen`);
  location.hash = "#/kitchen";
}

/* ---------- 4. Orders ---------- */
function viewOrders() {
  const list = [...D().orders].reverse()
    .filter((o) => ui.orderFilter === "All" || o.status === ui.orderFilter);

  return `
  <div class="toolbar">
    <select class="input" data-input="order-filter" aria-label="Filter by status">
      ${["All", ...STATUSES].map((s) => `<option ${s === ui.orderFilter ? "selected" : ""}>${s}</option>`).join("")}
    </select>
    <span class="muted">${list.length} order(s)</span>
  </div>
  <section class="card">
    ${list.length ? `
    <div class="table-wrap"><table>
      <thead><tr><th>Order</th><th>Table</th><th>Items</th><th>Subtotal</th><th>Status</th><th>Billing</th><th>Time</th></tr></thead>
      <tbody>${list.map((o) => `
        <tr>
          <td><strong>#${o.id}</strong></td>
          <td>T${o.table}</td>
          <td class="items-cell">${o.items.map((i) => `${i.qty}× ${esc(i.name)}`).join(", ")}</td>
          <td>${money(o.total)}</td>
          <td>${pill(o.status)}</td>
          <td>${o.paid ? '<span class="pill p-Ready">Paid</span>' : '<span class="pill p-Pending">Unpaid</span>'}</td>
          <td>${timeOf(o.createdAt)}</td>
        </tr>`).join("")}</tbody>
    </table></div>`
    : `<p class="empty">No orders match this filter.</p>`}
  </section>`;
}

/* ---------- 5. Kitchen ---------- */
const KITCHEN_ACTION = { Pending: "Start preparing", Preparing: "Mark ready", Ready: "Mark delivered" };

function viewKitchen() {
  const columns = STATUSES.map((status) => {
    let list = D().orders.filter((o) => o.status === status);
    if (status === "Delivered") list = list.slice(-6).reverse(); // show the latest 6 only
    return `
    <div class="col" data-status="${status}">
      <div class="col-head">${pill(status)}<span>${list.length}</span></div>
      ${list.length ? list.map((o) => `
        <article class="ticket-card">
          <div class="row"><strong>Table ${o.table}</strong><small>#${o.id} · ${timeOf(o.createdAt)}</small></div>
          <ul>${o.items.map((i) => `<li>${i.qty} × ${esc(i.name)}</li>`).join("")}</ul>
          ${NEXT_STATUS[o.status] ? `<button class="btn small" data-act="advance" data-v="${o.id}">${KITCHEN_ACTION[o.status]}</button>` : ""}
        </article>`).join("")
        : `<p class="empty">No orders</p>`}
    </div>`;
  }).join("");
  return `<div class="kanban">${columns}</div>`;
}

function advanceOrder(id) {
  Store.update((x) => {
    const order = x.orders.find((o) => o.id === Number(id));
    if (order && NEXT_STATUS[order.status]) order.status = NEXT_STATUS[order.status];
  });
  toast(`Order #${id} updated`);
}

/* ---------- 6. Tables ---------- */
function viewTables() {
  const selected = D().cart.table;
  return `
  <div class="legend">
    <span><i class="dot d-available"></i>Available</span>
    <span><i class="dot d-occupied"></i>Occupied</span>
    <span><i class="dot d-selected"></i>Selected</span>
  </div>
  <div class="tables-grid">
    ${Store.tables().map((t) => {
      const cls = selected === t.no ? "selected" : t.status;
      const total = t.open.reduce((s, o) => s + o.total, 0);
      const label = cls === "selected" ? "Selected"
        : cls === "occupied" ? `${t.open.length} open · ${money(total)}` : "Available";
      return `<button class="table-tile ${cls}" data-act="select-table" data-v="${t.no}"
        aria-pressed="${cls === "selected"}"><strong>T${t.no}</strong><small>${label}</small></button>`;
    }).join("")}
  </div>
  <p class="hint">Tap a table to select it for a new order (tap again to clear). Close occupied tables from Billing.</p>`;
}

/* ---------- 7. Billing ---------- */
function viewBilling() {
  const b = D().billing;
  const occupied = Store.tables().filter((t) => t.status === "occupied");
  const items = b.table ? mergeItems(Store.openOrders(b.table)) : [];
  const t = calcTotals(items, b.discount);

  return `
  <div class="split">
    <section class="card">
      <h2>Tables with open bills</h2>
      ${occupied.length ? `<div class="list">${occupied.map((tb) => `
        <button class="list-btn ${tb.no === b.table ? "on" : ""}" data-act="bill-table" data-v="${tb.no}">
          <span>Table ${tb.no}</span>
          <small>${tb.open.length} order(s)</small>
          <strong>${money(tb.open.reduce((s, o) => s + o.total, 0))}</strong>
        </button>`).join("")}</div>`
        : `<p class="empty">No tables with open bills.</p>`}
    </section>

    <aside class="card summary">
      <h2>${b.table ? `Bill · Table ${b.table}` : "Choose a table"}</h2>
      ${b.table && items.length ? `
        <ul class="bill-items">${items.map((i) => `
          <li><span>${i.qty} × ${esc(i.name)}</span><span>${money(i.price * i.qty)}</span></li>`).join("")}</ul>
        <label class="field">Discount (%)
          <input class="input" type="number" min="0" max="100" value="${b.discount}" data-input="bill-discount">
        </label>
        <label class="field">Payment method
          <select class="input" data-input="bill-method">
            ${["Cash", "Card", "UPI"].map((m) => `<option ${m === b.method ? "selected" : ""}>${m}</option>`).join("")}
          </select>
        </label>
        <div class="row"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
        <div class="row"><span>Discount</span><span>− ${money(t.discount)}</span></div>
        <div class="row"><span>Tax (5%)</span><span>${money(t.tax)}</span></div>
        <div class="row total"><span>Grand total</span><span>${money(t.total)}</span></div>
        <button class="btn big" data-act="generate-bill">Generate bill &amp; free table</button>`
      : `<p class="empty">Select a table on the left to prepare its bill.</p>`}
    </aside>
  </div>

  <section class="card" style="margin-top:20px">
    <h2>Bill history</h2>
    ${D().bills.length ? `
    <div class="table-wrap"><table>
      <thead><tr><th>Bill</th><th>Table</th><th>Subtotal</th><th>Discount</th><th>Tax</th><th>Total</th><th>Payment</th><th>Time</th><th></th></tr></thead>
      <tbody>${D().bills.map((x) => `
        <tr>
          <td><strong>#${x.id}</strong></td><td>T${x.table}</td><td>${money(x.subtotal)}</td>
          <td>${money(x.discount)}</td><td>${money(x.tax)}</td><td><strong>${money(x.total)}</strong></td>
          <td>${x.method}</td><td>${timeOf(x.createdAt)}</td>
          <td><button class="btn small" style="width:auto;margin:0" data-act="print-bill" data-v="${x.id}">Print</button></td>
        </tr>`).join("")}</tbody>
    </table></div>`
    : `<p class="empty">No bills yet.</p>`}
  </section>`;
}

function generateBill() {
  const b = D().billing;
  const open = Store.openOrders(b.table);
  if (!open.length) return toast("This table has no open orders", "error");

  const items = mergeItems(open);
  const totals = calcTotals(items, b.discount);
  Store.update((x) => {
    x.bills.unshift({
      id: x.nextBillId++, table: b.table, items, ...totals,
      method: b.method, createdAt: Date.now(),
    });
    x.orders.forEach((o) => { if (o.table === b.table && !o.paid) o.paid = true; });
    x.billing = { table: null, discount: 0, method: b.method };
  });
  toast(`Bill paid · ${money(totals.total)} · Table ${b.table} is free`);
}

// Opens a printable bill in a new window
function printBill(id) {
  const b = D().bills.find((x) => x.id === Number(id));
  if (!b) return;
  const w = window.open("", "_blank", "width=380,height=640");
  if (!w) return toast("Allow pop-ups to print bills", "error");
  w.document.write(`<!DOCTYPE html><html><head><title>Bill #${b.id}</title>
    <style>body{font-family:Arial,sans-serif;max-width:320px;margin:24px auto;padding:0 12px}
    .r{display:flex;justify-content:space-between;margin:4px 0}hr{border:0;border-top:1px dashed #999;margin:10px 0}
    h2,p{text-align:center;margin:4px 0}</style></head><body>
    <h2>QuickServe</h2><p>Bill #${b.id} · Table ${b.table}</p><p>${new Date(b.createdAt).toLocaleString()}</p><hr>
    ${b.items.map((i) => `<div class="r"><span>${i.qty} × ${esc(i.name)}</span><span>${money(i.price * i.qty)}</span></div>`).join("")}
    <hr>
    <div class="r"><span>Subtotal</span><span>${money(b.subtotal)}</span></div>
    <div class="r"><span>Discount</span><span>− ${money(b.discount)}</span></div>
    <div class="r"><span>Tax (5%)</span><span>${money(b.tax)}</span></div>
    <hr>
    <div class="r"><b>Total</b><b>${money(b.total)}</b></div>
    <p>Paid by ${esc(b.method)}. Thank you!</p>
    </body></html>`);
  w.document.close();
  w.print();
}

/* ---------- Routing ---------- */
const ROUTES = {
  dashboard: { title: "Dashboard", view: viewDashboard },
  menu:      { title: "Menu", view: viewMenu },
  cart:      { title: "Cart", view: viewCart },
  orders:    { title: "Orders", view: viewOrders },
  kitchen:   { title: "Kitchen", view: viewKitchen },
  tables:    { title: "Tables", view: viewTables },
  billing:   { title: "Billing", view: viewBilling },
};

const App = {
  render() {
    const requested = location.hash.replace("#/", "") || "dashboard";
    const key = ROUTES[requested] ? requested : "dashboard";

    $("#title").textContent = ROUTES[key].title;
    $("#app").innerHTML = ROUTES[key].view();
    $("#date").textContent = new Date().toLocaleDateString(undefined,
      { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    document.querySelectorAll("[data-route]").forEach((a) =>
      a.classList.toggle("active", a.dataset.route === key));
    this.setBadge("cart", Object.values(D().cart.items).reduce((s, q) => s + q, 0));
    this.setBadge("kitchen", D().orders.filter((o) => o.status !== "Delivered").length);
  },

  setBadge(name, count) {
    const el = document.querySelector(`[data-badge="${name}"]`);
    el.textContent = count || "";
  },
};

/* ---------- Events (one listener per event type) ---------- */
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const { act, v } = el.dataset;

  const actions = {
    cat:            () => { ui.category = v; App.render(); },
    add:            () => { Store.update((x) => { x.cart.items[v] = (x.cart.items[v] || 0) + 1; });
                            toast(`${Store.menuItem(v).name} added to cart`); },
    inc:            () => Store.update((x) => { x.cart.items[v] = (x.cart.items[v] || 0) + 1; }),
    dec:            () => Store.update((x) => {
                      const qty = (x.cart.items[v] || 0) - 1;
                      if (qty > 0) x.cart.items[v] = qty; else delete x.cart.items[v]; }),
    remove:         () => Store.update((x) => { delete x.cart.items[v]; }),
    "clear-cart":   () => Store.update((x) => { x.cart.items = {}; }),
    place:          () => placeOrder(),
    advance:        () => advanceOrder(v),
    "select-table": () => Store.update((x) => {
                      x.cart.table = x.cart.table === Number(v) ? null : Number(v); }),
    "bill-table":   () => Store.update((x) => { x.billing.table = Number(v); x.billing.discount = 0; }),
    "generate-bill":() => generateBill(),
    "print-bill":   () => printBill(v),
    reset:          () => { if (confirm("Reset all demo data? This cannot be undone.")) Store.reset(); },
  };

  if (actions[act]) actions[act]();
});

document.addEventListener("input", (e) => {
  if (e.target.id === "search") {
    ui.q = e.target.value;
    $("#grid").innerHTML = menuCards(); // updates results without losing focus
  }
});

document.addEventListener("change", (e) => {
  const el = e.target;
  const key = el.dataset.input;
  const inputs = {
    "cart-table":    () => Store.update((x) => { x.cart.table = el.value ? Number(el.value) : null; }),
    "bill-discount": () => Store.update((x) => {
                      x.billing.discount = Math.min(100, Math.max(0, Number(el.value) || 0)); }),
    "bill-method":   () => Store.update((x) => { x.billing.method = el.value; }),
    "order-filter":  () => { ui.orderFilter = el.value; App.render(); },
  };
  if (inputs[key]) inputs[key]();
});

window.addEventListener("hashchange", () => App.render());

// Start-up
App.render();