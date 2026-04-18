begin;

alter table if exists public.invoices
  add column if not exists brand_id bigint references public.brands (id) on delete set null;

update public.invoices as invoices
set brand_id = brands.id
from public.brands as brands
where invoices.brand_id is null
  and lower(trim(coalesce(invoices.brand_name, ''))) = lower(trim(coalesce(brands.brand_name, '')));

create index if not exists invoices_brand_id_idx on public.invoices (brand_id);

comment on column public.invoices.brand_id is
  'Canonical brand foreign key. Keep brand_name as the immutable snapshot shown on historical invoices.';

comment on column public.invoices.brand_name is
  'Display snapshot of the brand name at invoice creation time.';

alter table if exists public.invoices
  alter column amount type numeric(10,2)
  using coalesce(nullif(regexp_replace(coalesce(amount::text, ''), '[^0-9.\-]', '', 'g'), '')::numeric, 0);

alter table if exists public.invoices
  alter column amount set default 0.00;

alter table if exists public.clients
  alter column isdeleted set default false;

delete from public.payment_submissions as submissions
using public.payment_submissions as duplicates
where submissions.id < duplicates.id
  and submissions.stripe_payment_intent_id is not null
  and submissions.stripe_payment_intent_id = duplicates.stripe_payment_intent_id;

create unique index if not exists payment_submissions_stripe_intent_uniq
  on public.payment_submissions (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

insert into public.client_chat_message_attachments (
  message_id,
  attachment_name,
  attachment_path,
  sort_order,
  created_at
)
select
  messages.id,
  messages.attachment_name,
  messages.attachment_path,
  0,
  coalesce(messages.created_at, now())
from public.client_chat_messages as messages
where coalesce(messages.attachment_path, '') <> ''
  and not exists (
    select 1
    from public.client_chat_message_attachments as attachments
    where attachments.message_id = messages.id
      and coalesce(attachments.sort_order, 0) = 0
  );

comment on table public.payment_submissions is
  'Contains payer contact details for payment reconciliation and support. Retain only as long as operationally required and provide a redaction path for privacy requests.';

commit;
