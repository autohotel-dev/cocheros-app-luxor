-- Agregar columna push_token a la tabla employees para notificaciones push
-- Ejecutar en Supabase SQL Editor

ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS push_token TEXT;

ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS push_token_updated_at TIMESTAMPTZ;

-- Índice para búsquedas rápidas por token
CREATE INDEX IF NOT EXISTS idx_employees_push_token ON employees(push_token) WHERE push_token IS NOT NULL;

-- Comentarios
COMMENT ON COLUMN employees.push_token IS 'Expo Push Token para notificaciones móviles';
COMMENT ON COLUMN employees.push_token_updated_at IS 'Última actualización del push token';
