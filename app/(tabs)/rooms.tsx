import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, FlatList, RefreshControl, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useUserRole } from '../../hooks/use-user-role';
import { useValetActions } from '../../hooks/use-valet-actions';
import { useTheme } from '../../contexts/theme-context';
import { searchVehicles, VehicleSearchResult } from '../../lib/vehicle-catalog';
import { Car, CheckCircle2, CreditCard, Banknote, AlertCircle, Clock, LogOut, Users, DollarSign, AlertTriangle, X, Minus, Plus, Search } from 'lucide-react-native';

export default function RoomsScreen() {
    const { employeeId, hasActiveShift, isLoading: roleLoading } = useUserRole();
    const { isDark } = useTheme();
    const [rooms, setRooms] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    // States for Entry Modal
    const [selectedRoom, setSelectedRoom] = useState<any>(null);
    const [showEntryModal, setShowEntryModal] = useState(false);
    const [plate, setPlate] = useState('');
    const [brand, setBrand] = useState('');
    const [model, setModel] = useState('');
    const [reference, setReference] = useState('');
    const [method, setMethod] = useState<'EFECTIVO' | 'TARJETA'>('EFECTIVO');
    const [personCount, setPersonCount] = useState(2);
    
    // Vehicle search
    const [vehicleSearch, setVehicleSearch] = useState('');
    const [searchResults, setSearchResults] = useState<VehicleSearchResult[]>([]);
    const [showSearchResults, setShowSearchResults] = useState(false);
    
    // States for Checkout Modal
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);
    const [checkoutPersonCount, setCheckoutPersonCount] = useState(2);

    const fetchRooms = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from("rooms")
                .select(`
                    *,
                    room_types(*),
                    room_stays!inner(
                        *,
                        sales_orders(*)
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
        }
    }, []);

    useEffect(() => {
        fetchRooms();
        const channel = supabase.channel('valet-rooms-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'room_stays' }, () => fetchRooms())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => fetchRooms())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchRooms]);

    const {
        handleAcceptEntry,
        handleRegisterVehicleAndPayment,
        handleConfirmCheckout,
        handleProposeCheckout,
        loading: actionLoading
    } = useValetActions(fetchRooms);

    const onRefresh = () => {
        setRefreshing(true);
        fetchRooms();
    };

    const handleOpenEntry = (room: any) => {
        const stay = room.room_stays.find((s: any) => s.status === 'ACTIVA');
        setSelectedRoom({ ...room, stay });
        setPlate('');
        setBrand('');
        setModel('');
        setReference('');
        setMethod('EFECTIVO');
        setPersonCount(stay.current_people || 2);
        setVehicleSearch('');
        setSearchResults([]);
        setShowSearchResults(false);
        setShowEntryModal(true);
    };

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

    const handleOpenCheckout = (room: any) => {
        const stay = room.room_stays.find((s: any) => s.status === 'ACTIVA');
        setSelectedRoom({ ...room, stay });
        setCheckoutPersonCount(stay.current_people || 2);
        setShowCheckoutModal(true);
    };

    // Calcular monto basado en tipo de habitación y personas
    const baseAmount = selectedRoom?.room_types?.base_price ?? 0;
    const extraPersonPrice = selectedRoom?.room_types?.extra_person_price ?? 0;
    const extraPeopleCount = Math.max(0, personCount - 2);
    const calculatedAmount = baseAmount + (extraPeopleCount * extraPersonPrice);

    const submitEntry = async () => {
        if (!selectedRoom || !employeeId || !plate.trim()) return;
        const success = await handleRegisterVehicleAndPayment(
            selectedRoom.stay.id,
            selectedRoom.stay.sales_order_id,
            selectedRoom.number,
            { plate, brand, model },
            { amount: calculatedAmount, method, reference: method !== 'EFECTIVO' ? reference : undefined },
            employeeId,
            personCount,
            selectedRoom.stay.total_people
        );
        if (success) setShowEntryModal(false);
    };

    const submitCheckout = async () => {
        if (!selectedRoom || !employeeId) return;
        const success = await handleConfirmCheckout(
            selectedRoom.stay.id,
            selectedRoom.number,
            employeeId,
            checkoutPersonCount
        );
        if (success) setShowCheckoutModal(false);
    };

    const renderRoom = ({ item: room }: { item: any }) => {
        const stay = room.room_stays.find((s: any) => s.status === 'ACTIVA');
        if (!stay) return null;

        const isPendingEntry = !stay.vehicle_plate;
        const isPendingCheckout = stay.vehicle_plate && !stay.checkout_valet_employee_id;
        const isUrgent = stay.vehicle_requested_at || stay.valet_checkout_requested_at;
        const isProposed = !!stay.valet_checkout_requested_at;
        
        // Distinguir entre entradas sin asignar y mis entradas asignadas
        const isUnassignedEntry = isPendingEntry && !stay.valet_employee_id;
        const isMyPendingEntry = isPendingEntry && stay.valet_employee_id === employeeId;

        return (
            <View className={`m-2 p-4 rounded-2xl border shadow-sm ${
                isUrgent 
                    ? (isDark ? 'bg-red-900/20 border-red-800' : 'border-red-200 bg-red-50/10') 
                    : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')
            }`}>
                <View className="flex-row justify-between items-center mb-4">
                    <View>
                        <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Habitación {room.number}</Text>
                        {stay.vehicle_plate && (
                            <Text className="text-blue-500 font-bold text-xs">{stay.vehicle_plate} • {stay.vehicle_brand}</Text>
                        )}
                    </View>
                    <View className="flex-row gap-1">
                        {isUrgent && (
                            <View className="bg-red-500 px-2 py-1 rounded-full">
                                <Text className="text-white font-bold text-[8px] uppercase">¡URGENTE!</Text>
                            </View>
                        )}
                        {isMyPendingEntry && (
                            <View className="bg-purple-100 px-2 py-1 rounded-full border border-purple-200">
                                <Text className="text-purple-700 font-bold text-[8px] uppercase">MI ENTRADA</Text>
                            </View>
                        )}
                        {isProposed && (
                            <View className="bg-amber-100 px-2 py-1 rounded-full border border-amber-200">
                                <Text className="text-amber-700 font-bold text-[8px] uppercase">En Revisión</Text>
                            </View>
                        )}
                    </View>
                </View>

                {isUnassignedEntry ? (
                    // Entrada sin asignar - mostrar botón para aceptar
                    <TouchableOpacity
                        onPress={() => handleAcceptEntry(stay.id, room.number, employeeId!)}
                        disabled={!hasActiveShift || actionLoading}
                        className={`flex-row items-center justify-center p-4 rounded-xl ${hasActiveShift ? 'bg-blue-600' : 'bg-slate-200'}`}
                    >
                        <CheckCircle2 color="white" size={20} />
                        <Text className="text-white font-bold ml-2">Aceptar Entrada</Text>
                    </TouchableOpacity>
                ) : isMyPendingEntry ? (
                    // Mi entrada asignada - mostrar botón para registrar auto
                    <TouchableOpacity
                        onPress={() => handleOpenEntry(room)}
                        disabled={!hasActiveShift || actionLoading}
                        className={`flex-row items-center justify-center p-4 rounded-xl ${hasActiveShift ? 'bg-purple-600' : 'bg-slate-200'}`}
                    >
                        <Car color="white" size={20} />
                        <Text className="text-white font-bold ml-2">Registrar Auto</Text>
                    </TouchableOpacity>
                ) : isPendingCheckout ? (
                    <View className="gap-2">
                        {isUrgent ? (
                            // Solicitado - Botón grande rojo
                            <TouchableOpacity
                                onPress={() => handleOpenCheckout(room)}
                                disabled={!hasActiveShift || actionLoading}
                                className={`flex-row items-center justify-center p-4 rounded-xl ${hasActiveShift ? 'bg-red-600' : 'bg-slate-200'}`}
                            >
                                <LogOut color="white" size={20} />
                                <Text className="text-white font-bold ml-2 text-lg">Entregar</Text>
                            </TouchableOpacity>
                        ) : (
                            <>
                                {!isProposed && (
                                    <TouchableOpacity
                                        onPress={() => handleProposeCheckout(stay.id, room.number, employeeId!)}
                                        disabled={!hasActiveShift || actionLoading}
                                        className={`flex-row items-center justify-center p-3 rounded-xl border border-slate-200`}
                                    >
                                        <Text className="text-slate-500 font-medium">Avisar Salida</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    onPress={() => handleOpenCheckout(room)}
                                    disabled={!hasActiveShift || actionLoading}
                                    className={`flex-row items-center justify-center p-4 rounded-xl ${hasActiveShift ? 'bg-slate-600' : 'bg-slate-200'}`}
                                >
                                    <LogOut color="white" size={20} />
                                    <Text className="text-white font-bold ml-2">Entregar</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                ) : (
                    <View className="flex-row items-center justify-center p-4 rounded-xl bg-slate-100">
                        <Text className="text-slate-400 font-medium">Revisión Enviada</Text>
                    </View>
                )}
            </View>
        );
    };

    if (loading || roleLoading) {
        return <View className={`flex-1 items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}><ActivityIndicator size="large" color="#2563eb" /></View>;
    }

    return (
        <View className={`flex-1 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
            {!hasActiveShift && (
                <View className={`p-4 border-b flex-row items-center ${isDark ? 'bg-amber-900/30 border-amber-800' : 'bg-amber-100 border-amber-200'}`}>
                    <Text className={`font-medium flex-1 ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>Debes iniciar turno para realizar acciones.</Text>
                </View>
            )}

            <FlatList
                data={rooms}
                renderItem={renderRoom}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 8 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? '#94a3b8' : '#64748b'} />}
            />

            {/* Modal de Entrada - Diseño igual a Next.js */}
            <Modal visible={showEntryModal} animationType="slide" transparent>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                    <View className="flex-1 justify-end bg-black/50">
                        <View className={`rounded-t-3xl max-h-[90%] ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                            {/* Header */}
                            <View className={`flex-row justify-between items-center p-6 border-b ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                                <View>
                                    <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Entrada - Hab. {selectedRoom?.number}</Text>
                                    <Text className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{selectedRoom?.room_types?.name}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setShowEntryModal(false)} className="p-2">
                                    <X color={isDark ? '#94a3b8' : '#64748b'} size={24} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView className="p-6" showsVerticalScrollIndicator={false}>
                                {/* Sección Datos del Vehículo */}
                                <View className="mb-6">
                                    <View className="flex-row items-center gap-2 mb-4">
                                        <Car color="#3b82f6" size={20} />
                                        <Text className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Datos del Vehículo</Text>
                                    </View>

                                    <View className="mb-3">
                                        <Text className={`text-sm mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Placa <Text className="text-red-500">*</Text></Text>
                                        <TextInput
                                            value={plate}
                                            onChangeText={setPlate}
                                            placeholder="ABC-123"
                                            placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                                            autoCapitalize="characters"
                                            className={`border rounded-xl px-4 py-3 text-lg uppercase ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                                        />
                                    </View>

                                    {/* Búsqueda rápida por modelo */}
                                    <View className="mb-3 relative">
                                        <Text className={`text-sm mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Buscar vehículo</Text>
                                        <View className={`flex-row items-center border rounded-xl px-3 ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                                            <Search color={isDark ? '#64748b' : '#94a3b8'} size={18} />
                                            <TextInput
                                                value={vehicleSearch}
                                                onChangeText={handleVehicleSearch}
                                                placeholder="Buscar por modelo (ej: Corolla, Versa)..."
                                                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                                                className={`flex-1 py-3 pl-2 ${isDark ? 'text-white' : 'text-slate-800'}`}
                                            />
                                            {vehicleSearch.length > 0 && (
                                                <TouchableOpacity onPress={() => { setVehicleSearch(''); setShowSearchResults(false); }}>
                                                    <X color={isDark ? '#64748b' : '#94a3b8'} size={18} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                        
                                        {/* Resultados de búsqueda */}
                                        {showSearchResults && searchResults.length > 0 && (
                                            <View className={`absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border shadow-lg max-h-48 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                                                    {searchResults.map((result, idx) => (
                                                        <TouchableOpacity
                                                            key={idx}
                                                            onPress={() => selectVehicle(result)}
                                                            className={`flex-row items-center px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-100'}`}
                                                        >
                                                            <Text className="text-blue-500 font-medium">{result.brand.label}</Text>
                                                            <Text className={`ml-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{result.model}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </ScrollView>
                                            </View>
                                        )}
                                    </View>

                                    <View className="flex-row gap-3">
                                        <View className="flex-1">
                                            <Text className={`text-sm mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Marca</Text>
                                            <TextInput
                                                value={brand}
                                                onChangeText={setBrand}
                                                placeholder="Toyota"
                                                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                                                className={`border rounded-xl px-4 py-3 ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                                            />
                                        </View>
                                        <View className="flex-1">
                                            <Text className={`text-sm mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Modelo</Text>
                                            <TextInput
                                                value={model}
                                                onChangeText={setModel}
                                                placeholder="Corolla"
                                                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                                                className={`border rounded-xl px-4 py-3 ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                                            />
                                        </View>
                                    </View>
                                </View>

                                {/* Sección Cobro al Cliente */}
                                <View className={`border-t pt-6 mb-6 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                                    <Text className={`text-base font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>Cobro al Cliente</Text>

                                    <View className="flex-row gap-4 mb-4">
                                        {/* Contador de Personas */}
                                        <View className="flex-1">
                                            <Text className={`text-xs uppercase font-bold tracking-wider mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Personas</Text>
                                            <View className="flex-row items-center gap-2">
                                                <TouchableOpacity
                                                    onPress={() => setPersonCount(prev => Math.max(1, prev - 1))}
                                                    className={`w-10 h-10 rounded-lg items-center justify-center border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-100 border-slate-200'}`}
                                                >
                                                    <Minus color={isDark ? '#94a3b8' : '#64748b'} size={18} />
                                                </TouchableOpacity>
                                                <View className={`flex-1 h-10 rounded-lg items-center justify-center ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                                                    <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{personCount}</Text>
                                                </View>
                                                <TouchableOpacity
                                                    onPress={() => setPersonCount(prev => prev + 1)}
                                                    className={`w-10 h-10 rounded-lg items-center justify-center border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-100 border-slate-200'}`}
                                                >
                                                    <Plus color={isDark ? '#94a3b8' : '#64748b'} size={18} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        {/* Monto a Cobrar */}
                                        <View className={`flex-1 rounded-xl p-3 ${isDark ? 'bg-green-900/30 border border-green-800' : 'bg-green-50 border border-green-200'}`}>
                                            <Text className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Monto a cobrar</Text>
                                            <Text className="text-2xl font-bold text-green-500">${calculatedAmount.toFixed(2)}</Text>
                                        </View>
                                    </View>

                                    {extraPeopleCount > 0 && (
                                        <View className={`rounded-lg px-3 py-2 mb-4 border ${isDark ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-100'}`}>
                                            <Text className={`text-xs ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                                                Incluye {extraPeopleCount} persona{extraPeopleCount > 1 ? 's' : ''} extra ({`$${(extraPeopleCount * extraPersonPrice).toFixed(2)}`})
                                            </Text>
                                        </View>
                                    )}

                                    {/* Métodos de Pago */}
                                    <Text className={`text-sm mb-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Método de pago</Text>
                                    <View className="gap-2 mb-4">
                                        <TouchableOpacity
                                            onPress={() => setMethod('EFECTIVO')}
                                            className={`flex-row items-center p-4 rounded-xl border-2 ${method === 'EFECTIVO' ? (isDark ? 'bg-blue-900/30 border-blue-500' : 'bg-blue-50 border-blue-500') : (isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200')}`}
                                        >
                                            <View className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${method === 'EFECTIVO' ? 'border-blue-500' : (isDark ? 'border-slate-500' : 'border-slate-300')}`}>
                                                {method === 'EFECTIVO' && <View className="w-3 h-3 rounded-full bg-blue-500" />}
                                            </View>
                                            <Banknote color="#22c55e" size={20} />
                                            <Text className={`ml-2 font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>Efectivo</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => setMethod('TARJETA')}
                                            className={`flex-row items-center p-4 rounded-xl border-2 ${method === 'TARJETA' ? (isDark ? 'bg-blue-900/30 border-blue-500' : 'bg-blue-50 border-blue-500') : (isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200')}`}
                                        >
                                            <View className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${method === 'TARJETA' ? 'border-blue-500' : (isDark ? 'border-slate-500' : 'border-slate-300')}`}>
                                                {method === 'TARJETA' && <View className="w-3 h-3 rounded-full bg-blue-500" />}
                                            </View>
                                            <CreditCard color="#3b82f6" size={20} />
                                            <Text className={`ml-2 font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>Tarjeta</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {method === 'TARJETA' && (
                                        <View className="mb-4">
                                            <Text className={`text-sm mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Últimos 4 dígitos del voucher</Text>
                                            <TextInput
                                                value={reference}
                                                onChangeText={setReference}
                                                placeholder="1234"
                                                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                                                keyboardType="numeric"
                                                maxLength={4}
                                                className={`rounded-xl px-4 py-3 text-lg border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                                            />
                                        </View>
                                    )}
                                </View>

                                {/* Warning */}
                                <View className={`rounded-xl p-4 mb-6 border-2 ${isDark ? 'bg-amber-900/20 border-amber-700' : 'bg-amber-50 border-amber-400'}`}>
                                    <View className="flex-row items-start gap-3">
                                        <AlertCircle color="#f59e0b" size={24} />
                                        <View className="flex-1">
                                            <Text className={`font-semibold mb-1 ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>¡IMPORTANTE!</Text>
                                            <Text className={`text-sm ${isDark ? 'text-amber-400/80' : 'text-amber-700'}`}>
                                                Lleva {method === 'EFECTIVO' ? 'el dinero' : 'el voucher'} a recepción para confirmar el pago.
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Botones */}
                                <View className="flex-row gap-3 pb-8">
                                    <TouchableOpacity
                                        onPress={() => setShowEntryModal(false)}
                                        disabled={actionLoading}
                                        className={`flex-1 h-14 rounded-xl items-center justify-center border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}
                                    >
                                        <Text className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Cancelar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={submitEntry}
                                        disabled={actionLoading || !plate.trim()}
                                        className={`flex-1 h-14 rounded-xl items-center justify-center ${plate.trim() ? 'bg-green-600' : 'bg-slate-300'}`}
                                    >
                                        {actionLoading ? (
                                            <ActivityIndicator color="white" />
                                        ) : (
                                            <Text className="font-semibold text-white">Registrar Cobro</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Modal de Checkout - Diseño igual a Next.js con modo oscuro */}
            <Modal visible={showCheckoutModal} animationType="slide" transparent>
                <View className="flex-1 justify-end bg-black/50">
                    <View className={`rounded-t-3xl ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                        {/* Header */}
                        <View className={`flex-row justify-between items-center p-6 border-b ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                            <View>
                                <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Revisión de Salida - Hab. {selectedRoom?.number}</Text>
                                <Text className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{selectedRoom?.room_types?.name}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowCheckoutModal(false)} className="p-2">
                                <X color={isDark ? '#94a3b8' : '#64748b'} size={24} />
                            </TouchableOpacity>
                        </View>

                        <View className="p-6">
                            {/* Duración */}
                            <View className={`rounded-xl p-4 mb-4 border ${isDark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'}`}>
                                <View className="flex-row items-center gap-2 mb-2">
                                    <Clock color="#3b82f6" size={20} />
                                    <Text className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Duración de estancia</Text>
                                </View>
                                <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                    {selectedRoom?.stay?.check_in_at ? 
                                        `${Math.floor((Date.now() - new Date(selectedRoom.stay.check_in_at).getTime()) / 3600000)}h ${Math.floor(((Date.now() - new Date(selectedRoom.stay.check_in_at).getTime()) % 3600000) / 60000)}m` 
                                        : '--'}
                                </Text>
                            </View>

                            {/* Saldo */}
                            {(selectedRoom?.stay?.sales_orders?.remaining_amount ?? 0) > 0 ? (
                                <View className={`rounded-xl p-4 mb-4 border-2 ${isDark ? 'bg-amber-900/20 border-amber-700' : 'bg-amber-50 border-amber-400'}`}>
                                    <View className="flex-row items-center gap-2 mb-2">
                                        <AlertTriangle color="#f59e0b" size={20} />
                                        <Text className={`font-semibold ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>Saldo Pendiente</Text>
                                    </View>
                                    <Text className="text-3xl font-bold text-amber-500 mb-2">
                                        ${(selectedRoom?.stay?.sales_orders?.remaining_amount ?? 0).toFixed(2)}
                                    </Text>
                                    <Text className={`text-sm ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                                        ⚠️ Cliente debe pasar a recepción para liquidar saldo
                                    </Text>
                                </View>
                            ) : (
                                <View className={`rounded-xl p-4 mb-4 border ${isDark ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'}`}>
                                    <View className="flex-row items-center gap-2 mb-2">
                                        <DollarSign color="#22c55e" size={20} />
                                        <Text className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Estado de pago</Text>
                                    </View>
                                    <Text className="text-lg font-semibold text-green-500">✓ Saldo liquidado</Text>
                                </View>
                            )}

                            {/* Checklist y Personas */}
                            <View className="flex-row gap-4 mb-6">
                                <View className={`flex-1 rounded-xl p-4 border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                    <Text className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>Checklist de Revisión</Text>
                                    <View className="gap-2">
                                        <View className="flex-row items-center gap-2">
                                            <CheckCircle2 color="#22c55e" size={16} />
                                            <Text className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Habitación en orden</Text>
                                        </View>
                                        <View className="flex-row items-center gap-2">
                                            <CheckCircle2 color="#22c55e" size={16} />
                                            <Text className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Sin daños o faltantes</Text>
                                        </View>
                                        <View className="flex-row items-center gap-2">
                                            <CheckCircle2 color="#22c55e" size={16} />
                                            <Text className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Artículos de baño</Text>
                                        </View>
                                    </View>
                                </View>

                                <View className={`flex-1 rounded-xl p-4 border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                    <Text className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>Personas que salen</Text>
                                    <View className="flex-row items-center gap-2">
                                        <TouchableOpacity
                                            onPress={() => setCheckoutPersonCount(prev => Math.max(1, prev - 1))}
                                            className={`w-10 h-10 rounded-lg items-center justify-center border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-100 border-slate-200'}`}
                                        >
                                            <Minus color={isDark ? '#94a3b8' : '#64748b'} size={18} />
                                        </TouchableOpacity>
                                        <View className={`flex-1 h-10 rounded-lg items-center justify-center ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                                            <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{checkoutPersonCount}</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => setCheckoutPersonCount(prev => prev + 1)}
                                            className={`w-10 h-10 rounded-lg items-center justify-center border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-100 border-slate-200'}`}
                                        >
                                            <Plus color={isDark ? '#94a3b8' : '#64748b'} size={18} />
                                        </TouchableOpacity>
                                    </View>
                                    <Text className={`text-[10px] text-center mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                        Registrado al entrar: {selectedRoom?.stay?.current_people ?? 2}
                                    </Text>
                                </View>
                            </View>

                            {/* Info */}
                            <View className={`rounded-xl p-3 mb-6 ${isDark ? 'bg-slate-700' : 'bg-slate-50'}`}>
                                <Text className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Al confirmar, notificarás a recepción que la habitación está lista para salida.
                                </Text>
                            </View>

                            {/* Botones */}
                            <View className="flex-row gap-3">
                                <TouchableOpacity
                                    onPress={() => setShowCheckoutModal(false)}
                                    disabled={actionLoading}
                                    className={`flex-1 h-14 rounded-xl items-center justify-center border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}
                                >
                                    <Text className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={submitCheckout}
                                    disabled={actionLoading}
                                    className="flex-1 h-14 bg-blue-600 rounded-xl items-center justify-center"
                                >
                                    {actionLoading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <Text className="font-semibold text-white">Confirmar OK</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
