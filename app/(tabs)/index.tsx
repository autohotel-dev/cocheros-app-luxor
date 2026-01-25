import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserRole } from '../../hooks/use-user-role';
import { useTheme } from '../../contexts/theme-context';
import { useValetActions } from '../../hooks/use-valet-actions';
import { Clock, CheckCircle2, Car, LogOut, ShoppingBag, RefreshCw, ChevronRight } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

export default function DashboardScreen() {
    const router = useRouter();
    const { employeeName, employeeId, hasActiveShift, role, isLoading } = useUserRole();
    const { isDark } = useTheme();
    const [currentShift, setCurrentShift] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Stats
    const [stats, setStats] = useState({
        entries: 0,
        inStay: 0,
        checkouts: 0,
        services: 0
    });

    const fetchStats = useCallback(async () => {
        try {
            // Habitaciones con estancia activa
            const { data: rooms } = await supabase
                .from("rooms")
                .select(`
                    id,
                    number,
                    room_stays!inner(
                        id,
                        status,
                        vehicle_plate,
                        valet_employee_id,
                        checkout_valet_employee_id,
                        vehicle_requested_at,
                        valet_checkout_requested_at
                    )
                `)
                .eq("room_stays.status", "ACTIVA");

            const activeRooms = rooms || [];
            
            // Entradas (sin vehículo registrado)
            const entries = activeRooms.filter(r => {
                const stay = r.room_stays?.[0];
                return stay && !stay.vehicle_plate;
            }).length;

            // En estancia (con vehículo, sin checkout)
            const inStay = activeRooms.filter(r => {
                const stay = r.room_stays?.[0];
                return stay && stay.vehicle_plate && !stay.checkout_valet_employee_id;
            }).length;

            // Salidas urgentes (solicitadas)
            const checkouts = activeRooms.filter(r => {
                const stay = r.room_stays?.[0];
                return stay && stay.vehicle_plate && !stay.checkout_valet_employee_id && 
                    (stay.vehicle_requested_at || stay.valet_checkout_requested_at);
            }).length;

            // Servicios pendientes
            const { count: servicesCount } = await supabase
                .from('sales_order_items')
                .select('*', { count: 'exact', head: true })
                .eq('concept_type', 'CONSUMPTION')
                .eq('is_paid', false)
                .not('delivery_status', 'in', '("CANCELLED","COMPLETED","DELIVERED")');

            setStats({
                entries,
                inStay,
                checkouts,
                services: servicesCount || 0
            });
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    }, []);

    useEffect(() => {
        fetchCurrentShift();
        fetchStats();

        // Realtime subscription
        const channel = supabase.channel('dashboard-stats')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'room_stays' }, fetchStats)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_order_items' }, fetchStats)
            .subscribe();

        // Auto-refresh cada 30 segundos
        const interval = setInterval(fetchStats, 30000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, [fetchStats]);

    const fetchCurrentShift = async () => {
        const { data: shifts } = await supabase
            .from("shift_definitions")
            .select("*")
            .eq("is_active", true);

        if (!shifts?.length) return;

        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 8);

        for (const shift of shifts) {
            const start = shift.start_time;
            const end = shift.end_time;

            if (shift.crosses_midnight) {
                if (currentTime >= start || currentTime < end) {
                    setCurrentShift(shift);
                    return;
                }
            } else {
                if (currentTime >= start && currentTime < end) {
                    setCurrentShift(shift);
                    return;
                }
            }
        }
    };

    const handleStartShift = async () => {
        if (!employeeId || !currentShift) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from("shift_sessions")
                .insert({
                    employee_id: employeeId,
                    shift_definition_id: currentShift.id,
                    clock_in_at: new Date().toISOString(),
                    status: "active",
                });

            if (error) throw error;
            Alert.alert('Éxito', 'Turno iniciado correctamente');
        } catch (err: any) {
            Alert.alert('Error', err.message || 'No se pudo iniciar el turno');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchStats();
        setRefreshing(false);
    };

    if (isLoading) {
        return (
            <View className={`flex-1 items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
                <ActivityIndicator size="large" color="#2563eb" />
            </View>
        );
    }

    return (
        <ScrollView 
            className={`flex-1 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}
            refreshControl={
                <RefreshControl 
                    refreshing={refreshing} 
                    onRefresh={onRefresh}
                    tintColor={isDark ? '#94a3b8' : '#64748b'}
                />
            }
        >
            {/* Header - igual a Next.js */}
            <View className={`p-4 border-b ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <View className="flex-row items-center justify-between">
                    <View>
                        <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Dashboard Cochero</Text>
                        <Text className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                            {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </Text>
                    </View>
                    <TouchableOpacity 
                        onPress={onRefresh}
                        className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
                    >
                        <RefreshCw color={isDark ? '#94a3b8' : '#64748b'} size={20} />
                    </TouchableOpacity>
                </View>

                {/* Stats Grid - igual a Next.js */}
                <View className="flex-row gap-2 mt-4">
                    <View className={`flex-1 items-center justify-center p-3 rounded-xl border ${isDark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'}`}>
                        <Car color="#3b82f6" size={18} />
                        <Text className={`text-[10px] font-medium mt-1 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>Entradas</Text>
                        <Text className={`text-lg font-bold ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>{stats.entries}</Text>
                    </View>
                    <View className={`flex-1 items-center justify-center p-3 rounded-xl border ${isDark ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'}`}>
                        <CheckCircle2 color="#22c55e" size={18} />
                        <Text className={`text-[10px] font-medium mt-1 ${isDark ? 'text-green-400' : 'text-green-700'}`}>En Estancia</Text>
                        <Text className={`text-lg font-bold ${isDark ? 'text-green-400' : 'text-green-700'}`}>{stats.inStay}</Text>
                    </View>
                    <View className={`flex-1 items-center justify-center p-3 rounded-xl border ${isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'}`}>
                        <LogOut color="#ef4444" size={18} />
                        <Text className={`text-[10px] font-medium mt-1 ${isDark ? 'text-red-400' : 'text-red-700'}`}>Salidas</Text>
                        <Text className={`text-lg font-bold ${isDark ? 'text-red-400' : 'text-red-700'}`}>{stats.checkouts}</Text>
                    </View>
                    <View className={`flex-1 items-center justify-center p-3 rounded-xl border ${isDark ? 'bg-amber-900/20 border-amber-800' : 'bg-amber-50 border-amber-200'}`}>
                        <ShoppingBag color="#f59e0b" size={18} />
                        <Text className={`text-[10px] font-medium mt-1 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Servicios</Text>
                        <Text className={`text-lg font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>{stats.services}</Text>
                    </View>
                </View>
            </View>

            <View className="p-4">
                {/* Shift Card */}
                <View className={`p-5 rounded-2xl shadow-sm mb-4 ${hasActiveShift ? 'bg-emerald-500' : (isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200')}`}>
                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-row items-center">
                            <View className={`w-12 h-12 rounded-xl items-center justify-center ${hasActiveShift ? 'bg-white/20' : (isDark ? 'bg-slate-700' : 'bg-slate-100')}`}>
                                <Clock color={hasActiveShift ? 'white' : (isDark ? '#94a3b8' : '#64748b')} size={24} />
                            </View>
                            <View className="ml-4">
                                <Text className={`text-lg font-bold ${hasActiveShift ? 'text-white' : (isDark ? 'text-white' : 'text-slate-800')}`}>
                                    {hasActiveShift ? 'Turno Activo' : 'Sin Turno'}
                                </Text>
                                {currentShift && !hasActiveShift && (
                                    <Text className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Turno disponible: {currentShift.name}</Text>
                                )}
                            </View>
                        </View>
                        {hasActiveShift && (
                            <CheckCircle2 color="white" size={24} />
                        )}
                    </View>

                    {!hasActiveShift ? (
                        <TouchableOpacity
                            onPress={handleStartShift}
                            disabled={loading || !currentShift}
                            className={`h-14 items-center justify-center rounded-xl ${currentShift ? 'bg-blue-600' : (isDark ? 'bg-slate-700' : 'bg-slate-200')}`}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className={`font-bold text-lg ${currentShift ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>
                                    {currentShift ? `Iniciar ${currentShift.name}` : 'No hay turnos disponibles'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <View className="bg-white/20 p-4 rounded-xl">
                            <Text className="text-white/90 text-center font-medium">
                                Turno en curso. Use las pestañas inferiores.
                            </Text>
                        </View>
                    )}
                </View>

                {/* Quick Actions */}
                <Text className={`text-sm font-semibold mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Accesos Rápidos</Text>
                
                <TouchableOpacity 
                    onPress={() => router.push('/(tabs)/rooms')} 
                    className={`flex-row items-center justify-between p-4 rounded-xl mb-3 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}
                >
                    <View className="flex-row items-center">
                        <View className={`w-10 h-10 rounded-lg items-center justify-center ${isDark ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
                            <Car color="#3b82f6" size={20} />
                        </View>
                        <View className="ml-3">
                            <Text className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Habitaciones</Text>
                            <Text className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Gestionar entradas y salidas</Text>
                        </View>
                    </View>
                    <View className="flex-row items-center">
                        {stats.entries > 0 && (
                            <View className="bg-blue-500 px-2 py-1 rounded-full mr-2">
                                <Text className="text-white text-xs font-bold">{stats.entries}</Text>
                            </View>
                        )}
                        <ChevronRight color={isDark ? '#64748b' : '#94a3b8'} size={20} />
                    </View>
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={() => router.push('/(tabs)/services')} 
                    className={`flex-row items-center justify-between p-4 rounded-xl mb-3 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}
                >
                    <View className="flex-row items-center">
                        <View className={`w-10 h-10 rounded-lg items-center justify-center ${isDark ? 'bg-amber-900/30' : 'bg-amber-50'}`}>
                            <ShoppingBag color="#f59e0b" size={20} />
                        </View>
                        <View className="ml-3">
                            <Text className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Servicios</Text>
                            <Text className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Entregas de consumos</Text>
                        </View>
                    </View>
                    <View className="flex-row items-center">
                        {stats.services > 0 && (
                            <View className="bg-amber-500 px-2 py-1 rounded-full mr-2">
                                <Text className="text-white text-xs font-bold">{stats.services}</Text>
                            </View>
                        )}
                        <ChevronRight color={isDark ? '#64748b' : '#94a3b8'} size={20} />
                    </View>
                </TouchableOpacity>

                {/* Salidas Urgentes Alerta */}
                {stats.checkouts > 0 && (
                    <TouchableOpacity 
                        onPress={() => router.push('/(tabs)/rooms')}
                        className={`flex-row items-center p-4 rounded-xl ${isDark ? 'bg-red-900/30 border border-red-800' : 'bg-red-50 border border-red-200'}`}
                    >
                        <View className="w-10 h-10 rounded-lg bg-red-500 items-center justify-center">
                            <LogOut color="white" size={20} />
                        </View>
                        <View className="ml-3 flex-1">
                            <Text className={`font-semibold ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                                {stats.checkouts} Salida{stats.checkouts > 1 ? 's' : ''} Pendiente{stats.checkouts > 1 ? 's' : ''}
                            </Text>
                            <Text className={`text-xs ${isDark ? 'text-red-400/70' : 'text-red-600'}`}>
                                Vehículos solicitados
                            </Text>
                        </View>
                        <ChevronRight color="#ef4444" size={20} />
                    </TouchableOpacity>
                )}
            </View>
        </ScrollView>
    );
}
