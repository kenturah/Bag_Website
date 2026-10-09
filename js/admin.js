"use strict";
/* OWNER DASHBOARD: sign in, then manage products, stock, photos and orders.
   Only people listed in the database `staff` table can use it. All permissions are
   enforced by the database, not by this page. */
(function () {
  var STATUSES = [["placed", "Placed"], ["confirmed", "Confirmed"], ["packed", "Packed"], ["out_for_delivery", "Out for delivery"], ["delivered", "Delivered"], ["cancelled", "Cancelled"]];
  var PAY = [["unpaid", "Unpaid"], ["paid", "Paid"], ["refunded", "Refunded"]];
  var METHODS = { transfer: "Bank transfer", cod: "Pay on delivery", card: "Card", whatsapp: "WhatsApp" };
  var DEFAULT_CATS = ["Bags", "Accessories", "Appliances"];

  var app = document.getElementById("app");
  var sbc = null, products = [], orders = [], tab = "products", search = "", ordFilter = "all";
  var openOrders = {};
  var POLL_MS = window.ADMIN_POLL_MS || 30000;
  var pollTimer = null, sinceTs = null, unseen = 0, baseTitle = document.title;

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function money(n) { return "₦" + Number(n || 0).toLocaleString("en-NG"); }
  function label(list, key) { var m = list.filter(function (x) { return x[0] === key; })[0]; return m ? m[1] : key; }
  function imgSrc(u) { return !u ? "" : (/^(https?:)?\/\//.test(u) || u.charAt(0) === "/") ? u : "../" + u; }
  function errMsg(e) { return e && e.message ? e.message : "Something went wrong."; }
  function toast(msg, bad) {
    var t = document.getElementById("toast");
    t.textContent = msg; t.className = "show" + (bad ? " bad" : "");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.className = ""; }, 3400);
  }
  function parseWhole(v) {
    var s = String(v == null ? "" : v).replace(/[,\s₦]/g, "");
    return /^\d+$/.test(s) ? parseInt(s, 10) : NaN;
  }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return iso || ""; }
  }
  function intlPhone(p) {
    var d = String(p || "").replace(/\D/g, "");
    if (d.indexOf("234") === 0) return d;
    if (d.charAt(0) === "0") return "234" + d.slice(1);
    return d;
  }

  /* ---------------- sign in ---------------- */
  function notice(title, text) {
    app.innerHTML = '<div class="login"><h1>' + esc(title) + "</h1><p>" + esc(text) + "</p></div>";
  }

  function showLogin(msg) {
    app.innerHTML =
      '<div class="login"><h1>Owner sign in</h1><p>For the shop owner only.</p>' +
      '<form id="loginForm"><label>Email<input name="email" type="email" autocomplete="username" required></label>' +
      '<label>Password<input name="password" type="password" autocomplete="current-password" required></label>' +
      '<div class="err" id="loginErr">' + esc(msg || "") + '</div>' +
      '<button class="btn primary" type="submit" id="loginBtn">Sign in</button></form></div>';
    document.getElementById("loginForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var f = ev.target, btn = document.getElementById("loginBtn"), err = document.getElementById("loginErr");
      btn.disabled = true; btn.textContent = "Signing in…"; err.textContent = "";
      sbc.auth.signInWithPassword({ email: f.elements.email.value.trim(), password: f.elements.password.value })
        .then(function (r) {
          if (r.error) throw r.error;
          return checkOwner(r.data.user);
        })
        .catch(function (e) {
          btn.disabled = false; btn.textContent = "Sign in";
          err.textContent = /invalid login/i.test(errMsg(e)) ? "That email or password is not right." : errMsg(e);
        });
    });
  }

  function checkOwner(user) {
    return sbc.rpc("is_owner").then(function (r) {
      if (r.error) {
        notice("Could not check your access", "The database did not answer the owner check. Make sure schema.sql was run in Supabase. (" + errMsg(r.error) + ")");
        return;
      }
      if (r.data === true) showApp(user); else showDenied(user && user.email);
    });
  }

  function showDenied(email) {
    app.innerHTML =
      '<div class="login"><h1>Not an owner account</h1><p>' + esc(email || "This account") +
      " is signed in but is not listed as an owner. Run make-owner.sql in Supabase with this email, or sign in with the owner account.</p>" +
      '<button class="btn" id="outBtn">Sign out</button></div>';
    document.getElementById("outBtn").addEventListener("click", signOut);
  }

  function signOut() { stopAlerts(); sbc.auth.signOut().then(function () { showLogin(); }); }

  /* ---------------- live new-order alerts (while this page is open) ---------------- */
  function beep() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var c = beep.ctx || (beep.ctx = new Ctx()), o = c.createOscillator(), g = c.createGain();
      o.frequency.value = 880; g.gain.value = 0.08; o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.25);
    } catch (e) { /* sound not available */ }
  }
  function updateBadge() {
    var b = document.querySelector('.ad-tabs [data-tab="orders"]');
    if (b) b.innerHTML = "Orders" + (unseen ? ' <span class="pill">' + unseen + "</span>" : "");
    document.title = unseen ? "(" + unseen + ") New order · " + baseTitle : baseTitle;
  }
  function announce(list) {
    unseen += list.length; updateBadge();
    var msg = list.length === 1
      ? "New order " + list[0].order_number + " from " + list[0].customer_name + " · " + money(list[0].total)
      : list.length + " new orders";
    toast(msg); beep();
    try { if (window.Notification && Notification.permission === "granted") new Notification("New order", { body: msg }); } catch (e) { /* ignore */ }
    var editing = document.activeElement && document.activeElement.closest && document.activeElement.closest(".oedit");
    if (tab === "orders" && !editing) loadOrders().then(renderOrders);
  }
  function checkNew() {
    if (!sinceTs) { initAlerts(); return; }
    sbc.from("orders").select("id, order_number, customer_name, total, created_at").gt("created_at", sinceTs)
      .order("created_at", { ascending: true }).limit(20).then(function (r) {
        if (r.error || !r.data || !r.data.length) return;
        sinceTs = r.data[r.data.length - 1].created_at;
        announce(r.data);
      });
  }
  function initAlerts() {
    return sbc.from("orders").select("created_at").order("created_at", { ascending: false }).limit(1).then(function (r) {
      if (r.error) return; // try again on the next tick
      sinceTs = r.data && r.data[0] ? r.data[0].created_at : "1970-01-01T00:00:00Z";
    });
  }
  function startAlerts() {
    stopAlerts();
    initAlerts();
    pollTimer = setInterval(checkNew, POLL_MS);
  }
  function stopAlerts() { if (pollTimer) clearInterval(pollTimer); pollTimer = null; sinceTs = null; unseen = 0; updateBadge(); }

  /* ---------------- shell ---------------- */
  function showApp(user) {
    app.innerHTML =
      '<header class="ad-head"><div class="ad-brand"><span data-brand>' + esc(CONFIG.brandName) + "</span><small>Owner dashboard</small></div>" +
      '<nav class="ad-tabs"><button data-tab="products">Products</button><button data-tab="orders">Orders</button></nav>' +
      (window.Notification && Notification.permission === "default" ? '<button class="btn" id="alertBtn">Enable alerts</button>' : "") +
      '<button class="btn" id="outBtn">Sign out</button></header><main class="ad-main" id="view"></main>';
    document.getElementById("outBtn").addEventListener("click", signOut);
    var alertBtn = document.getElementById("alertBtn");
    if (alertBtn) alertBtn.addEventListener("click", function () {
      Notification.requestPermission().then(function () { alertBtn.remove(); beep(); });
    });
    startAlerts();
    document.querySelectorAll(".ad-tabs button").forEach(function (b) {
      b.addEventListener("click", function () { setTab(b.getAttribute("data-tab")); });
    });
    var view = document.getElementById("view");
    view.addEventListener("click", onViewClick);
    view.addEventListener("change", onViewChange);
    view.addEventListener("input", onViewInput);
    view.addEventListener("toggle", function (ev) {
      var d = ev.target;
      if (d && d.classList && d.classList.contains("ord")) openOrders[d.getAttribute("data-id")] = d.open;
    }, true);
    setTab(tab);
  }

  function setTab(t) {
    tab = t;
    if (t === "orders") { unseen = 0; updateBadge(); }
    document.querySelectorAll(".ad-tabs button").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-tab") === t); });
    document.getElementById("view").innerHTML = '<p class="ad-loading">Loading…</p>';
    (t === "products" ? loadProducts().then(renderProducts) : loadOrders().then(renderOrders));
  }

  /* ---------------- products ---------------- */
  function loadProducts() {
    return sbc.from("products").select("*").order("created_at", { ascending: false }).limit(1000).then(function (r) {
      if (r.error) { toast(errMsg(r.error), true); return; }
      products = (r.data || []).slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    });
  }

  function productRow(p) {
    var thumb = p.image_url ? '<img class="pthumb" src="' + esc(imgSrc(p.image_url)) + '" alt="">' : '<div class="pthumb"></div>';
    return (
      '<div class="prow" data-id="' + esc(p.id) + '">' + thumb +
      '<div><div class="pname">' + esc(p.name) + (p.tag ? ' <span class="pill ' + esc(p.tag) + '">' + esc(p.tag) + "</span>" : "") +
      (p.active ? "" : ' <span class="pill hide">Hidden</span>') + "</div>" +
      '<div class="psub">' + esc(p.category) + " · " + money(p.price) + (p.was ? " (was " + money(p.was) + ")" : "") + "</div></div>" +
      '<label class="pstock">Stock<input type="number" min="0" step="1" value="' + esc(p.stock) + '" data-act="stock" data-id="' + esc(p.id) + '"></label>' +
      '<button class="btn" data-act="edit" data-id="' + esc(p.id) + '">Edit</button></div>'
    );
  }

  function productListHtml() {
    var q = search.toLowerCase();
    var list = products.filter(function (p) { return !q || (p.name + " " + p.category).toLowerCase().indexOf(q) !== -1; });
    document.getElementById("pcount") && (document.getElementById("pcount").textContent = list.length + " of " + products.length);
    return list.length ? list.map(productRow).join("") : '<p class="ad-loading">No products match.</p>';
  }

  function renderProducts() {
    var view = document.getElementById("view");
    if (!view || tab !== "products") return;
    view.innerHTML =
      "<h2>Products</h2>" +
      '<div class="toolbar"><input type="search" placeholder="Search products" data-act="search" value="' + esc(search) + '" aria-label="Search products">' +
      '<span class="count" id="pcount"></span><button class="btn primary spacer" data-act="add">Add product</button></div>' +
      '<div id="plist"></div>';
    document.getElementById("plist").innerHTML = productListHtml();
  }

  function saveStock(input) {
    var id = input.getAttribute("data-id"), n = parseWhole(input.value);
    var p = products.filter(function (x) { return x.id === id; })[0];
    if (isNaN(n)) { toast("Stock must be a whole number, 0 or more.", true); input.value = p ? p.stock : 0; return; }
    sbc.from("products").update({ stock: n }).eq("id", id).select().then(function (r) {
      if (r.error || !r.data || r.data.length === 0) { toast(r.error ? errMsg(r.error) : "Could not save. Are you signed in as the owner?", true); if (p) input.value = p.stock; return; }
      if (p) p.stock = n;
      toast("Stock saved");
    });
  }

  function slug(s) {
    var t = String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28);
    return (t || "item") + "-" + Date.now().toString(36).slice(-4);
  }

  function catOptions() {
    var cats = DEFAULT_CATS.slice();
    products.forEach(function (p) { if (cats.indexOf(p.category) === -1) cats.push(p.category); });
    return cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join("");
  }

  function openProductForm(p) {
    var isNew = !p; p = p || { name: "", category: "", price: "", was: "", tag: "", stock: 0, description: "", active: true, image_url: "" };
    var back = document.createElement("div");
    back.className = "modal-back"; back.id = "modalBack";
    back.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true"><h2>' + (isNew ? "Add product" : "Edit product") + "</h2>" +
      '<form id="pform" novalidate>' +
      '<label>Name<input name="name" value="' + esc(p.name) + '" required></label>' +
      '<div class="row2"><label>Category<input name="category" list="catlist" value="' + esc(p.category) + '"></label><datalist id="catlist">' + catOptions() + "</datalist>" +
      '<label>Tag<select name="tag"><option value="">None</option><option value="new"' + (p.tag === "new" ? " selected" : "") + '>New</option><option value="deal"' + (p.tag === "deal" ? " selected" : "") + ">Deal</option></select></label></div>" +
      '<div class="row3"><label>Price (₦)<input name="price" inputmode="numeric" value="' + esc(p.price) + '"></label>' +
      '<label>Old price <span class="opt">(deals)</span><input name="was" inputmode="numeric" value="' + esc(p.was || "") + '"></label>' +
      '<label>Stock<input name="stock" inputmode="numeric" value="' + esc(p.stock) + '"></label></div>' +
      '<label>Description<textarea name="description" rows="3">' + esc(p.description || "") + "</textarea></label>" +
      '<div class="photo">' + (p.image_url ? '<img class="pthumb" id="pprev" src="' + esc(imgSrc(p.image_url)) + '" alt="">' : '<div class="pthumb" id="pprev"></div>') +
      '<label>Photo <span class="opt">(any size, it is shrunk for you)</span><input type="file" name="photo" accept="image/*"></label></div>' +
      '<label class="check"><input type="checkbox" name="active"' + (p.active ? " checked" : "") + "> Show in the shop</label>" +
      '<div class="err" id="perr"></div><div class="actions">' +
      (isNew ? "" : '<button type="button" class="btn danger" id="pdel">Delete</button>') +
      '<button type="button" class="btn" id="pcancel">Cancel</button><button type="submit" class="btn primary" id="psave">Save</button></div></form></div>';
    document.body.appendChild(back);
    var form = document.getElementById("pform");
    function close() { back.remove(); }
    document.getElementById("pcancel").addEventListener("click", close);
    back.addEventListener("click", function (ev) { if (ev.target === back) close(); });
    form.elements.photo.addEventListener("change", function () {
      var f = form.elements.photo.files[0];
      if (f) document.getElementById("pprev").outerHTML = '<img class="pthumb" id="pprev" src="' + URL.createObjectURL(f) + '" alt="">';
    });
    if (!isNew) document.getElementById("pdel").addEventListener("click", function () {
      if (!confirm('Delete "' + p.name + '" for good? Orders already placed keep their record. (To just hide it, untick "Show in the shop" instead.)')) return;
      sbc.from("products").delete().eq("id", p.id).select().then(function (r) {
        if (r.error || !r.data || r.data.length === 0) { toast(r.error ? errMsg(r.error) : "Could not delete.", true); return; }
        close(); toast("Deleted"); loadProducts().then(renderProducts);
      });
    });
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var err = document.getElementById("perr"), btn = document.getElementById("psave");
      var f = form.elements;
      var name = f.name.value.trim(), category = f.category.value.trim();
      var price = parseWhole(f.price.value), stock = parseWhole(f.stock.value);
      var wasRaw = f.was.value.trim(), was = wasRaw === "" ? null : parseWhole(wasRaw);
      if (!name) { err.textContent = "Please enter a name."; return; }
      if (!category) { err.textContent = "Please enter a category, for example Bags."; return; }
      if (isNaN(price)) { err.textContent = "Price must be a whole number of Naira."; return; }
      if (isNaN(stock)) { err.textContent = "Stock must be a whole number, 0 or more."; return; }
      if (was !== null && isNaN(was)) { err.textContent = "Old price must be a whole number, or left empty."; return; }
      err.textContent = ""; btn.disabled = true; btn.textContent = "Saving…";
      var id = isNew ? slug(name) : p.id;
      var row = { name: name, category: category, price: price, was: was, tag: f.tag.value || null, stock: stock, description: f.description.value.trim() || null, active: f.active.checked };
      var file = f.photo.files[0];
      var step = file ? uploadPhoto(file, id).then(function (url) { row.image_url = url; }) : Promise.resolve();
      step.then(function () {
        var q = isNew ? sbc.from("products").insert(Object.assign({ id: id }, row)) : sbc.from("products").update(row).eq("id", id);
        return q.select();
      }).then(function (r) {
        if (r.error) throw r.error;
        if (!r.data || r.data.length === 0) throw new Error("Nothing was saved. Are you signed in as the owner?");
        close(); toast(isNew ? "Product added" : "Saved"); return loadProducts().then(renderProducts);
      }).catch(function (e) {
        btn.disabled = false; btn.textContent = "Save"; err.textContent = errMsg(e);
      });
    });
  }

  // Shrinks a phone photo to at most 900px wide and saves it as a small WebP (or JPEG if WebP is unavailable).
  function shrinkImage(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        try {
          var scale = Math.min(1, 900 / Math.max(img.width, img.height));
          var c = document.createElement("canvas");
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          c.toBlob(function (blob) {
            URL.revokeObjectURL(url);
            if (blob) resolve(blob);
            else c.toBlob(function (jpg) { jpg ? resolve(jpg) : reject(new Error("Could not prepare the photo.")); }, "image/jpeg", 0.85);
          }, "image/webp", 0.85);
        } catch (e) { reject(new Error("Could not prepare the photo.")); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("That file is not a photo we can read.")); };
      img.src = url;
    });
  }

  function uploadPhoto(file, id) {
    return shrinkImage(file).then(function (blob) {
      var ext = blob.type === "image/jpeg" ? "jpg" : "webp";
      var path = "products/" + id + "-" + Date.now() + "." + ext;
      return sbc.storage.from("product-images").upload(path, blob, { contentType: blob.type || "image/webp" }).then(function (r) {
        if (r.error) throw new Error("Photo upload failed: " + errMsg(r.error));
        return sbc.storage.from("product-images").getPublicUrl(path).data.publicUrl;
      });
    });
  }

  /* ---------------- orders ---------------- */
  function loadOrders() {
    return sbc.from("orders").select("*, order_items(*)").order("created_at", { ascending: false }).limit(150).then(function (r) {
      if (r.error) { toast(errMsg(r.error), true); return; }
      orders = r.data || [];
    });
  }

  // The customer-facing tracking page, but only when this dashboard is on the real website (not on your own computer).
  function trackUrl(no) {
    try {
      var h = location.hostname;
      if (!h || h === "localhost" || h === "127.0.0.1") return "";
      return new URL("../track.html?order=" + encodeURIComponent(no), location.href).href;
    } catch (e) { return ""; }
  }

  function waText(o) {
    var t = "Hello " + o.customer_name + ", this is " + CONFIG.brandName + " about your order " + o.order_number + ". Status: " + label(STATUSES, o.status) + ".";
    if (o.delivery_fee > 0) t += " Delivery fee: " + money(o.delivery_fee) + ". Total to pay: " + money(o.total) + ".";
    if (o.status === "out_for_delivery") {
      if (o.rider_name || o.rider_phone) t += " Your rider: " + [o.rider_name, o.rider_phone].filter(Boolean).join(", ") + ".";
      if (o.tracking_link) t += " Track here: " + o.tracking_link;
    }
    if (o.tracking_note) t += " " + o.tracking_note;
    var tu = trackUrl(o.order_number);
    if (tu) t += " You can follow your order here, using your phone number: " + tu;
    return t;
  }

  function orderHtml(o) {
    var items = (o.order_items || []).map(function (i) {
      return "<li>" + esc(i.name) + " × " + esc(i.quantity) + " — " + money(i.unit_price * i.quantity) + "</li>";
    }).join("");
    var cancelled = o.status === "cancelled";
    var sel = function (field, list, cur, disabled) {
      return '<select data-f="' + field + '"' + (disabled ? " disabled" : "") + ">" +
        list.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === cur ? " selected" : "") + ">" + x[1] + "</option>"; }).join("") + "</select>";
    };
    var txt = function (field, v, ph) { return '<input data-f="' + field + '" value="' + esc(v || "") + '" placeholder="' + esc(ph || "") + '">'; };
    return (
      '<details class="ord" data-id="' + esc(o.id) + '"' + (openOrders[o.id] ? " open" : "") + ">" +
      "<summary><span class=\"ono\">" + esc(o.order_number) + '</span><span class="oname">' + esc(o.customer_name) + '</span><span class="ototal">' + money(o.total) +
      '</span><span class="chip st-' + esc(o.status) + '">' + esc(label(STATUSES, o.status)) + '</span><span class="odate">' + esc(fmtDate(o.created_at)) + " · " + esc(label(PAY, o.payment_status)) + "</span></summary>" +
      '<div class="obody"><div class="ocols"><div><h4>Customer</h4><p>' + esc(o.customer_name) + '<br><a href="tel:' + esc(o.phone) + '">' + esc(o.phone) + "</a>" +
      (o.email ? "<br>" + esc(o.email) : "") + "<br>" + esc(o.address) + (o.state ? ", " + esc(o.state) : "") + "</p>" +
      (o.note ? "<h4>Customer note</h4><p>" + esc(o.note) + "</p>" : "") +
      "<h4>Payment</h4><p>" + esc(METHODS[o.payment_method] || o.payment_method) + "</p></div>" +
      "<div><h4>Items</h4><ul>" + items + "</ul><p>Items " + money(o.subtotal) + "<br>Delivery " + money(o.delivery_fee) + "<br><strong>Total " + money(o.total) + "</strong></p></div></div>" +
      '<div class="oedit" data-id="' + esc(o.id) + '">' +
      "<label>Order status" + sel("status", STATUSES, o.status, cancelled) + "</label>" +
      "<label>Payment" + sel("payment_status", PAY, o.payment_status, false) + "</label>" +
      '<label>Delivery fee (₦)<input data-f="delivery_fee" inputmode="numeric" value="' + esc(o.delivery_fee) + '"></label>' +
      "<label>Rider name" + txt("rider_name", o.rider_name) + "</label><label>Rider phone" + txt("rider_phone", o.rider_phone) + "</label>" +
      "<label>Tracking link" + txt("tracking_link", o.tracking_link, "https://") + "</label>" +
      '<label class="wide">Note to the customer' + txt("tracking_note", o.tracking_note) + "</label></div>" +
      '<div class="oactions"><button class="btn primary" data-act="saveorder" data-id="' + esc(o.id) + '">Save changes</button>' +
      '<a class="btn" target="_blank" rel="noopener" href="https://wa.me/' + esc(intlPhone(o.phone)) + "?text=" + encodeURIComponent(waText(o)) + '">Message on WhatsApp</a></div>' +
      "</div></details>"
    );
  }

  function renderOrders() {
    var view = document.getElementById("view");
    if (!view || tab !== "orders") return;
    var n = function (f) { return orders.filter(f).length; };
    var list = orders.filter(function (o) { return ordFilter === "all" || o.status === ordFilter; });
    view.innerHTML =
      "<h2>Orders</h2>" +
      '<p class="count">Keep this page open to get a sound and a pop-up for each new order. For alerts on your phone when it is closed, set up email or Telegram alerts (see supabase/alerts-setup.sql).</p>' +
      '<div class="tiles"><div class="tile"><b>' + n(function (o) { return o.status === "placed"; }) + "</b><span>New orders</span></div>" +
      '<div class="tile"><b>' + n(function (o) { return ["confirmed", "packed", "out_for_delivery"].indexOf(o.status) !== -1; }) + "</b><span>To deliver</span></div>" +
      '<div class="tile"><b>' + n(function (o) { return o.payment_status === "unpaid" && o.status !== "cancelled"; }) + "</b><span>Unpaid</span></div></div>" +
      '<div class="toolbar"><select data-act="ofilter" aria-label="Filter orders"><option value="all">All orders</option>' +
      STATUSES.map(function (s) { return '<option value="' + s[0] + '"' + (ordFilter === s[0] ? " selected" : "") + ">" + s[1] + "</option>"; }).join("") +
      '</select><span class="count">' + list.length + ' shown</span><button class="btn spacer" data-act="refresh">Refresh</button></div>' +
      (list.length ? list.map(orderHtml).join("") : '<p class="ad-loading">No orders here yet.</p>');
  }

  function saveOrder(id, btn) {
    var box = document.querySelector('.oedit[data-id="' + id.replace(/"/g, "") + '"]');
    var o = orders.filter(function (x) { return x.id === id; })[0];
    if (!box || !o) return;
    function val(f) { return box.querySelector('[data-f="' + f + '"]').value.trim(); }
    var fee = parseWhole(val("delivery_fee"));
    if (isNaN(fee)) { toast("Delivery fee must be a whole number of Naira.", true); return; }
    var link = val("tracking_link");
    if (link && !/^https?:\/\//i.test(link)) { toast("The tracking link must start with http:// or https://", true); return; }
    var patch = {
      status: val("status"), payment_status: val("payment_status"), delivery_fee: fee,
      rider_name: val("rider_name") || null, rider_phone: val("rider_phone") || null,
      tracking_link: link || null, tracking_note: val("tracking_note") || null
    };
    if (patch.status === "cancelled" && o.status !== "cancelled" &&
        !confirm("Cancel this order? The items go back into stock, and a cancelled order cannot be reopened.")) return;
    btn.disabled = true; btn.textContent = "Saving…";
    sbc.from("orders").update(patch).eq("id", id).select().then(function (r) {
      btn.disabled = false; btn.textContent = "Save changes";
      if (r.error || !r.data || r.data.length === 0) { toast(r.error ? errMsg(r.error) : "Nothing was saved. Are you signed in as the owner?", true); return; }
      toast("Order saved");
      return loadOrders().then(renderOrders);
    });
  }

  /* ---------------- events ---------------- */
  function onViewClick(ev) {
    var el = ev.target.closest("[data-act]");
    if (!el) return;
    var act = el.getAttribute("data-act"), id = el.getAttribute("data-id");
    if (act === "add") openProductForm(null);
    else if (act === "edit") openProductForm(products.filter(function (p) { return p.id === id; })[0]);
    else if (act === "saveorder") saveOrder(id, el);
    else if (act === "refresh") loadOrders().then(renderOrders);
  }
  function onViewChange(ev) {
    var el = ev.target, act = el.getAttribute && el.getAttribute("data-act");
    if (act === "stock") saveStock(el);
    else if (act === "ofilter") { ordFilter = el.value; renderOrders(); }
  }
  function onViewInput(ev) {
    var el = ev.target;
    if (el.getAttribute && el.getAttribute("data-act") === "search") {
      search = el.value.trim();
      document.getElementById("plist").innerHTML = productListHtml();
    }
  }

  /* ---------------- start ---------------- */
  if (typeof CONFIG === "undefined") {
    notice("Settings file did not load", "js/config.js could not be found. Check that the file exists in the js folder, then reload this page.");
    return;
  }
  if (!window.supabase) {
    notice("Database library did not load", "js/vendor/supabase.js could not be found. Check that the js/vendor folder from the zip is in your project, then reload this page.");
    return;
  }
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) {
    notice("Database keys missing", "Your js/config.js has no supabaseUrl or supabaseKey lines. Add them (see README), then reload this page.");
    return;
  }
  sbc = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
  sbc.auth.getSession().then(function (r) {
    var s = r.data && r.data.session;
    if (s) checkOwner(s.user); else showLogin();
  }).catch(function () { showLogin(); });
})();
