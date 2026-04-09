create index if not exists client_chat_messages_client_active_created_idx
  on public.client_chat_messages (client_id, created_at desc, id desc)
  where coalesce(isdeleted, false) = false;

create index if not exists client_chat_messages_client_active_unread_employee_idx
  on public.client_chat_messages (client_id, read_by_employee, sender_auth_id)
  where coalesce(isdeleted, false) = false;

create index if not exists clients_chat_visibility_idx
  on public.clients (status, handler_id, created_date desc, id)
  where coalesce(isdeleted, false) = false;

create or replace function public.get_client_chat_conversation_summaries(
  p_include_all boolean default false
)
returns table (
  client_id bigint,
  name text,
  email text,
  handler_id text,
  created_date text,
  latest_message_id bigint,
  latest_sender_auth_id text,
  latest_message text,
  latest_attachment_name text,
  latest_created_at text,
  unread_count integer
)
language sql
security definer
set search_path = public
as $$
  with actor as (
    select
      coalesce(auth.uid()::text, '') as auth_id,
      exists (
        select 1
        from public.employees e
        where e.auth_id = auth.uid()::text
          and coalesce(e.isdeleted, false) = false
          and lower(replace(coalesce(e.role, ''), ' ', '')) in ('admin', 'superadmin')
      ) as can_include_all
  ),
  visible_clients as (
    select
      c.id,
      c.name,
      c.email,
      c.handler_id,
      c.created_date
    from public.clients c
    where coalesce(c.isdeleted, false) = false
      and lower(trim(coalesce(c.status, ''))) = 'approved'
      and (
        (select can_include_all from actor) and p_include_all
        or coalesce(c.handler_id, '') = (select auth_id from actor)
      )
  )
  select
    vc.id as client_id,
    vc.name,
    vc.email,
    vc.handler_id,
    vc.created_date::text as created_date,
    latest.id as latest_message_id,
    latest.sender_auth_id as latest_sender_auth_id,
    latest.message as latest_message,
    latest.attachment_name as latest_attachment_name,
    latest.created_at::text as latest_created_at,
    coalesce(unread.unread_count, 0)::integer as unread_count
  from visible_clients vc
  left join lateral (
    select
      m.id,
      m.sender_auth_id,
      m.message,
      m.attachment_name,
      m.created_at
    from public.client_chat_messages m
    where m.client_id = vc.id
      and coalesce(m.isdeleted, false) = false
    order by m.created_at desc nulls last, m.id desc
    limit 1
  ) latest on true
  left join lateral (
    select count(*)::integer as unread_count
    from public.client_chat_messages m
    where m.client_id = vc.id
      and coalesce(m.isdeleted, false) = false
      and m.sender_auth_id is distinct from (select auth_id from actor)
      and coalesce(m.read_by_employee, false) = false
  ) unread on true
  order by coalesce(latest.created_at, vc.created_date) desc nulls last, vc.id desc;
$$;

grant execute on function public.get_client_chat_conversation_summaries(boolean) to authenticated;
grant execute on function public.get_client_chat_conversation_summaries(boolean) to service_role;
