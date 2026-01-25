import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
}

serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Webhook received:", payload.type, payload.table);

    let title = "";
    let body = "";
    let shouldNotify = false;

    // Detectar tipo de evento
    if (payload.table === "room_stays") {
      const newRecord = payload.record;
      const oldRecord = payload.old_record;

      // Nueva solicitud de vehículo
      if (
        payload.type === "UPDATE" &&
        newRecord.vehicle_requested_at &&
        !oldRecord?.vehicle_requested_at
      ) {
        title = "🚗 ¡Solicitud de Vehículo!";
        body = "Una habitación solicita su vehículo";
        shouldNotify = true;
      }

      // Solicitud de checkout
      if (
        payload.type === "UPDATE" &&
        newRecord.valet_checkout_requested_at &&
        !oldRecord?.valet_checkout_requested_at
      ) {
        title = "🚪 Solicitud de Salida";
        body = "Una habitación solicita checkout";
        shouldNotify = true;
      }

      // Nueva entrada sin placa registrada
      if (
        payload.type === "INSERT" &&
        newRecord.status === "ACTIVA" &&
        !newRecord.vehicle_plate
      ) {
        title = "🏨 Nueva Entrada";
        body = "Hay una nueva entrada pendiente de registro";
        shouldNotify = true;
      }
    }

    // Nuevo consumo pendiente
    if (payload.table === "sales_order_items") {
      const newRecord = payload.record;
      if (payload.type === "INSERT" && newRecord.delivery_status === "PENDING") {
        title = "🛒 Nuevo Servicio";
        body = "Hay un nuevo servicio pendiente de entrega";
        shouldNotify = true;
      }
    }

    if (!shouldNotify) {
      return new Response(JSON.stringify({ message: "No notification needed" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Obtener tokens de todos los cocheros con turno activo
    const { data: activeValets, error: valetsError } = await supabase
      .from("shift_sessions")
      .select(`
        employee_id,
        employees!inner(push_token, role)
      `)
      .eq("status", "active");

    if (valetsError) {
      console.error("Error getting active valets:", valetsError);
      throw valetsError;
    }

    // Filtrar solo cocheros con push_token
    const tokens = activeValets
      ?.filter((v: any) => v.employees?.role === "cochero" && v.employees?.push_token)
      .map((v: any) => v.employees.push_token) || [];

    // Si no hay cocheros activos, enviar a todos los cocheros con token
    if (tokens.length === 0) {
      const { data: allCocheros } = await supabase
        .from("employees")
        .select("push_token")
        .eq("role", "cochero")
        .eq("is_active", true)
        .not("push_token", "is", null);

      if (allCocheros) {
        tokens.push(...allCocheros.map((e) => e.push_token));
      }
    }

    if (tokens.length === 0) {
      console.log("No push tokens available");
      return new Response(JSON.stringify({ message: "No tokens available" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log(`Sending notification to ${tokens.length} devices`);

    // Enviar notificaciones via Expo Push API
    const messages = tokens.map((token: string) => ({
      to: token,
      sound: "default",
      title,
      body,
      priority: "high",
      channelId: "urgent",
    }));

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log("Expo Push API response:", result);

    return new Response(JSON.stringify({ success: true, sent: tokens.length }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in send-push-notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
