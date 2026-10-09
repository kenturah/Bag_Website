-- =====================================================================
-- STORE DATABASE SETUP (run once, in the Supabase SQL Editor)
-- Creates: products, orders, order items, order status history,
-- the owner list, the access rules, the order functions and the
-- product photo storage. Safe to read top to bottom.
-- =====================================================================

-- ---------- 1. Who is the owner? -------------------------------------
-- Only people listed here can manage products and orders.
create table if not exists public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.staff enable row level security;
-- No policies on purpose: the website can never read or change this list.

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

-- ---------- 2. Products ----------------------------------------------
create table if not exists public.products (
  id          text primary key,                       -- e.g. bag1, app3
  name        text not null,
  category    text not null,                          -- e.g. Bags, Appliances
  price       integer not null check (price >= 0),    -- Naira
  was         integer check (was is null or was >= 0),-- old price, for deals
  tag         text check (tag in ('new', 'deal')),
  stock       integer not null default 0 check (stock >= 0),
  image_url   text,
  description text,
  active      boolean not null default true,          -- false = hidden from shop
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

drop policy if exists "Shoppers see active products" on public.products;
create policy "Shoppers see active products" on public.products
  for select to anon, authenticated
  using (active or public.is_owner());

drop policy if exists "Owner adds products" on public.products;
create policy "Owner adds products" on public.products
  for insert to authenticated with check (public.is_owner());

drop policy if exists "Owner edits products" on public.products;
create policy "Owner edits products" on public.products
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists "Owner deletes products" on public.products;
create policy "Owner deletes products" on public.products
  for delete to authenticated using (public.is_owner());

-- ---------- 3. Orders ------------------------------------------------
create sequence if not exists public.order_number_seq start 1001;

create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  order_number   text not null unique,                -- shown to the customer
  user_id        uuid references auth.users (id) on delete set null, -- null = guest
  customer_name  text not null,
  phone          text not null,
  email          text,
  address        text not null,
  state          text,
  note           text,
  payment_method text not null default 'transfer'
                 check (payment_method in ('transfer', 'whatsapp', 'cod', 'card')),
  payment_status text not null default 'unpaid'
                 check (payment_status in ('unpaid', 'paid', 'refunded')),
  status         text not null default 'placed'
                 check (status in ('placed', 'confirmed', 'packed', 'out_for_delivery', 'delivered', 'cancelled')),
  subtotal       integer not null check (subtotal >= 0),
  delivery_fee   integer not null default 0 check (delivery_fee >= 0),
  total          integer generated always as (subtotal + delivery_fee) stored,
  rider_name     text,
  rider_phone    text,
  tracking_link  text,
  tracking_note  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders (user_id);
create index if not exists orders_created_idx on public.orders (created_at desc);

create table if not exists public.order_items (
  id         bigint generated always as identity primary key,
  order_id   uuid not null references public.orders (id) on delete cascade,
  product_id text references public.products (id) on delete set null,
  name       text not null,                            -- copied at purchase time
  unit_price integer not null check (unit_price >= 0), -- copied at purchase time
  quantity   integer not null check (quantity > 0)
);
create index if not exists order_items_order_idx on public.order_items (order_id);

create table if not exists public.order_events (
  id         bigint generated always as identity primary key,
  order_id   uuid not null references public.orders (id) on delete cascade,
  status     text not null,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events (order_id);

-- Before an order changes: keep the timestamp fresh, and never reopen a cancelled order.
create or replace function public.orders_before_update()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'A cancelled order cannot be reopened. Create a new order instead.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists orders_before_update on public.orders;
create trigger orders_before_update before update on public.orders
  for each row execute function public.orders_before_update();

-- After the status changes: write it to the history, and put stock back if cancelled.
create or replace function public.orders_after_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.order_events (order_id, status) values (new.id, new.status);
  if new.status = 'cancelled' then
    update public.products p
       set stock = p.stock + oi.quantity
      from public.order_items oi
     where oi.order_id = new.id and oi.product_id = p.id;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_after_status_change on public.orders;
create trigger orders_after_status_change after update of status on public.orders
  for each row when (old.status is distinct from new.status)
  execute function public.orders_after_status_change();

-- Access rules: nobody can create orders directly. Shoppers use place_order() below.
alter table public.orders       enable row level security;
alter table public.order_items  enable row level security;
alter table public.order_events enable row level security;

drop policy if exists "Buyers see their own orders, owner sees all" on public.orders;
create policy "Buyers see their own orders, owner sees all" on public.orders
  for select to authenticated
  using (user_id = auth.uid() or public.is_owner());

drop policy if exists "Owner updates orders" on public.orders;
create policy "Owner updates orders" on public.orders
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists "Owner deletes orders" on public.orders;
create policy "Owner deletes orders" on public.orders
  for delete to authenticated using (public.is_owner());

drop policy if exists "Items follow their order" on public.order_items;
create policy "Items follow their order" on public.order_items
  for select to authenticated
  using (public.is_owner() or exists (
    select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

drop policy if exists "Events follow their order" on public.order_events;
create policy "Events follow their order" on public.order_events
  for select to authenticated
  using (public.is_owner() or exists (
    select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

drop policy if exists "Owner adds order notes" on public.order_events;
create policy "Owner adds order notes" on public.order_events
  for insert to authenticated with check (public.is_owner());

-- ---------- 4a. Private settings and owner alerts --------------------
-- Secret values (alert keys) live in a "private" schema the website can never reach.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.settings (
  key   text primary key,
  value text not null
);
alter table private.settings enable row level security;
revoke all on private.settings from public, anon, authenticated;

-- Sends a new-order alert to the owner by Telegram and/or email, whichever is set up
-- in private.settings (see alerts-setup.sql). If nothing is set up, it does nothing.
-- It uses the pg_net extension, which sends the message in the background.
create or replace function public.notify_new_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o          public.orders;
  v_items    text;
  v_text     text;
  v_site     text;
  v_tg_token text;
  v_tg_chat  text;
  v_rs_key   text;
  v_rs_to    text;
  v_rs_from  text;
begin
  select * into o from public.orders where id = p_order_id;
  if not found then return; end if;

  select string_agg('- ' || name || ' x' || quantity, E'\n' order by id)
    into v_items from public.order_items where order_id = p_order_id;
  select value into v_site from private.settings where key = 'site_url';

  v_text := 'New order ' || o.order_number || E'\n' ||
            o.customer_name || ', ' || o.phone || E'\n' ||
            o.address || coalesce(', ' || o.state, '') || E'\n\n' ||
            coalesce(v_items, '') || E'\n\n' ||
            'Items total: ₦' || to_char(o.subtotal, 'FM999,999,999') || E'\n' ||
            'Payment: ' || o.payment_method ||
            coalesce(E'\nNote: ' || o.note, '');
  if v_site is not null then
    v_text := v_text || E'\n\nOpen dashboard: ' || rtrim(v_site, '/') || '/admin/';
  end if;

  select value into v_tg_token from private.settings where key = 'telegram_bot_token';
  select value into v_tg_chat  from private.settings where key = 'telegram_chat_id';
  if v_tg_token is not null and v_tg_chat is not null then
    begin
      perform net.http_post(
        url     := 'https://api.telegram.org/bot' || v_tg_token || '/sendMessage',
        body    := jsonb_build_object('chat_id', v_tg_chat, 'text', v_text),
        headers := '{"Content-Type": "application/json"}'::jsonb);
    exception when others then null;
    end;
  end if;

  select value into v_rs_key  from private.settings where key = 'resend_api_key';
  select value into v_rs_to   from private.settings where key = 'alert_email';
  select value into v_rs_from from private.settings where key = 'resend_from';
  if v_rs_key is not null and v_rs_to is not null then
    begin
      perform net.http_post(
        url     := 'https://api.resend.com/emails',
        body    := jsonb_build_object(
                     'from', coalesce(v_rs_from, 'Shop alerts <onboarding@resend.dev>'),
                     'to', jsonb_build_array(v_rs_to),
                     'subject', 'New order ' || o.order_number || ' (₦' || to_char(o.subtotal, 'FM999,999,999') || ')',
                     'text', v_text),
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_rs_key));
    exception when others then null;
    end;
  end if;
end;
$$;

revoke all on function public.notify_new_order(uuid) from public, anon, authenticated;

-- ---------- 4. Placing an order (guests and signed-in buyers) --------
-- The website sends only product ids and quantities. Prices and stock are
-- checked HERE, on the server, so nobody can edit a price in their browser.
create or replace function public.place_order(
  p_name text,
  p_phone text,
  p_email text,
  p_address text,
  p_state text,
  p_note text,
  p_payment_method text,
  p_items jsonb
)
returns table (out_order_number text, out_total integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_number   text;
  v_subtotal integer := 0;
  v_item     jsonb;
  v_prod     public.products;
  v_qty      integer;
begin
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_phone), '') = '' or coalesce(trim(p_address), '') = '' then
    raise exception 'Name, phone number and delivery address are required.';
  end if;
  if length(regexp_replace(p_phone, '\D', '', 'g')) < 10 then
    raise exception 'Please enter a valid phone number.';
  end if;
  if p_payment_method not in ('transfer', 'whatsapp', 'cod', 'card') then
    raise exception 'Unknown payment method.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Too many items in one order.';
  end if;

  -- The real order number is only taken at the very end, so a refused order never uses up a number.
  insert into public.orders (order_number, user_id, customer_name, phone, email, address, state, note, payment_method, subtotal)
  values ('PENDING-' || gen_random_uuid()::text, auth.uid(), trim(p_name), trim(p_phone), nullif(trim(p_email), ''), trim(p_address),
          nullif(trim(p_state), ''), nullif(trim(p_note), ''), p_payment_method, 0)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item ->> 'qty')::integer, 0);
    if v_qty < 1 or v_qty > 20 then
      raise exception 'Each item must have a quantity between 1 and 20.';
    end if;

    select * into v_prod from public.products
     where id = v_item ->> 'id' and active
     for update;
    if not found then
      raise exception 'One of the items in your cart is no longer available.';
    end if;
    if v_prod.stock < v_qty then
      raise exception 'Sorry, only % of "%" left in stock.', v_prod.stock, v_prod.name;
    end if;

    update public.products set stock = stock - v_qty where id = v_prod.id;
    insert into public.order_items (order_id, product_id, name, unit_price, quantity)
    values (v_order_id, v_prod.id, v_prod.name, v_prod.price, v_qty);
    v_subtotal := v_subtotal + v_prod.price * v_qty;
  end loop;

  v_number := 'ORD-' || nextval('public.order_number_seq');
  update public.orders set subtotal = v_subtotal, order_number = v_number where id = v_order_id;
  insert into public.order_events (order_id, status, note) values (v_order_id, 'placed', 'Order received');

  -- Tell the owner. An alert problem must never stop a customer's order.
  begin
    perform public.notify_new_order(v_order_id);
  exception when others then
    null;
  end;

  return query select v_number, v_subtotal;
end;
$$;

-- ---------- 5. Tracking an order without an account ------------------
-- A guest needs the order number AND the phone number used to order.
create or replace function public.track_order(p_order_number text, p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  o public.orders;
begin
  select * into o from public.orders
   where order_number = upper(trim(p_order_number))
     and right(regexp_replace(phone, '\D', '', 'g'), 10) = right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10)
     and length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 10;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'order_number', o.order_number,
    'status', o.status,
    'payment_status', o.payment_status,
    'subtotal', o.subtotal,
    'delivery_fee', o.delivery_fee,
    'total', o.total,
    'rider_name', o.rider_name,
    'rider_phone', o.rider_phone,
    'tracking_link', o.tracking_link,
    'tracking_note', o.tracking_note,
    'created_at', o.created_at,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i.name, 'quantity', i.quantity, 'unit_price', i.unit_price)), '[]'::jsonb)
                from public.order_items i where i.order_id = o.id),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('status', e.status, 'note', e.note, 'at', e.created_at) order by e.created_at), '[]'::jsonb)
                 from public.order_events e where e.order_id = o.id)
  );
end;
$$;

-- ---------- 6. Permissions -------------------------------------------
revoke all on function public.place_order(text, text, text, text, text, text, text, jsonb) from public;
grant execute on function public.place_order(text, text, text, text, text, text, text, jsonb) to anon, authenticated;
revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select, update, delete on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select, insert on public.order_events to authenticated;

-- ---------- 7. Product photo storage ---------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view product photos" on storage.objects;
create policy "Anyone can view product photos" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "Owner uploads product photos" on storage.objects;
create policy "Owner uploads product photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images' and public.is_owner());

drop policy if exists "Owner replaces product photos" on storage.objects;
create policy "Owner replaces product photos" on storage.objects
  for update to authenticated using (bucket_id = 'product-images' and public.is_owner());

drop policy if exists "Owner deletes product photos" on storage.objects;
create policy "Owner deletes product photos" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images' and public.is_owner());
