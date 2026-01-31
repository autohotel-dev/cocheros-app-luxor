-- =====================================================
-- ALERTAS EXTENDIDAS PARA COCHEROS
-- =====================================================
-- Este script agrega triggers para notificar al cochero de:
-- 1. Horas extra / Personas extra
-- 2. Reporte de daños
-- 3. Promoción 4 horas
-- 4. Cambio de habitación
-- 5. Nuevas reservaciones
-- =====================================================
-- =====================================================
-- 0. ACTUALIZAR TIPOS PERMITIDOS EN NOTIFICATIONS
-- =====================================================
-- Ampliamos el constraint para permitir los nuevos tipos de alertas
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_type_check') THEN
    ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
  END IF;
  
  ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      -- Tipos originales
      'stock_low', 'stock_critical', 'order_pending', 'payment_due', 
      'shift_started', 'shift_ended', 'system_alert', 'info',
      -- Nuevos tipos para Cocheros
      'NEW_EXTRA', 'NEW_CONSUMPTION', 'DAMAGE_REPORT', 'PROMO_4H', 'ROOM_CHANGE'
    )
  );
END $$;

-- 1. Función principal de notificación para cocheros
CREATE OR REPLACE FUNCTION notify_cochero_event()
RETURNS TRIGGER AS $$
DECLARE
  target_user_ids UUID[];
  notification_title TEXT;
  notification_body TEXT;
  notification_data JSONB;
  notification_type TEXT;
  
  -- Variables auxiliares
  room_num TEXT;
  details TEXT;
  metadata JSONB;
BEGIN
  -- Inicializar lista de destinatarios (Valets activos)
  -- Obtenemos los IDs de usuario de los empleados con sesión activa ('active')
  SELECT array_agg(DISTINCT auth_user_id) INTO target_user_ids
  FROM shift_sessions ss
  JOIN employees e ON ss.employee_id = e.id
  WHERE ss.status = 'active'
    AND e.role IN ('cochero', 'admin') -- Usar los slugs correctos de la tabla roles
    AND e.auth_user_id IS NOT NULL;

  -- Si no hay valets activos, no hacemos nada (o podríamos guardar para historial)
  IF target_user_ids IS NULL THEN
    RETURN NEW;
  END IF;

  -- Lógica por tabla y eventos
  
  -- A) SALES ORDER ITEMS (Extras, Daños, Promos)
  -- A) SALES ORDER ITEMS (Extras, Daños, Promos)
  IF TG_TABLE_NAME = 'sales_order_items' THEN
    -- Obtener número de habitación a través de sales_order -> room_stays -> rooms
    -- Relación confirmada: room_stays tiene sales_order_id
    SELECT r.number INTO room_num
    FROM sales_orders so
    JOIN room_stays rs ON so.id = rs.sales_order_id
    JOIN rooms r ON rs.room_id = r.id
    WHERE so.id = NEW.sales_order_id
    LIMIT 1;
    
    room_num := COALESCE(room_num, '?');

    IF NEW.concept_type IN ('EXTRA_HOUR', 'EXTRA_PERSON') THEN
      notification_type := 'NEW_EXTRA';
      notification_title := 'Nueva ' || (CASE WHEN NEW.concept_type = 'EXTRA_HOUR' THEN 'Hora Extra' ELSE 'Persona Extra' END);
      notification_body := 'Habitación ' || room_num || ': Se ha registrado un cargo extra.';
      notification_data := jsonb_build_object(
        'type', 'NEW_EXTRA',
        'consumptionId', NEW.id,
        'salesOrderId', NEW.sales_order_id,
        'roomNumber', room_num
      );

    ELSIF NEW.concept_type IN ('CONSUMPTION', 'Minibar', 'Cafeteria', 'Cocina') THEN
      notification_type := 'NEW_CONSUMPTION';
      notification_title := 'Nuevo Consumo';
      notification_body := 'Habitación ' || room_num || ': Nuevo consumo registrado.';
      notification_data := jsonb_build_object(
        'type', 'NEW_CONSUMPTION',
        'consumptionId', NEW.id,
        'salesOrderId', NEW.sales_order_id,
        'roomNumber', room_num
      );
      
    ELSIF NEW.concept_type = 'DAMAGE_CHARGE' THEN
      notification_type := 'DAMAGE_REPORT';
      notification_title := '⚠️ Reporte de Daños';
      notification_body := 'Habitación ' || room_num || ': ' || LEFT(COALESCE(NEW.issue_description, 'Reporte de daño'), 50);
      notification_data := jsonb_build_object(
        'type', 'DAMAGE_REPORT',
        'consumptionId', NEW.id,
        'salesOrderId', NEW.sales_order_id,
        'roomNumber', room_num
      );
      
    ELSIF NEW.concept_type = 'PROMO_4H' THEN
      notification_type := 'PROMO_4H';
      notification_title := '⏳ Promoción 4 Horas';
      notification_body := 'Habitación ' || room_num || ' ha aplicado promoción de 4 horas.';
      notification_data := jsonb_build_object(
        'type', 'PROMO_4H',
        'consumptionId', NEW.id,
        'salesOrderId', NEW.sales_order_id,
        'roomNumber', room_num
      );
    ELSE
      -- Otros items no notifican al cochero específicamente por ahora
      RETURN NEW;
    END IF;

  -- B) ROOM STAYS (Cambio de habitación)
  ELSIF TG_TABLE_NAME = 'room_stays' THEN
    IF TG_OP = 'UPDATE' AND OLD.room_id IS DISTINCT FROM NEW.room_id THEN
      -- Obtener números de habitación
      DECLARE
        old_room_num TEXT;
        new_room_num TEXT;
      BEGIN
        SELECT number INTO old_room_num FROM rooms WHERE id = OLD.room_id;
        SELECT number INTO new_room_num FROM rooms WHERE id = NEW.room_id;
        
        notification_type := 'ROOM_CHANGE';
        notification_title := 'Cambio de Habitación';
        notification_body := 'Cambio: Hab ' || COALESCE(old_room_num, '?') || ' ➡️ Hab ' || COALESCE(new_room_num, '?');
        notification_data := jsonb_build_object(
          'type', 'ROOM_CHANGE',
          'stayId', NEW.id,
          'oldRoomId', OLD.room_id,
          'newRoomId', NEW.room_id,
          'oldRoomNumber', old_room_num,
          'newRoomNumber', new_room_num
        );
      END;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- Solo insertar si se definió un tipo de notificación
  IF notification_type IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, data, type, created_at)
    SELECT 
      target_id,
      notification_title,
      notification_body,
      notification_data,
      notification_type,
      NOW()
    FROM unnest(target_user_ids) AS target_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Crear Triggers

-- Trigger para SALES_ORDER_ITEMS (Extras, Daños, Promos)
DROP TRIGGER IF EXISTS trigger_notify_cochero_items ON sales_order_items;
CREATE TRIGGER trigger_notify_cochero_items
AFTER INSERT ON sales_order_items
FOR EACH ROW
EXECUTE FUNCTION notify_cochero_event();

-- Trigger para ROOM_STAYS (Cambio de habitación)
DROP TRIGGER IF EXISTS trigger_notify_cochero_room_change ON room_stays;
CREATE TRIGGER trigger_notify_cochero_room_change
AFTER UPDATE ON room_stays
FOR EACH ROW
WHEN (OLD.room_id IS DISTINCT FROM NEW.room_id)
EXECUTE FUNCTION notify_cochero_event();

-- 3. Configuración del Webhook para Notificaciones (Push)
-- ========================================================
-- IMPORTANTE: Para que las notificaciones lleguen al dispositivo (Push)
-- y no solo se muestren cuando la app está abierta, debes configurar
-- un Database Webhook en Supabase (o un trigger pg_notify si usas Edge Functions custom).
--
-- Si ya tienes un webhook configurado para 'room_stays', agrega uno nuevo para 'notifications':
--
-- Tabla: notifications
-- Eventos: INSERT
-- Webhook URL: (La misma que usas para send-push-notification)
-- ========================================================
