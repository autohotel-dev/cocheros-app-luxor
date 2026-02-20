import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useUserRole } from '../../hooks/use-user-role';
import { useTheme } from '../../contexts/theme-context';
import { supabase } from '../../lib/supabase';
import { LogOut, User, Mail, Shield, Sun, Moon, Smartphone, RefreshCw, CheckCircle, Wifi } from 'lucide-react-native';
import * as Updates from 'expo-updates';

export default function ProfileScreen() {
    const { employeeName, userEmail, role, hasActiveShift, employeeId } = useUserRole();
    const { themeMode, setThemeMode, isDark } = useTheme();

    const handleLogout = async () => {
        Alert.alert(
            'Cerrar Sesión',
            '¿Estás seguro que deseas salir?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Salir',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // Auto-close shift if active
                            if (hasActiveShift && employeeId) {
                                await supabase
                                    .from("shift_sessions")
                                    .update({
                                        clock_out_at: new Date().toISOString(),
                                        status: "pending_closing",
                                    })
                                    .eq("employee_id", employeeId)
                                    .in("status", ["active", "open"])
                                    .is("clock_out_at", null);
                            }
                        } catch (error) {
                            console.error("Error auto-closing shift:", error);
                        } finally {
                            await supabase.auth.signOut();
                        }
                    }
                },
            ]
        );
    };

    return (
        <ScrollView
            className="flex-1 bg-zinc-50 dark:bg-zinc-950"
            contentContainerStyle={{ paddingBottom: 100 }}
        >
            <View className="p-6">
                <View className="p-10 rounded-[48px] border-2 items-center bg-white border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
                    <View className="w-28 h-28 rounded-3xl items-center justify-center mb-8 bg-zinc-50 dark:bg-black">
                        <User color={isDark ? '#e4e4e7' : '#18181b'} size={48} strokeWidth={2.5} />
                    </View>

                    <Text className="text-3xl font-black text-center tracking-tight text-zinc-900 dark:text-white">{employeeName}</Text>

                    <View className="px-4 py-1.5 rounded-full mt-4 border-2 bg-zinc-900 border-zinc-900 dark:bg-zinc-950 dark:border-zinc-800">
                        <Text className="font-black uppercase text-[10px] tracking-[0.2em] text-zinc-50 dark:text-zinc-400">{role}</Text>
                    </View>

                    <View className="w-full mt-12 gap-4">
                        <View className="flex-row items-center p-5 rounded-2xl border-2 bg-zinc-50 border-zinc-100 dark:bg-black dark:border-zinc-800">
                            <Mail color={isDark ? '#52525b' : '#a1a1aa'} size={20} />
                            <Text className="ml-4 font-bold text-zinc-500 dark:text-zinc-400">{userEmail}</Text>
                        </View>
                        <View className="flex-row items-center p-5 rounded-2xl border-2 bg-zinc-50 border-zinc-100 dark:bg-black dark:border-zinc-800">
                            <Shield color={isDark ? '#52525b' : '#a1a1aa'} size={20} />
                            <Text className="ml-4 font-bold text-zinc-500 dark:text-zinc-400">Acceso Cochero</Text>
                        </View>
                    </View>

                    {/* Selector de Tema */}
                    <View className="w-full mt-10">
                        <Text className="text-[10px] font-black uppercase tracking-widest mb-4 ml-1 text-zinc-400 dark:text-zinc-500">Preferencia Visual</Text>
                        <View className="flex-row rounded-3xl p-1.5 border-2 bg-zinc-100 border-zinc-200 dark:bg-black dark:border-zinc-800">
                            <ThemeButton
                                isActive={themeMode === 'light'}
                                onPress={() => setThemeMode('light')}
                                icon={<Sun color={themeMode === 'light' ? '#fbbf24' : (isDark ? '#3f3f46' : '#d4d4d8')} size={18} strokeWidth={3} />}
                            />
                            <ThemeButton
                                isActive={themeMode === 'dark'}
                                onPress={() => setThemeMode('dark')}
                                icon={<Moon color={themeMode === 'dark' ? '#818cf8' : (isDark ? '#3f3f46' : '#d4d4d8')} size={18} strokeWidth={3} />}
                            />
                            <ThemeButton
                                isActive={themeMode === 'system'}
                                onPress={() => setThemeMode('system')}
                                icon={<Smartphone color={themeMode === 'system' ? '#a1a1aa' : (isDark ? '#3f3f46' : '#d4d4d8')} size={18} strokeWidth={3} />}
                            />
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={handleLogout}
                        className="flex-row items-center justify-center w-full h-16 rounded-2xl mt-12 border-2 bg-red-50 border-red-100 dark:bg-red-900 dark:border-red-800"
                    >
                        <LogOut color="#ef4444" size={20} strokeWidth={3} />
                        <Text className="ml-3 text-red-500 font-black uppercase tracking-widest text-xs">Finalizar Sesión</Text>
                    </TouchableOpacity>
                </View>

                {/* Sección de Actualizaciones */}
                <View className="mt-8 p-5 rounded-3xl border-2 bg-white border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
                    <View className="flex-row items-center mb-4">
                        <View className="w-10 h-10 rounded-2xl items-center justify-center bg-emerald-50 dark:bg-emerald-950">
                            <Wifi color={isDark ? '#34d399' : '#059669'} size={20} strokeWidth={2.5} />
                        </View>
                        <View className="ml-3 flex-1">
                            <Text className="text-sm font-black text-zinc-900 dark:text-white">Actualizaciones OTA</Text>
                            <Text className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                                {Updates.updateId ? 'Última: ' + Updates.updateId.slice(0, 8) : 'Versión embebida'}
                            </Text>
                        </View>
                    </View>

                    <View className="flex-row gap-2 mb-4">
                        <View className="flex-1 p-3 rounded-2xl bg-zinc-50 dark:bg-black">
                            <Text className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">Canal</Text>
                            <Text className="text-xs font-black text-zinc-700 dark:text-zinc-300 mt-1">{Updates.channel || 'default'}</Text>
                        </View>
                        <View className="flex-1 p-3 rounded-2xl bg-zinc-50 dark:bg-black">
                            <Text className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">Runtime</Text>
                            <Text className="text-xs font-black text-zinc-700 dark:text-zinc-300 mt-1">{Updates.runtimeVersion}</Text>
                        </View>
                    </View>

                    <ManualUpdateCheck isDark={isDark} />
                </View>

                <View className="mt-6 items-center pb-8">
                    <Text className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-300 dark:text-zinc-800">
                        AHLM v2.1.1 • LUXOR
                    </Text>
                </View>
            </View>
        </ScrollView>
    );
}

function ManualUpdateCheck({ isDark }: { isDark: boolean }) {
    const [checking, setChecking] = useState(false);

    const onCheck = async () => {
        if (checking) return;
        setChecking(true);
        try {
            const update = await Updates.checkForUpdateAsync();
            if (update.isAvailable) {
                Alert.alert(
                    "🚀 Actualización Disponible",
                    "Se encontró una nueva versión. ¿Deseas descargarla e instalarla ahora?",
                    [
                        { text: "Después", style: 'cancel' },
                        {
                            text: "Actualizar", style: 'default', onPress: async () => {
                                try {
                                    await Updates.fetchUpdateAsync();
                                    await Updates.reloadAsync();
                                } catch (e: any) {
                                    Alert.alert("Error al descargar", e.message);
                                }
                            }
                        }
                    ]
                );
            } else {
                Alert.alert("✅ Todo al día", "Ya tienes la última versión instalada.");
            }
        } catch (error: any) {
            Alert.alert(
                "Error de conexión",
                `${error.message}\n\nVerifica tu conexión a internet e intenta de nuevo.`
            );
        } finally {
            setChecking(false);
        }
    };

    return (
        <TouchableOpacity
            onPress={onCheck}
            disabled={checking}
            className="flex-row items-center justify-center py-4 rounded-2xl border-2 bg-emerald-50 border-emerald-100 dark:bg-emerald-950 dark:border-emerald-900"
            style={{ opacity: checking ? 0.7 : 1 }}
        >
            {checking ? (
                <ActivityIndicator size="small" color={isDark ? '#34d399' : '#059669'} />
            ) : (
                <RefreshCw color={isDark ? '#34d399' : '#059669'} size={18} strokeWidth={3} />
            )}
            <Text className="ml-2 font-black text-xs uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                {checking ? 'Buscando...' : 'Verificar Actualizaciones'}
            </Text>
        </TouchableOpacity>
    );
}

function ThemeButton({ isActive, onPress, icon }: { isActive: boolean; onPress: () => void; icon: React.ReactNode }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            className={isActive ?
                "flex-1 flex-row items-center justify-center py-4 rounded-2xl bg-white dark:bg-zinc-800" :
                "flex-1 flex-row items-center justify-center py-4 rounded-2xl"
            }
        >
            {icon}
        </TouchableOpacity>
    );
}
