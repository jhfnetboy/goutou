-- Customizable web/link preview (Open Graph card) on the System Settings page.
-- Admins can override the link-preview title, description, and image; all three
-- are nullable and fall back to the bundled seeder-web defaults when unset
-- (PREVIEW_DEFAULTS in lib/system-settings.ts).
ALTER TABLE "system_settings" ADD COLUMN "preview_title" TEXT;
ALTER TABLE "system_settings" ADD COLUMN "preview_description" TEXT;
ALTER TABLE "system_settings" ADD COLUMN "preview_image_key" TEXT;
