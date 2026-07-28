alter table if exists public.invoices
  add column if not exists due_date date;

update public.invoices
set due_date = coalesce(invoice_date::date, created_at::date, current_date) + 30
where due_date is null;

alter table if exists public.invoices
  alter column due_date set default (current_date + 30);
