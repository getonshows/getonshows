-- GetOnShows · Sprint 1 seed: 20 curated launch topic categories.
-- Custom tags are added by users at runtime (topics.is_custom = true,
-- capped at 3 per profile in application code).

insert into public.topics (label, slug) values
  ('Entrepreneurship',        'entrepreneurship'),
  ('Startups',                'startups'),
  ('Marketing',               'marketing'),
  ('Sales',                   'sales'),
  ('Artificial Intelligence', 'artificial-intelligence'),
  ('Software & Technology',   'software-technology'),
  ('Product Management',      'product-management'),
  ('Finance & Investing',     'finance-investing'),
  ('Real Estate',             'real-estate'),
  ('Leadership',              'leadership'),
  ('Career Growth',           'career-growth'),
  ('Health & Wellness',       'health-wellness'),
  ('Fitness',                 'fitness'),
  ('Nutrition',               'nutrition'),
  ('Mental Health',           'mental-health'),
  ('Personal Development',    'personal-development'),
  ('Creativity',              'creativity'),
  ('Writing & Publishing',    'writing-publishing'),
  ('Podcasting & Media',      'podcasting-media'),
  ('Comedy',                  'comedy')
on conflict (slug) do nothing;
