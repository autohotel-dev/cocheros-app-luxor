import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions, Vibration, Platform } from 'react-native';
import { Bell, X, Car, ShoppingCart, UserPlus, Clock, AlertTriangle, RefreshCcw } from 'lucide-react-native';
import { notificationEventEmitter } from '../hooks/use-notifications';
import { useTheme } from './theme-context';

// Tipos de notificación soportados
export type InAppNotificationType =
    | 'VEHICLE_REQUEST'
    | 'NEW_CONSUMPTION'
    | 'NEW_ENTRY'
    | 'CHECKOUT_REQUEST'
    | 'NEW_EXTRA'
    | 'ROOM_CHANGE'
    | 'DAMAGE_REPORT'
    | 'PROMO_4H'
    | 'GENERAL';

export interface InAppNotification {
    id: string;
    type: InAppNotificationType;
    title: string;
    message: string;
    data?: any;
    timestamp: number;
}

interface InAppNotificationContextType {
    showNotification: (notification: Omit<InAppNotification, 'id' | 'timestamp'>) => void;
    dismissNotification: (id: string) => void;
    dismissAll: () => void;
}

const InAppNotificationContext = createContext<InAppNotificationContextType | undefined>(undefined);

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Configuración de iconos y colores por tipo de notificación (light mode / dark mode)
const getNotificationConfig = (isDark: boolean): Record<InAppNotificationType, { icon: any; color: string; bgColor: string; textColor: string; subtitleColor: string }> => ({
    VEHICLE_REQUEST: { icon: Car, color: '#ef4444', bgColor: isDark ? '#1c1917' : '#fef2f2', textColor: isDark ? '#fafafa' : '#18181b', subtitleColor: isDark ? '#a1a1aa' : '#71717a' },
    CHECKOUT_REQUEST: { icon: Car, color: '#f97316', bgColor: isDark ? '#1c1917' : '#fff7ed', textColor: isDark ? '#fafafa' : '#18181b', subtitleColor: isDark ? '#a1a1aa' : '#71717a' },
    NEW_CONSUMPTION: { icon: ShoppingCart, color: '#3b82f6', bgColor: isDark ? '#1c1917' : '#eff6ff', textColor: isDark ? '#fafafa' : '#18181b', subtitleColor: isDark ? '#a1a1aa' : '#71717a' },
    NEW_ENTRY: { icon: UserPlus, color: '#22c55e', bgColor: isDark ? '#1c1917' : '#f0fdf4', textColor: isDark ? '#fafafa' : '#18181b', subtitleColor: isDark ? '#a1a1aa' : '#71717a' },
    NEW_EXTRA: { icon: UserPlus, color: '#8b5cf6', bgColor: isDark ? '#1c1917' : '#f5f3ff', textColor: isDark ? '#fafafa' : '#18181b', subtitleColor: isDark ? '#a1a1aa' : '#71717a' },
    ROOM_CHANGE: { icon: RefreshCcw, color: '#06b6d4', bgColor: isDark ? '#1c1917' : '#ecfeff', textColor: isDark ? '#fafafa' : '#18181b', subtitleColor: isDark ? '#a1a1aa' : '#71717a' },
    DAMAGE_REPORT: { icon: AlertTriangle, color: '#ef4444', bgColor: isDark ? '#1c1917' : '#fef2f2', textColor: isDark ? '#fafafa' : '#18181b', subtitleColor: isDark ? '#a1a1aa' : '#71717a' },
    PROMO_4H: { icon: Clock, color: '#eab308', bgColor: isDark ? '#1c1917' : '#fefce8', textColor: isDark ? '#fafafa' : '#18181b', subtitleColor: isDark ? '#a1a1aa' : '#71717a' },
    GENERAL: { icon: Bell, color: '#6b7280', bgColor: isDark ? '#1c1917' : '#f9fafb', textColor: isDark ? '#fafafa' : '#18181b', subtitleColor: isDark ? '#a1a1aa' : '#71717a' },
});

// Componente individual de notificación
function NotificationToast({
    notification,
    onDismiss,
    index,
    isDark
}: {
    notification: InAppNotification;
    onDismiss: () => void;
    index: number;
    isDark: boolean;
}) {
    const translateY = useRef(new Animated.Value(-100)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const notificationConfig = getNotificationConfig(isDark);
    const config = notificationConfig[notification.type] || notificationConfig.GENERAL;
    const Icon = config.icon;

    useEffect(() => {
        // Animación de entrada
        Animated.parallel([
            Animated.spring(translateY, {
                toValue: 0,
                tension: 100,
                friction: 10,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const handleDismiss = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -100,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onDismiss();
        });
    };

    // Animación de pulso para el icono
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.1,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, []);

    return (
        <Animated.View
            style={{
                position: 'absolute',
                top: 60 + (index * 110),
                left: 12,
                right: 12,
                transform: [{ translateY }],
                opacity,
                zIndex: 9999 - index,
            }}
        >
            <TouchableOpacity
                activeOpacity={0.95}
                onPress={handleDismiss}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 20,
                    paddingLeft: 16,
                    borderRadius: 24,
                    backgroundColor: config.bgColor,
                    borderWidth: 1,
                    borderColor: config.color + '25',
                    // Sombra elegante
                    shadowColor: config.color,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.25,
                    shadowRadius: 16,
                    elevation: 12,
                }}
            >
                {/* Indicador lateral de color */}
                <View
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 16,
                        bottom: 16,
                        width: 4,
                        borderRadius: 4,
                        backgroundColor: config.color,
                    }}
                />

                {/* Icono animado */}
                <Animated.View
                    style={{
                        width: 56,
                        height: 56,
                        borderRadius: 16,
                        backgroundColor: config.color + '15',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 16,
                        transform: [{ scale: pulseAnim }],
                    }}
                >
                    <View
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            backgroundColor: config.color,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Icon color="#ffffff" size={22} strokeWidth={2.5} />
                    </View>
                </Animated.View>

                {/* Contenido */}
                <View style={{ flex: 1, marginRight: 8 }}>
                    <Text
                        style={{
                            fontSize: 15,
                            fontWeight: '700',
                            color: config.textColor,
                            marginBottom: 4,
                            letterSpacing: 0.2,
                        }}
                        numberOfLines={1}
                    >
                        {notification.title}
                    </Text>
                    <Text
                        style={{
                            fontSize: 13,
                            color: config.subtitleColor,
                            lineHeight: 18,
                        }}
                        numberOfLines={2}
                    >
                        {notification.message}
                    </Text>
                    {/* Timestamp */}
                    <Text
                        style={{
                            fontSize: 10,
                            color: config.subtitleColor,
                            opacity: 0.6,
                            marginTop: 6,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                        }}
                    >
                        Ahora · Toca para cerrar
                    </Text>
                </View>

                {/* Indicador visual de cerrar */}
                <View
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: isDark ? '#ffffff10' : '#00000008',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <X color={config.subtitleColor} size={14} strokeWidth={2.5} />
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

export function InAppNotificationProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<InAppNotification[]>([]);
    const { isDark } = useTheme();

    const playNotificationAlert = async () => {
        try {
            // Vibrar para alertar al usuario
            if (Platform.OS === 'android') {
                Vibration.vibrate([0, 200, 100, 200]);
            } else {
                Vibration.vibrate();
            }

            // Reproducir sonido usando una notificación local silenciosa
            // Esto usa el sonido del sistema configurado en el canal
            const ExpoNotifications = await import('expo-notifications');
            await ExpoNotifications.scheduleNotificationAsync({
                content: {
                    title: '',
                    body: '',
                    sound: 'default',
                },
                trigger: null, // Inmediato
            });

            // Cancelar inmediatamente para que no se vea pero sí suene
            setTimeout(async () => {
                await ExpoNotifications.dismissAllNotificationsAsync();
            }, 100);
        } catch (error) {
            console.log('[InAppNotification] Error reproduciendo sonido:', error);
        }
    };

    const showNotification = useCallback((notification: Omit<InAppNotification, 'id' | 'timestamp'>) => {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newNotification: InAppNotification = {
            ...notification,
            id,
            timestamp: Date.now(),
        };

        console.log('[InAppNotification] Mostrando notificación:', newNotification.title);

        // Vibrar para alertar
        playNotificationAlert();

        setNotifications(prev => {
            // Limitar a máximo 3 notificaciones visibles
            const updated = [newNotification, ...prev].slice(0, 3);
            return updated;
        });
    }, []);

    const dismissNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const dismissAll = useCallback(() => {
        setNotifications([]);
    }, []);

    // Escuchar eventos del hook de notificaciones
    useEffect(() => {
        const handleInAppNotification = (data: any) => {
            console.log('[InAppNotification] Evento recibido:', data);
            showNotification({
                type: data.type || 'GENERAL',
                title: data.title,
                message: data.message,
                data: data.data,
            });
        };

        notificationEventEmitter.on('inAppNotification', handleInAppNotification);

        return () => {
            notificationEventEmitter.off('inAppNotification', handleInAppNotification);
        };
    }, [showNotification]);

    return (
        <InAppNotificationContext.Provider value={{ showNotification, dismissNotification, dismissAll }}>
            {children}
            {/* Renderizar notificaciones */}
            <View
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 9999,
                    pointerEvents: 'box-none',
                }}
            >
                {notifications.map((notification, index) => (
                    <NotificationToast
                        key={notification.id}
                        notification={notification}
                        index={index}
                        isDark={isDark}
                        onDismiss={() => dismissNotification(notification.id)}
                    />
                ))}
            </View>
        </InAppNotificationContext.Provider>
    );
}

export function useInAppNotification() {
    const context = useContext(InAppNotificationContext);
    if (context === undefined) {
        throw new Error('useInAppNotification must be used within an InAppNotificationProvider');
    }
    return context;
}
