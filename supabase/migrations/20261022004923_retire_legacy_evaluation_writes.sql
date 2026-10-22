-- The supplied PDF forms are the only client write path. Preserve historic rows
-- and the publish/read APIs, but prevent old RPCs from bypassing PDF criteria.
do $$
declare f record;
begin
 for f in select p.oid::regprocedure as signature
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='public' and p.proname in ('save_player_evaluation','save_player_evaluation_v2'))
    or (n.nspname='internal' and p.proname in ('save_player_evaluation_impl','save_player_evaluation_v2_impl'))
 loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;
end $$;
notify pgrst,'reload schema';
