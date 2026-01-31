import React, { memo, useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { X } from 'lucide-react-native';
import { MultiPaymentInput } from '../../MultiPaymentInput';
import { PaymentEntry } from '../../../lib/payment-types';
import { SalesOrderItem } from '../../../lib/types';

export interface VerifyExtraModalProps {
    visible: boolean;
    onClose: () => void;
    room: any;
    items: SalesOrderItem[];
    isDark: boolean;
    actionLoading: boolean;
    onSubmit: (payments: PaymentEntry[]) => void;
}

export const VerifyExtraModal = memo(({
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
                    <View className="rounded-t-3xl bg-white dark:bg-zinc-950">
                        <View className="flex-row justify-between items-center p-6 border-b border-zinc-100 dark:border-zinc-800">
                            <View>
                                <Text className="text-[10px] font-black uppercase tracking-widest mb-1 text-zinc-400 dark:text-zinc-500">Verificar Extras</Text>
                                <Text className="text-xl font-black text-zinc-900 dark:text-white">Hab. {room?.number}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} className="p-2">
                                <X color={isDark ? '#71717a' : '#52525b'} size={24} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView className="p-6 max-h-[500px]" showsVerticalScrollIndicator={false}>
                            <View className="mb-6">
                                <Text className="text-sm font-semibold mb-3 text-zinc-600 dark:text-zinc-400">Conceptos a Cobrar:</Text>
                                {items.map((item, idx) => (
                                    <View key={idx} className="flex-row justify-between items-center p-3 rounded-xl mb-2 bg-zinc-50 dark:bg-zinc-900">
                                        <View className="flex-1 pr-4">
                                            <Text className="font-bold text-zinc-900 dark:text-white">{item.description}</Text>
                                            <Text className="text-xs text-zinc-500">
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

                            <View className="border-t pt-6 mb-6 border-zinc-100 dark:border-zinc-800">
                                <View className="p-4 rounded-2xl border-2 mb-6 bg-zinc-50 border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
                                    <Text className="text-[10px] font-black uppercase tracking-widest mb-1 text-zinc-400 dark:text-zinc-500">Total a Cobrar</Text>
                                    <Text className="text-3xl font-black text-emerald-500">${totalAmount.toFixed(2)}</Text>
                                </View>

                                <MultiPaymentInput totalAmount={totalAmount} payments={payments} onPaymentsChange={setPayments} disabled={actionLoading} />
                            </View>

                            <View className="flex-row gap-4 pb-12">
                                <TouchableOpacity onPress={onClose} className="flex-1 h-16 rounded-2xl items-center justify-center border-2 border-zinc-100 dark:border-zinc-800">
                                    <Text className="font-black uppercase tracking-widest text-xs text-zinc-400 dark:text-zinc-500">Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => onSubmit(payments)} disabled={actionLoading} className="flex-1 h-16 rounded-2xl items-center justify-center shadow-lg bg-zinc-900 dark:bg-white">
                                    <Text className="font-black uppercase tracking-widest text-xs text-white dark:text-black">Cobrar y Confirmar</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
});
