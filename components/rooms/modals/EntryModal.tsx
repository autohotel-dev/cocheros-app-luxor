import React, { memo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { X, Car, Minus, Plus } from 'lucide-react-native';
import { MultiPaymentInput } from '../../MultiPaymentInput';
import { VehicleSearchResult } from '../../../lib/vehicle-catalog';
import { PaymentEntry } from '../../../lib/payment-types';
import { Room } from '../../../lib/types';

export interface EntryModalProps {
    visible: boolean;
    onClose: () => void;
    room: any; // Ideally Room, but partials can be tricky. Let's try to constrain it more if possible, or keep as any if the shape is dynamic in usage. 
    // Actually, let's use Room | null since it can be null.
    // Update: The parent passes `selectedRoom` which is a mix of Room + Stay.
    // For now, let's keep it loose in the Prop definition to avoid breaking the build if the parent constructs it ad-hoc, 
    // BUT inside the component we strictly access properties known to exist.
    // Ideally: room: Room & { stay: RoomStay } | null
    isDark: boolean;
    plate: string;
    setPlate: (v: string) => void;
    brand: string;
    setBrand: (v: string) => void;
    model: string;
    setModel: (v: string) => void;
    personCount: number;
    setPersonCount: (v: React.SetStateAction<number>) => void;
    payments: PaymentEntry[];
    setPayments: (v: PaymentEntry[]) => void;
    actionLoading: boolean;
    onSubmit: () => void;
    vehicleSearch: string;
    handleVehicleSearch: (t: string) => void;
    showSearchResults: boolean;
    searchResults: VehicleSearchResult[];
    selectVehicle: (v: VehicleSearchResult) => void;
}

export const EntryModal = memo(({
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
                    <View className="rounded-t-3xl max-h-[90%] bg-white dark:bg-zinc-950">
                        <View className="flex-row justify-between items-center p-6 border-b border-zinc-100 dark:border-zinc-800">
                            <View>
                                <Text className="text-[10px] font-black uppercase tracking-widest mb-1 text-zinc-400 dark:text-zinc-500">Check-in Valet</Text>
                                <Text className="text-xl font-black text-zinc-900 dark:text-white">Hab. {room?.number}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} className="p-2">
                                <X color={isDark ? '#71717a' : '#52525b'} size={24} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView className="p-6" showsVerticalScrollIndicator={false}>
                            <View className="mb-6">
                                <View className="flex-row items-center gap-2 mb-4">
                                    <Car color="#3b82f6" size={20} />
                                    <Text className="text-base font-semibold text-zinc-800 dark:text-white">Datos del Vehículo</Text>
                                </View>
                                <View className="mb-3">
                                    <View className="mb-4 relative">
                                        <TextInput
                                            value={plate}
                                            onChangeText={setPlate}
                                            placeholder="Placa (ABC-123)"
                                            placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                                            autoCapitalize="characters"
                                            className="border rounded-xl px-4 py-3 text-lg uppercase bg-zinc-50 border-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                                        />
                                    </View>
                                    <View className="mb-4 relative">
                                        <TextInput
                                            value={vehicleSearch}
                                            onChangeText={handleVehicleSearch}
                                            placeholder="Buscar modelo..."
                                            placeholderTextColor={isDark ? '#3f3f46' : '#a1a1aa'}
                                            className="border-2 rounded-2xl py-4 px-4 font-bold bg-zinc-50 border-zinc-100 text-zinc-900 dark:bg-black dark:border-zinc-800 dark:text-white"
                                        />
                                        {showSearchResults && searchResults.length > 0 && (
                                            <View className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border shadow-lg max-h-48 bg-white border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700">
                                                <ScrollView nestedScrollEnabled>
                                                    {searchResults.map((result, idx) => (
                                                        <TouchableOpacity key={idx} onPress={() => selectVehicle(result)} className="flex-row items-center px-4 py-3 border-b border-zinc-100 dark:border-zinc-700">
                                                            <Text className="text-blue-500 font-medium">{result.brand.label}</Text>
                                                            <Text className="ml-2 text-zinc-600 dark:text-zinc-300">{result.model}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </ScrollView>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </View>
                            <View className="border-t pt-8 mb-6 border-zinc-100 dark:border-zinc-800">
                                <View className="flex-row gap-4 mb-6">
                                    <View className="flex-1">
                                        <Text className="text-[10px] uppercase font-black tracking-widest mb-2 text-zinc-400 dark:text-zinc-500">Personas</Text>
                                        <View className="flex-row items-center gap-2">
                                            <TouchableOpacity onPress={() => setPersonCount((prev: number) => Math.max(1, prev - 1))} className="w-12 h-12 rounded-xl items-center justify-center border-2 bg-zinc-100 border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
                                                <Minus color={isDark ? '#a1a1aa' : '#52525b'} size={18} />
                                            </TouchableOpacity>
                                            <View className="flex-1 h-12 rounded-xl items-center justify-center bg-zinc-50 dark:bg-zinc-900">
                                                <Text className="text-xl font-black text-zinc-900 dark:text-white">{personCount}</Text>
                                            </View>
                                            <TouchableOpacity onPress={() => setPersonCount((prev: number) => prev + 1)} className="w-12 h-12 rounded-xl items-center justify-center border-2 bg-zinc-100 border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
                                                <Plus color={isDark ? '#a1a1aa' : '#52525b'} size={18} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    <View className="flex-1 rounded-2xl p-4 border-2 bg-zinc-50 border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
                                        <Text className="text-[10px] font-black uppercase tracking-widest mb-1 text-zinc-400 dark:text-zinc-500">Total</Text>
                                        <Text className="text-3xl font-black text-emerald-500">${amount.toFixed(2)}</Text>
                                    </View>
                                </View>
                                <MultiPaymentInput totalAmount={amount} payments={payments} onPaymentsChange={setPayments} disabled={actionLoading} />
                            </View>
                            <View className="flex-row gap-4 pb-12">
                                <TouchableOpacity onPress={onClose} className="flex-1 h-16 rounded-2xl items-center justify-center border-2 border-zinc-100 dark:border-zinc-800">
                                    <Text className="font-black dark:text-zinc-400">Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={onSubmit}
                                    disabled={actionLoading || !plate.trim()}
                                    className={`flex-1 h-16 rounded-2xl items-center justify-center shadow-lg ${plate.trim()
                                            ? 'bg-zinc-900 dark:bg-white'
                                            : 'bg-zinc-200'
                                        }`}
                                >
                                    <Text className={`font-black ${plate.trim()
                                            ? 'text-white dark:text-black'
                                            : 'text-zinc-400'
                                        }`}>
                                        Enviar
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
});
