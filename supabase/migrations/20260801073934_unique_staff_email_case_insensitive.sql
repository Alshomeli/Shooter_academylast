/*
  # Canonical staff email

  1. Changes
    - Add a unique index on lower(staff.email) so two staff rows cannot differ
      only by letter case, which would make permission lookups ambiguous.
*/

CREATE UNIQUE INDEX IF NOT EXISTS staff_email_lower_key ON public.staff (lower(email));
