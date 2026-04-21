-- Beta: record in-app acceptance of bundled terms / privacy summary. Null = not accepted yet (gate in app).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

COMMENT ON COLUMN public.profiles.terms_accepted_at IS 'When set, user has accepted beta terms in app (app/terms). Null forces terms screen on next launch until accepted.';
