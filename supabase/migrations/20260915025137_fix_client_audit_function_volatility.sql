alter function internal.record_client_audit_log(text,text) volatile;
alter function internal.record_client_login_audit(text,text) volatile;
alter function public.record_audit_log(text,text) volatile;
alter function public.record_login_audit_log(text,text) volatile;
