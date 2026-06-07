-- Rows created via the workspace mutation route before the codeNumber fix
-- have code_number = NULL. Assign sequential numbers per project, picking up
-- after any existing max so we don't collide with the unique index.

UPDATE tasks
SET code_number = (
  SELECT next_code
  FROM (
    SELECT id,
      (
        COALESCE(
          (SELECT MAX(code_number) FROM tasks t2 WHERE t2.project_id = t.project_id),
          0
        )
        + ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at, id)
      ) AS next_code
    FROM tasks t
    WHERE code_number IS NULL
  ) numbered
  WHERE numbered.id = tasks.id
)
WHERE code_number IS NULL;

UPDATE client_requests
SET code_number = (
  SELECT next_code
  FROM (
    SELECT id,
      (
        COALESCE(
          (SELECT MAX(code_number) FROM client_requests r2 WHERE r2.project_id = r.project_id),
          0
        )
        + ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at, id)
      ) AS next_code
    FROM client_requests r
    WHERE code_number IS NULL
  ) numbered
  WHERE numbered.id = client_requests.id
)
WHERE code_number IS NULL;
