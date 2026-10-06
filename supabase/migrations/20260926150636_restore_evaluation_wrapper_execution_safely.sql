grant usage on schema internal to authenticated;
grant execute on function internal.publish_player_evaluation_impl(uuid) to authenticated;
grant execute on function internal.save_player_evaluation_impl(uuid, text, date, text, smallint, smallint, smallint, smallint, smallint, text, text, text, text) to authenticated;
grant execute on function internal.save_player_evaluation_v2_impl(uuid, text, date, text, smallint, smallint, smallint, smallint, smallint, text, text, text, text, jsonb, text[], text, date, text) to authenticated;
revoke all on function internal.publish_player_evaluation_impl(uuid) from public, anon;
revoke all on function internal.save_player_evaluation_impl(uuid, text, date, text, smallint, smallint, smallint, smallint, smallint, text, text, text, text) from public, anon;
revoke all on function internal.save_player_evaluation_v2_impl(uuid, text, date, text, smallint, smallint, smallint, smallint, smallint, text, text, text, text, jsonb, text[], text, date, text) from public, anon;
