"use strict";
/* CHECKOUT: collects delivery details, saves the order in the database, then guides payment.
   Used only when the live database is connected (see db.js). Otherwise main.js keeps the
   original WhatsApp-only checkout. */

var CUSTOMER_KEY = "tn_customer";
var PAY_LABEL = { transfer: "bank transfer", cod: "pay on delivery", card: "card payment" };

function loadCustomer() {
  try { return JSON.parse(localStorage.getItem(CUSTOMER_KEY)) || {}; } catch (e) { return {}; }
}
function saveCustomer(c) {
  try {
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name: c.name, phone: c.phone, email: c.email, address: c.address, state: c.state }));
  } catch (e) { /* ignore */ }
}

function coField(label, name, type, value, optional, extra) {
  var input = type === "textarea"
    ? '<textarea id="co_' + name + '" name="' + name + '" autocomplete="' + (extra || "off") + '">' + esc(value || "") + "</textarea>"
    : '<input id="co_' + name + '" name="' + name + '" type="' + type + '" value="' + esc(value || "") + '" autocomplete="' + (extra || "off") + '">';
  return '<div class="field"><label for="co_' + name + '">' + label + (optional ? ' <span class="opt">(optional)</span>' : "") + "</label>" + input + "</div>";
}

function checkoutFormHtml(method) {
  var c = loadCustomer();
  return (
    "<p>Tell us where to deliver. You pay for " + esc(PAY_LABEL[method]) + " after this step, and we confirm your delivery fee on WhatsApp before you pay for delivery.</p>" +
    '<form id="checkoutForm" class="co-form" novalidate>' +
      coField("Full name", "name", "text", c.name, false, "name") +
      coField("Phone number", "phone", "tel", c.phone, false, "tel") +
      coField("Email", "email", "email", c.email, true, "email") +
      coField("State", "state", "text", c.state, true, "address-level1") +
      coField("Delivery address", "address", "textarea", c.address, false, "street-address") +
      coField("Note for us", "note", "text", "", true) +
      '<div class="form-error" id="coError" role="alert"></div>' +
      '<button type="submit" class="sheet-cta primary" id="coSubmit">Place order · ' + money(cartTotal()) + "</button>" +
    "</form>"
  );
}

function readCheckoutForm() {
  var f = document.getElementById("checkoutForm");
  function v(n) { return f.elements[n].value.trim(); }
  return { name: v("name"), phone: v("phone"), email: v("email"), state: v("state"), address: v("address"), note: v("note") };
}

function validateCheckout(c) {
  if (c.name.length < 2) return "Please enter your full name.";
  if (c.phone.replace(/\D/g, "").length < 10) return "Please enter a valid phone number, for example 0801 234 5678.";
  if (c.email && c.email.indexOf("@") < 1) return "That email address does not look right.";
  if (c.address.length < 6) return "Please enter your full delivery address.";
  return "";
}

function orderMessage(order, entries, c, paymentLine) {
  var lines = ["Hello " + CONFIG.brandName + ", I just placed order " + order.number + ":"];
  entries.forEach(function (e) { lines.push("• " + e.name + " x" + e.qty + " — " + money(e.price * e.qty)); });
  lines.push("", "Items total: " + money(order.total), "Payment: " + paymentLine, "",
    "Name: " + c.name, "Phone: " + c.phone,
    "Delivery address: " + c.address + (c.state ? ", " + c.state : ""), "",
    "Please confirm my delivery fee.");
  return lines.join("\n");
}

function friendlyOrderError(msg) {
  if (/failed to fetch|network|load failed|timeout/i.test(msg)) {
    return "We could not reach the shop just now. Check your internet connection and try again.";
  }
  return msg;
}

function startCheckout(method) {
  if (cartCount() === 0) return;
  closeCart();
  openSheet("Delivery details", checkoutFormHtml(method));
  var form = document.getElementById("checkoutForm");
  var errEl = document.getElementById("coError");
  var btn = document.getElementById("coSubmit");
  var label = btn.textContent;

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var c = readCheckoutForm();
    var problem = validateCheckout(c);
    if (problem) { errEl.textContent = problem; return; }
    errEl.textContent = "";
    btn.disabled = true;
    btn.textContent = "Placing your order…";
    var entries = cartEntries().map(function (e) { return { name: e.product.name, qty: e.qty, price: e.product.price }; });

    placeOrderRemote(c, method).then(function (order) {
      saveCustomer(c);
      try { localStorage.setItem("tn_last_order", order.number); } catch (e) { /* ignore */ }
      state.cart = {};
      persistCart();
      renderCart();
      showOrderPlaced(method, order, entries, c);
      refreshProducts().then(function () { renderTabs(); renderProducts(); });
    }).catch(function (e) {
      btn.disabled = false;
      btn.textContent = label;
      errEl.textContent = friendlyOrderError(e.message || "Something went wrong.");
      // The stock may have changed while the shopper was browsing.
      refreshProducts().then(function () { renderTabs(); renderProducts(); renderCart(); });
    });
  });
}

function showOrderPlaced(method, order, entries, c) {
  var html =
    '<div class="order-done"><div class="order-no">' + esc(order.number) + "</div>" +
    "<p>Your order has been placed. Keep this number: you will need it for any question about your order.</p></div>" +
    '<div class="bank-box"><div class="bank-row"><span><span class="k">Items total</span><br><span class="v">' + money(order.total) +
    '</span></span></div><div class="bank-row"><span><span class="k">Delivery</span><br><span class="v">Quoted on WhatsApp</span></span></div></div>';

  if (method === "transfer") {
    html +=
      "<p>Transfer the items total to the account below, then tap the button so we can confirm and start packing.</p>" +
      '<div class="bank-box">' +
        '<div class="bank-row"><span><span class="k">Account name</span><br><span class="v">' + esc(CONFIG.bank.accountName) + "</span></span></div>" +
        '<div class="bank-row"><span><span class="k">Account number</span><br><span class="v">' + esc(CONFIG.bank.accountNumber) + '</span></span><button class="copy-btn" id="copyAcctBtn">Copy</button></div>' +
        '<div class="bank-row"><span><span class="k">Bank</span><br><span class="v">' + esc(CONFIG.bank.bankName) + "</span></span></div>" +
      "</div>" +
      '<a class="sheet-cta wa" href="' + esc(waLink(orderMessage(order, entries, c, "bank transfer, I have sent the money. Here is my proof of payment"))) + '" target="_blank" rel="noopener">I have sent it, notify us</a>';
  } else if (method === "card") {
    html +=
      "<p>Pay by card on our secure payment page, then tell us so we can confirm.</p>" +
      '<a class="sheet-cta primary" href="' + esc(CONFIG.cardPaymentLink) + '" target="_blank" rel="noopener">Pay ' + money(order.total) + " now</a>" +
      '<a class="sheet-cta wa" href="' + esc(waLink(orderMessage(order, entries, c, "card, I have completed payment"))) + '" target="_blank" rel="noopener" style="margin-top:8px;">I have paid, notify us</a>';
  } else {
    html +=
      "<p>You will pay on delivery. Tap below and we will confirm your delivery fee and delivery time on WhatsApp.</p>" +
      '<a class="sheet-cta wa" href="' + esc(waLink(orderMessage(order, entries, c, "pay on delivery"))) + '" target="_blank" rel="noopener">Confirm on WhatsApp</a>';
  }

  html += '<a class="track-link" href="track.html?order=' + encodeURIComponent(order.number) + '">Track this order</a>';

  openSheet("Order placed", html);
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
}
