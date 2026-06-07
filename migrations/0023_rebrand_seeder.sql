-- Rebrand: KeepMe -> Seeder. Updates the singleton settings row only when it
-- still holds the original seed defaults, so an operator who already customized
-- their brand name is left untouched. The accent stays emerald (#10b981), so it
-- is intentionally not modified here.
UPDATE "system_settings"
SET "web_title" = 'Seeder'
WHERE "id" = 1 AND "web_title" = 'KeepMe';

UPDATE "system_settings"
SET "system_name" = 'Seeder'
WHERE "id" = 1 AND "system_name" = 'KeepMe';
