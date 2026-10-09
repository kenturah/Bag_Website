"use strict";
/* PRODUCTS: the product list, the SVG fallback icons, product descriptions and image helper.
   To add a product: put its photo in images/products/<bags|appliances>/ and add a line to PRODUCTS. */
// Makes any text safe to put inside HTML (owner-typed product names, descriptions, photo links).
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

var PRODUCTS = [
    { id: "bag1", name: "Ivory Teddy-Embossed Boston Bag", category: "Bags", price: 13500, tag: "new", img: "images/products/bags/bag1.webp", stock: 10 },
    { id: "bag2", name: "Purple Floral Patent Tote & Purse Set", category: "Bags", price: 27500, tag: null, img: "images/products/bags/bag2.webp", stock: 5 },
    { id: "bag3", name: "Burgundy Woven Knot Shoulder Bag", category: "Bags", price: 16800, tag: "deal", was: 20500, img: "images/products/bags/bag3.webp", stock: 7 },
    { id: "bag4", name: "Tan Mini Top-Handle Satchel", category: "Bags", price: 9200, tag: null, img: "images/products/bags/bag4.webp", stock: 12 },
    { id: "bag5", name: "Navy Colourblock Tote & Mini Bag Set", category: "Bags", price: 24000, tag: null, img: "images/products/bags/bag5.webp", stock: 6 },
    { id: "bag6", name: "Rosewood Quilted 3-Piece Bag Set", category: "Bags", price: 22500, tag: "new", img: "images/products/bags/bag6.webp", stock: 8 },
    { id: "bag7", name: "Navy Floral Patent Tote & Purse Set", category: "Bags", price: 27500, tag: null, img: "images/products/bags/bag7.webp", stock: 4 },
    { id: "bag8", name: "Cognac Woven Knot Shoulder Bag", category: "Bags", price: 16800, tag: null, img: "images/products/bags/bag8.webp", stock: 9 },
    { id: "bag9", name: "Emerald Floral Patent Tote & Purse Set", category: "Bags", price: 27500, tag: "new", img: "images/products/bags/bag9.webp", stock: 3 },
    { id: "bag10", name: "Black Floral Patent Tote & Purse Set", category: "Bags", price: 27500, tag: null, img: "images/products/bags/bag10.webp", stock: 6 },
    { id: "bag11", name: "Espresso Woven Knot Shoulder Bag", category: "Bags", price: 16800, tag: null, img: "images/products/bags/bag11.webp", stock: 0 },
    { id: "bag12", name: "Emerald Pleated Satin Clutch", category: "Bags", price: 14500, tag: null, img: "images/products/bags/bag12.webp", stock: 11 },
    { id: "bag13", name: "Silver Pleated Satin Clutch", category: "Bags", price: 14500, tag: "new", img: "images/products/bags/bag13.webp", stock: 13 },
    { id: "bag14", name: "Emerald Croc-Embossed Structured Tote", category: "Bags", price: 29500, tag: "deal", was: 35000, img: "images/products/bags/bag14.webp", stock: 2 },
    { id: "bag15", name: "Ivory Classic Boston Bag", category: "Bags", price: 18500, tag: null, img: "images/products/bags/bag15.webp", stock: 15 },
    { id: "bag16", name: "Taupe Croc-Embossed 3-Piece Bag Set", category: "Bags", price: 23500, tag: null, img: "images/products/bags/bag16.webp", stock: 5 },
    { id: "bag17", name: "Silver Sequin Bucket Bag", category: "Bags", price: 19800, tag: "new", img: "images/products/bags/bag17.webp", stock: 4 },
    { id: "bag18", name: "Blush Croc-Embossed 3-Piece Bag Set", category: "Bags", price: 23500, tag: null, img: "images/products/bags/bag18.webp", stock: 7 },
    { id: "bag19", name: "Black Woven Knot Shoulder Bag", category: "Bags", price: 16800, tag: null, img: "images/products/bags/bag19.webp", stock: 10 },
    { id: "bag20", name: "Black Tweed Chain Flap Bag", category: "Bags", price: 21500, tag: "deal", was: 26000, img: "images/products/bags/bag20.webp", stock: 6 },
    { id: "bag21", name: "Taupe Pebbled Leather Shoulder Bag", category: "Bags", price: 17500, tag: null, img: "images/products/bags/bag21.webp", stock: 9 },
    { id: "bag22", name: "Black Mini Top-Handle Satchel", category: "Bags", price: 9200, tag: null, img: "images/products/bags/bag22.webp", stock: 11 },
    { id: "bag23", name: "Purple Croc-Embossed Structured Tote", category: "Bags", price: 29500, tag: "new", img: "images/products/bags/bag23.webp", stock: 4 },
    { id: "bag24", name: "Black Belted Tote with Charm Pouch", category: "Bags", price: 26500, tag: null, img: "images/products/bags/bag24.webp", stock: 5 },
    { id: "bag25", name: "Ivory Pleated Satin Clutch", category: "Bags", price: 14500, tag: null, img: "images/products/bags/bag25.webp", stock: 10 },
    { id: "bag26", name: "White Croc-Trim Tote with Charm Pouch", category: "Bags", price: 26500, tag: "new", img: "images/products/bags/bag26.webp", stock: 3 },
    { id: "bag27", name: "Black Pebbled Leather Shoulder Bag", category: "Bags", price: 17500, tag: null, img: "images/products/bags/bag27.webp", stock: 8 },
    { id: "bag28", name: "Red Belted Tote with Charm Pouch", category: "Bags", price: 26500, tag: "deal", was: 31500, img: "images/products/bags/bag28.webp", stock: 4 },
    { id: "bag29", name: "Silver Mini Top-Handle Satchel", category: "Bags", price: 9200, tag: null, img: "images/products/bags/bag29.webp", stock: 7 },
    { id: "bag30", name: "Black Sequin Chain Bucket Bag", category: "Bags", price: 18800, tag: null, img: "images/products/bags/bag30.webp", stock: 6 },
    { id: "bag31", name: "Wine Boston Bag with Strap Detail", category: "Bags", price: 15800, tag: null, img: "images/products/bags/bag31.webp", stock: 12 },
    { id: "bag32", name: "Black Slouchy Shoulder Bag", category: "Bags", price: 17500, tag: "deal", was: 21000, img: "images/products/bags/bag32.webp", stock: 10 },
    { id: "bag33", name: "Brown Flap Crossbody Bag", category: "Bags", price: 16200, tag: null, img: "images/products/bags/bag33.webp", stock: 9 },
    { id: "bag34", name: "Silver Metallic Woven Knot Bag", category: "Bags", price: 17800, tag: "new", img: "images/products/bags/bag34.webp", stock: 6 },
    { id: "bag35", name: "Blush Mini Top-Handle Satchel", category: "Bags", price: 9200, tag: null, img: "images/products/bags/bag35.webp", stock: 8 },
    { id: "bag36", name: "Magenta Pleated Satin Clutch", category: "Bags", price: 14500, tag: null, img: "images/products/bags/bag36.webp", stock: 11 },
    { id: "bag37", name: "Black Paillette Bucket Bag", category: "Bags", price: 18800, tag: null, img: "images/products/bags/bag37.webp", stock: 5 },
    { id: "bag38", name: "Black Quilted 3-Piece Bag Set", category: "Bags", price: 23500, tag: null, img: "images/products/bags/bag38.webp", stock: 6 },
    { id: "bag39", name: "Caramel Quilted 3-Piece Bag Set", category: "Bags", price: 23500, tag: "new", img: "images/products/bags/bag39.webp", stock: 7 },
    { id: "bag40", name: "Crimson Mini Top-Handle Satchel", category: "Bags", price: 9200, tag: null, img: "images/products/bags/bag40.webp", stock: 10 },
    { id: "bag41", name: "Black Leather Business Briefcase", category: "Bags", price: 26500, tag: null, img: "images/products/bags/bag41.webp", stock: 6 },
    { id: "bag42", name: "White Croc-Embossed Buckle Shoulder Bag", category: "Bags", price: 19800, tag: "new", img: "images/products/bags/bag42.webp", stock: 8 },
    { id: "bag43", name: "Black Croc-Embossed Buckle Shoulder Bag", category: "Bags", price: 19800, tag: null, img: "images/products/bags/bag43.webp", stock: 9 },
    { id: "bag44", name: "Black Anti-Theft Tech Backpack", category: "Bags", price: 23500, tag: "deal", was: 28000, img: "images/products/bags/bag44.webp", stock: 7 },
    { id: "a1", name: "Electric kettle 1.8L, stainless steel body", category: "Appliances", price: 9500, tag: null, icon: "kettle", grad: ["#E9EBEA", "#D6DAD7"], stock: 11 },
    { id: "a2", name: "Blender and grinder combo, 2-in-1 kitchen set", category: "Appliances", price: 18000, tag: "deal", was: 21500, icon: "blender", grad: ["#EEEAE2", "#DFD5C2"], stock: 5 },
    { id: "a3", name: "Standing fan 18-inch, 3 speed adjustable", category: "Appliances", price: 22500, tag: null, icon: "fan", grad: ["#EAEAEC", "#D7D7DC"], stock: 8 },
    { id: "a4", name: "Rice cooker 1.5L, non-stick inner pot", category: "Appliances", price: 14000, tag: "new", icon: "cooker", grad: ["#EDE8E3", "#DCD2C7"], stock: 17 },
    { id: "a5", name: "Dry pressing iron, lightweight home use", category: "Appliances", price: 7800, tag: null, icon: "iron", grad: ["#E8E8E8", "#D4D4D4"], stock: 2 },
    { id: "a6", name: "Mini fridge 50L, compact for bedroom or office", category: "Appliances", price: 95000, tag: null, icon: "fridge", grad: ["#E9ECEA", "#D3D9D5"], stock: 4 },
    { id: "app7", name: "Green 4-Compartment Lunch Box + Soup Bowl", category: "Appliances", price: 7800, tag: "new", img: "images/products/appliances/app7.webp", stock: 18 },
    { id: "app8", name: "Blue 5-Compartment Lunch Box + Soup Bowl", category: "Appliances", price: 8200, tag: null, img: "images/products/appliances/app8.webp", stock: 14 },
    { id: "app9", name: "Green 5-Compartment Lunch Box + Soup Bowl", category: "Appliances", price: 8200, tag: null, img: "images/products/appliances/app9.webp", stock: 11 },
    { id: "app10", name: "Blue 4-Compartment Lunch Box + Soup Bowl", category: "Appliances", price: 7800, tag: null, img: "images/products/appliances/app10.webp", stock: 16 },
    { id: "app11", name: "Pink Compartment Lunch Box Set", category: "Appliances", price: 7800, tag: "deal", was: 9500, img: "images/products/appliances/app11.webp", stock: 9 },
    { id: "app12", name: "Manual Food Chopper 1.5L", category: "Appliances", price: 11500, tag: null, img: "images/products/appliances/app12.webp", stock: 10 },
    { id: "app13", name: "Manual Food Chopper 0.7L", category: "Appliances", price: 8500, tag: "new", img: "images/products/appliances/app13.webp", stock: 13 },
    { id: "app14", name: "Manual Food Chopper 2.0L", category: "Appliances", price: 14500, tag: null, img: "images/products/appliances/app14.webp", stock: 7 }
  ];

var ICON_PATHS = {
    tote: '<path d="M32 46 L32 30 A24 24 0 0 1 78 30 L78 46" fill="none" stroke="#33322D" stroke-width="4" opacity="0.85"/><rect x="18" y="46" width="74" height="56" rx="6" fill="rgba(0,0,0,0.04)" stroke="#33322D" stroke-width="4"/>',
    weekender: '<rect x="14" y="40" width="82" height="46" rx="14" fill="rgba(0,0,0,0.04)" stroke="#33322D" stroke-width="4"/><path d="M38 40 v-10 a17 17 0 0 1 34 0 v10" fill="none" stroke="#33322D" stroke-width="4" opacity="0.85"/>',
    basket: '<path d="M24 46 L86 46 L78 96 L32 96 Z" fill="rgba(0,0,0,0.04)" stroke="#3A3226" stroke-width="4"/><path d="M38 46 L44 20 M72 46 L66 20" fill="none" stroke="#3A3226" stroke-width="4" opacity="0.85"/>',
    backpack: '<rect x="24" y="30" width="62" height="66" rx="18" fill="rgba(0,0,0,0.04)" stroke="#302F2B" stroke-width="4"/><path d="M38 30 v-8 a17 17 0 0 1 34 0 v8" fill="none" stroke="#302F2B" stroke-width="4" opacity="0.85"/><rect x="42" y="52" width="26" height="16" rx="3" fill="none" stroke="#302F2B" stroke-width="3" opacity="0.75"/>',
    crossbody: '<rect x="28" y="46" width="54" height="42" rx="10" fill="rgba(0,0,0,0.04)" stroke="#3A3128" stroke-width="4"/><path d="M30 46 L80 10 M80 46 L30 10" fill="none" stroke="#3A3128" stroke-width="3" opacity="0.8"/>',
    laptopbag: '<rect x="17" y="36" width="76" height="52" rx="8" fill="rgba(0,0,0,0.04)" stroke="#2E2E2C" stroke-width="4"/><rect x="36" y="20" width="38" height="14" rx="3" fill="none" stroke="#2E2E2C" stroke-width="4" opacity="0.85"/>',
    kettle: '<path d="M30 52 a24 24 0 0 1 48 0 v24 a7 7 0 0 1 -7 7 h-34 a7 7 0 0 1 -7 -7 z" fill="rgba(0,0,0,0.04)" stroke="#2D3230" stroke-width="4"/><path d="M78 52 L94 44" stroke="#2D3230" stroke-width="4" opacity="0.85"/><rect x="46" y="18" width="16" height="12" rx="3" fill="none" stroke="#2D3230" stroke-width="3" opacity="0.8"/>',
    blender: '<path d="M38 20 L70 20 L62 66 L46 66 Z" fill="rgba(0,0,0,0.04)" stroke="#332E24" stroke-width="4"/><rect x="30" y="66" width="48" height="24" rx="5" fill="none" stroke="#332E24" stroke-width="4" opacity="0.85"/>',
    fan: '<circle cx="55" cy="42" r="26" fill="rgba(0,0,0,0.03)" stroke="#2E2E31" stroke-width="4"/><circle cx="55" cy="42" r="5" fill="#2E2E31"/><line x1="55" y1="68" x2="55" y2="92" stroke="#2E2E31" stroke-width="4" opacity="0.85"/><line x1="38" y1="92" x2="72" y2="92" stroke="#2E2E31" stroke-width="4" opacity="0.85"/>',
    cooker: '<rect x="24" y="36" width="62" height="48" rx="10" fill="rgba(0,0,0,0.04)" stroke="#312E27" stroke-width="4"/><circle cx="55" cy="26" r="6" fill="none" stroke="#312E27" stroke-width="3" opacity="0.8"/><line x1="36" y1="58" x2="74" y2="58" stroke="#312E27" stroke-width="3" opacity="0.6"/>',
    iron: '<path d="M24 54 Q24 34 58 34 L84 50 L84 76 L36 76 Z" fill="rgba(0,0,0,0.04)" stroke="#2C2C2C" stroke-width="4"/><line x1="42" y1="20" x2="58" y2="34" stroke="#2C2C2C" stroke-width="4" opacity="0.85"/>',
    fridge: '<rect x="32" y="14" width="46" height="82" rx="7" fill="rgba(0,0,0,0.04)" stroke="#2C302D" stroke-width="4"/><line x1="32" y1="46" x2="78" y2="46" stroke="#2C302D" stroke-width="3" opacity="0.8"/><line x1="42" y1="28" x2="42" y2="36" stroke="#2C302D" stroke-width="3" opacity="0.6"/><line x1="42" y1="56" x2="42" y2="64" stroke="#2C302D" stroke-width="3" opacity="0.6"/>'
  };

var DESC = [
    ["3-piece", "A coordinated bag set with matching pieces, so your look comes together in one purchase."],
    ["purse set", "A statement tote with a matching purse, made for carrying your daily essentials in style."],
    ["mini bag set", "A full-size tote with a matching mini bag, for days that move from work to evening."],
    ["clutch", "A pleated satin clutch for weddings, dinners and evenings out. Slim enough to carry in one hand."],
    ["bucket", "A bucket-shaped bag with a sparkle finish that dresses up an evening look."],
    ["satchel", "A compact top-handle satchel, small enough to be easy and smart enough for any occasion."],
    ["knot", "A shoulder bag with a woven knot detail, easy to wear from work to the weekend."],
    ["boston", "A Boston-style bag with a rounded, roomy shape for the office and for travel days."],
    ["backpack", "An anti-theft backpack made for work, school and daily commutes."],
    ["briefcase", "A business briefcase with a clean, professional look for work and meetings."],
    ["crossbody", "A flap crossbody bag that keeps your hands free and your essentials close."],
    ["charm pouch", "A belted tote that comes with a charm pouch, for extra storage and a finishing touch."],
    ["chain flap", "A chain-strap flap bag in a classic tweed finish that goes with almost anything."],
    ["shoulder", "A shoulder bag cut for daily use, with room for your phone, wallet and essentials."],
    ["tote", "A structured tote with room for your daily essentials."],
    ["rice cooker", "A 1.5L rice cooker with a non-stick inner pot, easy to cook with and easy to clean."],
    ["kettle", "A 1.8L stainless steel electric kettle for fast tea, coffee and hot water."],
    ["blender", "A 2-in-1 blender and grinder set for smoothies, sauces and spices."],
    ["fan", "An 18-inch standing fan with three speed settings and an adjustable stand."],
    ["iron", "A lightweight dry pressing iron for everyday home use."],
    ["fridge", "A compact 50L mini fridge, sized for a bedroom or office."],
    ["lunch", "A compartment lunch box with a soup bowl, for carrying a full meal to work or school."],
    ["chopper", "A manual food chopper for vegetables and herbs, no electricity needed."]
  ];

function describe(p) {
    if (p.description) return p.description;
    var n = p.name.toLowerCase();
    for (var i = 0; i < DESC.length; i++) { if (n.indexOf(DESC[i][0]) !== -1) return DESC[i][1]; }
    return p.category === "Bags" ? "A carefully chosen bag for everyday use." : "A practical appliance for everyday home use.";
  }

function mediaFor(p) {
    if (p.img) {
      return '<img src="' + esc(p.img) + '" alt="' + esc(p.name) + '" loading="lazy">';
    }
    var gid = "g_" + p.id;
    return (
      '<svg viewBox="0 0 110 110" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
        '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="' + p.grad[0] + '"/><stop offset="1" stop-color="' + p.grad[1] + '"/>' +
        "</linearGradient></defs>" +
        '<rect width="110" height="110" fill="url(#' + gid + ')"/>' +
        (ICON_PATHS[p.icon] || "") +
      "</svg>"
    );
  }
