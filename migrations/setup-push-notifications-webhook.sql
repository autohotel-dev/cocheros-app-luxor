-- =====================================================
-- CONFIGURACIÓN DE NOTIFICACIONES PUSH EN BACKGROUND
-- =====================================================
-- Este script configura los triggers y funciones necesarias
-- para enviar notificaciones push cuando la app está cerrada.
--
-- IMPORTANTE: Después de ejecutar este script, debes:
-- 1. Desplegar la Edge Function 'send-push-notification'
-- 2. Configurar los Database Webhooks en el dashboard de Supabase
-- =====================================================

-- Función para llamar a la Edge Function de notificaciones
CREATE OR REPLACE FUNCTION notify_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  payload jsonb;
  function_url text;
BEGIN
  -- Construir el payload según el tipo de operación
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', to_jsonb(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END
  );

  -- URL de la Edge Function (reemplazar con tu URL real después del deploy)
  function_url := current_setting('app.settings.edge_function_url', true);
  
  IF function_url IS NULL OR function_url = '' THEN
    -- Si no hay URL configurada, usar pg_notify como fallback
    PERFORM pg_notify('push_notification', payload::text);
  ELSE
    -- Llamar a la Edge Function via HTTP (requiere extensión http)
    -- PERFORM http_post(function_url, payload::text, 'application/json');
    PERFORM pg_notify('push_notification', payload::text);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para room_stays (solicitudes de vehículo y checkout)
DROP TRIGGER IF EXISTS room_stays_push_notification ON room_stays;
CREATE TRIGGER room_stays_push_notification
  AFTER INSERT OR UPDATE ON room_stays
  FOR EACH ROW
  WHEN (
    -- Nueva entrada
    (TG_OP = 'INSERT' AND NEW.status = 'ACTIVA')
    OR
    -- Solicitud de vehículo
    (TG_OP = 'UPDATE' AND NEW.vehicle_requested_at IS NOT NULL AND OLD.vehicle_requested_at IS NULL)
    OR
    -- Solicitud de checkout
    (TG_OP = 'UPDATE' AND NEW.valet_checkout_requested_at IS NOT NULL AND OLD.valet_checkout_requested_at IS NULL)
  )
  EXECUTE FUNCTION notify_push_notification();

-- Trigger para sales_order_items (nuevos consumos)
DROP TRIGGER IF EXISTS sales_order_items_push_notification ON sales_order_items;
CREATE TRIGGER sales_order_items_push_notification
  AFTER INSERT ON sales_order_items
  FOR EACH ROW
  WHEN (NEW.delivery_status = 'PENDING')
  EXECUTE FUNCTION notify_push_notification();

-- =====================================================
-- ALTERNATIVA: Usar Supabase Database Webhooks (Recomendado)
-- =====================================================
-- En lugar de triggers, puedes configurar Database Webhooks
-- directamente en el dashboard de Supabase:
--
-- 1. Ve a Database > Webhooks en tu proyecto de Supabase
-- 2. Crea un nuevo webhook para cada tabla:
--
--    Webhook 1: room_stays_notifications
--    - Table: room_stays
--    - Events: INSERT, UPDATE
--    - URL: https://<project-ref>.supabase.co/functions/v1/send-push-notification
--    - Headers: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
--
--    Webhook 2: sales_order_notifications  
--    - Table: sales_order_items
--    - Events: INSERT
--    - URL: https://<project-ref>.supabase.co/functions/v1/send-push-notification
--    - Headers: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
-- =====================================================

COMMENT ON FUNCTION notify_push_notification IS 
'Función que envía notificaciones push cuando hay eventos relevantes para los cocheros';
