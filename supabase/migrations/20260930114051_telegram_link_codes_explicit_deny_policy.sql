create policy telegram_link_codes_no_direct_access
on public.telegram_link_codes for all to authenticated
using (false) with check (false);
