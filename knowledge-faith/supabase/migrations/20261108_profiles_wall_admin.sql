-- Curated User Profiles, Controlled Dual-Post Engine & Institutional Admin Cockpit
-- Migration: 20261108_profiles_wall_admin.sql

CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  banner_url TEXT DEFAULT '/assets/banner-art.jpg',
  role TEXT NOT NULL DEFAULT 'seeker' CHECK (role IN ('seeker', 'researcher', 'scholar', 'admin')),
  bio TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wall_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'reflection' CHECK (type IN ('reflection', 'podcast')),
  surah INTEGER,
  ayah INTEGER,
  verse_text TEXT,
  translation_text TEXT,
  podcast_id TEXT,
  podcast_audio_url TEXT,
  reflection_text VARCHAR(500) NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'emerald' CHECK (theme IN ('emerald', 'amethyst', 'obsidian', 'sapphire', 'amber')),
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wall_posts_status_created ON public.wall_posts (status, is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wall_posts_user_id ON public.wall_posts (user_id, status);

CREATE TABLE IF NOT EXISTS public.admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.admin_settings (key, value)
VALUES
  ('moderation_mode', '"instant"'::jsonb),
  ('hero_banner_url', '"/assets/banner-art.jpg"'::jsonb),
  ('desk_palette', '"emerald-gold"'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.unanswered_questions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'ta', 'si')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered')),
  answer TEXT,
  answered_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unanswered_questions_status ON public.unanswered_questions (status, created_at DESC);
