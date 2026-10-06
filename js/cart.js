"use strict";
/* CART: cart state (saved in the browser), totals, cart drawer and WhatsApp order messages. */
var state = { category: "Home", query: "", cart: {} };

try {
    var saved = localStorage.getItem("totenest_cart");
    if (saved) state.cart = JSON.parse(saved);
  } catch (e) { /* start empty */ }

function money(n) { return "₦" + n.toLocaleString("en-NG"); }

function available(p) {
    return p.stock - (state.cart[p.id] || 0);
  }

function addToCart(id) {
    var product = PRODUCTS.filter(function (p) { return p.id === id; })[0];
    if (!product || available(product) <= 0) return;
    state.cart[id] = (state.cart[id] || 0) + 1;
    persistCart();
    renderCart();
  }

function addQtyToCart(id, qty) {
    var product = PRODUCTS.filter(function (p) { return p.id === id; })[0];
    if (!product) return;
    var current = state.cart[id] || 0;
    var max = product.stock;
    var next = current + qty;
    if (next > max) next = max;
    if (next <= 0) delete state.cart[id]; else state.cart[id] = next;
    persistCart();
    renderCart();
    renderProducts();
  }

function setQty(id, qty) {
    var product = PRODUCTS.filter(function (p) { return p.id === id; })[0];
    var max = product ? product.stock : Infinity;
    if (qty > max) qty = max;
    if (qty <= 0) delete state.cart[id]; else state.cart[id] = qty;
    persistCart();
    renderCart();
    renderProducts();
  }

function persistCart() {
    try { localStorage.setItem("totenest_cart", JSON.stringify(state.cart)); } catch (e) {}
  }

function cartEntries() {
    return Object.keys(state.cart).map(function (id) {
      var product = PRODUCTS.filter(function (p) { return p.id === id; })[0];
      return product ? { product: product, qty: state.cart[id] } : null;
    }).filter(Boolean);
  }

function cartTotal() { return cartEntries().reduce(function (s, e) { return s + e.product.price * e.qty; }, 0); }

function cartCount() { return cartEntries().reduce(function (s, e) { return s + e.qty; }, 0); }

function renderCart() {
    var count = cartCount();
    var badge = document.getElementById("cartBadge");
    badge.style.display = count > 0 ? "flex" : "none";
    badge.textContent = count;
    document.getElementById("cartTotal").textContent = money(cartTotal());

    var itemsEl = document.getElementById("drawerItems");
    var entries = cartEntries();
    if (entries.length === 0) {
      itemsEl.innerHTML = '<div class="empty-state" style="padding:30px 0;"><h3>Your cart is empty</h3><p>Tap the + on any item to add it.</p></div>';
      return;
    }
    itemsEl.innerHTML = entries.map(function (e) {
      var atMax = e.qty >= e.product.stock;
      return (
        '<div class="drawer-item" data-id="' + e.product.id + '">' +
          '<div class="thumb">' + mediaFor(e.product) + "</div>" +
          '<div class="info">' +
            '<div class="name">' + e.product.name + "</div>" +
            '<div class="unit">' + money(e.product.price) + " each" + (atMax ? " · max in stock" : "") + "</div>" +
            '<div class="qty-row">' +
              '<button class="qty-btn" data-action="dec">−</button>' +
              '<span class="qty-val">' + e.qty + "</span>" +
              '<button class="qty-btn" data-action="inc"' + (atMax ? " disabled" : "") + '>+</button>' +
              '<button class="remove-link" data-action="remove">Remove</button>' +
            "</div>" +
          "</div>" +
        "</div>"
      );
    }).join("");
    itemsEl.querySelectorAll(".drawer-item").forEach(function (row) {
      var id = row.getAttribute("data-id");
      var current = state.cart[id];
      row.querySelector('[data-action="inc"]').addEventListener("click", function () { setQty(id, current + 1); });
      row.querySelector('[data-action="dec"]').addEventListener("click", function () { setQty(id, current - 1); });
      row.querySelector('[data-action="remove"]').addEventListener("click", function () { setQty(id, 0); });
    });
  }

function openCart() {
    document.getElementById("cartDrawer").classList.add("open");
    document.getElementById("overlay").classList.add("open");
  }

function closeCart() {
    document.getElementById("cartDrawer").classList.remove("open");
    document.getElementById("overlay").classList.remove("open");
  }

function waLink(text) {
    return "https://wa.me/" + CONFIG.whatsappNumber + (text ? "?text=" + encodeURIComponent(text) : "");
  }

function orderLines(note) {
    var lines = ["Hello " + CONFIG.brandName + ", I'd like to order:"];
    cartEntries().forEach(function (e) {
      lines.push("• " + e.product.name + " x" + e.qty + " — " + money(e.product.price * e.qty));
    });
    lines.push("", "Total: " + money(cartTotal()));
    if (note) lines.push("", note);
    lines.push("", "Name: ", "Delivery address: ");
    return lines.join("\n");
  }
