import { useState, useEffect, useRef } from 'react';
import { Platform, Alert, AppState } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';
import SimpleEventEmitter from '../lib/event-emitter';

// Event emitter para comunicar notificaciones in-app
export const notificationEventEmitter = new SimpleEventEmitter();

// Cache global para evitar duplicados entre Realtime y Push
const processedNotificationsMap: { [key: string]: number } = {};
// Mantener referencia al canal activo para evitar duplicados
let globalSystemNotifChannel: any = null;
let currentSubscribedUserId: string | null = null;

/**
 * Normaliza los IDs de negocio para de-duplicar correctamente.
 * Prioriza IDs de estancia, orden o consumo sobre el ID técnico de la notificación.
 * Soporta snake_case (web) y camelCase (push/mobile).
 */
const getNormalizedId = (data: any) => {
    if (!data) return null;
    // Buscar en todas las variantes posibles de nombres de campos
    const id = (
        data.stay_id || data.stayId ||
        data.sales_order_id || data.salesOrderId ||
        data.consumption_id || data.consumptionId ||
        data.id
    );
    return id ? String(id) : null;
};

// Helper para evitar duplicados con ventana de 20 segundos para ser más conservadores
const shouldNotifyGlobal = (type: string, id: string | undefined) => {
    if (!id) return true;
    const key = `${type}:${id}`;
    const now = Date.now();
    const lastTime = processedNotificationsMap[key];

    if (lastTime && (now - lastTime < 20000)) {
        console.log(`[Notifications] BLOQUEADO duplicado: ${key} (Hace ${Math.round((now - lastTime) / 1000)}s)`);
        return false;
    }

    processedNotificationsMap[key] = now;
    return true;
};

// Configurar cómo se muestran las notificaciones cuando la app está en primer plano
Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
        const data = notification.request.content.data as any;
        const msgId = getNormalizedId(data);
        const type = data.type || 'SYSTEM';

        console.log(`[Notifications] Handler invocado id=${msgId} type=${type}`);

        // Si ya procesamos esto por Realtime recientemente, silenciamos el Push por completo
        if (msgId && !shouldNotifyGlobal(type, msgId)) {
            console.log(`[Notifications] Handler: SILENCIANDO porque ya fue procesado: ${type}:${msgId}`);
            return {
                shouldPlaySound: false,
                shouldSetBadge: false,
                shouldShowAlert: false,
                shouldShowBanner: false,
                shouldShowList: false,
            };
        }

        console.log(`[Notifications] Handler: MOSTRANDO notificación: ${type}:${msgId}`);
        return {
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowAlert: true,
            shouldShowBanner: true,
            shouldShowList: true,
        };
    },
});

export interface NotificationData {
    type?: 'VEHICLE_REQUEST' | 'NEW_CONSUMPTION' | 'NEW_ENTRY' | 'CHECKOUT_REQUEST' | 'GENERAL' | 'REGULAR_CONSUMPTION' | 'NEW_EXTRA'
    | 'ROOM_CHANGE' | 'DAMAGE_REPORT' | 'PROMO_4H';
    roomNumber?: string;
    stayId?: string;
    consumptionId?: string;
    salesOrderId?: string;
    message?: string;
    newRoomId?: string;
    oldRoomId?: string;
    [key: string]: unknown;
}

export function useNotifications(employeeId: string | null) {
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const notificationListener = useRef<Notifications.Subscription | null>(null);
    const responseListener = useRef<Notifications.Subscription | null>(null);

    useEffect(() => {
        if (!employeeId) return;

        // Registrar para notificaciones push
        console.log('[Notifications] Iniciando registro con employeeId:', employeeId);
        registerForPushNotificationsAsync().then(token => {
            console.log('[Notifications] Token obtenido:', token);
            if (token) {
                setExpoPushToken(token);
                // Guardar token en Supabase
                savePushToken(employeeId, token);
            } else {
                console.warn('[Notifications] No se pudo obtener token');
            }
        }).catch(err => {
            console.error('[Notifications] Error registrando:', err);
        });

        // Listener para notificaciones recibidas mientras la app está abierta
        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            // No guardamos estado para evitar re-renders innecesarios en RootLayout
            handleNotificationReceived(notification);
        });

        // Listener para cuando el usuario toca la notificación
        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            handleNotificationResponse(response);
        });

        return () => {
            if (notificationListener.current) {
                notificationListener.current.remove();
            }
            if (responseListener.current) {
                responseListener.current.remove();
            }
        };
    }, [employeeId]);

    // Suscribirse a cambios en tiempo real de Supabase para notificaciones
    useEffect(() => {
        if (!employeeId) return;

        let isMounted = true;

        const setupRealtime = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!isMounted || !user) return;

            const authUserId = user.id;

            // Si el canal ya existe para este usuario, no hacemos nada
            if (globalSystemNotifChannel && currentSubscribedUserId === authUserId) {
                console.log('[Notifications] Canal activo y válido, manteniendo suscripción.');
                return;
            }

            // Si el canal existía para otro usuario o está muerto, lo limpiamos
            if (globalSystemNotifChannel) {
                console.log('[Notifications] Limpiando canal anterior antes de re-suscripción');
                supabase.removeChannel(globalSystemNotifChannel);
                globalSystemNotifChannel = null;
            }

            console.log('[Notifications] Creando suscripción Realtime filtrada para:', authUserId);
            currentSubscribedUserId = authUserId;

            globalSystemNotifChannel = supabase
                .channel(`system-notifications-${authUserId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${authUserId}`
                    },
                    (payload) => {
                        const newNotif = payload.new as any;
                        const businessId = getNormalizedId(newNotif.data) || newNotif.id;
                        const type = newNotif.data?.type || 'SYSTEM';

                        console.log(`[Notifications] Evento Realtime recibido: ${type}:${businessId}`);

                        // SOLO NOTIFICAR SI LA APP ESTÁ EN PRIMER PLANO
                        if (AppState.currentState === 'active') {
                            console.log(`[Notifications] -> Emitiendo alerta in-app: ${newNotif.title}`);

                            // Emitir evento para que el contexto de in-app notifications lo muestre
                            notificationEventEmitter.emit('inAppNotification', {
                                type: type,
                                title: newNotif.title || 'Nueva Notificación',
                                message: newNotif.message || '',
                                data: { ...newNotif.data, type, id: businessId }
                            });
                        } else {
                            console.log(`[Notifications] Omitiendo alerta (App en segundo plano): ${type}:${businessId}`);
                        }
                    }
                )
                .subscribe((status: string) => {
                    console.log(`[Notifications] Estado del canal (${authUserId}):`, status);
                    if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                        globalSystemNotifChannel = null;
                        currentSubscribedUserId = null;
                    }
                });
        };

        setupRealtime();

        return () => {
            isMounted = false;
            // No destruimos el canal global aquí para permitir que sobreviva a re-renders menores
            // pero sí limpiamos cuando la app se cierra de verdad o el employeeId cambia drásticamente
        };
    }, [employeeId]);

    return {
        expoPushToken,
    };
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
    let token: string | null = null;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#3b82f6',
            sound: 'default',
        });

        // Canal para solicitudes urgentes
        await Notifications.setNotificationChannelAsync('urgent', {
            name: 'Solicitudes Urgentes',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 500, 200, 500],
            lightColor: '#ef4444',
            sound: 'default',
        });
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            Alert.alert(
                'Notificaciones deshabilitadas',
                'Para recibir alertas de solicitudes de vehículos y servicios, habilita las notificaciones en la configuración de tu dispositivo.'
            );
            return null;
        }

        try {
            const projectId = Constants.expoConfig?.extra?.eas?.projectId;
            console.log('[Notifications] Project ID configurado:', projectId);
            if (projectId) {
                token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
            } else {
                console.warn('[Notifications] Project ID no encontrado en la configuración, usando fallback');
                token = (await Notifications.getExpoPushTokenAsync()).data;
            }
        } catch (error: any) {
            console.error('[Notifications] Error detallado al obtener token:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });
        }
    } else {
        console.log('Push notifications require a physical device');
    }

    return token;
}

async function savePushToken(employeeId: string, token: string) {
    try {
        console.log('[Notifications] Guardando token para empleado:', employeeId);
        // Guardar o actualizar el token en la tabla de empleados
        const { data, error } = await supabase
            .from('employees')
            .update({ push_token: token, push_token_updated_at: new Date().toISOString() })
            .eq('id', employeeId)
            .select();

        if (error) {
            console.error('[Notifications] Error saving push token:', error);
        } else {
            console.log('[Notifications] Token guardado exitosamente:', data);
        }
    } catch (error) {
        console.error('[Notifications] Error saving push token:', error);
    }
}

async function scheduleLocalNotification(params: {
    title: string;
    body: string;
    data?: NotificationData;
    channelId?: string;
    identifier?: string; // ID único para evitar duplicados en la bandeja
}) {
    // Asegurar que usamos el canal default si no se especifica uno, para que suene y vibre en Android
    const channelId = params.channelId || 'default';

    await Notifications.scheduleNotificationAsync({
        identifier: params.identifier, // Si es el mismo ID, Expo reemplaza la notificación anterior
        content: {
            title: params.title,
            body: params.body,
            data: params.data || {},
            sound: 'default',
            color: '#3b82f6',
            vibrate: [0, 250, 250, 250],
            priority: Notifications.AndroidNotificationPriority.MAX, // Force High Priority
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 1, // Pequeño delay para asegurar que el channel lo tome
            channelId: channelId, // IMPORTANTE: Vincular al canal de alta prioridad
        },
    });
}

function handleNotificationReceived(notification: Notifications.Notification) {
    const data = notification.request.content.data as unknown as NotificationData;
    console.log('Push notification received:', data);
    // Nota: Aquí podrías implementar más lógica si necesitas silenciar el Push
    // basado en processedNotifications, pero como scheduleLocalNotification
    // ya de-duplica el Realtime, el usuario solo verá el Push de sistema o el local de realtime.
}

function handleNotificationResponse(response: Notifications.NotificationResponse) {
    const data = response.notification.request.content.data as unknown as NotificationData;
    console.log('Notification tapped:', data);

    // Navegación basada en el tipo de notificación
    if (data.type === 'VEHICLE_REQUEST' || data.type === 'CHECKOUT_REQUEST') {
        router.push({
            pathname: '/(tabs)/rooms',
            params: { action: 'checkout', stayId: data.stayId }
        });
    } else if (data.type === 'NEW_ENTRY') {
        router.push({
            pathname: '/(tabs)/rooms',
            params: { action: 'entry', stayId: data.stayId }
        });
    } else if (data.type === 'NEW_CONSUMPTION' || data.type === 'REGULAR_CONSUMPTION') {
        router.push({
            pathname: '/(tabs)/services',
            params: { salesOrderId: data.salesOrderId }
        });
    } else if (data.type === 'NEW_EXTRA' || data.type === 'DAMAGE_REPORT' || data.type === 'PROMO_4H') {
        // Redirigir a verificar extra para estos casos también
        router.push({
            pathname: '/(tabs)/rooms',
            params: {
                action: 'verify',
                consumptionId: data.consumptionId,
                stayId: data.stayId,
                salesOrderId: data.salesOrderId
            }
        });
    } else if (data.type === 'ROOM_CHANGE') {
        // Ir a verificar el cambio de habitación
        router.push({
            pathname: '/(tabs)/rooms',
            params: {
                action: 'verifyRoomChange',
                consumptionId: data.consumptionId,
                stayId: data.stayId,
                salesOrderId: data.salesOrderId
            }
        });
    }
}

// Función para enviar notificación push a un empleado específico
export async function sendPushNotificationToEmployee(
    employeeId: string,
    title: string,
    body: string,
    data?: NotificationData
) {
    try {
        // Obtener el token del empleado
        const { data: employee, error } = await supabase
            .from('employees')
            .select('push_token')
            .eq('id', employeeId)
            .single();

        if (error || !employee?.push_token) {
            console.log('No push token found for employee:', employeeId);
            return;
        }

        // Enviar notificación usando Expo Push API
        const message = {
            to: employee.push_token,
            sound: 'default',
            title,
            body,
            data: data || {},
        };

        await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });
    } catch (error) {
        console.error('Error sending push notification:', error);
    }
}

// Función para enviar notificación a todos los valets activos
export async function sendPushNotificationToAllValets(
    title: string,
    body: string,
    data?: NotificationData
) {
    try {
        // Obtener todos los empleados con rol de valet que tengan turno activo
        const { data: activeValets, error } = await supabase
            .from('shift_sessions')
            .select(`
                employee_id,
                employees!inner(push_token)
            `)
            .eq('status', 'active');

        if (error || !activeValets) {
            console.error('Error getting active valets:', error);
            return;
        }

        const tokens = activeValets
            .map((v: any) => v.employees?.push_token)
            .filter((token: string | null) => token);

        if (tokens.length === 0) return;

        // Enviar a todos los tokens
        const messages = tokens.map((token: string) => ({
            to: token,
            sound: 'default',
            title,
            body,
            data: data || {},
        }));

        await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
        });
    } catch (error) {
        console.error('Error sending push notifications:', error);
    }
}
