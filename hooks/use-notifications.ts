import { useState, useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';

// Configurar cómo se muestran las notificaciones cuando la app está en primer plano
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export interface NotificationData {
    type?: 'VEHICLE_REQUEST' | 'NEW_CONSUMPTION' | 'NEW_ENTRY' | 'CHECKOUT_REQUEST' | 'GENERAL';
    roomNumber?: string;
    stayId?: string;
    consumptionId?: string;
    message?: string;
    [key: string]: unknown;
}

export function useNotifications(employeeId: string | null) {
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [notification, setNotification] = useState<Notifications.Notification | null>(null);
    const notificationListener = useRef<Notifications.Subscription | null>(null);
    const responseListener = useRef<Notifications.Subscription | null>(null);

    useEffect(() => {
        if (!employeeId) return;

        // Registrar para notificaciones push
        registerForPushNotificationsAsync().then(token => {
            if (token) {
                setExpoPushToken(token);
                // Guardar token en Supabase
                savePushToken(employeeId, token);
            }
        });

        // Listener para notificaciones recibidas mientras la app está abierta
        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            setNotification(notification);
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

        // Suscribirse a solicitudes de vehículo (vehicle_requested_at)
        const vehicleChannel = supabase
            .channel('vehicle-requests')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'room_stays',
                    filter: 'status=eq.ACTIVA'
                },
                (payload) => {
                    const newData = payload.new as any;
                    const oldData = payload.old as any;
                    
                    // Detectar nueva solicitud de vehículo
                    if (newData.vehicle_requested_at && !oldData.vehicle_requested_at) {
                        scheduleLocalNotification({
                            title: '🚗 ¡Solicitud de Vehículo!',
                            body: `Habitación solicita su vehículo`,
                            data: { type: 'VEHICLE_REQUEST', stayId: newData.id }
                        });
                    }
                    
                    // Detectar solicitud de checkout
                    if (newData.valet_checkout_requested_at && !oldData.valet_checkout_requested_at) {
                        scheduleLocalNotification({
                            title: '🚪 Solicitud de Salida',
                            body: `Una habitación solicita checkout`,
                            data: { type: 'CHECKOUT_REQUEST', stayId: newData.id }
                        });
                    }
                }
            )
            .subscribe();

        // Suscribirse a nuevos consumos pendientes
        const consumptionChannel = supabase
            .channel('new-consumptions')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'sales_order_items',
                },
                (payload) => {
                    const newItem = payload.new as any;
                    if (newItem.delivery_status === 'PENDING') {
                        scheduleLocalNotification({
                            title: '🛒 Nuevo Servicio',
                            body: `Hay un nuevo servicio pendiente de entrega`,
                            data: { type: 'NEW_CONSUMPTION', consumptionId: newItem.id }
                        });
                    }
                }
            )
            .subscribe();

        // Suscribirse a nuevas entradas
        const entryChannel = supabase
            .channel('new-entries')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'room_stays',
                },
                (payload) => {
                    const newStay = payload.new as any;
                    if (newStay.status === 'ACTIVA' && !newStay.vehicle_plate) {
                        scheduleLocalNotification({
                            title: '🏨 Nueva Entrada',
                            body: `Hay una nueva entrada pendiente de registro`,
                            data: { type: 'NEW_ENTRY', stayId: newStay.id }
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(vehicleChannel);
            supabase.removeChannel(consumptionChannel);
            supabase.removeChannel(entryChannel);
        };
    }, [employeeId]);

    return {
        expoPushToken,
        notification,
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
            if (projectId) {
                token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
            } else {
                // Fallback para desarrollo
                token = (await Notifications.getExpoPushTokenAsync()).data;
            }
        } catch (error) {
            console.error('Error getting push token:', error);
        }
    } else {
        console.log('Push notifications require a physical device');
    }

    return token;
}

async function savePushToken(employeeId: string, token: string) {
    try {
        // Guardar o actualizar el token en la tabla de empleados
        const { error } = await supabase
            .from('employees')
            .update({ push_token: token, push_token_updated_at: new Date().toISOString() })
            .eq('id', employeeId);

        if (error) {
            console.error('Error saving push token:', error);
        }
    } catch (error) {
        console.error('Error saving push token:', error);
    }
}

async function scheduleLocalNotification(params: {
    title: string;
    body: string;
    data?: NotificationData;
    channelId?: string;
}) {
    await Notifications.scheduleNotificationAsync({
        content: {
            title: params.title,
            body: params.body,
            data: params.data || {},
            sound: 'default',
        },
        trigger: null, // Mostrar inmediatamente
    });
}

function handleNotificationReceived(notification: Notifications.Notification) {
    const data = notification.request.content.data as unknown as NotificationData;
    console.log('Notification received:', data);
}

function handleNotificationResponse(response: Notifications.NotificationResponse) {
    const data = response.notification.request.content.data as unknown as NotificationData;
    console.log('Notification tapped:', data);
    
    // Aquí puedes navegar a la pantalla correspondiente según el tipo
    // Por ejemplo, usando expo-router:
    // if (data.type === 'VEHICLE_REQUEST') {
    //     router.push('/rooms');
    // }
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
