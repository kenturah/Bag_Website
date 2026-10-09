"use strict";
/* MAIN: tabs, product grid, product detail sheet, checkout sheets and start-up. Load this file last. */
// Tabs are built from the categories that actually have products, so a new category shows up by itself.
function tabList() {
  var preferred = ["Bags", "Accessories", "Appliances"];
  var cats = [];
  PRODUCTS.forEach(function (p) { if (cats.indexOf(p.category) === -1) cats.push(p.category); });
  cats.sort(function (a, b) {
    var ia = preferred.indexOf(a), ib = preferred.indexOf(b);
    if (ia === -1) ia = 99; if (ib === -1) ib = 99;
    return ia !== ib ? ia - ib : a.localeCompare(b);
  });
  return ["Home"].concat(cats, ["New", "Deals"]);
}

function matchesCategory(p) {
    if (state.category === "Home") return true;
    if (state.category === "New") return p.tag === "new";
    if (state.category === "Deals") return p.tag === "deal";
    return p.category === state.category;
  }

function filtered() {
    return PRODUCTS.filter(function (p) {
      var okCat = matchesCategory(p);
      var okQuery = !state.query || p.name.toLowerCase().indexOf(state.query.toLowerCase()) !== -1;
      return okCat && okQuery;
    });
  }

function goCategory(cat) {
    state.category = cat;
    state.query = "";
    document.getElementById("searchInput").value = "";
    renderTabs();
    renderProducts();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

window.goCategory = goCategory;

function renderTabs() {
    var el = document.getElementById("tabsInner");
    el.innerHTML = tabList().map(function (t) {
      return '<button class="tab' + (state.category === t ? " active" : "") + '" data-tab="' + esc(t) + '">' + esc(t) + "</button>";
    }).join("");
    el.querySelectorAll(".tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        goCategory(btn.getAttribute("data-tab"));
      });
    });
  }

function renderProducts() {
    var grid = document.getElementById("productGrid");
    var list = filtered();
    document.getElementById("hero").style.display = (state.category === "Home" && !state.query) ? "" : "none";
    document.getElementById("shopTitle").textContent = state.query ? "Results for \u201c" + state.query + "\u201d" : (state.category === "Home" ? "The collection" : state.category);

    if (list.length === 0) {
      grid.innerHTML = '<div class="empty-state"><h3>No products match that search</h3><p>Try a different keyword or tab.</p></div>';
      return;
    }

    grid.innerHTML = list.map(function (p) {
      var badge = p.tag === "new" ? '<span class="card-badge new">New</span>' : p.tag === "deal" ? '<span class="card-badge deal">Deal</span>' : "";
      var left = available(p);
      var soldOut = left <= 0;
      var stockClass = soldOut ? "out" : (left <= 3 ? "low" : "");
      var stockText = soldOut ? "Sold out" : (left <= 3 ? "Only " + left + " left" : left + " in stock");
      return (
        '<div class="card' + (soldOut ? " soldout" : "") + '" data-id="' + esc(p.id) + '">' +
          '<div class="card-media">' + badge + mediaFor(p) +
            '<button class="fab-add" data-id="' + esc(p.id) + '" aria-label="Add to cart"' + (soldOut ? " disabled" : "") + '>' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
            "</button>" +
          "</div>" +
          '<div class="card-info">' +
            '<div class="name">' + esc(p.name) + "</div>" +
            '<div class="price-row"><span class="price">' + p.price.toLocaleString("en-NG") + "</span>" +
              (p.was ? '<span class="was">' + p.was.toLocaleString("en-NG") + "</span>" : "") +
            "</div>" +
            '<div class="stock-line ' + stockClass + '">' + stockText + "</div>" +
          "</div>" +
        "</div>"
      );
    }).join("");

    grid.querySelectorAll(".card").forEach(function (cardEl) {
      cardEl.addEventListener("click", function (ev) {
        if (ev.target.closest(".fab-add")) return;
        openProductDetail(cardEl.getAttribute("data-id"));
      });
    });

    grid.querySelectorAll(".fab-add:not([disabled])").forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation(); // do not let this tap also open the product details
        addToCart(btn.getAttribute("data-id"));
        btn.classList.add("added");
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
        setTimeout(function () {
          renderProducts();
        }, 700);
      });
    });
  }

function openProductDetail(id) {
    var p = PRODUCTS.filter(function (pr) { return pr.id === id; })[0];
    if (!p) return;
    var left = available(p);
    var soldOut = left <= 0;
    var stockClass = soldOut ? "out" : (left <= 3 ? "low" : "");
    var stockText = soldOut ? "Sold out" : (left <= 3 ? "Only " + left + " left" : left + " in stock");
    var pickQty = soldOut ? 0 : 1;

    function bodyHtml(qty) {
      return (
        '<div class="pd-media">' + mediaFor(p) + "</div>" +
        '<div class="pd-name">' + esc(p.name) + "</div>" +
        '<div class="pd-price-row"><span class="price">' + money(p.price) + "</span>" +
          (p.was ? '<span class="was">' + money(p.was) + "</span>" : "") +
        "</div>" +
        '<p class="pd-desc">' + esc(describe(p)) + "</p>" +
        '<div class="pd-stock ' + stockClass + '">' + stockText + "</div>" +
        (soldOut ? "" : (
          '<div class="pd-qty-row">' +
            '<button class="qty-btn" id="pdDec"' + (qty <= 1 ? " disabled" : "") + '>−</button>' +
            '<span class="qty-val" id="pdQtyVal">' + qty + "</span>" +
            '<button class="qty-btn" id="pdInc"' + (qty >= p.stock ? " disabled" : "") + '>+</button>' +
          "</div>" +
          '<button class="sheet-cta primary" id="pdAddBtn">Add ' + qty + " to cart — " + money(p.price * qty) + "</button>"
        ))
      );
    }

    function wire(qty) {
      var dec = document.getElementById("pdDec");
      var inc = document.getElementById("pdInc");
      var addBtn = document.getElementById("pdAddBtn");
      if (dec) dec.addEventListener("click", function () { renderBody(Math.max(1, qty - 1)); });
      if (inc) inc.addEventListener("click", function () { renderBody(Math.min(p.stock, qty + 1)); });
      if (addBtn) addBtn.addEventListener("click", function () {
        addQtyToCart(p.id, qty);
        closeSheet();
        openCart();
      });
    }

    function renderBody(qty) {
      document.getElementById("infoSheetBody").innerHTML = bodyHtml(qty);
      wire(qty);
    }

    openSheet("", bodyHtml(pickQty));
    document.getElementById("infoSheetTitle").textContent = p.category;
    wire(pickQty);
  }

function openSheet(title, html) {
    document.getElementById("infoSheetTitle").textContent = title;
    document.getElementById("infoSheetBody").innerHTML = html;
    document.getElementById("infoSheet").classList.add("open");
    document.getElementById("overlay").classList.add("open");
  }

function closeSheet() {
    document.getElementById("infoSheet").classList.remove("open");
    document.getElementById("overlay").classList.remove("open");
  }

function closeAll() {
    closeCart();
    closeSheet();
  }

document.getElementById("localeBtn").addEventListener("click", function () {
    openSheet("Delivery &amp; Currency", (
      '<p>Right now ' + CONFIG.brandName + ' ships within <strong>Nigeria</strong> only, and all prices are shown in <strong>Naira (₦)</strong>.</p>' +
      '<div class="account-row"><span class="ic">📍</span> Lagos &amp; Ogun: delivered within the same week</div>' +
      '<div class="account-row"><span class="ic">🚚</span> Other states: delivered within 5 days</div>' +
      '<p style="margin-top:12px;">Have a question about delivering outside Nigeria? Ask us directly.</p>' +
      '<a class="sheet-cta wa" href="' + waLink("Hi " + CONFIG.brandName + ", do you deliver outside Nigeria?") + '" target="_blank" rel="noopener">Ask on WhatsApp</a>'
    ));
  });

document.getElementById("searchToggle").addEventListener("click", function () {
    var row = document.getElementById("searchRow");
    row.classList.toggle("open");
    if (row.classList.contains("open")) document.getElementById("searchInput").focus();
  });

document.getElementById("searchForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    state.query = document.getElementById("searchInput").value.trim();
    renderProducts();
  });

document.getElementById("drawerCloseBtn").addEventListener("click", closeCart);

document.getElementById("infoSheetCloseBtn").addEventListener("click", closeSheet);

document.getElementById("overlay").addEventListener("click", closeAll);

function openAccountSheet() {
    openSheet("Account", (
      '<div class="account-row"><span class="ic">👤</span> You\'re browsing as a guest — no account needed to order</div>' +
      '<div class="account-row"><span class="ic">📦</span> Order history isn\'t tracked here; ask us on WhatsApp anytime for a status update</div>' +
      '<div class="account-row"><span class="ic">📍</span> Delivery: Lagos &amp; Ogun same-week, nationwide within 5 days</div>' +
      '<a class="sheet-cta wa" href="' + waLink("Hi " + CONFIG.brandName + ", I'd like help with my account/order.") + '" target="_blank" rel="noopener" style="margin-top:14px;">Contact support</a>'
    ));
  }

document.getElementById("cartOpenBtn").addEventListener("click", openCart);

document.getElementById("accountBtn").addEventListener("click", openAccountSheet);

document.getElementById("footerAccountLink").addEventListener("click", openAccountSheet);

document.querySelectorAll(".footer-link[data-cat]").forEach(function (btn) {
    btn.addEventListener("click", function () { goCategory(btn.getAttribute("data-cat")); });
  });

var footerYearEl = document.getElementById("footerYear");

if (footerYearEl) footerYearEl.textContent = new Date().getFullYear();

document.getElementById("payWaBtn").addEventListener("click", function () {
    if (cartCount() === 0) return;
    if (sb && dbOnline) { startCheckout("cod"); return; }
    window.open(waLink(orderLines("Payment: on delivery")), "_blank");
    closeCart();
  });

document.getElementById("payTransferBtn").addEventListener("click", function () {
    if (cartCount() === 0) return;
    if (sb && dbOnline) { startCheckout("transfer"); return; }
    closeCart();
    openSheet("Pay by Bank Transfer", (
      '<p>Transfer <strong>' + money(cartTotal()) + '</strong> to the account below, then tap "I\'ve sent it" so we can confirm and start packing your order.</p>' +
      '<div class="bank-box">' +
        '<div class="bank-row"><span><span class="k">Account name</span><br><span class="v">' + CONFIG.bank.accountName + '</span></span></div>' +
        '<div class="bank-row"><span><span class="k">Account number</span><br><span class="v" id="acctNumVal">' + CONFIG.bank.accountNumber + '</span></span><button class="copy-btn" id="copyAcctBtn">Copy</button></div>' +
        '<div class="bank-row"><span><span class="k">Bank</span><br><span class="v">' + CONFIG.bank.bankName + '</span></span></div>' +
      "</div>" +
      '<a class="sheet-cta wa" href="' + waLink(orderLines("Payment: bank transfer — I have sent the money, here is my proof of payment")) + '" target="_blank" rel="noopener">I\'ve sent it — notify us</a>'
    ));
    var copyBtn = document.getElementById("copyAcctBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        try {
          navigator.clipboard.writeText(CONFIG.bank.accountNumber);
          copyBtn.textContent = "Copied";
          setTimeout(function () { copyBtn.textContent = "Copy"; }, 1200);
        } catch (e) { /* clipboard unavailable */ }
      });
    }
  });

document.getElementById("payCardBtn").addEventListener("click", function () {
    if (cartCount() === 0) return;
    if (sb && dbOnline && CONFIG.cardPaymentLink) { startCheckout("card"); return; }
    closeCart();
    if (CONFIG.cardPaymentLink) {
      openSheet("Pay with Card", (
        '<p>You\'ll be taken to our secure payment page to pay <strong>' + money(cartTotal()) + '</strong> by card. Once you\'ve paid, come back and let us know so we can confirm your order.</p>' +
        '<a class="sheet-cta primary" href="' + CONFIG.cardPaymentLink + '" target="_blank" rel="noopener">Pay ' + money(cartTotal()) + ' now</a>' +
        '<a class="sheet-cta wa" href="' + waLink(orderLines("Payment: card — I have completed payment on your payment page")) + '" target="_blank" rel="noopener" style="margin-top:8px;">I\'ve paid — notify us</a>'
      ));
    } else {
      openSheet("Pay with Card", (
        '<p>Card payment isn\'t available just yet. You can pay by bank transfer or on delivery, and we will confirm everything with you on WhatsApp.</p>' +
        '' +
        '<a class="sheet-cta wa" href="' + waLink(orderLines("Payment: card requested — please share payment options")) + '" target="_blank" rel="noopener">Ask us how to pay</a>'
      ));
    }
  });

document.getElementById("waFloat").href = waLink("Hi " + CONFIG.brandName + ", I'd like to ask about a product.");

document.getElementById("footerWaLink").href = waLink("Hi " + CONFIG.brandName + ", I have a question.");

document.querySelectorAll("[data-go]").forEach(function (b) {
    b.addEventListener("click", function () { goCategory(b.getAttribute("data-go")); });
  });

document.querySelectorAll("[data-brand]").forEach(function (el) { el.textContent = CONFIG.brandName; });
document.title = CONFIG.brandName + " \u2014 Bags & Home Appliances";

renderCart();
if (sb) {
  renderTabs();
  document.getElementById("productGrid").innerHTML = '<div class="empty-state"><h3>Loading products…</h3></div>';
  refreshProducts().then(function () { renderTabs(); renderProducts(); renderCart(); });
} else {
  renderTabs();
  renderProducts();
}
