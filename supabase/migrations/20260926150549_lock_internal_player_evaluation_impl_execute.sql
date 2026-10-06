revoke all on function internal.publish_player_evaluation_impl(uuid) from public, anon, authenticated;
revoke all on function internal.save_player_evaluation_impl(uuid, text, date, text, smallint, smallint, smallint, smallint, smallint, text, text, text, text) from public, anon, authenticated;
revoke all on function internal.save_player_evaluation_v2_impl(uuid, text, date, text, smallint, smallint, smallint, smallint, smallint, text, text, text, text, jsonb, text[], text, date, text) from public, anon, authenticated;
