do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_submissions'
      and column_name = 'authorize_transaction_id'
  ) then
    alter table public.payment_submissions
      drop column authorize_transaction_id;
  end if;
end $$;
