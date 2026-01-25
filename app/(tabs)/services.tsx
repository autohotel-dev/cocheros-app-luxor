import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, FlatList, RefreshControl, TextInput, Modal, Alert, Switch } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useUserRole } from '../../hooks/use-user-role';
import { useValetActions } from '../../hooks/use-valet-actions';
import { useTheme } from '../../contexts/theme-context';
import { ShoppingBag, CheckCircle2, XCircle, ChevronDown, ChevronUp, Banknote, CreditCard, MessageSquare, X, AlertCircle } from 'lucide-react-native';

export default function ServicesScreen() {
    const { employeeId, hasActiveShift, isLoading: roleLoading } = useUserRole();
    const { isDark } = useTheme();
    const [pendingConsumptions, setPendingConsumptions] = useState<any[]>([]);
    const [myConsumptions, setMyConsumptions] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());

    // Delivery Modal
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [hasTip, setHasTip] = useState(false);
    const [tipAmount, setTipAmount] = useState('');
    const [tipMethod, setTipMethod] = useState<'EFECTIVO' | 'TARJETA'>('EFECTIVO');
    const [notes, setNotes] = useState('');

    const fetchData = useCallback(async () => {
        if (!employeeId) return;

        try {
            // Pending
            const { data: pending } = await supabase
                .from('sales_order_items')
                .select(`
                    *,
                    products(name),
                    sales_orders(
                        room_stays(
                            rooms(number)
                        )
                    )
                `)
                .eq('concept_type', 'CONSUMPTION')
                .is('delivery_accepted_by', null)
                .eq('is_paid', false)
                .not('delivery_status', 'in', '("CANCELLED","COMPLETED","DELIVERED")');

            // My services
            const { data: mine } = await supabase
                .from('sales_order_items')
                .select(`
                    *,
                    products(name),
                    sales_orders(
                        room_stays(
                            rooms(number)
                        )
                    )
                `)
                .eq('concept_type', 'CONSUMPTION')
                .eq('delivery_accepted_by', employeeId)
                .in('delivery_status', ['ACCEPTED', 'IN_TRANSIT'])
                .not('delivery_status', 'in', '("CANCELLED","COMPLETED","DELIVERED")');

            setPendingConsumptions(pending || []);
            setMyConsumptions(mine || []);
        } catch (error) {
            console.error("Error fetching services:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [employeeId]);

    useEffect(() => {
        fetchData();
        const channel = supabase.channel('valet-services-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_order_items' }, () => fetchData())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchData]);

    const {
        handleAcceptConsumption,
        handleAcceptAllConsumptions,
        handleConfirmDelivery,
        handleConfirmAllDeliveries,
        handleCancelConsumption,
        loading: actionLoading
    } = useValetActions(fetchData);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const toggleExpand = (roomNum: string) => {
        setExpandedRooms(prev => {
            const next = new Set(prev);
            if (next.has(roomNum)) next.delete(roomNum);
            else next.add(roomNum);
            return next;
        });
    };

    const openConfirmModal = (item: any) => {
        setSelectedItem(item);
        setHasTip(false);
        setTipAmount('');
        setTipMethod('EFECTIVO');
        setNotes('');
        setShowDeliveryModal(true);
    };

    const submitConfirmation = async () => {
        if (!selectedItem) return;
        const success = await handleConfirmDelivery(
            selectedItem.id,
            selectedItem.sales_orders.room_stays[0].rooms.number,
            hasTip ? { amount: parseFloat(tipAmount) || 0, method: tipMethod } : undefined,
            notes
        );
        if (success) setShowDeliveryModal(false);
    };

    // Grouping
    const groupedMy = myConsumptions.reduce((acc: any, item) => {
        const num = item.sales_orders?.room_stays[0]?.rooms?.number || '??';
        if (!acc[num]) acc[num] = [];
        acc[num].push(item);
        return acc;
    }, {});

    const groupedPending = pendingConsumptions.reduce((acc: any, item) => {
        const num = item.sales_orders?.room_stays[0]?.rooms?.number || '??';
        if (!acc[num]) acc[num] = [];
        acc[num].push(item);
        return acc;
    }, {});

    if (loading || roleLoading) {
        return <View className={`flex-1 items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}><ActivityIndicator size="large" color="#2563eb" /></View>;
    }

    return (
        <View className={`flex-1 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? '#94a3b8' : '#64748b'} />}
                className="p-4"
            >
                {/* Mis Entregas - Color naranja igual a Next.js */}
                <View className="mb-8">
                    <View className="flex-row items-center mb-4">
                        <ShoppingBag color="#f97316" size={20} />
                        <Text className={`text-lg font-bold ml-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Mis Entregas ({myConsumptions.length})</Text>
                    </View>

                    {Object.entries(groupedMy).map(([roomNum, items]: [string, any]) => {
                        const inTransitItems = items.filter((i: any) => i.delivery_status === 'IN_TRANSIT');
                        
                        return (
                            <View key={roomNum} className={`rounded-2xl border shadow-sm mb-3 overflow-hidden ${isDark ? 'bg-slate-800 border-orange-800' : 'bg-orange-50/50 border-orange-300'}`}>
                                <TouchableOpacity
                                    onPress={() => toggleExpand(`my-${roomNum}`)}
                                    className={`flex-row justify-between items-center p-4 ${isDark ? 'bg-orange-900/20' : 'bg-orange-50'}`}
                                >
                                    <View className="flex-row items-center">
                                        <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Hab. {roomNum}</Text>
                                        <View className="bg-orange-500 px-2 py-0.5 rounded-full ml-3">
                                            <Text className="text-white text-[10px] font-bold">{items.length} a entregar</Text>
                                        </View>
                                    </View>
                                    {expandedRooms.has(`my-${roomNum}`) ? <ChevronUp size={20} color={isDark ? '#94a3b8' : '#64748b'} /> : <ChevronDown size={20} color={isDark ? '#94a3b8' : '#64748b'} />}
                                </TouchableOpacity>

                                {expandedRooms.has(`my-${roomNum}`) && (
                                    <View className={`p-4 border-t ${isDark ? 'border-orange-900' : 'border-orange-100'}`}>
                                        {/* Botón Confirmar Todos si hay más de 1 item listo */}
                                        {inTransitItems.length > 1 && (
                                            <TouchableOpacity
                                                onPress={() => {
                                                    Alert.alert(
                                                        'Confirmar Todas las Entregas',
                                                        `¿Confirmar ${inTransitItems.length} entregas en Hab. ${roomNum}?`,
                                                        [
                                                            { text: 'Cancelar', style: 'cancel' },
                                                            { 
                                                                text: 'Confirmar Todos', 
                                                                onPress: () => handleConfirmAllDeliveries(inTransitItems, roomNum) 
                                                            }
                                                        ]
                                                    );
                                                }}
                                                disabled={actionLoading}
                                                className="bg-green-600 p-3 rounded-xl mb-3 flex-row items-center justify-center"
                                            >
                                                <CheckCircle2 color="white" size={18} />
                                                <Text className="text-white font-bold ml-2">Confirmar Todos ({inTransitItems.length})</Text>
                                            </TouchableOpacity>
                                        )}
                                        
                                        {items.map((item: any) => {
                                            const isInTransit = item.delivery_status === 'IN_TRANSIT';
                                            return (
                                                <View key={item.id} className={`flex-row justify-between items-center py-3 px-2 rounded-lg mb-2 ${isDark ? 'bg-slate-700/50' : 'bg-white/80'}`}>
                                                    <View className="flex-1">
                                                        <Text className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                                            {item.qty}x {item.products?.name || 'Producto'}
                                                        </Text>
                                                        <Text className="text-green-500 font-bold">${Number(item.total || 0).toFixed(2)}</Text>
                                                        {!isInTransit && (
                                                            <Text className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Esperando...</Text>
                                                        )}
                                                    </View>
                                                    <View className="flex-row items-center gap-2">
                                                        {isInTransit ? (
                                                            <TouchableOpacity
                                                                onPress={() => openConfirmModal(item)}
                                                                className="bg-green-600 px-3 py-2 rounded-lg"
                                                            >
                                                                <Text className="text-white text-xs font-bold">Confirmar</Text>
                                                            </TouchableOpacity>
                                                        ) : null}
                                                        <TouchableOpacity
                                                            onPress={() => Alert.alert('Cancelar', '¿Deseas cancelar este pedido?', [{ text: 'No' }, { text: 'Sí', onPress: () => handleCancelConsumption(item.id) }])}
                                                            className={`p-2 rounded-lg ${isDark ? 'bg-red-900/30' : 'bg-red-50'}`}
                                                        >
                                                            <XCircle color="#ef4444" size={16} />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                    {myConsumptions.length === 0 && <Text className={`italic text-center py-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No tienes entregas asignadas</Text>}
                </View>

                {/* Pendientes Generales - Color ámbar igual a Next.js */}
                <View className="mb-20">
                    <View className="flex-row items-center mb-4">
                        <ShoppingBag color="#d97706" size={20} />
                        <Text className={`text-lg font-bold ml-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Pendientes ({pendingConsumptions.length})</Text>
                    </View>

                    {Object.entries(groupedPending).map(([roomNum, items]: [string, any]) => (
                        <View key={roomNum} className={`rounded-2xl border shadow-sm mb-3 ${isDark ? 'bg-slate-800 border-amber-800' : 'bg-amber-50/50 border-amber-200'}`}>
                            <View className={`p-4 flex-row justify-between items-center border-b ${isDark ? 'border-amber-900' : 'border-amber-100'}`}>
                                <View className="flex-row items-center">
                                    <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Hab. {roomNum}</Text>
                                    <View className={`px-2 py-0.5 rounded-full ml-3 ${isDark ? 'bg-amber-800' : 'bg-amber-100'}`}>
                                        <Text className={`text-[10px] font-bold ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>{items.length} items</Text>
                                    </View>
                                </View>
                            </View>
                            
                            {/* Botón Aceptar Todos */}
                            {items.length > 1 && (
                                <TouchableOpacity
                                    onPress={() => handleAcceptAllConsumptions(items, roomNum, employeeId!)}
                                    className="bg-amber-600 mx-4 mt-3 p-3 rounded-xl flex-row items-center justify-center"
                                >
                                    <CheckCircle2 color="white" size={18} />
                                    <Text className="text-white font-bold ml-2">Aceptar Todos ({items.length})</Text>
                                </TouchableOpacity>
                            )}
                            
                            <View className="p-4">
                                {items.map((item: any) => (
                                    <View key={item.id} className={`flex-row justify-between items-center py-3 px-2 rounded-lg mb-2 ${isDark ? 'bg-slate-700/50' : 'bg-white/80'}`}>
                                        <View className="flex-1">
                                            <Text className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                                {item.qty}x {item.products?.name || 'Producto'}
                                            </Text>
                                        </View>
                                        <View className="flex-row items-center gap-2">
                                            <TouchableOpacity
                                                onPress={() => handleAcceptConsumption(item.id, roomNum, employeeId!)}
                                                className={`px-3 py-2 rounded-lg border ${isDark ? 'border-amber-700 bg-amber-900/30' : 'border-amber-400 bg-amber-50'}`}
                                            >
                                                <Text className={`text-xs font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Aceptar</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => Alert.alert('Cancelar', '¿Deseas cancelar este pedido?', [{ text: 'No' }, { text: 'Sí', onPress: () => handleCancelConsumption(item.id) }])}
                                                className={`p-2 rounded-lg ${isDark ? 'bg-red-900/30' : 'bg-red-50'}`}
                                            >
                                                <XCircle color="#ef4444" size={16} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ))}
                    
                    {pendingConsumptions.length === 0 && <Text className={`italic text-center py-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No hay servicios pendientes</Text>}
                </View>
            </ScrollView>

            {/* Delivery Modal - Diseño igual a Next.js con modo oscuro */}
            <Modal visible={showDeliveryModal} animationType="slide" transparent>
                <View className="flex-1 justify-end bg-black/50">
                    <View className={`rounded-t-3xl ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                        {/* Header */}
                        <View className={`flex-row justify-between items-center p-6 border-b ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                            <View className="flex-row items-center gap-2">
                                <CheckCircle2 color="#22c55e" size={24} />
                                <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Confirmar Entrega</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowDeliveryModal(false)} className="p-2">
                                <X color={isDark ? '#94a3b8' : '#64748b'} size={24} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView className="p-6">
                            {/* Info del consumo */}
                            <View className={`rounded-xl p-4 mb-6 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                                <View className="flex-row justify-between items-center mb-2">
                                    <Text className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Habitación</Text>
                                    <View className={`px-3 py-1 rounded-lg border ${isDark ? 'bg-slate-600 border-slate-500' : 'bg-white border-slate-200'}`}>
                                        <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                            {selectedItem?.sales_orders?.room_stays?.[0]?.rooms?.number || '??'}
                                        </Text>
                                    </View>
                                </View>
                                <View className="flex-row justify-between items-center mb-2">
                                    <Text className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Producto</Text>
                                    <Text className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                        {selectedItem?.qty}x {selectedItem?.products?.name || 'Producto'}
                                    </Text>
                                </View>
                                <View className={`border-t pt-2 mt-2 flex-row justify-between items-center ${isDark ? 'border-slate-600' : 'border-slate-200'}`}>
                                    <Text className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Total a cobrar</Text>
                                    <Text className="text-2xl font-bold text-green-500">
                                        ${Number(selectedItem?.total || 0).toFixed(2)}
                                    </Text>
                                </View>
                            </View>

                            {/* Toggle propina */}
                            <View className={`flex-row justify-between items-center py-4 border-b mb-4 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                                <View>
                                    <Text className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>¿Hubo propina a registrar?</Text>
                                    <Text className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Solo si fue con tarjeta o si necesitas dar cambio</Text>
                                </View>
                                <Switch
                                    value={hasTip}
                                    onValueChange={setHasTip}
                                    trackColor={{ false: isDark ? '#475569' : '#e2e8f0', true: '#22c55e' }}
                                    thumbColor="white"
                                />
                            </View>

                            {/* Campos de propina */}
                            {hasTip && (
                                <View className={`rounded-xl p-4 mb-4 border ${isDark ? 'bg-amber-900/30 border-amber-800' : 'bg-amber-50 border-amber-200'}`}>
                                    <View className="flex-row items-center gap-2 mb-3">
                                        <Banknote color="#f59e0b" size={18} />
                                        <Text className={`font-medium text-sm ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>Detalles de propina</Text>
                                    </View>

                                    <View className="flex-row gap-3">
                                        <View className="flex-1">
                                            <Text className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Monto</Text>
                                            <View className={`flex-row items-center rounded-lg px-3 border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}>
                                                <Text className={isDark ? 'text-slate-400' : 'text-slate-400'}>$</Text>
                                                <TextInput
                                                    value={tipAmount}
                                                    onChangeText={setTipAmount}
                                                    keyboardType="numeric"
                                                    placeholder="0"
                                                    placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                                                    className={`flex-1 py-3 pl-1 text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}
                                                />
                                            </View>
                                        </View>

                                        <View className="flex-1">
                                            <Text className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Método</Text>
                                            <View className="flex-row gap-2">
                                                <TouchableOpacity
                                                    onPress={() => setTipMethod('EFECTIVO')}
                                                    className={`flex-1 h-12 items-center justify-center rounded-lg ${tipMethod === 'EFECTIVO' ? 'bg-green-600' : (isDark ? 'bg-slate-700' : 'bg-slate-100')}`}
                                                >
                                                    <Banknote color={tipMethod === 'EFECTIVO' ? 'white' : '#64748b'} size={20} />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => setTipMethod('TARJETA')}
                                                    className={`flex-1 h-12 items-center justify-center rounded-lg ${tipMethod === 'TARJETA' ? 'bg-blue-600' : (isDark ? 'bg-slate-700' : 'bg-slate-100')}`}
                                                >
                                                    <CreditCard color={tipMethod === 'TARJETA' ? 'white' : '#64748b'} size={20} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            )}

                            {/* Notas opcionales */}
                            <View className="mb-4">
                                <Text className={`text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Notas (opcional)</Text>
                                <View className={`flex-row items-start rounded-xl p-3 border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                                    <MessageSquare color={isDark ? '#94a3b8' : '#64748b'} size={18} />
                                    <TextInput
                                        placeholder="Ej: Cliente pidió más servilletas..."
                                        placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                                        value={notes}
                                        onChangeText={setNotes}
                                        multiline
                                        className={`ml-3 flex-1 ${isDark ? 'text-white' : 'text-slate-800'}`}
                                    />
                                </View>
                            </View>

                            {/* Advertencia */}
                            <View className={`rounded-xl p-3 mb-6 flex-row items-start gap-2 border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                                <AlertCircle color={isDark ? '#94a3b8' : '#64748b'} size={16} />
                                <Text className={`text-xs flex-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Después de confirmar, debes entregar el dinero en recepción.
                                    {hasTip && tipMethod === 'EFECTIVO' && parseFloat(tipAmount) > 0 && (
                                        <Text className="font-bold text-amber-500">
                                            {'\n'}Total a entregar: ${(Number(selectedItem?.total || 0) + parseFloat(tipAmount || '0')).toFixed(2)} (incluye propina en efectivo)
                                        </Text>
                                    )}
                                </Text>
                            </View>

                            {/* Botones */}
                            <View className="flex-row gap-3 pb-8">
                                <TouchableOpacity
                                    onPress={() => setShowDeliveryModal(false)}
                                    disabled={actionLoading}
                                    className={`flex-1 h-14 rounded-xl items-center justify-center border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}
                                >
                                    <Text className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={submitConfirmation}
                                    disabled={actionLoading}
                                    className="flex-1 h-14 bg-green-600 rounded-xl items-center justify-center flex-row"
                                >
                                    {actionLoading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <>
                                            <CheckCircle2 color="white" size={20} />
                                            <Text className="font-semibold text-white ml-2">Confirmar Entrega</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
