"use strict";
/* Used by the pages/ folder: fills in the business name from config.js. */
document.querySelectorAll("[data-brand]").forEach(function (el) { el.textContent = CONFIG.brandName; });
document.title = document.title + " | " + CONFIG.brandName;
