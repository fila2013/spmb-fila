-- Existing blocks retain their data; tutorial titles are optional.
BEGIN;

ALTER TABLE "konten_tahap" ADD COLUMN "judul_tutorial" VARCHAR(200);

ALTER TABLE "konten_tahap"
  DROP CONSTRAINT "konten_tahap_youtube_video_check",
  ADD CONSTRAINT "konten_tahap_youtube_video_check" CHECK (
    "youtube_video_id" IS NULL OR (
      "tahap"::text IN ('home', 'admission_fee') AND
      "youtube_video_id" ~ '^[A-Za-z0-9_-]{11}$'
    )
  ),
  ADD CONSTRAINT "konten_tahap_judul_tutorial_check" CHECK (
    "judul_tutorial" IS NULL OR (
      "tahap"::text = 'admission_fee' AND
      LENGTH(BTRIM("judul_tutorial")) BETWEEN 1 AND 200
    )
  );

COMMIT;
