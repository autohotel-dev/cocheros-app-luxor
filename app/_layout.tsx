import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { ThemeProvider, useTheme } from '../contexts/theme-context';
import { useNotifications } from '../hooks/use-notifications';
import "../global.css";

function RootLayoutNav() {
    const segments = useSegments();
    const router = useRouter();
    const { isDark } = useTheme();
    const [employeeId, setEmployeeId] = useState<string | null>(null);
    
    // Inicializar notificaciones push
    useNotifications(employeeId);

    useEffect(() => {
        console.log("RootLayout: Segments changed to:", segments);

        // Check initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            handleNavigation(session);
            if (session?.user?.id) {
                fetchEmployeeId(session.user.id);
            }
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log("Auth Event:", event, "Session exists:", !!session);
            handleNavigation(session);
            if (session?.user?.id) {
                fetchEmployeeId(session.user.id);
            } else {
                setEmployeeId(null);
            }
        });

        async function fetchEmployeeId(userId: string) {
            console.log('[Layout] Buscando empleado con auth_user_id:', userId);
            const { data, error } = await supabase
                .from('employees')
                .select('id')
                .eq('auth_user_id', userId)
                .single();
            
            if (error) {
                console.error('[Layout] Error buscando empleado:', error);
            }
            if (data?.id) {
                console.log('[Layout] Empleado encontrado:', data.id);
                setEmployeeId(data.id);
            } else {
                console.warn('[Layout] No se encontró empleado para userId:', userId);
            }
        }

        function handleNavigation(session: any) {
            const firstSegment = segments[0];
            const isAtLogin = firstSegment === 'login';
            const inTabs = firstSegment === '(tabs)';
            const isAtRoot = !firstSegment || firstSegment === '';

            if (!session) {
                if (!isAtLogin) {
                    console.log("Redirigiendo a /login");
                    router.replace('/login');
                }
            } else {
                // If we have a session and we are at login or root, go to dashboard
                if (isAtLogin || isAtRoot) {
                    console.log("Redirigiendo a /(tabs)");
                    router.replace('/(tabs)');
                }
                // If already inTabs, don't do anything to avoid loop
            }
        }

        return () => {
            subscription.unsubscribe();
        };
    }, [segments]);

    return (
        <View className={`flex-1 ${isDark ? 'dark' : ''}`} style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc' }}>
            <Stack screenOptions={{ 
                headerShown: false,
                contentStyle: { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }
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
                <RootLayoutNav />
            </ThemeProvider>
        </SafeAreaProvider>
    );
}
