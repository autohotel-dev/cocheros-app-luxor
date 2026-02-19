import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { View, Text, TouchableOpacity, RefreshControl, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useUserRole } from '../../hooks/use-user-role';
import { useEntryActions } from '../../hooks/use-entry-actions';
import { useCheckoutActions } from '../../hooks/use-checkout-actions';
import { useConsumptionActions } from '../../hooks/use-consumption-actions';
import { useTheme } from '../../contexts/theme-context';
import { searchVehicles, VehicleSearchResult } from '../../lib/vehicle-catalog';
import { AlertCircle, AlertTriangle } from 'lucide-react-native';
import { MultiPaymentInput } from '../../components/MultiPaymentInput';
import { PaymentEntry } from '../../lib/payment-types';
import { FlashList } from "@shopify/flash-list";
import * as Haptics from 'expo-haptics';
import { Skeleton, RoomCardSkeleton } from '../../components/Skeleton';
import { Room, SalesOrder, SalesOrderItem } from '../../lib/types';

const AnyFlashList = FlashList as any;



import { RoomCard } from '../../components/rooms/RoomCard';
import { EntryModal } from '../../components/rooms/modals/EntryModal';
import { VerifyExtraModal } from '../../components/rooms/modals/VerifyExtraModal';
import { VerifyRoomChangeModal } from '../../components/rooms/modals/VerifyRoomChangeModal';
import { CheckoutModal } from '../../components/rooms/modals/CheckoutModal';

export default function RoomsScreen() {
    const { employeeId, hasActiveShift, isLoading: roleLoading } = useUserRole();
    const { isDark } = useTheme();
    const [rooms, setRooms] = useState<Room[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // States for Entry Modal
    const [selectedRoom, setSelectedRoom] = useState<any>(null);
    const [showEntryModal, setShowEntryModal] = useState(false);
    const [plate, setPlate] = useState('');
    const [brand, setBrand] = useState('');
    const [model, setModel] = useState('');
    const [payments, setPayments] = useState<PaymentEntry[]>([]);
    const [personCount, setPersonCount] = useState(2);

    // Damage reporting state
    const [showDamageForm, setShowDamageForm] = useState(false);
    const [damageDescription, setDamageDescription] = useState('');
    const [damageAmount, setDamageAmount] = useState('');
    const [damagePayments, setDamagePayments] = useState<PaymentEntry[]>([]);

    // Extra Hour state
    const [showExtraHourForm, setShowExtraHourForm] = useState(false);
    const [extraHourAmount, setExtraHourAmount] = useState('');
    const [extraHourPayments, setExtraHourPayments] = useState<PaymentEntry[]>([]);

    // Extra Person state
    const [showExtraPersonForm, setShowExtraPersonForm] = useState(false);
    const [extraPersonAmount, setExtraPersonAmount] = useState('');
    const [extraPersonPayments, setExtraPersonPayments] = useState<PaymentEntry[]>([]);

    // Vehicle search
    const [vehicleSearch, setVehicleSearch] = useState('');
    const [searchResults, setSearchResults] = useState<VehicleSearchResult[]>([]);
    const [showSearchResults, setShowSearchResults] = useState(false);

    // States for Checkout Modal
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);
    const [checkoutPersonCount, setCheckoutPersonCount] = useState(2);
    const [checkoutPayments, setCheckoutPayments] = useState<PaymentEntry[]>([]);

    // Verify Extra Modal State
    const [showVerifyExtraModal, setShowVerifyExtraModal] = useState(false);
    const [extraItems, setExtraItems] = useState<SalesOrderItem[]>([]);

    // Verify Room Change Modal State
    const [showVerifyRoomChangeModal, setShowVerifyRoomChangeModal] = useState(false);
    const [roomChangeItem, setRoomChangeItem] = useState<SalesOrderItem | null>(null);

    const fetchRooms = useCallback(async (quiet = false) => {
        if (!quiet && isInitialLoad) setLoading(true);
        try {
            const { data, error } = await supabase
                .from("rooms")
                .select(`
                    *,
                    room_types(*),
                    room_stays!inner(
                        *,
                        sales_orders(
                            *,
                            sales_order_items(*)
                        )
                    )
                `)
                .eq("room_stays.status", "ACTIVA")
                .order("number");

            if (error) throw error;
            setRooms(data || []);
        } catch (error) {
            console.error("Error fetching rooms:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
            setIsInitialLoad(false);
        }
    }, [isInitialLoad]);

    useEffect(() => {
        fetchRooms();

        let timeout: NodeJS.Timeout;
        const debouncedFetch = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fetchRooms(true), 1000);
        };

        const channel = supabase.channel('valet-rooms-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'room_stays' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_orders' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_order_items' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, debouncedFetch)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            clearTimeout(timeout);
        };
    }, [fetchRooms]);

    const {
        handleAcceptEntry: originalHandleAcceptEntry,
        handleRegisterVehicleAndPayment,
        loading: entryLoading
    } = useEntryActions(fetchRooms);

    const {
        handleConfirmCheckout,
        handleProposeCheckout,
        handleReportDamage,
        handleRegisterExtraHour,
        handleRegisterExtraPerson,
        loading: checkoutLoading
    } = useCheckoutActions(fetchRooms);

    const {
        handleAcceptVerification,
        handleConfirmAllDeliveries,
        loading: consumptionLoading
    } = useConsumptionActions(fetchRooms);

    const actionLoading = entryLoading || checkoutLoading || consumptionLoading;

    const handleAcceptEntry = async (stayId: string, roomNum: string, valetId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // Optimistic update
        setRooms(prev => prev.map(r => {
            const stay = r.room_stays?.find(s => s.id === stayId);
            if (stay) {
                return { ...r, room_stays: r.room_stays.map(s => s.id === stayId ? { ...s, valet_employee_id: valetId } : s) };
            }
            return r;
        }));
        const success = await originalHandleAcceptEntry(stayId, roomNum, valetId);
        if (!success) fetchRooms(true); // Rollback
        return success;
    };

    const onRefresh = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setRefreshing(true);
        fetchRooms();
    };

    const handleOpenEntry = useCallback((roomId: string) => {
        const room = rooms.find(r => r.id === roomId);
        if (!room) return;
        const stay = room.room_stays?.find(s => s.status === 'ACTIVA');
        if (!stay) {
            console.warn("No active stay found for entry", roomId);
            return;
        }
        setSelectedRoom({ ...room, stay });
        setPlate('');
        setBrand('');
        setModel('');
        setPersonCount(stay.current_people || 2);

        // Inicializar un pago con el monto calculado
        const basePrice = room.room_types?.base_price ?? 0;
        const extraPrice = room.room_types?.extra_person_price ?? 0;
        const currentCount = stay.current_people || 2;
        const extraCount = Math.max(0, currentCount - 2);
        const amount = basePrice + (extraCount * extraPrice);

        setPayments([{
            id: 'p1',
            amount: amount,
            method: 'EFECTIVO'
        }]);

        setVehicleSearch('');
        setSearchResults([]);
        setShowSearchResults(false);
        setShowEntryModal(true);
    }, [rooms]);

    const handleVehicleSearch = (text: string) => {
        setVehicleSearch(text);
        if (text.length >= 2) {
            const results = searchVehicles(text);
            setSearchResults(results);
            setShowSearchResults(results.length > 0);
        } else {
            setSearchResults([]);
            setShowSearchResults(false);
        }
    };

    const selectVehicle = (result: VehicleSearchResult) => {
        setBrand(result.brand.label);
        setModel(result.model);
        setVehicleSearch(`${result.brand.label} ${result.model}`);
        setShowSearchResults(false);
    };

    const handleOpenCheckout = useCallback((roomId: string) => {
        const room = rooms.find(r => r.id === roomId);
        if (!room) return;
        const stay = room.room_stays?.find(s => s.status === 'ACTIVA');
        if (!stay) return;
        setSelectedRoom({ ...room, stay });
        setCheckoutPersonCount(stay.current_people || 2);

        // Pre-cargar precios por defecto del tipo de habitación
        setExtraHourAmount((room.room_types?.extra_hour_price || 0).toString());
        setExtraPersonAmount((room.room_types?.extra_person_price || 0).toString());
        setExtraHourPayments([{ id: 'p1', amount: room.room_types?.extra_hour_price || 0, method: 'EFECTIVO' }]);
        setExtraPersonPayments([{ id: 'p1', amount: room.room_types?.extra_person_price || 0, method: 'EFECTIVO' }]);

        // Initialize checkout payments helper
        const activeStay = room.room_stays?.find(s => s.status === 'ACTIVA');
        const orders = activeStay?.sales_orders;
        const remainingAmount = Array.isArray(orders)
            ? orders.reduce((sum, order) => sum + (order.remaining_amount || 0), 0)
            : (orders?.remaining_amount || 0);

        setCheckoutPayments([{
            id: 'checkout-p1',
            amount: remainingAmount > 0 ? remainingAmount : 0,
            method: 'EFECTIVO'
        }]);

        setShowCheckoutModal(true);
        setShowDamageForm(false);
        setShowExtraHourForm(false);
        setShowExtraPersonForm(false);
    }, [rooms]);



    const submitEntry = async () => {
        if (!selectedRoom || !employeeId || !plate.trim()) return;
        const success = await handleRegisterVehicleAndPayment(
            selectedRoom.stay.id,
            selectedRoom.stay.sales_order_id,
            selectedRoom.number,
            { plate, brand, model },
            payments,
            employeeId,
            personCount,
            selectedRoom.stay.total_people
        );
        if (success) setShowEntryModal(false);
    };


    // Deep linking params
    const params = useLocalSearchParams();
    const processedDeepLinkRef = useRef<string | null>(null);

    // Effect to handle deep linking actions - Placed here to ensure handlers are defined
    useEffect(() => {
        // Create a unique key for this deep link action
        const deepLinkKey = params.action ? `${params.action}:${params.stayId || params.consumptionId}` : null;

        // Skip if no action, still loading, no rooms, or already processed this exact action
        if (!params.action || loading || rooms.length === 0 || processedDeepLinkRef.current === deepLinkKey) {
            return;
        }

        console.log('Deep Link Action:', params.action, params);

        // Mark this action as processed BEFORE executing to prevent re-runs
        processedDeepLinkRef.current = deepLinkKey;

        if (params.action === 'checkout' && params.stayId) {
            const room = rooms.find(r => r.room_stays?.some((s: any) => s.id === params.stayId));
            if (room) {
                handleOpenCheckout(room.id);
            }
        } else if (params.action === 'entry' && params.stayId) {
            const room = rooms.find(r => r.room_stays?.some((s: any) => s.id === params.stayId));
            if (room) {
                handleOpenEntry(room.id);
            }
        } else if (params.action === 'verify' && params.consumptionId) {
            const room = rooms.find(r => r.room_stays?.some((s: any) =>
                s.sales_orders?.sales_order_items?.some((i: any) => i.id === params.consumptionId)
            ));

            if (room) {
                const stay = room.room_stays.find(s => s.status === 'ACTIVA');
                if (stay) {
                    const orders: SalesOrder[] = Array.isArray(stay.sales_orders) ? stay.sales_orders : (stay.sales_orders ? [stay.sales_orders] : []);
                    const pendingExtras = orders.flatMap(o => o.sales_order_items || [])
                        .filter(item =>
                            (item.concept_type === 'EXTRA_PERSON' || item.concept_type === 'EXTRA_HOUR' || item.concept_type === 'RENEWAL' || item.concept_type === 'PROMO_4H') &&
                            (!item.delivery_status || item.delivery_status === 'PENDING_VALET')
                        );

                    if (pendingExtras.length > 0) {
                        setSelectedRoom({ ...room, stay });
                        setExtraItems(pendingExtras);
                        setShowVerifyExtraModal(true);
                    }
                }
            }
        } else if (params.action === 'verifyRoomChange' && params.consumptionId) {
            // Deep link para verificar cambio de habitación
            const room = rooms.find(r => r.room_stays?.some((s: any) =>
                s.sales_orders?.sales_order_items?.some((i: any) => i.id === params.consumptionId)
            ));

            if (room) {
                const stay = room.room_stays.find(s => s.status === 'ACTIVA');
                if (stay) {
                    const orders: SalesOrder[] = Array.isArray(stay.sales_orders) ? stay.sales_orders : (stay.sales_orders ? [stay.sales_orders] : []);
                    const roomChangeItems = orders.flatMap(o => o.sales_order_items || [])
                        .filter(item =>
                            item.concept_type === 'ROOM_CHANGE_ADJUSTMENT' &&
                            (!item.delivery_status || item.delivery_status === 'PENDING_VALET')
                        );

                    if (roomChangeItems.length > 0) {
                        setSelectedRoom({ ...room, stay });
                        setRoomChangeItem(roomChangeItems[0]);
                        setShowVerifyRoomChangeModal(true);
                    }
                }
            }
        }
    }, [params.action, params.stayId, params.consumptionId, loading, rooms.length]);

    const handleReportDamageSubmit = async () => {
        if (!selectedRoom || !employeeId || !damageDescription || !damageAmount) return;
        const success = await handleReportDamage(
            selectedRoom.stay.id,
            selectedRoom.stay.sales_order_id,
            selectedRoom.number,
            damageDescription,
            parseFloat(damageAmount),
            damagePayments,
            employeeId
        );
        if (success) {
            setShowDamageForm(false);
            setDamageDescription('');
            setDamageAmount('');
            setDamagePayments([]);
        }
    };

    const handleExtraHourSubmit = async () => {
        if (!selectedRoom || !employeeId || !extraHourAmount) return;
        const success = await handleRegisterExtraHour(
            selectedRoom.stay.sales_order_id,
            selectedRoom.number,
            parseFloat(extraHourAmount),
            extraHourPayments,
            employeeId
        );
        if (success) {
            setShowExtraHourForm(false);
            setExtraHourAmount('');
            setExtraHourPayments([]);
        }
    };

    const handleExtraPersonSubmit = async () => {
        if (!selectedRoom || !employeeId || !extraPersonAmount) return;
        const success = await handleRegisterExtraPerson(
            selectedRoom.stay.sales_order_id,
            selectedRoom.number,
            parseFloat(extraPersonAmount),
            extraPersonPayments,
            employeeId
        );
        if (success) {
            setShowExtraPersonForm(false);
            setExtraPersonAmount('');
            setExtraPersonPayments([]);
        }
    };

    const handleVerifyExtraOpen = useCallback((room: Room, items: SalesOrderItem[]) => {
        const stay = room.room_stays?.find(s => s.status === 'ACTIVA');
        if (!stay) return;
        setSelectedRoom({ ...room, stay });
        setExtraItems(items);
        setShowVerifyExtraModal(true);
    }, []);

    const handleVerifyExtraSubmit = async (payments: PaymentEntry[]) => {
        if (!selectedRoom || !employeeId) return;

        // Use handleConfirmAllDeliveries to process the payment and update status
        const success = await handleConfirmAllDeliveries(
            extraItems,
            selectedRoom.number,
            payments,
            "Cobro de Extra verificado por Valet", // notes
            employeeId
        );

        if (success) {
            setShowVerifyExtraModal(false);
            setExtraItems([]);
            setSelectedRoom(null);
        }
    };

    const handleVerifyRoomChangeSubmit = async (payments: PaymentEntry[], isRefund: boolean) => {
        if (!selectedRoom || !employeeId || !roomChangeItem) return;

        try {
            // Actualizar issue_description con los detalles del pago reportado por el cochero
            const existingMetadata = roomChangeItem.issue_description
                ? JSON.parse(roomChangeItem.issue_description)
                : {};

            const metadataWithPayment = {
                ...existingMetadata,
                valetPaymentReport: {
                    payments, // Array de { amount, method }
                    reportedAt: new Date().toISOString(),
                    reportedBy: employeeId
                }
            };

            // Marcar el item como entregado/verificado por el cochero
            // NOTA: No marcamos is_paid: true ni insertamos pagos automáticamente.
            // Recepción verificará el dinero y marcará como pagado.
            await supabase.from('sales_order_items')
                .update({
                    delivery_status: 'DELIVERED',
                    delivery_completed_at: new Date().toISOString(),
                    delivery_accepted_by: employeeId,
                    issue_description: JSON.stringify(metadataWithPayment)
                })
                .eq('id', roomChangeItem.id);

            // Feedback visual
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            setShowVerifyRoomChangeModal(false);
            setRoomChangeItem(null);
            setSelectedRoom(null);
            await fetchRooms(true);
        } catch (error) {
            console.error('Error verifying room change:', error);
            Alert.alert('Error', 'No se pudo verificar el cambio. Intenta de nuevo.');
        }
    };

    const handleVerifyRoomChangeOpen = useCallback((room: Room, item: SalesOrderItem) => {
        const stay = room.room_stays?.find(s => s.status === 'ACTIVA');
        if (!stay) return;
        setSelectedRoom({ ...room, stay });
        setRoomChangeItem(item);
        setShowVerifyRoomChangeModal(true);
    }, []);

    const submitCheckout = async () => {
        if (!selectedRoom || !employeeId) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const success = await handleConfirmCheckout(
            selectedRoom.stay.id,
            selectedRoom.number,
            employeeId,
            checkoutPersonCount
        );
        if (success) setShowCheckoutModal(false);
    };

    const renderRoom = useCallback(({ item: room }: { item: Room }) => {
        const stay = room.room_stays?.find(s => s.status === 'ACTIVA');
        if (!stay) return null;

        // Calculate pending extras
        const orders: SalesOrder[] = Array.isArray(stay.sales_orders) ? stay.sales_orders : (stay.sales_orders ? [stay.sales_orders] : []);

        // Debug: Log all items for this room
        const allOrderItems = orders.flatMap(o => o.sales_order_items || []);
        console.log(`[Room ${room.number}] Total items: ${allOrderItems.length}, concept_types:`,
            allOrderItems.map(i => i.concept_type)
        );

        const pendingExtras = allOrderItems.filter(item =>
            (item.concept_type === 'EXTRA_PERSON' || item.concept_type === 'EXTRA_HOUR' || item.concept_type === 'RENEWAL' || item.concept_type === 'PROMO_4H') &&
            (!item.delivery_status || item.delivery_status === 'PENDING_VALET' || item.delivery_status === 'ACCEPTED')
        );

        // Calculate pending room change items
        const allItems = orders.flatMap(o => o.sales_order_items || []);
        const roomChangeItems = allItems.filter(item => item.concept_type === 'ROOM_CHANGE_ADJUSTMENT');

        // Debug log
        if (roomChangeItems.length > 0) {
            console.log(`[Room ${room.number}] Found ${roomChangeItems.length} ROOM_CHANGE items:`,
                roomChangeItems.map(i => ({
                    id: i.id,
                    concept_type: i.concept_type,
                    delivery_status: i.delivery_status,
                    is_paid: i.is_paid
                }))
            );
        }

        const pendingRoomChangeItem = roomChangeItems.find(item =>
            !item.delivery_status || item.delivery_status === 'PENDING_VALET'
        ) || null;

        return (
            <RoomCard
                roomId={room.id}
                stayId={stay.id}
                roomNumber={room.number}
                vehiclePlate={stay.vehicle_plate}
                vehicleBrand={stay.vehicle_brand}
                valetEmployeeId={stay.valet_employee_id}
                isUrgent={!!(stay.vehicle_requested_at || stay.valet_checkout_requested_at)}
                isProposed={!!stay.valet_checkout_requested_at}
                isCheckoutReviewed={!!stay.checkout_valet_employee_id}
                isDark={isDark}
                hasActiveShift={hasActiveShift}
                actionLoading={actionLoading}
                employeeId={employeeId}
                handleAcceptEntry={async (stayId, roomNumber, valetId) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    return await handleAcceptEntry(stayId, roomNumber, valetId);
                }}
                handleOpenEntry={(roomId) => {
                    Haptics.selectionAsync();
                    handleOpenEntry(roomId);
                }}
                handleOpenCheckout={(roomId) => {
                    Haptics.selectionAsync();
                    handleOpenCheckout(roomId);
                }}
                handleProposeCheckout={async (stayId, roomNumber, valetId) => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    return await handleProposeCheckout(stayId, roomNumber, valetId, checkoutPayments);
                }}
                pendingExtras={pendingExtras}
                onVerifyExtras={() => {
                    Haptics.selectionAsync();
                    handleVerifyExtraOpen(room, pendingExtras);
                }}
                onAcceptVerification={async (roomId, items) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    await handleAcceptVerification(items, room.number, employeeId!);
                }}
                pendingRoomChangeItem={pendingRoomChangeItem}
                onVerifyRoomChange={(roomId, item) => {
                    Haptics.selectionAsync();
                    handleVerifyRoomChangeOpen(room, item);
                }}
            />
        );
    }, [isDark, hasActiveShift, actionLoading, employeeId, handleAcceptEntry, handleOpenEntry, handleOpenCheckout, handleProposeCheckout, handleVerifyExtraOpen, handleVerifyRoomChangeOpen]);

    if (loading || roleLoading) {
        return (
            <View className={`flex-1 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
                <View className="p-4 px-6 pt-12">
                    <Skeleton width={180} height={28} borderRadius={14} style={{ marginBottom: 8 }} />
                    <Skeleton width={120} height={14} borderRadius={4} />
                </View>
                <View className="px-2">
                    {[1, 2, 3].map(i => <RoomCardSkeleton key={i} />)}
                </View>
            </View>
        );
    }

    return (
        <View className={`flex-1 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
            {!hasActiveShift && (
                <View className={`p-4 border-b flex-row items-center ${isDark ? 'bg-amber-500/10 border-amber-500/50' : 'bg-amber-100 border-amber-200'}`}>
                    <AlertCircle color="#f59e0b" size={16} />
                    <Text className={`font-black uppercase tracking-[0.2em] text-[10px] ml-2 ${isDark ? 'text-amber-500' : 'text-amber-700'}`}>Inicia turno para realizar acciones</Text>
                </View>
            )}

            <AnyFlashList
                data={rooms}
                renderItem={renderRoom}
                keyExtractor={(item: any) => item.id}
                estimatedItemSize={350}
                contentContainerStyle={{ padding: 8, paddingBottom: 100 }}
                ListEmptyComponent={
                    !loading ? (
                        <View className="flex-1 items-center justify-center py-20">
                            <Text className={`font-bold ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                                No hay habitaciones activas
                            </Text>
                        </View>
                    ) : null
                }
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={isDark ? '#94a3b8' : '#64748b'}
                    />
                }
            />

            <EntryModal
                visible={showEntryModal}
                onClose={() => setShowEntryModal(false)}
                room={selectedRoom}
                isDark={isDark}
                plate={plate}
                setPlate={setPlate}
                brand={brand}
                setBrand={setBrand}
                model={model}
                setModel={setModel}
                personCount={personCount}
                setPersonCount={setPersonCount}
                payments={payments}
                setPayments={setPayments}
                actionLoading={actionLoading}
                onSubmit={submitEntry}
                vehicleSearch={vehicleSearch}
                handleVehicleSearch={handleVehicleSearch}
                showSearchResults={showSearchResults}
                searchResults={searchResults}
                selectVehicle={selectVehicle}
            />

            <CheckoutModal
                visible={showCheckoutModal}
                onClose={() => setShowCheckoutModal(false)}
                room={selectedRoom}
                isDark={isDark}
                actionLoading={actionLoading}
                onSubmit={submitCheckout}
                showDamageForm={showDamageForm}
                setShowDamageForm={setShowDamageForm}
                damageDescription={damageDescription}
                setDamageDescription={setDamageDescription}
                damageAmount={damageAmount}
                setDamageAmount={setDamageAmount}
                damagePayments={damagePayments}
                setDamagePayments={setDamagePayments}
                handleReportDamageSubmit={handleReportDamageSubmit}
                showExtraHourForm={showExtraHourForm}
                setShowExtraHourForm={setShowExtraHourForm}
                extraHourAmount={extraHourAmount}
                setExtraHourAmount={setExtraHourAmount}
                extraHourPayments={extraHourPayments}
                setExtraHourPayments={setExtraHourPayments}
                handleExtraHourSubmit={handleExtraHourSubmit}
                showExtraPersonForm={showExtraPersonForm}
                setShowExtraPersonForm={setShowExtraPersonForm}
                extraPersonAmount={extraPersonAmount}
                setExtraPersonAmount={setExtraPersonAmount}
                extraPersonPayments={extraPersonPayments}
                setExtraPersonPayments={setExtraPersonPayments}
                handleExtraPersonSubmit={handleExtraPersonSubmit}
                payments={checkoutPayments}
                setPayments={setCheckoutPayments}
            />

            <VerifyExtraModal
                visible={showVerifyExtraModal}
                onClose={() => setShowVerifyExtraModal(false)}
                room={selectedRoom}
                items={extraItems}
                isDark={isDark}
                actionLoading={actionLoading}
                onSubmit={handleVerifyExtraSubmit}
            />

            <VerifyRoomChangeModal
                visible={showVerifyRoomChangeModal}
                onClose={() => setShowVerifyRoomChangeModal(false)}
                room={selectedRoom}
                item={roomChangeItem}
                isDark={isDark}
                actionLoading={actionLoading}
                onSubmit={handleVerifyRoomChangeSubmit}
            />
        </View>
    );
}
