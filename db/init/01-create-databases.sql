-- The "after" app uses the default `invoices` database (created via POSTGRES_DB).
-- The vulnerable "before" app gets its own database so the two schemas never collide.
CREATE DATABASE mvp;
