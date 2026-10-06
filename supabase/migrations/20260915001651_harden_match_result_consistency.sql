alter table public.matches drop constraint if exists matches_result_score_consistency;
alter table public.matches add constraint matches_result_score_consistency check (
  (lower(trim(result)) in ('win','won','فوز') and academy_score > opponent_score)
  or (lower(trim(result)) in ('draw','تعادل') and academy_score = opponent_score)
  or (lower(trim(result)) in ('loss','lose','lost','خسارة') and academy_score < opponent_score)
  or (lower(trim(result)) in ('scheduled','cancelled','canceled','postponed','ملغاة','مؤجلة') and academy_score = 0 and opponent_score = 0)
);
create index if not exists idx_matches_team_date on public.matches(team_id, match_date desc);
