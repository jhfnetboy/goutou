-- System admin config: a single-row settings table (id always = 1) holding
-- app-wide branding read by the root layout on (nearly) every request — the web
-- title, the dynamic system/brand name, one theme accent hex (all shades derived
-- in CSS via color-mix at runtime), and R2 object keys for an uploaded dark/light
-- sidebar logo pair and a square favicon. A seed row is inserted so the read path
-- never has to handle a missing row in the common case; lib/system-settings.ts
-- also carries a DEFAULTS fallback so a failed read never breaks the app. The
-- CHECK ("id" = 1) pins the singleton at the DB level.

CREATE TABLE "system_settings" (
  "id" INTEGER PRIMARY KEY CHECK ("id" = 1),
  "web_title" TEXT NOT NULL DEFAULT 'KeepMe',
  "system_name" TEXT NOT NULL DEFAULT 'KeepMe',
  "accent_color" TEXT NOT NULL DEFAULT '#10b981',
  "logo_dark_key" TEXT,
  "logo_light_key" TEXT,
  "favicon_key" TEXT,
  "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

INSERT INTO "system_settings" ("id") VALUES (1);
