-- Optional participant-order targeting; existing blocks retain NULL bounds and
-- remain visible to every participant matching their existing stage/scope.
ALTER TABLE public.konten_tahap
  ADD COLUMN min_participant_order INTEGER,
  ADD COLUMN max_participant_order INTEGER;

ALTER TABLE public.konten_tahap
  ADD CONSTRAINT konten_tahap_participant_order_range_check
    CHECK (
      (min_participant_order IS NULL OR min_participant_order >= 1)
      AND (max_participant_order IS NULL OR max_participant_order >= 1)
      AND (min_participant_order IS NULL OR max_participant_order IS NULL
        OR min_participant_order <= max_participant_order)
    ),
  ADD CONSTRAINT konten_tahap_home_participant_order_check
    CHECK (
      tahap <> 'home'::public.tahap_konten
      OR (min_participant_order IS NULL AND max_participant_order IS NULL)
    );
