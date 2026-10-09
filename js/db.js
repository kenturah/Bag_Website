"use strict";
/* DB: connects to Supabase, loads the live product list, and saves orders.
   If Supabase is not set up or cannot be reached, the shop quietly keeps using
   the product list built into products.js, so the site never goes blank. */

var sb = null;
try {
  if (window.supabase && CONFIG.supabaseUrl && CONFIG.supabaseKey) {
    sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
  }
} catch (e) { sb = null; }
if (!sb) {
  console.warn("Shop database is off, using the built-in product list. " +
    (!window.supabase ? "js/vendor/supabase.js did not load." : "supabaseUrl or supabaseKey is missing in js/config.js."));
}

var dbOnline = false; // true only after the product list was loaded from the database
var FALLBACK_PRODUCTS = PRODUCTS.slice(); // the list built into products.js

function defaultLook(category) {
  return category === "Appliances"
    ? { icon: "kettle", grad: ["#E9EBEA", "#D6DAD7"] }
    : { icon: "tote", grad: ["#EEEAE2", "#DFD5C2"] };
}

function rowToProduct(r) {
  var old = FALLBACK_PRODUCTS.filter(function (p) { return p.id === r.id; })[0];
  var look = old && old.icon ? { icon: old.icon, grad: old.grad } : defaultLook(r.category);
  return {
    id: r.id, name: r.name, category: r.category, price: r.price,
    was: r.was || undefined, tag: r.tag || null, stock: r.stock,
    img: r.image_url || null, description: r.description || "",
    icon: look.icon, grad: look.grad, created: r.created_at || ""
  };
}

// New products first (newest on top), then the original products in their original order.
function sortLikeStore(list) {
  var order = {};
  FALLBACK_PRODUCTS.forEach(function (p, i) { order[p.id] = i; });
  var known = function (p) { return Object.prototype.hasOwnProperty.call(order, p.id); };
  var fresh = list.filter(function (p) { return !known(p); })
    .sort(function (a, b) { return String(b.created).localeCompare(String(a.created)); });
  var old = list.filter(known).sort(function (a, b) { return order[a.id] - order[b.id]; });
  return fresh.concat(old);
}

// Remove sold-out or deleted products from the saved cart and trim quantities to stock.
function reconcileCart() {
  var changed = false;
  Object.keys(state.cart).forEach(function (id) {
    var p = PRODUCTS.filter(function (x) { return x.id === id; })[0];
    if (!p || p.stock <= 0) { delete state.cart[id]; changed = true; }
    else if (state.cart[id] > p.stock) { state.cart[id] = p.stock; changed = true; }
  });
  if (changed) persistCart();
}

// Always resolves: true if the live list was loaded, false if the built-in list is being used.
function refreshProducts() {
  if (!sb) return Promise.resolve(false);
  var timeout = new Promise(function (resolve) { setTimeout(function () { resolve({ timedOut: true }); }, 6000); });
  return Promise.race([sb.from("products").select("*").limit(1000), timeout]).then(function (res) {
    if (!res || res.timedOut || res.error || !Array.isArray(res.data) || res.data.length === 0) {
      dbOnline = false;
      return false;
    }
    PRODUCTS = sortLikeStore(res.data.map(rowToProduct));
    dbOnline = true;
    reconcileCart();
    if (tabList().indexOf(state.category) === -1) state.category = "Home";
    return true;
  }).catch(function () { dbOnline = false; return false; });
}

// Saves the order on the server. The server re-checks prices and stock itself.
function placeOrderRemote(c, method) {
  var items = Object.keys(state.cart).map(function (id) { return { id: id, qty: state.cart[id] }; });
  return Promise.resolve().then(function () {
    return sb.rpc("place_order", {
      p_name: c.name, p_phone: c.phone, p_email: c.email || "", p_address: c.address,
      p_state: c.state || "", p_note: c.note || "", p_payment_method: method, p_items: items
    });
  }).then(function (res) {
    if (res.error) throw new Error(res.error.message || "Could not place the order.");
    var row = Array.isArray(res.data) ? res.data[0] : res.data;
    if (!row || !row.out_order_number) throw new Error("Could not place the order.");
    return { number: row.out_order_number, total: row.out_total };
  });
}
