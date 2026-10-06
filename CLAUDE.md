# Project notes for Claude

Static online store (no framework, no build step) for a ladies' bags, accessories and home appliances business in Abuja, Nigeria.

## Brand
- Palette (Midnight Truffle + Whipped Cream), all defined in `css/tokens.css`:
  - Midnight Espresso `#24202B` (header text, hero, footer)
  - Dark Truffle `#3A251C` (headings, prices)
  - Warm Cognac `#A97061` (decoration) and deeper cognac `#9A604F` (buttons, active tab)
  - Champagne Glow `#FFF0DF` (highlights)
  - Page background `#FFF8F0`, cards white
- Fonts: Fraunces (headings) and IBM Plex Sans (body), loaded from Google Fonts.
- The body is always light. The hero and footer are dark. Do not add a dark mode without asking.

## Rules
- Prices are in Naira (₦), written as plain numbers in `js/products.js`. Delivery is not included in prices.
- Checkout is by WhatsApp message, bank transfer or card payment link. The site never handles card numbers.
- Never hardcode the business name. Use `CONFIG.brandName` in JavaScript and the `data-brand` attribute in HTML. The name is still undecided.
- Scripts share one global scope. Load order is `config.js`, `products.js`, `cart.js`, `main.js`. Use plain script tags, not ES modules.
- CSS load order is `tokens.css`, `base.css`, `components.css`. Later rules in `components.css` override earlier ones.
- Product photos live in `images/products/<bags|appliances>/<id>.webp`.

## Open items
- Placeholder WhatsApp number and bank details in `js/config.js` must be replaced.
- Business is not registered yet and not VAT-registered. The pages in `pages/` are drafts with highlighted blanks.
- Delivery text must reflect an Abuja base.
