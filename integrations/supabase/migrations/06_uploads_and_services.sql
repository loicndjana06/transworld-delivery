-- Ajouts sans suppression : imports directs prives et prestations conditionnelles.
begin;
create table if not exists public.cargo_uploads (
  id text primary key,
  shipment_id text not null references public.shipments(id) on delete cascade,
  invoice_id text references public.invoices(id) on delete cascade,
  object_key text not null unique,
  name text not null,
  mime text not null check (mime in ('application/pdf','image/jpeg','image/png')),
  size integer not null check (size > 0 and size <= 10485760),
  kind text not null,
  shared integer not null default 0 check (shared in (0,1)),
  expires timestamptz not null,
  completed_at timestamptz
);
create index if not exists cargo_uploads_shipment_idx on public.cargo_uploads(shipment_id);
create table if not exists public.service_tasks (
  id text primary key,
  shipment_id text not null references public.shipments(id) on delete cascade,
  invoice_id text not null unique references public.invoices(id) on delete cascade,
  action text not null,
  requires_payment integer not null default 1 check (requires_payment in (0,1)),
  status text not null default 'pending' check (status in ('pending','confirmed')),
  source text not null default '',
  confirmed_at timestamptz,
  version integer not null default 0,
  updated timestamptz not null default now()
);
create index if not exists service_tasks_shipment_idx on public.service_tasks(shipment_id);
alter table public.cargo_uploads enable row level security;
alter table public.service_tasks enable row level security;
revoke all on public.cargo_uploads, public.service_tasks from public, anon, authenticated;
grant all on public.cargo_uploads, public.service_tasks to service_role;
notify pgrst, 'reload schema';
commit;
