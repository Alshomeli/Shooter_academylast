-- Public snapshots are separate from manager-only drafts and history.
create table public.academy_content_drafts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('news','gallery','video','coach','contact')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 20000),
  sort_order integer not null default 0,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create table public.academy_content_public (
  id uuid primary key references public.academy_content_drafts(id),
  kind text not null,
  payload jsonb not null,
  sort_order integer not null,
  published_at timestamptz not null default now()
);
create table public.academy_content_revisions (
  id bigint generated always as identity primary key,
  content_id uuid not null references public.academy_content_drafts(id),
  version integer not null,
  payload jsonb not null,
  sort_order integer not null,
  action text not null,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  unique(content_id,version)
);
alter table public.academy_content_drafts enable row level security;
alter table public.academy_content_public enable row level security;
alter table public.academy_content_revisions enable row level security;
revoke all on public.academy_content_drafts, public.academy_content_public, public.academy_content_revisions from public, anon, authenticated;
grant select, insert, update on public.academy_content_drafts to authenticated;
grant select on public.academy_content_public to anon, authenticated;
grant insert, update, delete on public.academy_content_public to authenticated;
grant select on public.academy_content_revisions to authenticated;
revoke all on public.academy_content_drafts, public.academy_content_revisions from anon;
create policy content_drafts_manager on public.academy_content_drafts for all to authenticated
  using (internal.has_role(array['manager'])) with check (internal.has_role(array['manager']));
create policy content_public_read on public.academy_content_public for select to anon, authenticated using (true);
create policy content_public_insert on public.academy_content_public for insert to authenticated with check (internal.has_role(array['manager']));
create policy content_public_update on public.academy_content_public for update to authenticated using (internal.has_role(array['manager'])) with check (internal.has_role(array['manager']));
create policy content_public_delete on public.academy_content_public for delete to authenticated using (internal.has_role(array['manager']));
create policy content_history_manager on public.academy_content_revisions for select to authenticated using (internal.has_role(array['manager']));

create function internal.content_stamp() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.kind <> old.kind then raise exception 'Content identity cannot change'; end if;
    new.version := old.version + 1;
  else new.version := 1;
  end if;
  new.updated_at := now(); new.updated_by := auth.uid();
  return new;
end $$;
create function internal.content_history() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.academy_content_revisions(content_id,version,payload,sort_order,action,changed_by)
  values(new.id,new.version,new.payload,new.sort_order,
    case when tg_op='INSERT' then 'created' else coalesce(nullif(current_setting('app.content_action',true),''),'saved') end, auth.uid());
  return new;
end $$;
revoke all on function internal.content_stamp(), internal.content_history() from public, anon, authenticated;
create trigger content_stamp before insert or update on public.academy_content_drafts for each row execute function internal.content_stamp();
create trigger content_history after insert or update on public.academy_content_drafts for each row execute function internal.content_history();

create function public.publish_academy_content(content_id uuid, expected_version integer, visible boolean)
returns void language plpgsql security invoker set search_path = '' as $$
declare item public.academy_content_drafts;
begin
  if not internal.has_role(array['manager']) then raise exception 'Manager access required' using errcode='42501'; end if;
  select * into item from public.academy_content_drafts where id=content_id for update;
  if not found then raise exception 'Content not found'; end if;
  if item.version is distinct from expected_version then raise exception 'Content changed; reload before publishing'; end if;
  if visible then
    if item.kind <> 'contact' and nullif(btrim(item.payload->>'title'),'') is null then raise exception 'Title required'; end if;
    if item.kind in ('gallery','coach') and coalesce(nullif(item.payload->>'image_path',''),nullif(item.payload->>'image','')) is null then raise exception 'Image required'; end if;
    if item.kind='video' and coalesce(nullif(item.payload->>'video_path',''),nullif(item.payload->>'video','')) is null then raise exception 'Video required'; end if;
    insert into public.academy_content_public(id,kind,payload,sort_order,published_at)
    values(item.id,item.kind,item.payload,item.sort_order,now())
    on conflict(id) do update set payload=excluded.payload,sort_order=excluded.sort_order,published_at=excluded.published_at;
  else delete from public.academy_content_public where id=content_id;
  end if;
  perform set_config('app.content_action',case when visible then 'published' else 'hidden' end,true);
  update public.academy_content_drafts set updated_at=now() where id=content_id;
  perform set_config('app.content_action','',true);
end $$;
revoke all on function public.publish_academy_content(uuid,integer,boolean) from public, anon;
grant execute on function public.publish_academy_content(uuid,integer,boolean) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('academy-content','academy-content',false,20971520,array['image/jpeg','image/png','image/webp','video/mp4']);
create policy content_asset_manager on storage.objects for all to authenticated
  using(bucket_id='academy-content' and internal.has_role(array['manager']))
  with check(bucket_id='academy-content' and internal.has_role(array['manager']));
create policy content_asset_published on storage.objects for select to anon, authenticated using (
  bucket_id='academy-content' and exists(select 1 from public.academy_content_public c
    where c.payload->>'image_path'=name or c.payload->>'video_path'=name or c.payload->>'poster_path'=name)
);
create index content_history_item on public.academy_content_revisions(content_id,changed_at desc);
create index content_public_order on public.academy_content_public(kind,sort_order);

-- Preserve the academy-approved existing public material.
insert into public.academy_content_drafts(id,kind,payload,sort_order) values('acade000-0000-4000-8000-000000000001','news','{"title":"شوتر تنضم إلى Junior Premier League","body":"أكاديمية شوتر مسجلة رسميًا للمشاركة في موسم 2026/27 من Junior Premier League. نترقب موسمًا يجمع اللاعبين والمدربين وأولياء الأمور على شغف المنافسة والتطور.","image":"/home/jpl-2026-27.jpg","alt":"إعلان انضمام أكاديمية شوتر إلى Junior Premier League"}'::jsonb,1);
insert into public.academy_content_drafts(id,kind,payload,sort_order) values('acade000-0000-4000-8000-000000000002','news','{"title":"مشاركة مواليد 2014 في مهرجان الاتحاد الآسيوي","body":"نفخر بمشاركة لاعبينا في المهرجان. فرصة لاكتساب الخبرة، وتعزيز العمل الجماعي، والاستمتاع بكرة القدم معًا.","image":"/home/festival-team.jpg","alt":"فريق مواليد 2014 في مهرجان الاتحاد الآسيوي"}'::jsonb,2);
insert into public.academy_content_drafts(id,kind,payload,sort_order) values('acade000-0000-4000-8000-000000000003','gallery','{"title":"فريق واحد، وشغف يجمعنا","body":"لاعبو أكاديمية شوتر في مهرجان الاتحاد الآسيوي لفئة مواليد 2014. تجربة تعزز روح الفريق وحب كرة القدم.","image":"/home/festival-team.jpg","alt":"صورة جماعية لفريق أكاديمية شوتر في الملعب"}'::jsonb,3);
insert into public.academy_content_drafts(id,kind,payload,sort_order) values('acade000-0000-4000-8000-000000000004','gallery','{"title":"لحظات نعيشها معًا","body":"من المدرجات إلى الملعب، تتكوّن ذكريات الفريق. مشاركة تمنح لاعبينا فرصة للتعلم والتواصل مع زملائهم.","image":"/home/festival-stands.jpg","alt":"لاعبو أكاديمية شوتر مجتمعون في مدرجات الملعب"}'::jsonb,4);
insert into public.academy_content_drafts(id,kind,payload,sort_order) values('acade000-0000-4000-8000-000000000005','gallery','{"title":"ذكريات تبقى مع الفريق","body":"لقطة جماعية من المشاركة؛ وجوه يملؤها الشغف، وخطوات جديدة في رحلة التطور الكروي.","image":"/home/festival-medals.jpg","alt":"لاعبو أكاديمية شوتر في صورة جماعية بعد المشاركة"}'::jsonb,5);
insert into public.academy_content_drafts(id,kind,payload,sort_order) values('acade000-0000-4000-8000-000000000006','video','{"title":"فريد البلوشي إلى نادي النجمة","body":"فريد البلوشي، مواليد 2012، لاعب أكاديمية شوتر الذي سبق له تمثيل نادي المحرق، ينتقل إلى صفوف نادي النجمة. نعتز بخطوته الجديدة ونتمنى له التوفيق.","video":"/home/farid-albalushi.mp4","poster":"/home/farid-poster.jpg"}'::jsonb,6);
insert into public.academy_content_drafts(id,kind,payload,sort_order) values('acade000-0000-4000-8000-000000000007','contact','{"instagram":"https://www.instagram.com/shooter.academy.bh/","tiktok":"https://www.tiktok.com/@shooter_academy","facebook":"https://www.facebook.com/Shooter.academy.bh/","whatsapp":"https://wa.me/97332287776","maps":"https://maps.app.goo.gl/h7MjBm9kDBykRmkKA?g_st=ac"}'::jsonb,7);
insert into public.academy_content_public(id,kind,payload,sort_order) select id,kind,payload,sort_order from public.academy_content_drafts;
