insert into public.notification_reads(notification_id,user_id,read_at)
select id,recipient_user_id,coalesce(created_at,now())
from public.notifications
where recipient_user_id is not null and read=true
on conflict(notification_id,user_id) do nothing;
