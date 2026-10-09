# Database setup (Supabase)

Run these in the Supabase **SQL Editor**, in this order. Each can be run again safely.

1. `schema.sql` : tables, access rules, order functions, photo storage
2. `seed-products.sql` : loads the 58 starter products
3. Create your login (Authentication > Users > Add user), then run `make-owner.sql` with your email

4. (Optional but recommended) `alerts-setup.sql` : instant email and/or Telegram alerts for new orders. Edit it first, as the comments in the file explain.

If you already ran an older `schema.sql`, run the new one again. It upgrades the database and keeps your products and orders.

Your site also needs two values from your project in `js/config.js`:
- the **Project URL**
- the **Publishable key** (starts with `sb_publishable_`)

**Never** put the *secret key*, the *service_role key* or the *database password* in the website or send them to anyone. The publishable key is designed to be public; the access rules in `schema.sql` are what protect your data.

## How the security works
- Shoppers can read active products only. They cannot read or write orders directly.
- Orders are created through `place_order()`, which checks prices and stock on the server.
- Guests track an order with `track_order()` using the order number and the phone number they ordered with.
- Signed-in buyers see only their own orders. Only people listed in `staff` can manage products and orders.

Note: `make-owner.sql` contains your email address after you edit it. If your GitHub repository is public, do not commit that edited file.

## Alerts: how they work
When an order is placed, the database sends a message through the pg_net extension to Telegram and/or Resend, whichever you set up in `private.settings`. Those keys live in a schema the website cannot reach. If an alert fails (for example no internet at Resend), the customer's order is still saved. Resend's free test sender only delivers to the email you signed up to Resend with; to alert other people you need to verify your own domain in Resend.
