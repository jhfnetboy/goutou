-- Square "sidebar icon" for the collapsed sidebar rail. The expanded sidebar
-- shows the wide wordmark (logo_dark_key / logo_light_key); when collapsed it
-- shows a small 1:1 mark. Previously that mark was a hardcoded SVG — this lets
-- an admin upload a custom square icon (R2 key under branding/). Null = use the
-- bundled mark.

ALTER TABLE "system_settings" ADD COLUMN "sidebar_mark_key" TEXT;
