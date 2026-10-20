-- ===========================================================================
-- 0005 — derive session progress from completed conversations
--
-- Replaces the increment-only helper from 0003. Repeated completion callbacks
-- now return the same progress instead of advancing the session more than once.
-- ===========================================================================

create or replace function public.complete_session_conversation(p_session_id uuid)
returns public.auditor_sessions
language plpgsql security definer set search_path = public as $$
declare
  v_session public.auditor_sessions;
  v_completed integer;
begin
  select * into v_session from public.auditor_sessions
   where id = p_session_id and auditor_id = auth.uid()
   for update;
  if not found then
    raise exception 'Session not found or not yours';
  end if;

  select count(*)::integer into v_completed
    from public.conversations
   where session_id = p_session_id
     and auditor_id = auth.uid()
     and state = 'complete';

  update public.auditor_sessions
     set completed_conversations = case
           when expected_conversations is null then v_completed
           else least(v_completed, expected_conversations)
         end,
         status = case
           when expected_conversations is not null
             and v_completed >= expected_conversations then 'complete'
           else 'in_progress'
         end
   where id = p_session_id
  returning * into v_session;

  return v_session;
end;
$$;

grant execute on function public.complete_session_conversation(uuid) to authenticated;
