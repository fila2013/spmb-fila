-- Store only a validated YouTube video ID. The application constructs the
-- privacy-enhanced embed URL and never stores arbitrary iframe markup.
ALTER TABLE "konten_tahap"
  ADD COLUMN "youtube_video_id" VARCHAR(11);

ALTER TABLE "konten_tahap"
  ADD CONSTRAINT "konten_tahap_youtube_video_check"
  CHECK (
    "youtube_video_id" IS NULL
    OR (
      "tahap"::text = 'home'
      AND "youtube_video_id" ~ '^[A-Za-z0-9_-]{11}$'
    )
  );
