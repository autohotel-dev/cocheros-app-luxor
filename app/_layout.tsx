import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { ThemeProvider, useTheme } from '../contexts/theme-context';
import { FeedbackProvider } from '../contexts/feedback-context';
import { InAppNotificationProvider } from '../contexts/in-app-notification-context';
import { useNotifications } from '../hooks/use-notifications';
import "../global.css";

function RootLayoutNav() {
    const segments = useSegments();
    const router = useRouter();
    const { isDark } = useTheme();
    const [employeeId, setEmployeeId] = useState<string | null>(null);

    // Inicializar notificaciones push
    useNotifications(employeeId);

    // 1. Manejo de sesión y navegación
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log("Auth Event:", event, "Session exists:", !!session);
            handleNavigation(session);
        });

        // Check initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            handleNavigation(session);
        });

        function handleNavigation(session: any) {
            const firstSegment = segments[0];
            const isAtLogin = firstSegment === 'login';
            const inTabs = firstSegment === '(tabs)';
            const isAtRoot = !firstSegment || firstSegment === '';

            if (!session) {
                if (!isAtLogin) {
                    router.replace('/login');
                }
            } else if (isAtLogin || isAtRoot) {
                router.replace('/(tabs)');
            }
        }

        return () => subscription.unsubscribe();
    }, [segments]);

    // 2. Carga de datos del empleado (separado para no interferir con la navegación)
    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user?.id) fetchEmployeeId(user.id);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user?.id) {
                fetchEmployeeId(session.user.id);
            } else {
                setEmployeeId(null);
            }
        });

        async function fetchEmployeeId(userId: string) {
            const { data } = await supabase
                .from('employees')
                .select('id')
                .eq('auth_user_id', userId)
                .maybeSingle();

            if (data?.id && data.id !== employeeId) {
                setEmployeeId(data.id);
            }
        }

        return () => subscription.unsubscribe();
    }, []);

    return (
        <View className="flex-1" style={{ backgroundColor: isDark ? '#09090b' : '#fafafa' }}>
            <Stack screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: isDark ? '#09090b' : '#fafafa' }
            }}>
                <Stack.Screen name="login" options={{ title: 'Iniciar Sesión' }} />
                <Stack.Screen name="(tabs)" options={{ title: 'Panel Cocheros' }} />
            </Stack>
        </View>
    );
}

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <ThemeProvider>
                <FeedbackProvider>
                    <InAppNotificationProvider>
                        <RootLayoutNav />
                    </InAppNotificationProvider>
                </FeedbackProvider>
            </ThemeProvider>
        </SafeAreaProvider>
    );
}
