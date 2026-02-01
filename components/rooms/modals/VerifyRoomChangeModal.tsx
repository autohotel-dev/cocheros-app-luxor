import React, { memo, useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { X, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react-native';
import { MultiPaymentInput } from '../../MultiPaymentInput';
import { PaymentEntry } from '../../../lib/payment-types';
import { SalesOrderItem } from '../../../lib/types';

interface RoomChangeMetadata {
    oldRoomNumber: string;
    newRoomNumber: string;
    oldRoomType: string;
    newRoomType: string;
    isRefund: boolean;
    amount: number;
}

export interface VerifyRoomChangeModalProps {
    visible: boolean;
    onClose: () => void;
    room: any;
    item: SalesOrderItem | null;
    isDark: boolean;
    actionLoading: boolean;
    onSubmit: (payments: PaymentEntry[], isRefund: boolean) => void;
}

export const VerifyRoomChangeModal = memo(({
    visible, onClose, room, item, isDark, actionLoading, onSubmit
}: VerifyRoomChangeModalProps) => {
    const [payments, setPayments] = useState<PaymentEntry[]>([]);

    // Parse metadata del item
    const metadata: RoomChangeMetadata | null = useMemo(() => {
        if (!item?.issue_description) return null;
        try {
            return JSON.parse(item.issue_description);
        } catch {
            return null;
        }
    }, [item?.issue_description]);

    const amount = item?.total || metadata?.amount || 0;
    const isRefund = metadata?.isRefund || false;

    // Reset payments when item changes
    useEffect(() => {
        if (visible && item) {
            setPayments([{
                id: 'p1',
                amount: amount,
                method: 'EFECTIVO'
            }]);
        }
    }, [visible, amount]);

    if (!visible || !item || !metadata) return null;

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                <View className="flex-1 justify-end bg-black/70">
                    <View className="rounded-t-3xl bg-white dark:bg-zinc-950">
                        {/* Header */}
                        <View className="flex-row justify-between items-center p-6 border-b border-zinc-100 dark:border-zinc-800">
                            <View>
                                <Text className="text-[10px] font-black uppercase tracking-widest mb-1 text-zinc-400 dark:text-zinc-500">
                                    Verificar Cambio de Habitación
                                </Text>
                                <Text className="text-xl font-black text-zinc-900 dark:text-white">
                                    Hab. {room?.number}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={onClose} className="p-2">
                                <X color={isDark ? '#71717a' : '#52525b'} size={24} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView className="p-6 max-h-[500px]" showsVerticalScrollIndicator={false}>
                            {/* Información del cambio */}
                            <View className="mb-6 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900">
                                <Text className="text-sm font-semibold mb-4 text-zinc-600 dark:text-zinc-400">
                                    Detalle del Cambio:
                                </Text>

                                {/* Visual del cambio */}
                                <View className="flex-row items-center justify-center mb-4">
                                    <View className="items-center flex-1">
                                        <Text className="text-2xl font-black text-zinc-900 dark:text-white">
                                            {metadata.oldRoomNumber}
                                        </Text>
                                        <Text className="text-xs text-zinc-500 mt-1">
                                            {metadata.oldRoomType}
                                        </Text>
                                    </View>

                                    <View className="px-4">
                                        <ArrowRight color={isDark ? '#71717a' : '#a1a1aa'} size={24} />
                                    </View>

                                    <View className="items-center flex-1">
                                        <Text className="text-2xl font-black text-zinc-900 dark:text-white">
                                            {metadata.newRoomNumber}
                                        </Text>
                                        <Text className="text-xs text-zinc-500 mt-1">
                                            {metadata.newRoomType}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Monto a cobrar/devolver */}
                            <View className={`p-4 rounded-2xl border-2 mb-6 ${isRefund
                                    ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800'
                                    : 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800'
                                }`}>
                                <View className="flex-row items-center mb-2">
                                    {isRefund ? (
                                        <TrendingDown color="#10b981" size={20} />
                                    ) : (
                                        <TrendingUp color="#f59e0b" size={20} />
                                    )}
                                    <Text className={`text-[10px] font-black uppercase tracking-widest ml-2 ${isRefund ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                                        }`}>
                                        {isRefund ? 'Devolución a Entregar' : 'Diferencia a Cobrar'}
                                    </Text>
                                </View>
                                <Text className={`text-3xl font-black ${isRefund ? 'text-emerald-500' : 'text-amber-500'
                                    }`}>
                                    ${amount.toFixed(2)}
                                </Text>
                                <Text className="text-xs text-zinc-500 mt-1">
                                    {isRefund
                                        ? 'El cliente recibe esta cantidad (habitación más barata)'
                                        : 'El cliente debe pagar esta cantidad (habitación más cara)'
                                    }
                                </Text>
                            </View>

                            {/* Input de pago */}
                            <View className="border-t pt-6 mb-6 border-zinc-100 dark:border-zinc-800">
                                <Text className="text-sm font-semibold mb-3 text-zinc-600 dark:text-zinc-400">
                                    {isRefund ? 'Método de Devolución:' : 'Método de Pago:'}
                                </Text>
                                <MultiPaymentInput
                                    totalAmount={amount}
                                    payments={payments}
                                    onPaymentsChange={setPayments}
                                    disabled={actionLoading}
                                />
                            </View>

                            {/* Botones */}
                            <View className="flex-row gap-4 pb-12">
                                <TouchableOpacity
                                    onPress={onClose}
                                    className="flex-1 h-16 rounded-2xl items-center justify-center border-2 border-zinc-100 dark:border-zinc-800"
                                >
                                    <Text className="font-black uppercase tracking-widest text-xs text-zinc-400 dark:text-zinc-500">
                                        Cancelar
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => onSubmit(payments, isRefund)}
                                    disabled={actionLoading}
                                    className={`flex-1 h-16 rounded-2xl items-center justify-center shadow-lg ${isRefund
                                            ? 'bg-emerald-500'
                                            : 'bg-amber-500'
                                        }`}
                                >
                                    <Text className="font-black uppercase tracking-widest text-xs text-white">
                                        {isRefund ? 'Entregar y Verificar' : 'Cobrar y Verificar'}
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
