"use strict";
/* TRACK: lets a customer see their order status using the order number and the phone number
   they ordered with. No account needed. The database function `track_order` only answers when
   both match, and it returns only what the customer should see. */
(function () {
  var STEPS = [["placed", "Order placed"], ["confirmed", "Confirmed"], ["packed", "Packed"], ["out_for_delivery", "Out for delivery"], ["delivered", "Delivered"]];
  var STATUS_TEXT = {
    placed: "We have your order and will confirm it shortly.",
    confirmed: "Your order is confirmed.",
    packed: "Your order is packed and ready for dispatch.",
    out_for_delivery: "Your order is on its way to you.",
    delivered: "Your order has been delivered. Thank you!",
    cancelled: "This order was cancelled."
  };
  var PAY_TEXT = { unpaid: "Not paid yet", paid: "Paid", refunded: "Refunded" };

  var form = document.getElementById("trackForm");
  var out = document.getElementById("trackResult");
  var errEl = document.getElementById("trError");
  var btn = document.getElementById("trBtn");
  var sbc = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function money(n) { return "₦" + Number(n || 0).toLocaleString("en-NG"); }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return ""; }
  }
  function safeUrl(u) { return /^https?:\/\//i.test(u || "") ? u : ""; }
  function label(key) { var m = STEPS.filter(function (s) { return s[0] === key; })[0]; return m ? m[1] : (key === "cancelled" ? "Cancelled" : key); }
  function waHelp(no) {
    var text = "Hello " + CONFIG.brandName + ", I am asking about my order " + no + ".";
    return "https://wa.me/" + String(CONFIG.whatsappNumber).replace(/\D/g, "") + "?text=" + encodeURIComponent(text);
  }

  function render(o) {
    var cancelled = o.status === "cancelled";
    var idx = STEPS.map(function (s) { return s[0]; }).indexOf(o.status);
    var steps = cancelled
      ? '<div class="tr-cancel">This order was cancelled.</div>'
      : '<ol class="tr-steps">' + STEPS.map(function (s, i) {
          return '<li class="' + (i < idx ? "done" : i === idx ? "now" : "") + '"><span class="dot"></span><span>' + esc(s[1]) + "</span></li>";
        }).join("") + "</ol>";

    var rider = "";
    var link = safeUrl(o.tracking_link);
    if (o.rider_name || o.rider_phone || link) {
      rider = '<div class="tr-card"><h3>Delivery</h3>' +
        (o.rider_name ? "<p>Rider: <strong>" + esc(o.rider_name) + "</strong></p>" : "") +
        (o.rider_phone ? '<p>Rider phone: <a href="tel:' + esc(o.rider_phone) + '">' + esc(o.rider_phone) + "</a></p>" : "") +
        (link ? '<p><a class="tr-btn small" href="' + esc(link) + '" target="_blank" rel="noopener">Open live tracking</a></p>' : "") +
        "</div>";
    }

    var items = (o.items || []).map(function (i) {
      return "<li>" + esc(i.name) + " × " + esc(i.quantity) + " <span>" + money(i.unit_price * i.quantity) + "</span></li>";
    }).join("");
    var fee = o.delivery_fee > 0 ? money(o.delivery_fee) : "To be confirmed on WhatsApp";
    var total = o.delivery_fee > 0 ? money(o.total) : money(o.subtotal) + " plus delivery";

    var events = (o.events || []).map(function (e) {
      return "<li><strong>" + esc(label(e.status)) + "</strong>" + (e.note ? " · " + esc(e.note) : "") + "<span>" + esc(fmtDate(e.at)) + "</span></li>";
    }).join("");

    out.innerHTML =
      '<div class="tr-result"><div class="tr-head"><div><div class="tr-no">' + esc(o.order_number) + '</div><div class="tr-date">Placed ' + esc(fmtDate(o.created_at)) + "</div></div>" +
      '<span class="tr-chip st-' + esc(o.status) + '">' + esc(label(o.status)) + "</span></div>" +
      '<p class="tr-msg">' + esc(STATUS_TEXT[o.status] || "") + "</p>" + steps +
      (o.tracking_note ? '<div class="tr-card"><h3>Message from us</h3><p>' + esc(o.tracking_note) + "</p></div>" : "") +
      rider +
      '<div class="tr-card"><h3>Your order</h3><ul class="tr-items">' + items + "</ul>" +
      '<p class="tr-sum">Items: ' + money(o.subtotal) + "<br>Delivery: " + esc(fee) + "<br><strong>Total: " + esc(total) + "</strong><br>Payment: " + esc(PAY_TEXT[o.payment_status] || o.payment_status) + "</p></div>" +
      (events ? '<div class="tr-card"><h3>History</h3><ul class="tr-events">' + events + "</ul></div>" : "") +
      '<p class="tr-help"><a class="tr-btn ghost" href="' + esc(waHelp(o.order_number)) + '" target="_blank" rel="noopener">Ask us about this order</a> ' +
      '<button type="button" class="tr-btn ghost" id="trRefresh">Refresh</button></p></div>';
    var r = document.getElementById("trRefresh");
    if (r) r.addEventListener("click", function () { lookup(); });
  }

  function lookup() {
    var order = form.elements.order.value.trim();
    var phone = form.elements.phone.value.trim();
    errEl.textContent = ""; out.innerHTML = "";
    if (!order) { errEl.textContent = "Please enter your order number, for example ORD-1001."; return; }
    if (phone.replace(/\D/g, "").length < 10) { errEl.textContent = "Please enter the phone number you used to order."; return; }
    btn.disabled = true; btn.textContent = "Looking…";
    Promise.resolve().then(function () {
      return sbc.rpc("track_order", { p_order_number: order, p_phone: phone });
    }).then(function (res) {
      btn.disabled = false; btn.textContent = "Track order";
      if (res.error) throw new Error(res.error.message || "Lookup failed.");
      if (!res.data) {
        errEl.innerHTML = "We could not find an order with that number and phone number. Check both and try again, or <a href=\"" + esc(waHelp(order.toUpperCase())) + '" target="_blank" rel="noopener">ask us on WhatsApp</a>.';
        return;
      }
      try { localStorage.setItem("tn_last_order", res.data.order_number); } catch (e) { /* ignore */ }
      render(res.data);
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = "Track order";
      errEl.textContent = /failed to fetch|network|load failed/i.test(e.message || "")
        ? "We could not reach the shop just now. Check your internet connection and try again."
        : "Something went wrong. Please try again in a moment.";
    });
  }

  /* ---- start ---- */
  document.querySelectorAll("[data-brand]").forEach(function (el) { el.textContent = CONFIG.brandName; });
  document.title = "Track your order | " + CONFIG.brandName;

  if (!window.supabase || !CONFIG.supabaseUrl || !CONFIG.supabaseKey) {
    form.style.display = "none";
    out.innerHTML = '<div class="tr-card"><p>Order tracking is not available right now. Please <a href="' + esc(waHelp("")) + '" target="_blank" rel="noopener">ask us on WhatsApp</a> for an update.</p></div>';
    return;
  }
  sbc = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

  var params = new URLSearchParams(location.search);
  var last = "", saved = {};
  try { last = localStorage.getItem("tn_last_order") || ""; } catch (e) { /* ignore */ }
  try { saved = JSON.parse(localStorage.getItem("tn_customer")) || {}; } catch (e) { saved = {}; }
  var fromLink = (params.get("order") || "").toUpperCase();
  form.elements.order.value = fromLink || last;
  form.elements.phone.value = saved.phone || "";
  form.addEventListener("submit", function (ev) { ev.preventDefault(); lookup(); });
  // Arrived from "Track this order" on this device: show it straight away.
  if (fromLink && saved.phone) lookup();
})();
