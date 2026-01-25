import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useUserRole } from '../../hooks/use-user-role';
import { useTheme } from '../../contexts/theme-context';
import { supabase } from '../../lib/supabase';
import { LogOut, User, Mail, Shield, Sun, Moon, Smartphone } from 'lucide-react-native';

export default function ProfileScreen() {
    const { employeeName, userEmail, role } = useUserRole();
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
                        await supabase.auth.signOut();
                    }
                },
            ]
        );
    };

    return (
        <View className={`flex-1 p-6 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
            <View className={`p-8 rounded-[40px] shadow-sm border items-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                <View className={`w-24 h-24 rounded-full items-center justify-center mb-6 ${isDark ? 'bg-blue-900' : 'bg-blue-100'}`}>
                    <User color="#2563eb" size={48} />
                </View>
                <Text className={`text-2xl font-bold text-center ${isDark ? 'text-white' : 'text-slate-800'}`}>{employeeName}</Text>
                <View className={`px-4 py-1 rounded-full mt-2 ${isDark ? 'bg-blue-900' : 'bg-blue-50'}`}>
                    <Text className="text-blue-500 font-bold uppercase text-xs">{role}</Text>
                </View>

                <View className="w-full mt-8 gap-3">
                    <View className={`flex-row items-center p-4 rounded-2xl ${isDark ? 'bg-slate-700' : 'bg-slate-50'}`}>
                        <Mail color={isDark ? '#94a3b8' : '#64748b'} size={20} />
                        <Text className={`ml-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{userEmail}</Text>
                    </View>
                    <View className={`flex-row items-center p-4 rounded-2xl ${isDark ? 'bg-slate-700' : 'bg-slate-50'}`}>
                        <Shield color={isDark ? '#94a3b8' : '#64748b'} size={20} />
                        <Text className={`ml-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Acceso Cochero</Text>
                    </View>
                </View>

                {/* Selector de Tema */}
                <View className="w-full mt-6">
                    <Text className={`text-sm font-semibold mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Apariencia</Text>
                    <View className={`flex-row rounded-2xl p-1 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                        <TouchableOpacity
                            onPress={() => setThemeMode('light')}
                            className={`flex-1 flex-row items-center justify-center py-3 rounded-xl ${themeMode === 'light' ? (isDark ? 'bg-slate-600' : 'bg-white shadow-sm') : ''}`}
                        >
                            <Sun color={themeMode === 'light' ? '#f59e0b' : (isDark ? '#64748b' : '#94a3b8')} size={18} />
                            <Text className={`ml-2 font-medium text-sm ${themeMode === 'light' ? (isDark ? 'text-white' : 'text-slate-800') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>Claro</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setThemeMode('dark')}
                            className={`flex-1 flex-row items-center justify-center py-3 rounded-xl ${themeMode === 'dark' ? (isDark ? 'bg-slate-600' : 'bg-white shadow-sm') : ''}`}
                        >
                            <Moon color={themeMode === 'dark' ? '#8b5cf6' : (isDark ? '#64748b' : '#94a3b8')} size={18} />
                            <Text className={`ml-2 font-medium text-sm ${themeMode === 'dark' ? (isDark ? 'text-white' : 'text-slate-800') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>Oscuro</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setThemeMode('system')}
                            className={`flex-1 flex-row items-center justify-center py-3 rounded-xl ${themeMode === 'system' ? (isDark ? 'bg-slate-600' : 'bg-white shadow-sm') : ''}`}
                        >
                            <Smartphone color={themeMode === 'system' ? '#3b82f6' : (isDark ? '#64748b' : '#94a3b8')} size={18} />
                            <Text className={`ml-2 font-medium text-sm ${themeMode === 'system' ? (isDark ? 'text-white' : 'text-slate-800') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>Auto</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity
                    onPress={handleLogout}
                    className={`flex-row items-center justify-center w-full h-16 rounded-2xl mt-8 border ${isDark ? 'bg-red-900/30 border-red-800' : 'bg-red-50 border-red-100'}`}
                >
                    <LogOut color="#ef4444" size={20} />
                    <Text className="ml-2 text-red-500 font-bold text-lg">Cerrar Sesión</Text>
                </TouchableOpacity>
            </View>

            <Text className={`text-center text-xs mt-auto pb-6 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                Luxor Manager Mobile v1.0.0
            </Text>
        </View>
    );
}
