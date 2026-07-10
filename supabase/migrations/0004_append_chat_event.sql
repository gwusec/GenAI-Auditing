-- ===========================================================================
-- 0004 — append-only chat events (fixes §4.6 last-write-wins clobber)
--
-- Problem: the app used to persist a new chat event by rewriting the whole
-- conversations.chat_events array (read → push → write). Two tabs, or a retry,
-- could each read the same array and write back, silently dropping the other's
-- event.
--
-- Fix: append a single event SERVER-SIDE so the array grows atomically and no
-- client ever overwrites the whole thing. SECURITY DEFINER (to perform the
-- update) with an explicit membership check, mirroring the conversations RLS —
-- a caller may only append to a conversation in a study they belong to.
--
-- Idempotent: safe to run more than once.
-- ===========================================================================

create or replace function public.append_chat_event(
  p_conversation_id uuid,
  p_event           jsonb,
  p_state           text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_study uuid;
begin
  select study_id into v_study
    from public.conversations
   where id = p_conversation_id;

  if v_study is null then
    raise exception 'conversation % not found', p_conversation_id;
  end if;

  -- Same authorization as the conversations write policy (0003): the caller must
  -- be a member (investigator or auditor) of the study this conversation belongs to.
  if not public.is_study_member(v_study, auth.uid()) then
    raise exception 'not authorized to append to conversation %', p_conversation_id;
  end if;

  update public.conversations
     set chat_events = coalesce(chat_events, '[]'::jsonb) || jsonb_build_array(p_event),
         state       = coalesce(p_state, state),
         updated_at  = now()
   where id = p_conversation_id;
end;
$$;

-- Auditors sign in anonymously (authenticated role, is_anonymous=true) and
-- investigators are authenticated; both need to append. The membership check
-- inside the function is the real gate.
grant execute on function public.append_chat_event(uuid, jsonb, text) to authenticated, anon;
