-- Repair URLs saved without a scheme (e.g. "google.com/x" rendered as a
-- relative link and 404'd). Going forward, normalizeUrl() is applied on save
-- (actions.ts) and at render time (OneSheet, ThreadView).

-- Text URL columns: prefix https:// where no scheme is present.
UPDATE host_profiles
SET show_url = 'https://' || show_url
WHERE show_url IS NOT NULL AND show_url <> ''
  AND show_url !~ '^[a-zA-Z][a-zA-Z0-9+.-]*:';

UPDATE host_profiles
SET booking_url = 'https://' || booking_url
WHERE booking_url IS NOT NULL AND booking_url <> ''
  AND booking_url !~ '^[a-zA-Z][a-zA-Z0-9+.-]*:';

UPDATE host_profiles
SET recent_episode_url = 'https://' || recent_episode_url
WHERE recent_episode_url IS NOT NULL AND recent_episode_url <> ''
  AND recent_episode_url !~ '^[a-zA-Z][a-zA-Z0-9+.-]*:';

UPDATE guest_profiles
SET booking_url = 'https://' || booking_url
WHERE booking_url IS NOT NULL AND booking_url <> ''
  AND booking_url !~ '^[a-zA-Z][a-zA-Z0-9+.-]*:';

-- JSONB link arrays: rewrite each element's url the same way.
UPDATE guest_profiles
SET proof_links = COALESCE((
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'url' IS NULL OR elem->>'url' = ''
        OR elem->>'url' ~ '^[a-zA-Z][a-zA-Z0-9+.-]*:'
      THEN elem
      ELSE jsonb_set(elem, '{url}', to_jsonb('https://' || (elem->>'url')))
    END
  )
  FROM jsonb_array_elements(proof_links) AS elem
), '[]'::jsonb)
WHERE proof_links IS NOT NULL AND proof_links <> '[]'::jsonb;

UPDATE profiles
SET links = COALESCE((
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'url' IS NULL OR elem->>'url' = ''
        OR elem->>'url' ~ '^[a-zA-Z][a-zA-Z0-9+.-]*:'
      THEN elem
      ELSE jsonb_set(elem, '{url}', to_jsonb('https://' || (elem->>'url')))
    END
  )
  FROM jsonb_array_elements(links) AS elem
), '[]'::jsonb)
WHERE links IS NOT NULL AND links <> '[]'::jsonb;
