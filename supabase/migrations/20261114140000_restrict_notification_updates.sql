-- Read acknowledgements are stored separately in public.notification_reads.
ALTER POLICY update_notifications_recipient_or_staff
ON public.notifications
USING (
  recipient_user_id IS NULL
  AND (SELECT internal.has_role(ARRAY['manager', 'coach', 'receptionist', 'accountant']))
)
WITH CHECK (
  recipient_user_id IS NULL
  AND (SELECT internal.has_role(ARRAY['manager', 'coach', 'receptionist', 'accountant']))
);
