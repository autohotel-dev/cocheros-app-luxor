import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, FlatList, RefreshControl, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useUserRole } from '../../hooks/use-user-role';
import { useValetActions } from '../../hooks/use-valet-actions';
import { useTheme } from '../../contexts/theme-context';
import { searchVehicles, VehicleSearchResult } from '../../lib/vehicle-catalog';
import { Car, CheckCircle2, CreditCard, Banknote, AlertCircle, Clock, LogOut, Users, DollarSign, AlertTriangle, X, Minus, Plus, Search, Hammer } from 'lucide-react-native';
import { MultiPaymentInput } from '../../components/MultiPaymentInput';
import { PaymentEntry } from '../../lib/payment-types';
import { FlashList } from "@shopify/flash-list";
import * as Haptics from 'expo-haptics';
import { Skeleton, RoomCardSkeleton } from '../../components/Skeleton';

const AnyFlashList = FlashList as any;

interface RoomCardProps {
    roomId: string;
    stayId: string;
    roomNumber: string;
    vehiclePlate: string | null;
    vehicleBrand: string | null;
    valetEmployeeId: string | null;
    isUrgent: boolean;
    isProposed: boolean;
    isDark: boolean;
    hasActiveShift: boolean;
    actionLoading: boolean;
    employeeId: string | null;
    handleAcceptEntry: (stayId: string, roomNumber: string, valetId: string) => Promise<boolean>;
    handleOpenEntry: (roomId: string) => void;
    handleOpenCheckout: (roomId: string) => void;
    handleProposeCheckout: (stayId: string, roomNumber: string, valetId: string) => Promise<boolean>;
    pendingExtras: any[];
    onVerifyExtras: (room: any, items: any[]) => void;
    isCheckoutReviewed: boolean;
}

const RoomCard = React.memo(({
    roomId,
    stayId,
    roomNumber,
    vehiclePlate,
    vehicleBrand,
    valetEmployeeId,
    isUrgent,
    isProposed,
    isDark,
    hasActiveShift,
    actionLoading,
    employeeId,
    handleAcceptEntry,
    handleOpenEntry,
    handleOpenCheckout,
    handleProposeCheckout,
    pendingExtras,
    onVerifyExtras,
    isCheckoutReviewed
}: RoomCardProps) => {
    const isPendingEntry = !vehiclePlate;
    const isPendingCheckout = !!vehiclePlate && !isCheckoutReviewed;
    const hasPendingExtras = pendingExtras && pendingExtras.length > 0;

    // Distinguir entre entradas sin asignar y mis entradas asignadas
    const isUnassignedEntry = isPendingEntry && !valetEmployeeId;
    const isMyPendingEntry = isPendingEntry && valetEmployeeId === employeeId;

    // Estilos dinámicos simplificados para evitar recursión en NativeWind v4
    const containerClasses = [
        "m-2 p-5 rounded-2xl border-2 shadow-sm",
        isUrgent
            ? (isDark ? 'bg-red-500/10 border-red-500/50' : 'border-red-200 bg-red-50')
            : (isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100')
    ].join(" ");

    return (
        <View className={containerClasses}>
            <View className="flex-row justify-between items-center mb-5">
                <View>
                    <Text className={`text-[10px] uppercase font-black tracking-widest mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Habitación</Text>
                    <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>{roomNumber}</Text>
                    {vehiclePlate && (
                        <View className="flex-row items-center mt-1">
                            <Car size={12} color={isDark ? '#a1a1aa' : '#52525b'} />
                            <Text className={`ml-1.5 font-black text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{vehiclePlate} • {vehicleBrand}</Text>
                        </View>
                    )}
                </View>
                <View className="flex-row gap-1">
                    {isUrgent && (
                        <View className="bg-red-500 px-2 py-1 rounded-full">
                            <Text className="text-white font-bold text-[8px] uppercase">¡URGENTE!</Text>
                        </View>
                    )}
                    {isMyPendingEntry && (
                        <View className={`px-2 py-1 rounded-full border ${isDark ? 'bg-zinc-100 border-zinc-100' : 'bg-black border-black'}`}>
                            <Text className={`font-black text-[8px] uppercase ${isDark ? 'text-black' : 'text-white'}`}>MI ENTRADA</Text>
                        </View>
                    )}
                    {isProposed && (
                        <View className={`px-2 py-1 rounded-full border ${isDark ? 'bg-amber-500/10 border-amber-500/50' : 'bg-amber-50 border-amber-200'}`}>
                            <Text className={`font-black text-[8px] uppercase ${isDark ? 'text-amber-500' : 'text-amber-700'}`}>En Revisión</Text>
                        </View>
                    )}
                </View>
            </View>

            {hasPendingExtras && (
                <TouchableOpacity
                    onPress={() => onVerifyExtras(roomId, pendingExtras)} // We'll pass the room object in the parent or find it by ID
                    disabled={!hasActiveShift || actionLoading}
                    className={`flex-row items-center justify-center p-4 rounded-xl shadow-sm mb-3 ${hasActiveShift ? (isDark ? 'bg-amber-600' : 'bg-amber-500') : 'bg-zinc-200'}`}
                >
                    <AlertTriangle color="white" size={20} strokeWidth={3} />
                    <Text className="font-black uppercase tracking-widest text-xs ml-2 text-white">
                        Verificar Extra ({pendingExtras.length})
                    </Text>
                </TouchableOpacity>
            )}

            {isUnassignedEntry ? (
                <TouchableOpacity
                    onPress={() => handleAcceptEntry(stayId, roomNumber, employeeId!)}
                    disabled={!hasActiveShift || actionLoading}
                    className={`flex-row items-center justify-center p-4 rounded-xl shadow-sm ${hasActiveShift ? (isDark ? 'bg-white' : 'bg-zinc-900') : 'bg-zinc-200'}`}
                >
                    <CheckCircle2 color={isDark ? '#000' : '#fff'} size={20} strokeWidth={3} />
                    <Text className={`font-black uppercase tracking-widest text-xs ml-2 ${isDark ? 'text-black' : 'text-white'}`}>Aceptar Entrada</Text>
                </TouchableOpacity>
            ) : isMyPendingEntry ? (
                <TouchableOpacity
                    onPress={() => handleOpenEntry(roomId)}
                    disabled={!hasActiveShift || actionLoading}
                    className={`flex-row items-center justify-center p-4 rounded-xl shadow-sm ${hasActiveShift ? (isDark ? 'bg-white' : 'bg-zinc-900') : 'bg-zinc-200'}`}
                >
                    <Car color={isDark ? '#000' : '#fff'} size={20} strokeWidth={3} />
                    <Text className={`font-black uppercase tracking-widest text-xs ml-2 ${isDark ? 'text-black' : 'text-white'}`}>Registrar Auto</Text>
                </TouchableOpacity>
            ) : isPendingCheckout ? (

                <View>
                    {isUrgent ? (
                        <TouchableOpacity
                            onPress={() => handleOpenCheckout(roomId)}
                            disabled={!hasActiveShift || actionLoading}
                            className={`flex-row items-center justify-center p-4 rounded-xl shadow-md ${hasActiveShift ? 'bg-red-600' : 'bg-zinc-200'}`}
                        >
                            <LogOut color="white" size={20} strokeWidth={3} />
                            <Text className="text-white font-black uppercase tracking-widest ml-2">Entregar Auto</Text>
                        </TouchableOpacity>
                    ) : (
                        <View>
                            {!isProposed && (
                                <TouchableOpacity
                                    onPress={() => handleProposeCheckout(stayId, roomNumber, employeeId!)}
                                    disabled={!hasActiveShift || actionLoading}
                                    className={`flex-row items-center justify-center p-3 rounded-xl border-2 border-dashed mb-2 ${isDark ? 'border-zinc-700' : 'border-zinc-200'}`}
                                >
                                    <Text className={`font-black uppercase tracking-widest text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Avisar Salida</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                onPress={() => handleOpenCheckout(roomId)}
                                disabled={!hasActiveShift || actionLoading}
                                className={`flex-row items-center justify-center p-4 rounded-xl border-2 ${hasActiveShift ? (isDark ? 'border-zinc-700 bg-zinc-800' : 'border-zinc-100 bg-zinc-50') : 'bg-zinc-200 border-zinc-200'}`}
                            >
                                <LogOut color={isDark ? '#a1a1aa' : '#52525b'} size={20} strokeWidth={3} />
                                <Text className={`font-black uppercase tracking-widest text-xs ml-2 ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>Entregar</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            ) : (
                <View className={`flex-row items-center justify-center p-4 rounded-xl border-2 border-dashed ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-100'}`}>
                    <Text className={`font-black uppercase tracking-widest text-[10px] ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>Revisión Enviada</Text>
                </View>
            )}
        </View>
    );
});

// --- Modal Components ---

interface EntryModalProps {
    visible: boolean;
    onClose: () => void;
    room: any;
    isDark: boolean;
    plate: string;
    setPlate: (v: string) => void;
    brand: string;
    setBrand: (v: string) => void;
    model: string;
    setModel: (v: string) => void;
    personCount: number;
    setPersonCount: (v: any) => void;
    payments: any[];
    setPayments: (v: any) => void;
    actionLoading: boolean;
    onSubmit: () => void;
    vehicleSearch: string;
    handleVehicleSearch: (t: string) => void;
    showSearchResults: boolean;
    searchResults: any[];
    selectVehicle: (v: any) => void;
}

const EntryModal = React.memo(({
    visible, onClose, room, isDark, plate, setPlate, brand, setBrand, model, setModel,
    personCount, setPersonCount, payments, setPayments, actionLoading, onSubmit,
    vehicleSearch, handleVehicleSearch, showSearchResults, searchResults, selectVehicle
}: EntryModalProps) => {
    const basePrice = room?.room_types?.base_price ?? 0;
    const extraPrice = room?.room_types?.extra_person_price ?? 0;
    const extraCount = Math.max(0, personCount - 2);
    const amount = basePrice + (extraCount * extraPrice);

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                <View className="flex-1 justify-end bg-black/70">
                    <View className={`rounded-t-3xl max-h-[90%] ${isDark ? 'bg-zinc-950' : 'bg-white'}`}>
                        <View className={`flex-row justify-between items-center p-6 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                            <View>
                                <Text className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Check-in Valet</Text>
                                <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>Hab. {room?.number}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} className="p-2">
                                <X color={isDark ? '#71717a' : '#52525b'} size={24} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView className="p-6" showsVerticalScrollIndicator={false}>
                            <View className="mb-6">
                                <View className="flex-row items-center gap-2 mb-4">
                                    <Car color="#3b82f6" size={20} />
                                    <Text className={`text-base font-semibold ${isDark ? 'text-white' : 'text-zinc-800'}`}>Datos del Vehículo</Text>
                                </View>
                                <View className="mb-3">
                                    <View className="mb-4 relative">
                                        <TextInput
                                            value={plate}
                                            onChangeText={setPlate}
                                            placeholder="Placa (ABC-123)"
                                            placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                                            autoCapitalize="characters"
                                            className={`border rounded-xl px-4 py-3 text-lg uppercase ${isDark ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-800'}`}
                                        />
                                    </View>
                                    <View className="mb-4 relative">
                                        <TextInput
                                            value={vehicleSearch}
                                            onChangeText={handleVehicleSearch}
                                            placeholder="Buscar modelo..."
                                            placeholderTextColor={isDark ? '#3f3f46' : '#a1a1aa'}
                                            className={`border-2 rounded-2xl py-4 px-4 font-bold ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-100 text-zinc-900'}`}
                                        />
                                        {showSearchResults && searchResults.length > 0 && (
                                            <View className={`absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border shadow-lg max-h-48 ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-200'}`}>
                                                <ScrollView nestedScrollEnabled>
                                                    {searchResults.map((result: any, idx: number) => (
                                                        <TouchableOpacity key={idx} onPress={() => selectVehicle(result)} className={`flex-row items-center px-4 py-3 border-b ${isDark ? 'border-zinc-700' : 'border-zinc-100'}`}>
                                                            <Text className="text-blue-500 font-medium">{result.brand.label}</Text>
                                                            <Text className={`ml-2 ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{result.model}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </ScrollView>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </View>
                            <View className={`border-t pt-8 mb-6 ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                                <View className="flex-row gap-4 mb-6">
                                    <View className="flex-1">
                                        <Text className={`text-[10px] uppercase font-black tracking-widest mb-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Personas</Text>
                                        <View className="flex-row items-center gap-2">
                                            <TouchableOpacity onPress={() => setPersonCount((prev: number) => Math.max(1, prev - 1))} className={`w-12 h-12 rounded-xl items-center justify-center border-2 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-100'}`}>
                                                <Minus color={isDark ? '#a1a1aa' : '#52525b'} size={18} />
                                            </TouchableOpacity>
                                            <View className={`flex-1 h-12 rounded-xl items-center justify-center ${isDark ? 'bg-zinc-900' : 'bg-zinc-50'}`}>
                                                <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>{personCount}</Text>
                                            </View>
                                            <TouchableOpacity onPress={() => setPersonCount((prev: number) => prev + 1)} className={`w-12 h-12 rounded-xl items-center justify-center border-2 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-100'}`}>
                                                <Plus color={isDark ? '#a1a1aa' : '#52525b'} size={18} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    <View className={`flex-1 rounded-2xl p-4 border-2 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-100'}`}>
                                        <Text className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Total</Text>
                                        <Text className="text-3xl font-black text-emerald-500">${amount.toFixed(2)}</Text>
                                    </View>
                                </View>
                                <MultiPaymentInput totalAmount={amount} payments={payments} onPaymentsChange={setPayments} disabled={actionLoading} />
                            </View>
                            <View className="flex-row gap-4 pb-12">
                                <TouchableOpacity onPress={onClose} className={`flex-1 h-16 rounded-2xl items-center justify-center border-2 ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                                    <Text className="font-black">Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={onSubmit} disabled={actionLoading || !plate.trim()} className={`flex-1 h-16 rounded-2xl items-center justify-center shadow-lg ${plate.trim() ? (isDark ? 'bg-white' : 'bg-zinc-900') : 'bg-zinc-200'}`}>
                                    <Text className={`font-black ${isDark ? 'text-black' : 'text-white'}`}>Enviar</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
});

interface VerifyExtraModalProps {
    visible: boolean;
    onClose: () => void;
    room: any;
    items: any[];
    isDark: boolean;
    actionLoading: boolean;
    onSubmit: (payments: PaymentEntry[]) => void;
}

const VerifyExtraModal = React.memo(({
    visible, onClose, room, items, isDark, actionLoading, onSubmit
}: VerifyExtraModalProps) => {
    const [payments, setPayments] = useState<PaymentEntry[]>([]);

    // Calcular total
    const totalAmount = useMemo(() => items.reduce((sum, item) => sum + (item.total || 0), 0), [items]);

    // Reset payments when items change
    useEffect(() => {
        if (visible && items.length > 0) {
            setPayments([{
                id: 'p1',
                amount: totalAmount,
                method: 'EFECTIVO'
            }]);
        }
    }, [visible, totalAmount]);

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                <View className="flex-1 justify-end bg-black/70">
                    <View className={`rounded-t-3xl ${isDark ? 'bg-zinc-950' : 'bg-white'}`}>
                        <View className={`flex-row justify-between items-center p-6 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                            <View>
                                <Text className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Verificar Extras</Text>
                                <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>Hab. {room?.number}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} className="p-2">
                                <X color={isDark ? '#71717a' : '#52525b'} size={24} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView className="p-6 max-h-[500px]" showsVerticalScrollIndicator={false}>
                            <View className="mb-6">
                                <Text className={`text-sm font-semibold mb-3 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Conceptos a Cobrar:</Text>
                                {items.map((item, idx) => (
                                    <View key={idx} className={`flex-row justify-between items-center p-3 rounded-xl mb-2 ${isDark ? 'bg-zinc-900' : 'bg-zinc-50'}`}>
                                        <View className="flex-1 pr-4">
                                            <Text className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{item.description}</Text>
                                            <Text className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                                                {item.concept_type === 'EXTRA_PERSON' ? 'Persona Extra' :
                                                    item.concept_type === 'EXTRA_HOUR' ? 'Hora Extra' :
                                                        item.concept_type === 'RENEWAL' ? 'Renovación' :
                                                            item.concept_type === 'PROMO_4H' ? 'Promo 4 Horas' :
                                                                item.concept_type}
                                            </Text>
                                        </View>
                                        <Text className="font-black text-emerald-500">${(item.total || 0).toFixed(2)}</Text>
                                    </View>
                                ))}
                            </View>

                            <View className={`border-t pt-6 mb-6 ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                                <View className={`p-4 rounded-2xl border-2 mb-6 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-100'}`}>
                                    <Text className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Total a Cobrar</Text>
                                    <Text className="text-3xl font-black text-emerald-500">${totalAmount.toFixed(2)}</Text>
                                </View>

                                <MultiPaymentInput totalAmount={totalAmount} payments={payments} onPaymentsChange={setPayments} disabled={actionLoading} />
                            </View>

                            <View className="flex-row gap-4 pb-12">
                                <TouchableOpacity onPress={onClose} className={`flex-1 h-16 rounded-2xl items-center justify-center border-2 ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                                    <Text className={`font-black uppercase tracking-widest text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => onSubmit(payments)} disabled={actionLoading} className={`flex-1 h-16 rounded-2xl items-center justify-center shadow-lg ${isDark ? 'bg-white' : 'bg-zinc-900'}`}>
                                    <Text className={`font-black uppercase tracking-widest text-xs ${isDark ? 'text-black' : 'text-white'}`}>Cobrar y Confirmar</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
});

interface CheckoutModalProps {
    visible: boolean;
    onClose: () => void;
    room: any;
    isDark: boolean;
    actionLoading: boolean;
    onSubmit: () => void;
    showDamageForm: boolean;
    setShowDamageForm: (v: boolean) => void;
    damageDescription: string;
    setDamageDescription: (v: string) => void;
    damageAmount: string;
    setDamageAmount: (v: string) => void;
    damagePayments: any[];
    setDamagePayments: (v: any[]) => void;
    handleReportDamageSubmit: () => void;
    showExtraHourForm: boolean;
    setShowExtraHourForm: (v: boolean) => void;
    extraHourAmount: string;
    setExtraHourAmount: (v: string) => void;
    extraHourPayments: any[];
    setExtraHourPayments: (v: any[]) => void;
    handleExtraHourSubmit: () => void;
    showExtraPersonForm: boolean;
    setShowExtraPersonForm: (v: boolean) => void;
    extraPersonAmount: string;
    setExtraPersonAmount: (v: string) => void;
    extraPersonPayments: any[];
    setExtraPersonPayments: (v: any[]) => void;
    handleExtraPersonSubmit: () => void;
}

const CheckoutModal = React.memo(({
    visible, onClose, room, isDark, actionLoading, onSubmit,
    showDamageForm, setShowDamageForm, damageDescription, setDamageDescription,
    damageAmount, setDamageAmount, damagePayments, setDamagePayments, handleReportDamageSubmit,
    showExtraHourForm, setShowExtraHourForm, extraHourAmount, setExtraHourAmount,
    extraHourPayments, setExtraHourPayments, handleExtraHourSubmit,
    showExtraPersonForm, setShowExtraPersonForm, extraPersonAmount, setExtraPersonAmount,
    extraPersonPayments, setExtraPersonPayments, handleExtraPersonSubmit
}: CheckoutModalProps) => {
    return (
        <Modal visible={visible} animationType="slide" transparent>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                <View className="flex-1 justify-end bg-black/70">
                    <View className={`rounded-t-3xl max-h-[85%] ${isDark ? 'bg-zinc-950' : 'bg-white'}`}>
                        <View className={`flex-row justify-between items-center p-6 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                            <View>
                                <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>Hab. {room?.number}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} className="p-2"><X color={isDark ? '#71717a' : '#52525b'} size={24} /></TouchableOpacity>
                        </View>
                        <ScrollView className="p-6">
                            <View className={`rounded-2xl p-5 mb-6 border-2 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-100'}`}>
                                <Text className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Tiempo Transcurrido</Text>
                                <Text className={`text-3xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>{room?.stay?.check_in_at ? `${Math.floor((Date.now() - new Date(room.stay.check_in_at).getTime()) / 3600000)}h ${Math.floor(((Date.now() - new Date(room.stay.check_in_at).getTime()) % 3600000) / 60000)}m` : '--'}</Text>
                            </View>

                            {(room?.stay?.sales_orders?.remaining_amount ?? 0) > 0 && (
                                <View className={`rounded-2xl p-5 mb-6 border-2 bg-amber-500/10 border-amber-500/50`}>
                                    <Text className={`text-[10px] font-black uppercase tracking-widest mb-1 text-amber-500`}>Saldo Pendiente</Text>
                                    <Text className="text-2xl font-black text-white">${(room?.stay?.sales_orders?.remaining_amount ?? 0).toFixed(2)}</Text>
                                </View>
                            )}

                            <View className="flex-row gap-2 mb-2">
                                <TouchableOpacity
                                    onPress={() => { setShowExtraHourForm(!showExtraHourForm); setShowExtraPersonForm(false); setShowDamageForm(false); }}
                                    className={`flex-1 p-4 rounded-xl border-2 items-center justify-center ${showExtraHourForm ? 'border-blue-500 bg-blue-500/10' : (isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-100 bg-zinc-50')}`}
                                >
                                    <Clock size={20} color={showExtraHourForm ? '#3b82f6' : (isDark ? '#71717a' : '#52525b')} />
                                    <Text className={`font-black text-[10px] mt-2 uppercase ${showExtraHourForm ? 'text-blue-500' : (isDark ? 'text-zinc-400' : 'text-zinc-600')}`}>Hora Extra</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => { setShowExtraPersonForm(!showExtraPersonForm); setShowExtraHourForm(false); setShowDamageForm(false); }}
                                    className={`flex-1 p-4 rounded-xl border-2 items-center justify-center ${showExtraPersonForm ? 'border-emerald-500 bg-emerald-500/10' : (isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-100 bg-zinc-50')}`}
                                >
                                    <Users size={20} color={showExtraPersonForm ? '#10b981' : (isDark ? '#71717a' : '#52525b')} />
                                    <Text className={`font-black text-[10px] mt-2 uppercase ${showExtraPersonForm ? 'text-emerald-500' : (isDark ? 'text-zinc-400' : 'text-zinc-600')}`}>Pers. Extra</Text>
                                </TouchableOpacity>
                            </View>

                            <View className="mb-6">
                                <TouchableOpacity
                                    onPress={() => { setShowDamageForm(!showDamageForm); setShowExtraHourForm(false); setShowExtraPersonForm(false); }}
                                    className={`p-4 rounded-xl border-2 items-center justify-center ${showDamageForm ? 'border-red-500 bg-red-500/10' : (isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-100 bg-zinc-50')}`}
                                >
                                    <Hammer size={20} color={showDamageForm ? '#ef4444' : (isDark ? '#71717a' : '#52525b')} />
                                    <Text className={`font-black text-[10px] mt-2 uppercase ${showDamageForm ? 'text-red-500' : (isDark ? 'text-zinc-400' : 'text-zinc-600')}`}>Reportar Daño</Text>
                                </TouchableOpacity>
                            </View>

                            {showExtraHourForm && (
                                <View className={`mb-8 p-6 rounded-2xl border-2 ${isDark ? 'bg-black border-blue-500/50' : 'bg-blue-50 border-blue-100'}`}>
                                    <Text className={`text-sm font-black mb-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Registrar Hora Extra</Text>
                                    <TextInput
                                        value={extraHourAmount}
                                        onChangeText={setExtraHourAmount}
                                        placeholder="Monto"
                                        keyboardType="numeric"
                                        className={`p-4 border-2 rounded-xl mb-4 font-bold ${isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-100 text-zinc-900'}`}
                                    />
                                    <MultiPaymentInput totalAmount={parseFloat(extraHourAmount) || 0} payments={extraHourPayments} onPaymentsChange={setExtraHourPayments} disabled={actionLoading} />
                                    <TouchableOpacity onPress={handleExtraHourSubmit} className="mt-8 h-14 bg-blue-600 rounded-xl items-center justify-center shadow-lg">
                                        <Text className="text-white font-black text-xs uppercase tracking-widest">Informar Hora Extra</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {showExtraPersonForm && (
                                <View className={`mb-8 p-6 rounded-2xl border-2 ${isDark ? 'bg-black border-emerald-500/50' : 'bg-emerald-50 border-emerald-100'}`}>
                                    <Text className={`text-sm font-black mb-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Registrar Persona Extra</Text>
                                    <TextInput
                                        value={extraPersonAmount}
                                        onChangeText={setExtraPersonAmount}
                                        placeholder="Monto"
                                        keyboardType="numeric"
                                        className={`p-4 border-2 rounded-xl mb-4 font-bold ${isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-100 text-zinc-900'}`}
                                    />
                                    <MultiPaymentInput totalAmount={parseFloat(extraPersonAmount) || 0} payments={extraPersonPayments} onPaymentsChange={setExtraPersonPayments} disabled={actionLoading} />
                                    <TouchableOpacity onPress={handleExtraPersonSubmit} className="mt-8 h-14 bg-emerald-600 rounded-xl items-center justify-center shadow-lg">
                                        <Text className="text-white font-black text-xs uppercase tracking-widest">Informar Pers. Extra</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {showDamageForm && (
                                <View className={`mb-8 p-6 rounded-2xl border-2 ${isDark ? 'bg-black border-red-500/50' : 'bg-red-50 border-red-100'}`}>
                                    <Text className={`text-sm font-black mb-4 ${isDark ? 'text-red-400' : 'text-red-600'}`}>Registrar Daño</Text>
                                    <TextInput
                                        value={damageDescription}
                                        onChangeText={setDamageDescription}
                                        placeholder="¿Qué se dañó?"
                                        className={`p-4 border-2 rounded-xl mb-4 ${isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-100 text-zinc-900'}`}
                                    />
                                    <TextInput
                                        value={damageAmount}
                                        onChangeText={setDamageAmount}
                                        placeholder="Costo"
                                        keyboardType="numeric"
                                        className={`p-4 border-2 rounded-xl mb-4 font-bold ${isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-100 text-zinc-900'}`}
                                    />
                                    <MultiPaymentInput totalAmount={parseFloat(damageAmount) || 0} payments={damagePayments} onPaymentsChange={setDamagePayments} disabled={actionLoading} />
                                    <TouchableOpacity onPress={handleReportDamageSubmit} className="mt-8 h-14 bg-red-600 rounded-xl items-center justify-center shadow-lg">
                                        <Text className="text-white font-black text-xs uppercase tracking-widest">Registrar Daño</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <View className="flex-row gap-4 pb-12">
                                <TouchableOpacity onPress={onClose} className={`flex-1 h-16 border-2 rounded-2xl items-center justify-center ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                                    <Text className={`font-black text-xs uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={onSubmit} className={`flex-1 h-16 rounded-2xl items-center justify-center shadow-lg ${isDark ? 'bg-white' : 'bg-zinc-900'}`}>
                                    <Text className={`font-black text-xs uppercase tracking-widest ${isDark ? 'text-black' : 'text-white'}`}>Confirmar OK</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
});

export default function RoomsScreen() {
    const { employeeId, hasActiveShift, isLoading: roleLoading } = useUserRole();
    const { isDark } = useTheme();
    const [rooms, setRooms] = useState<any[]>([]);
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

    // Verify Extra Modal State
    const [showVerifyExtraModal, setShowVerifyExtraModal] = useState(false);
    const [extraItems, setExtraItems] = useState<any[]>([]);

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
        handleConfirmCheckout,
        handleProposeCheckout,
        handleReportDamage,
        handleRegisterVehicleAndPayment,
        handleRegisterExtraHour,
        handleRegisterExtraPerson,
        handleConfirmAllDeliveries, // Reuse this for extras verification
        loading: actionLoading
    } = useValetActions(fetchRooms);

    const handleAcceptEntry = async (stayId: string, roomNum: string, valetId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // Optimistic update
        setRooms(prev => prev.map(r => {
            const stay = r.room_stays?.find((s: any) => s.id === stayId);
            if (stay) {
                return { ...r, room_stays: r.room_stays.map((s: any) => s.id === stayId ? { ...s, valet_employee_id: valetId } : s) };
            }
            return r;
        }));
        const success = await originalHandleAcceptEntry(stayId, roomNum, valetId);
        if (!success) fetchRooms(true); // Rollback
        return success;
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchRooms();
    };

    const handleOpenEntry = useCallback((roomId: string) => {
        const room = rooms.find(r => r.id === roomId);
        if (!room) return;
        const stay = room.room_stays?.find((s: any) => s.status === 'ACTIVA');
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
        const stay = room.room_stays?.find((s: any) => s.status === 'ACTIVA');
        if (!stay) return;
        setSelectedRoom({ ...room, stay });
        setCheckoutPersonCount(stay.current_people || 2);

        // Pre-cargar precios por defecto del tipo de habitación
        setExtraHourAmount((room.room_types?.extra_hour_price || 0).toString());
        setExtraPersonAmount((room.room_types?.extra_person_price || 0).toString());
        setExtraHourPayments([{ id: 'p1', amount: room.room_types?.extra_hour_price || 0, method: 'EFECTIVO' }]);
        setExtraPersonPayments([{ id: 'p1', amount: room.room_types?.extra_person_price || 0, method: 'EFECTIVO' }]);

        setShowCheckoutModal(true);
        setShowDamageForm(false);
        setShowExtraHourForm(false);
        setShowExtraPersonForm(false);
    }, [rooms]);

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
                const stay = room.room_stays.find((s: any) => s.status === 'ACTIVA');
                if (stay) {
                    const orders = Array.isArray(stay.sales_orders) ? stay.sales_orders : (stay.sales_orders ? [stay.sales_orders] : []);
                    const pendingExtras = orders.flatMap((o: any) => o.sales_order_items || [])
                        .filter((item: any) =>
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

    const handleVerifyExtraOpen = useCallback((room: any, items: any[]) => {
        const stay = room.room_stays?.find((s: any) => s.status === 'ACTIVA');
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

    const renderRoom = useCallback(({ item: room }: { item: any }) => {
        const stay = room.room_stays?.find((s: any) => s.status === 'ACTIVA');
        if (!stay) return null;

        // Calculate pending extras
        const orders = Array.isArray(stay.sales_orders) ? stay.sales_orders : (stay.sales_orders ? [stay.sales_orders] : []);
        const pendingExtras = orders.flatMap((o: any) => o.sales_order_items || [])
            .filter((item: any) =>
                (item.concept_type === 'EXTRA_PERSON' || item.concept_type === 'EXTRA_HOUR' || item.concept_type === 'RENEWAL' || item.concept_type === 'PROMO_4H') &&
                (!item.delivery_status || item.delivery_status === 'PENDING_VALET')
            );

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
                    return await handleProposeCheckout(stayId, roomNumber, valetId);
                }}
                pendingExtras={pendingExtras}
                onVerifyExtras={() => {
                    Haptics.selectionAsync();
                    handleVerifyExtraOpen(room, pendingExtras);
                }}
            />
        );
    }, [isDark, hasActiveShift, actionLoading, employeeId, handleAcceptEntry, handleOpenEntry, handleOpenCheckout, handleProposeCheckout, handleVerifyExtraOpen]);

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

            {/* Using AnyFlashList to bypass persistent and incorrect type errors in the IDE */}
            <AnyFlashList
                data={rooms as any}
                renderItem={renderRoom as any}
                keyExtractor={(item: any) => item.id}
                estimatedItemSize={120}
                contentContainerStyle={{ padding: 8, paddingBottom: 100 }}
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
        </View>
    );
}
