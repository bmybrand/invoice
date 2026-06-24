begin;

alter table if exists public.invoices
  add column if not exists payment_gateway_id bigint references public.payment_gateways (id) on delete set null;

create index if not exists invoices_payment_gateway_id_idx on public.invoices (payment_gateway_id);

comment on column public.invoices.payment_gateway_id is
  'Stripe payment gateway selected when the invoice was created.';

commit;
