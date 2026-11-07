-- Public SECURITY INVOKER wrappers require EXECUTE on their internal targets.
-- Keep authorization in the existing implementations; never grant table writes
-- or make the public wrappers SECURITY DEFINER to work around this boundary.
REVOKE EXECUTE ON FUNCTION
  internal.create_or_update_staff_application(text,text,text,text,text,integer,text[],text),
  internal.submit_staff_application(uuid),
  internal.review_staff_application(uuid,text,text),
  internal.approve_staff_application(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  internal.create_or_update_staff_application(text,text,text,text,text,integer,text[],text),
  internal.submit_staff_application(uuid),
  internal.review_staff_application(uuid,text,text),
  internal.approve_staff_application(uuid)
TO authenticated;
