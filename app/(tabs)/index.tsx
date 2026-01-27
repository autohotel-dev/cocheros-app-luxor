import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserRole } from '../../hooks/use-user-role';
import { useTheme } from '../../contexts/theme-context';
import { useFeedback } from '../../contexts/feedback-context';
import { useValetActions } from '../../hooks/use-valet-actions';
import { Clock, CheckCircle2, Car, LogOut, ShoppingBag, RefreshCw, ChevronRight } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

export default function DashboardScreen() {
    const router = useRouter();
    const { employeeName, employeeId, hasActiveShift, role, isLoading } = useUserRole();
    const { isDark } = useTheme();
    const { showFeedback } = useFeedback();
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
            showFeedback('¡Bienvenido!', 'Tu turno ha iniciado correctamente');
        } catch (err: any) {
            showFeedback('Error', err.message || 'No se pudo iniciar el turno', 'error');
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
            <View className={`flex-1 items-center justify-center ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
                <ActivityIndicator size="large" color="#a1a1aa" />
            </View>
        );
    }

    return (
        <ScrollView
            className={`flex-1 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={isDark ? '#52525b' : '#a1a1aa'}
                />
            }
        >
            {/* Header - igual a Next.js */}
            <View className={`p-4 border-b ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-100'}`}>
                <View className="flex-row items-center justify-between">
                    <View>
                        <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Dashboard Cochero</Text>
                        <Text className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                            {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={onRefresh}
                        className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-zinc-900' : 'bg-zinc-100'}`}
                    >
                        <RefreshCw color={isDark ? '#71717a' : '#a1a1aa'} size={20} />
                    </TouchableOpacity>
                </View>

                {/* Stats Grid - neutral tones */}
                <View className="flex-row gap-2 mt-4">
                    <View className={`flex-1 items-center justify-center p-3 rounded-xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-100'}`}>
                        <Car color={isDark ? '#a1a1aa' : '#52525b'} size={18} />
                        <Text className={`text-[10px] font-medium mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Entradas</Text>
                        <Text className={`text-lg font-bold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>{stats.entries}</Text>
                    </View>
                    <View className={`flex-1 items-center justify-center p-3 rounded-xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-100'}`}>
                        <CheckCircle2 color={isDark ? '#10b981' : '#059669'} size={18} />
                        <Text className={`text-[10px] font-medium mt-1 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>En Estancia</Text>
                        <Text className={`text-lg font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{stats.inStay}</Text>
                    </View>
                    <View className={`flex-1 items-center justify-center p-3 rounded-xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-100'}`}>
                        <LogOut color={isDark ? '#f87171' : '#dc2626'} size={18} />
                        <Text className={`text-[10px] font-medium mt-1 ${isDark ? 'text-red-400' : 'text-red-700'}`}>Salidas</Text>
                        <Text className={`text-lg font-bold ${isDark ? 'text-red-400' : 'text-red-700'}`}>{stats.checkouts}</Text>
                    </View>
                    <View className={`flex-1 items-center justify-center p-3 rounded-xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-100'}`}>
                        <ShoppingBag color={isDark ? '#fbbf24' : '#d97706'} size={18} />
                        <Text className={`text-[10px] font-medium mt-1 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Servicios</Text>
                        <Text className={`text-lg font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>{stats.services}</Text>
                    </View>
                </View>
            </View>

            <View className="p-4">
                {/* Shift Card */}
                <View className={`p-5 rounded-2xl shadow-sm mb-4 ${hasActiveShift ? 'bg-emerald-600' : (isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-100')}`}>
                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-row items-center">
                            <View className={`w-12 h-12 rounded-xl items-center justify-center ${hasActiveShift ? 'bg-white/20' : (isDark ? 'bg-zinc-800' : 'bg-zinc-50')}`}>
                                <Clock color={hasActiveShift ? 'white' : (isDark ? '#a1a1aa' : '#71717a')} size={24} />
                            </View>
                            <View className="ml-4">
                                <Text className={`text-lg font-bold ${hasActiveShift ? 'text-white' : (isDark ? 'text-white' : 'text-zinc-900')}`}>
                                    {hasActiveShift ? 'Turno Activo' : 'Sin Turno'}
                                </Text>
                                {currentShift && !hasActiveShift && (
                                    <Text className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Turno disponible: {currentShift.name}</Text>
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
                            className={`h-14 items-center justify-center rounded-xl ${currentShift ? (isDark ? 'bg-white' : 'bg-zinc-900') : (isDark ? 'bg-zinc-800' : 'bg-zinc-200')}`}
                        >
                            {loading ? (
                                <ActivityIndicator color={isDark ? 'black' : 'white'} />
                            ) : (
                                <Text className={`font-black uppercase tracking-widest text-sm ${currentShift ? (isDark ? 'text-zinc-900' : 'text-white') : (isDark ? 'text-zinc-500' : 'text-zinc-400')}`}>
                                    {currentShift ? `Iniciar ${currentShift.name}` : 'No hay turnos'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <View className="bg-white/20 p-4 rounded-xl">
                            <Text className="text-white/90 text-center font-bold uppercase tracking-wider text-xs">
                                Turno en curso
                            </Text>
                        </View>
                    )}
                </View>

                {/* Quick Actions */}
                <Text className={`text-sm font-semibold mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Accesos Rápidos</Text>

                <TouchableOpacity
                    onPress={() => router.push('/(tabs)/rooms')}
                    className={`flex-row items-center justify-between p-4 rounded-xl mb-3 ${isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-100'}`}
                >
                    <View className="flex-row items-center">
                        <View className={`w-10 h-10 rounded-lg items-center justify-center ${isDark ? 'bg-zinc-800' : 'bg-zinc-50'}`}>
                            <Car color={isDark ? '#a1a1aa' : '#52525b'} size={20} />
                        </View>
                        <View className="ml-3">
                            <Text className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Habitaciones</Text>
                            <Text className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Gestionar entradas y salidas</Text>
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
                    className={`flex-row items-center justify-between p-4 rounded-xl mb-3 ${isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-100'}`}
                >
                    <View className="flex-row items-center">
                        <View className={`w-10 h-10 rounded-lg items-center justify-center ${isDark ? 'bg-zinc-800' : 'bg-zinc-50'}`}>
                            <ShoppingBag color={isDark ? '#fbbf24' : '#d97706'} size={20} />
                        </View>
                        <View className="ml-3">
                            <Text className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Servicios</Text>
                            <Text className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Entregas de consumos</Text>
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
