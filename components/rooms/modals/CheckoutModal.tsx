import React, { memo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { X, Clock, Users, Hammer } from 'lucide-react-native';
import { MultiPaymentInput } from '../../MultiPaymentInput';
import { PaymentEntry } from '../../../lib/payment-types';
// import { Room } from '../../../lib/types'; // Room prop is mixed with stay info often using & { stay: ... } logic in parent

export interface CheckoutModalProps {
    visible: boolean;
    onClose: () => void;
    room: any; // We'll look at refining this in the final step with rooms.tsx to see exactly what's passed.
    isDark: boolean;
    actionLoading: boolean;
    onSubmit: () => void;
    showDamageForm: boolean;
    setShowDamageForm: (v: boolean) => void;
    damageDescription: string;
    setDamageDescription: (v: string) => void;
    damageAmount: string;
    setDamageAmount: (v: string) => void;
    damagePayments: PaymentEntry[];
    setDamagePayments: (v: PaymentEntry[]) => void;
    handleReportDamageSubmit: () => void;
    showExtraHourForm: boolean;
    setShowExtraHourForm: (v: boolean) => void;
    extraHourAmount: string;
    setExtraHourAmount: (v: string) => void;
    extraHourPayments: PaymentEntry[];
    setExtraHourPayments: (v: PaymentEntry[]) => void;
    handleExtraHourSubmit: () => void;
    showExtraPersonForm: boolean;
    setShowExtraPersonForm: (v: boolean) => void;
    extraPersonAmount: string;
    setExtraPersonAmount: (v: string) => void;
    extraPersonPayments: PaymentEntry[];
    setExtraPersonPayments: (v: PaymentEntry[]) => void;
    handleExtraPersonSubmit: () => void;
}

export const CheckoutModal = memo(({
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
                    <View className="rounded-t-3xl max-h-[85%] bg-white dark:bg-zinc-950">
                        <View className="flex-row justify-between items-center p-6 border-b border-zinc-100 dark:border-zinc-800">
                            <View>
                                <Text className="text-xl font-black text-zinc-900 dark:text-white">Hab. {room?.number}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} className="p-2"><X color={isDark ? '#71717a' : '#52525b'} size={24} /></TouchableOpacity>
                        </View>
                        <ScrollView className="p-6">
                            <View className="rounded-2xl p-5 mb-6 border-2 bg-zinc-50 border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
                                <Text className="text-[10px] font-black uppercase tracking-widest mb-1 text-zinc-400 dark:text-zinc-500">Tiempo Transcurrido</Text>
                                <Text className="text-3xl font-black text-zinc-900 dark:text-white">{room?.stay?.check_in_at ? `${Math.floor((Date.now() - new Date(room.stay.check_in_at).getTime()) / 3600000)}h ${Math.floor(((Date.now() - new Date(room.stay.check_in_at).getTime()) % 3600000) / 60000)}m` : '--'}</Text>
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
                                    className={`flex-1 p-4 rounded-xl border-2 items-center justify-center ${showExtraHourForm
                                            ? 'border-blue-500 bg-blue-500/10'
                                            : 'border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900'
                                        }`}
                                >
                                    <Clock size={20} color={showExtraHourForm ? '#3b82f6' : (isDark ? '#71717a' : '#52525b')} />
                                    <Text className={`font-black text-[10px] mt-2 uppercase ${showExtraHourForm ? 'text-blue-500' : 'text-zinc-600 dark:text-zinc-400'}`}>Hora Extra</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => { setShowExtraPersonForm(!showExtraPersonForm); setShowExtraHourForm(false); setShowDamageForm(false); }}
                                    className={`flex-1 p-4 rounded-xl border-2 items-center justify-center ${showExtraPersonForm
                                            ? 'border-emerald-500 bg-emerald-500/10'
                                            : 'border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900'
                                        }`}
                                >
                                    <Users size={20} color={showExtraPersonForm ? '#10b981' : (isDark ? '#71717a' : '#52525b')} />
                                    <Text className={`font-black text-[10px] mt-2 uppercase ${showExtraPersonForm ? 'text-emerald-500' : 'text-zinc-600 dark:text-zinc-400'}`}>Pers. Extra</Text>
                                </TouchableOpacity>
                            </View>

                            <View className="mb-6">
                                <TouchableOpacity
                                    onPress={() => { setShowDamageForm(!showDamageForm); setShowExtraHourForm(false); setShowExtraPersonForm(false); }}
                                    className={`p-4 rounded-xl border-2 items-center justify-center ${showDamageForm
                                            ? 'border-red-500 bg-red-500/10'
                                            : 'border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900'
                                        }`}
                                >
                                    <Hammer size={20} color={showDamageForm ? '#ef4444' : (isDark ? '#71717a' : '#52525b')} />
                                    <Text className={`font-black text-[10px] mt-2 uppercase ${showDamageForm ? 'text-red-500' : 'text-zinc-600 dark:text-zinc-400'}`}>Reportar Daño</Text>
                                </TouchableOpacity>
                            </View>

                            {showExtraHourForm && (
                                <View className="mb-8 p-6 rounded-2xl border-2 bg-blue-50 border-blue-100 dark:bg-black dark:border-blue-500/50">
                                    <Text className="text-sm font-black mb-4 text-blue-600 dark:text-blue-400">Registrar Hora Extra</Text>
                                    <TextInput
                                        value={extraHourAmount}
                                        onChangeText={setExtraHourAmount}
                                        placeholder="Monto"
                                        keyboardType="numeric"
                                        className="p-4 border-2 rounded-xl mb-4 font-bold bg-white border-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:border-zinc-800 dark:text-white"
                                    />
                                    <MultiPaymentInput totalAmount={parseFloat(extraHourAmount) || 0} payments={extraHourPayments} onPaymentsChange={setExtraHourPayments} disabled={actionLoading} />
                                    <TouchableOpacity onPress={handleExtraHourSubmit} className="mt-8 h-14 bg-blue-600 rounded-xl items-center justify-center shadow-lg">
                                        <Text className="text-white font-black text-xs uppercase tracking-widest">Informar Hora Extra</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {showExtraPersonForm && (
                                <View className="mb-8 p-6 rounded-2xl border-2 bg-emerald-50 border-emerald-100 dark:bg-black dark:border-emerald-500/50">
                                    <Text className="text-sm font-black mb-4 text-emerald-600 dark:text-emerald-400">Registrar Persona Extra</Text>
                                    <TextInput
                                        value={extraPersonAmount}
                                        onChangeText={setExtraPersonAmount}
                                        placeholder="Monto"
                                        keyboardType="numeric"
                                        className="p-4 border-2 rounded-xl mb-4 font-bold bg-white border-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:border-zinc-800 dark:text-white"
                                    />
                                    <MultiPaymentInput totalAmount={parseFloat(extraPersonAmount) || 0} payments={extraPersonPayments} onPaymentsChange={setExtraPersonPayments} disabled={actionLoading} />
                                    <TouchableOpacity onPress={handleExtraPersonSubmit} className="mt-8 h-14 bg-emerald-600 rounded-xl items-center justify-center shadow-lg">
                                        <Text className="text-white font-black text-xs uppercase tracking-widest">Informar Pers. Extra</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {showDamageForm && (
                                <View className="mb-8 p-6 rounded-2xl border-2 bg-red-50 border-red-100 dark:bg-black dark:border-red-500/50">
                                    <Text className="text-sm font-black mb-4 text-red-600 dark:text-red-400">Registrar Daño</Text>
                                    <TextInput
                                        value={damageDescription}
                                        onChangeText={setDamageDescription}
                                        placeholder="¿Qué se dañó?"
                                        className="p-4 border-2 rounded-xl mb-4 bg-white border-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:border-zinc-800 dark:text-white"
                                    />
                                    <TextInput
                                        value={damageAmount}
                                        onChangeText={setDamageAmount}
                                        placeholder="Costo"
                                        keyboardType="numeric"
                                        className="p-4 border-2 rounded-xl mb-4 font-bold bg-white border-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:border-zinc-800 dark:text-white"
                                    />
                                    <MultiPaymentInput totalAmount={parseFloat(damageAmount) || 0} payments={damagePayments} onPaymentsChange={setDamagePayments} disabled={actionLoading} />
                                    <TouchableOpacity onPress={handleReportDamageSubmit} className="mt-8 h-14 bg-red-600 rounded-xl items-center justify-center shadow-lg">
                                        <Text className="text-white font-black text-xs uppercase tracking-widest">Registrar Daño</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <View className="flex-row gap-4 pb-12">
                                <TouchableOpacity onPress={onClose} className="flex-1 h-16 border-2 rounded-2xl items-center justify-center border-zinc-100 dark:border-zinc-800">
                                    <Text className="font-black text-xs uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={onSubmit} className="flex-1 h-16 rounded-2xl items-center justify-center shadow-lg bg-zinc-900 dark:bg-white">
                                    <Text className="font-black text-xs uppercase tracking-widest text-white dark:text-black">Confirmar OK</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
});
