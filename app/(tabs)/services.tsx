import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, FlatList, RefreshControl, TextInput, Modal, Alert, Switch } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useUserRole } from '../../hooks/use-user-role';
import { useValetActions } from '../../hooks/use-valet-actions';
import { useTheme } from '../../contexts/theme-context';
import { ShoppingBag, CheckCircle2, XCircle, ChevronDown, ChevronUp, Banknote, CreditCard, MessageSquare, X, AlertCircle, Plus, Minus } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import { MultiPaymentInput } from '../../components/MultiPaymentInput';
import { PaymentEntry } from '../../lib/payment-types';
import * as Haptics from 'expo-haptics';
import { Skeleton } from '../../components/Skeleton';

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
    const [selectedItems, setSelectedItems] = useState<any[]>([]);
    const [payments, setPayments] = useState<PaymentEntry[]>([]);
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
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_orders' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'room_stays' }, () => fetchData())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchData]);

    // Auto-expand room from Deep Link
    const params = useLocalSearchParams();
    useEffect(() => {
        if (params.salesOrderId && (pendingConsumptions.length > 0 || myConsumptions.length > 0)) {
            // Buscar la habitación asociada a esta orden
            const allItems = [...pendingConsumptions, ...myConsumptions];
            const item = allItems.find(i => i.sales_order_id === params.salesOrderId);
            if (item) {
                const roomNum = item.sales_orders?.room_stays[0]?.rooms?.number;
                if (roomNum) {
                    setExpandedRooms(prev => {
                        const next = new Set(prev);
                        // Intentar expandir tanto en "Mis Entregas" como en "Pendientes" si aplica
                        next.add(roomNum);
                        next.add(`my-${roomNum}`);
                        return next;
                    });
                }
            }
        }
    }, [params.salesOrderId, pendingConsumptions, myConsumptions]);

    const {
        handleAcceptConsumption: originalHandleAcceptConsumption,
        handleAcceptAllConsumptions: originalHandleAcceptAllConsumptions,
        handleConfirmDelivery,
        handleConfirmAllDeliveries,
        handleCancelConsumption,
        loading: actionLoading
    } = useValetActions(fetchData);

    const handleAcceptConsumption = async (id: string, roomNum: string, empId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // Optimistic update
        setPendingConsumptions(prev => prev.filter(item => item.id !== id));
        const success = await originalHandleAcceptConsumption(id, roomNum, empId);
        if (!success) fetchData(); // Rollback if failed
    };

    const handleAcceptAllConsumptions = async (items: any[], roomNum: string, empId: string) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Optimistic update
        const itemIds = items.map(i => i.id);
        setPendingConsumptions(prev => prev.filter(item => !itemIds.includes(item.id)));
        const success = await originalHandleAcceptAllConsumptions(items, roomNum, empId);
        if (!success) fetchData(); // Rollback
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const toggleExpand = (roomNum: string) => {
        Haptics.selectionAsync();
        setExpandedRooms(prev => {
            const next = new Set(prev);
            if (next.has(roomNum)) next.delete(roomNum);
            else next.add(roomNum);
            return next;
        });
    };

    const openConfirmModal = (items: any | any[]) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const itemsArray = Array.isArray(items) ? items : [items];
        setSelectedItems(itemsArray);
        const total = itemsArray.reduce((sum, item) => sum + Number(item.total || 0), 0);

        setPayments([{
            id: 'p1',
            amount: total,
            method: 'EFECTIVO'
        }]);
        setNotes('');
        setShowDeliveryModal(true);
    };

    const submitConfirmation = async () => {
        if (selectedItems.length === 0 || !employeeId) return;

        const roomNum = selectedItems[0].sales_orders?.room_stays[0]?.rooms?.number || '??';

        let success = false;
        if (selectedItems.length === 1) {
            success = await handleConfirmDelivery(
                selectedItems[0].id,
                roomNum,
                payments,
                notes,
                employeeId
            );
        } else {
            success = await handleConfirmAllDeliveries(
                selectedItems,
                roomNum,
                payments,
                notes,
                employeeId
            );
        }

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
        return (
            <View className={`flex-1 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
                <View className="p-6 pt-12">
                    <Skeleton width={180} height={24} borderRadius={12} style={{ marginBottom: 20 }} />
                    <View className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <View key={i} className={`p-5 rounded-2xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'}`}>
                                <View className="flex-row justify-between items-center">
                                    <Skeleton width={120} height={20} borderRadius={10} />
                                    <Skeleton width={20} height={20} borderRadius={10} />
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View className={`flex-1 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? '#52525b' : '#a1a1aa'} />}
                className="p-4"
            >
                {/* Mis Entregas */}
                <View className="mb-8">
                    <View className="flex-row items-center mb-4">
                        <ShoppingBag color={isDark ? '#fbbf24' : '#d97706'} size={20} />
                        <Text className={`text-lg font-bold ml-2 ${isDark ? 'text-white' : 'text-zinc-900'}`}>Mis Entregas ({myConsumptions.length})</Text>
                    </View>

                    {Object.entries(groupedMy).map(([roomNum, items]: [string, any]) => {
                        const inTransitItems = items.filter((i: any) => i.delivery_status === 'IN_TRANSIT');

                        return (
                            <View key={roomNum} className={`rounded-2xl border shadow-sm mb-3 overflow-hidden ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'}`}>
                                <TouchableOpacity
                                    onPress={() => toggleExpand(`my-${roomNum}`)}
                                    className={`flex-row justify-between items-center p-4 ${isDark ? 'bg-zinc-800/30' : 'bg-zinc-50'}`}
                                >
                                    <View className="flex-row items-center">
                                        <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Hab. {roomNum}</Text>
                                        <View className="bg-zinc-900 px-2 py-0.5 rounded-full ml-3 border border-zinc-700">
                                            <Text className="text-white text-[10px] font-bold">{items.length} a entregar</Text>
                                        </View>
                                    </View>
                                    <View className="flex-row items-center gap-2">
                                        {inTransitItems.length > 1 && (
                                            <TouchableOpacity
                                                onPress={() => openConfirmModal(inTransitItems)}
                                                className={`px-4 py-2 rounded-xl flex-row items-center border-2 shadow-sm ${isDark ? 'bg-white border-zinc-100' : 'bg-zinc-900 border-zinc-900'}`}
                                            >
                                                <CheckCircle2 size={14} color={isDark ? '#000' : '#fff'} strokeWidth={3} />
                                                <Text className={`text-[10px] font-black uppercase tracking-widest ml-1.5 ${isDark ? 'text-black' : 'text-white'}`}>Entregar Todo</Text>
                                            </TouchableOpacity>
                                        )}
                                        {expandedRooms.has(`my-${roomNum}`) ? <ChevronUp size={20} color={isDark ? '#94a3b8' : '#64748b'} /> : <ChevronDown size={20} color={isDark ? '#94a3b8' : '#64748b'} />}
                                    </View>
                                </TouchableOpacity>

                                {expandedRooms.has(`my-${roomNum}`) && (
                                    <View className={`p-4 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                                        {items.map((item: any) => {
                                            const isInTransit = item.delivery_status === 'IN_TRANSIT';
                                            return (
                                                <View key={item.id} className={`flex-row justify-between items-center py-3 px-2 rounded-lg mb-2 ${isDark ? 'bg-zinc-800/50' : 'bg-zinc-50'}`}>
                                                    <View className="flex-1">
                                                        <Text className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                                            {item.qty}x {item.products?.name || 'Producto'}
                                                        </Text>
                                                        <Text className="text-green-500 font-bold">${Number(item.total || 0).toFixed(2)}</Text>
                                                    </View>
                                                    <View className="flex-row items-center gap-2">
                                                        {isInTransit ? (
                                                            <TouchableOpacity onPress={() => openConfirmModal(item)} className={`px-4 py-2 rounded-xl border-2 ${isDark ? 'bg-white border-zinc-100' : 'bg-zinc-900 border-zinc-900'}`}>
                                                                <Text className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-black' : 'text-white'}`}>Entregar</Text>
                                                            </TouchableOpacity>
                                                        ) : null}
                                                        <TouchableOpacity onPress={() => Alert.alert('Cancelar', '¿Deseas cancelar?', [{ text: 'No' }, { text: 'Sí', onPress: () => handleCancelConsumption(item.id) }])} className={`p-2 rounded-lg ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
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
                </View>

                {/* Pendientes Generales */}
                <View className="mb-20">
                    <View className="flex-row items-center mb-4">
                        <ShoppingBag color={isDark ? '#fbbf24' : '#d97706'} size={20} />
                        <Text className={`text-lg font-bold ml-2 ${isDark ? 'text-white' : 'text-zinc-800'}`}>Pendientes ({pendingConsumptions.length})</Text>
                    </View>

                    {Object.entries(groupedPending).map(([roomNum, items]: [string, any]) => (
                        <View key={roomNum} className={`rounded-2xl border shadow-sm mb-3 ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-100'}`}>
                            <View className={`p-4 flex-row justify-between items-center border-b ${isDark ? 'border-zinc-900' : 'border-zinc-50'}`}>
                                <View className="flex-row items-center">
                                    <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Hab. {roomNum}</Text>
                                    <View className="bg-zinc-900 px-2 py-0.5 rounded-full ml-3 border border-zinc-700">
                                        <Text className="text-white text-[10px] font-bold">{items.length}</Text>
                                    </View>
                                </View>
                                {items.length > 1 && (
                                    <TouchableOpacity
                                        onPress={() => handleAcceptAllConsumptions(items, roomNum, employeeId!)}
                                        className={`px-4 py-2 rounded-xl flex-row items-center border-2 shadow-sm ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-200'}`}
                                    >
                                        <CheckCircle2 size={14} color={isDark ? '#e4e4e7' : '#18181b'} strokeWidth={3} />
                                        <Text className={`text-[10px] font-black uppercase tracking-widest ml-1.5 ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>Aceptar Todo</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            <View className="p-4">
                                {items.map((item: any) => (
                                    <View key={item.id} className={`flex-row justify-between items-center py-3 px-2 rounded-lg mb-2 ${isDark ? 'bg-zinc-900/50' : 'bg-zinc-50'}`}>
                                        <View className="flex-1"><Text className={`font-medium ${isDark ? 'text-white' : 'text-zinc-900'}`}>{item.qty}x {item.products?.name}</Text></View>
                                        <TouchableOpacity onPress={() => handleAcceptConsumption(item.id, roomNum, employeeId!)} className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700"><Text className="text-white text-xs font-bold font-black uppercase tracking-widest">Aceptar</Text></TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ))}
                </View>
            </ScrollView>

            <Modal visible={showDeliveryModal} animationType="slide" transparent>
                <View className="flex-1 justify-end bg-black/70">
                    <View className={`rounded-t-3xl ${isDark ? 'bg-zinc-950' : 'bg-white'}`}>
                        <View className={`flex-row justify-between items-center p-6 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                            <Text className={`text-xl font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-zinc-900'}`}>Confirmar Entrega</Text>
                            <TouchableOpacity onPress={() => setShowDeliveryModal(false)} className="p-2"><X color={isDark ? '#71717a' : '#52525b'} size={24} /></TouchableOpacity>
                        </View>

                        <ScrollView className="p-6">
                            <View className={`rounded-2xl p-5 mb-6 border-2 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-100'}`}>
                                {selectedItems.length === 1 ? (
                                    <View>
                                        <Text className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Servicio</Text>
                                        <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{selectedItems[0]?.qty}x {selectedItems[0]?.products?.name}</Text>
                                        <Text className="text-3xl font-black text-emerald-500 mt-2">${Number(selectedItems[0]?.total || 0).toFixed(2)}</Text>
                                    </View>
                                ) : (
                                    <View>
                                        <Text className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Varios Servicios</Text>
                                        <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{selectedItems.length} servicios seleccionados</Text>
                                        <Text className="text-3xl font-black text-emerald-500 mt-2">
                                            ${selectedItems.reduce((sum, i) => sum + Number(i.total || 0), 0).toFixed(2)}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            <MultiPaymentInput
                                totalAmount={selectedItems.reduce((sum, i) => sum + Number(i.total || 0), 0)}
                                payments={payments}
                                onPaymentsChange={setPayments}
                                disabled={actionLoading}
                            />

                            <TextInput
                                placeholder="Notas adicionales..."
                                placeholderTextColor={isDark ? '#3f3f46' : '#d4d4d8'}
                                value={notes}
                                onChangeText={setNotes}
                                multiline
                                className={`mt-6 p-5 rounded-2xl border-2 font-bold ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-100 text-zinc-900'}`}
                            />

                            <View className="flex-row gap-4 py-10">
                                <TouchableOpacity onPress={() => setShowDeliveryModal(false)} className={`flex-1 h-16 rounded-2xl items-center justify-center border-2 ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                                    <Text className={`font-black uppercase tracking-widest text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={submitConfirmation} className={`flex-1 h-16 rounded-2xl items-center justify-center shadow-lg ${isDark ? 'bg-white' : 'bg-zinc-900'}`}>
                                    <Text className={`font-black uppercase tracking-widest text-xs ${isDark ? 'text-zinc-950' : 'text-white'}`}>Confirmar Entrega</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
