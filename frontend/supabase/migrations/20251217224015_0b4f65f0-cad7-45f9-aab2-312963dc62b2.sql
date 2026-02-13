-- Make comprovativos bucket public
UPDATE storage.buckets SET public = true WHERE id = 'comprovativos';