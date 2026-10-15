-- TRANSWORLD DELIVERY: run once after the installed schema.sql.
begin;
create or replace function public.cargo_execute(statements jsonb)
returns jsonb language plpgsql security invoker
set search_path = pg_catalog, public
as $cargo$
declare
  command jsonb; query_text text; rows_json jsonb;
  affected bigint := 0; output jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(statements) <> 'array' or jsonb_array_length(statements) > 7000 then
    raise exception 'Invalid transaction';
  end if;
  perform pg_advisory_xact_lock(41026, 15001);
  foreach command in array array(select jsonb_array_elements(statements)) loop
    query_text := command #>> '{}';
    if query_text ~* '^\s*select\s' then
      execute 'select coalesce(jsonb_agg(to_jsonb(cargo_row)), ''[]''::jsonb) from (' || query_text || ') cargo_row'
        into rows_json using affected;
      affected := 0;
    elsif query_text ~* '^\s*(insert\s+into|update|delete\s+from)\s' then
      execute query_text using affected;
      get diagnostics affected = row_count;
      rows_json := '[]'::jsonb;
    else
      raise exception 'Unsupported business statement';
    end if;
    output := output || jsonb_build_array(jsonb_build_object('rows', rows_json, 'changes', affected));
  end loop;
  return output;
end
$cargo$;
revoke all on function public.cargo_execute(jsonb) from public, anon, authenticated;
grant execute on function public.cargo_execute(jsonb) to service_role;
create table if not exists public.cargo_rate_limits (
  id text primary key, attempts integer not null, expires timestamptz not null
);
alter table public.cargo_rate_limits enable row level security;
revoke all on public.cargo_rate_limits from public, anon, authenticated;
grant all on public.cargo_rate_limits to service_role;
create or replace function public.cargo_throttle(p_key text, p_limit integer default 10)
returns boolean language plpgsql security invoker
set search_path = pg_catalog, public
as $throttle$
declare hits integer;
begin
  insert into public.cargo_rate_limits(id, attempts, expires)
  values(p_key, 1, now() + interval '15 minutes')
  on conflict(id) do update
    set attempts = case when cargo_rate_limits.expires < now() then 1 else cargo_rate_limits.attempts + 1 end,
        expires = case when cargo_rate_limits.expires < now() then now() + interval '15 minutes' else cargo_rate_limits.expires end
  returning attempts into hits;
  return hits <= p_limit;
end
$throttle$;
revoke all on function public.cargo_throttle(text,integer) from public, anon, authenticated;
grant execute on function public.cargo_throttle(text,integer) to service_role;
notify pgrst, 'reload schema';
commit;
