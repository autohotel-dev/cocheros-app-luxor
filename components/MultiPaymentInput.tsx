import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Platform } from 'react-native';
import { Plus, Trash2, ChevronDown, ChevronUp, Banknote, CreditCard, Landmark, Delete } from 'lucide-react-native';
import { useTheme } from '../contexts/theme-context';
import { PaymentEntry, PaymentMethod, PAYMENT_METHODS, PaymentTerminal, PAYMENT_TERMINALS, CardType, CARD_TYPES } from '../lib/payment-types';

interface MultiPaymentInputProps {
    totalAmount: number;
    payments: PaymentEntry[];
    onPaymentsChange: (payments: PaymentEntry[]) => void;
    disabled?: boolean;
}

export function MultiPaymentInput({
    totalAmount,
    payments,
    onPaymentsChange,
    disabled = false,
}: MultiPaymentInputProps) {
    const { isDark } = useTheme();
    const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set(payments.map(p => p.id)));

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = totalAmount - totalPaid;
    const isComplete = totalPaid >= totalAmount;

    const toggleExpanded = (id: string) => {
        setExpandedPayments(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const addPayment = () => {
        const newPayment: PaymentEntry = {
            id: Math.random().toString(36).substring(7),
            amount: remaining > 0 ? remaining : 0,
            method: 'EFECTIVO',
            terminal: undefined,
            reference: '',
            cardLast4: undefined,
            cardType: undefined,
        };
        onPaymentsChange([...payments, newPayment]);
        setExpandedPayments(prev => new Set([...prev, newPayment.id]));
    };

    const updatePayment = (id: string, field: keyof PaymentEntry, value: any) => {
        onPaymentsChange(
            payments.map((p) => {
                if (p.id !== id) return p;
                const updated = { ...p, [field]: field === 'amount' ? parseFloat(value) || 0 : value };

                if (field === 'method' && value === 'EFECTIVO') {
                    updated.terminal = undefined;
                    updated.cardLast4 = undefined;
                    updated.cardType = undefined;
                }
                if (field === 'method' && value === 'TARJETA' && !updated.terminal) {
                    updated.terminal = 'BBVA';
                }
                return updated;
            })
        );
    };

    const removePayment = (id: string) => {
        onPaymentsChange(payments.filter((p) => p.id !== id));
        setExpandedPayments(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };

    return (
        <View className="gap-5">
            {/* Status Summary */}
            <View className={`flex-row p-5 rounded-3xl border-2 ${isComplete
                ? (isDark ? 'bg-zinc-900 border-zinc-500/30' : 'bg-white border-zinc-900/10 shadow-sm')
                : remaining > 0
                    ? (isDark ? 'bg-zinc-900 border-amber-500/20' : 'bg-white border-amber-200 shadow-sm')
                    : (isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200 shadow-sm')
                }`}>
                <View className="flex-1 items-center">
                    <Text className={`text-[10px] uppercase font-black tracking-widest mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Total</Text>
                    <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>${totalAmount.toFixed(2)}</Text>
                </View>
                <View className={`w-[1px] h-8 self-center mx-2 ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`} />
                <View className="flex-1 items-center">
                    <Text className={`text-[10px] uppercase font-black tracking-widest mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Pagado</Text>
                    <Text className={`text-xl font-black ${isComplete ? (isDark ? 'text-white' : 'text-zinc-900') : (isDark ? 'text-zinc-400' : 'text-zinc-500')}`}>${totalPaid.toFixed(2)}</Text>
                </View>
                <View className={`w-[1px] h-8 self-center mx-2 ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`} />
                <View className="flex-1 items-center">
                    <Text className={`text-[10px] uppercase font-black tracking-widest mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        {remaining > 0 ? 'Falta' : 'Cambio'}
                    </Text>
                    <Text className={`text-xl font-black ${remaining > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                        ${Math.abs(remaining).toFixed(2)}
                    </Text>
                </View>
            </View>

            {/* Payment Entries */}
            <View className="gap-3">
                {payments.map((payment, index) => {
                    const isExpanded = expandedPayments.has(payment.id);
                    const isCard = payment.method === 'TARJETA';

                    return (
                        <View
                            key={payment.id}
                            className={`rounded-2xl border-2 overflow-hidden ${isDark
                                ? (isExpanded ? 'bg-zinc-900 border-zinc-700' : 'bg-zinc-900/40 border-zinc-800/50')
                                : (isExpanded ? 'bg-white border-zinc-200 shadow-md' : 'bg-zinc-50 border-zinc-100')
                                }`}
                        >
                            {/* Header */}
                            <TouchableOpacity
                                onPress={() => toggleExpanded(payment.id)}
                                className={`flex-row items-center justify-between p-4 ${isDark ? (isExpanded ? 'bg-zinc-800/50' : 'bg-transparent') : (isExpanded ? 'bg-zinc-50' : 'bg-transparent')}`}
                            >
                                <View className="flex-row items-center flex-1">
                                    <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${isDark ? 'bg-zinc-100' : 'bg-zinc-900'}`}>
                                        <Text className={`text-xs font-black ${isDark ? 'text-zinc-900' : 'text-white'}`}>{index + 1}</Text>
                                    </View>
                                    <View className="flex-row items-center gap-2">
                                        <View className={`p-1.5 rounded-lg ${payment.method === 'EFECTIVO' ? (isDark ? 'bg-zinc-800' : 'bg-zinc-100') : (isDark ? 'bg-zinc-800' : 'bg-zinc-100')}`}>
                                            {payment.method === 'EFECTIVO' ? <Banknote size={16} color={isDark ? '#e4e4e7' : '#18181b'} /> : <CreditCard size={16} color={isDark ? '#e4e4e7' : '#18181b'} />}
                                        </View>
                                        <Text className={`font-black text-base ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                                            {PAYMENT_METHODS.find(m => m.value === payment.method)?.label}
                                        </Text>
                                    </View>
                                    <Text className={`mr-4 font-black text-lg ${isDark ? 'text-white' : 'text-zinc-900'}`}>${payment.amount.toFixed(2)}</Text>
                                </View>
                                {isExpanded ? <ChevronUp size={22} color={isDark ? '#71717a' : '#52525b'} strokeWidth={3} /> : <ChevronDown size={22} color={isDark ? '#71717a' : '#52525b'} strokeWidth={3} />}
                            </TouchableOpacity>

                            {/* Details */}
                            {isExpanded && (
                                <View className="p-5 gap-5 border-t border-zinc-200/20">
                                    {/* Amount Input */}
                                    <View>
                                        <Text className={`text-[10px] font-black mb-2 uppercase tracking-widest ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Monto a pagar</Text>
                                        <View className={`flex-row items-center border-[3px] rounded-2xl px-4 ${isDark ? 'bg-black border-zinc-800' : 'bg-white border-zinc-100'}`}>
                                            <Text className="text-2xl font-black text-zinc-400">$</Text>
                                            <TextInput
                                                className={`flex-1 py-4 pl-3 text-2xl font-black ${isDark ? 'text-white' : 'text-zinc-800'}`}
                                                value={payment.amount.toString()}
                                                onChangeText={(val) => updatePayment(payment.id, 'amount', val)}
                                                keyboardType="numeric"
                                                placeholder="0.00"
                                                placeholderTextColor={isDark ? '#3f3f46' : '#d4d4d8'}
                                                editable={!disabled}
                                            />
                                        </View>
                                    </View>

                                    {/* Method Selection */}
                                    <View>
                                        <Text className={`text-[10px] font-black mb-2 uppercase tracking-widest ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Seleccionar Medio</Text>
                                        <View className="flex-row gap-3">
                                            {PAYMENT_METHODS.map((m) => {
                                                const active = payment.method === m.value;

                                                let activeClasses = '';
                                                if (active) {
                                                    if (m.value === 'EFECTIVO') {
                                                        activeClasses = isDark ? 'bg-emerald-500 border-emerald-400' : 'bg-emerald-600 border-emerald-500';
                                                    } else {
                                                        activeClasses = isDark ? 'bg-blue-500 border-blue-400' : 'bg-blue-600 border-blue-500';
                                                    }
                                                }
                                                const inactiveClasses = isDark ? 'border-zinc-800 bg-black' : 'border-zinc-100 bg-white shadow-sm';

                                                return (
                                                    <TouchableOpacity
                                                        key={m.value}
                                                        onPress={() => updatePayment(payment.id, 'method', m.value)}
                                                        className={`flex-1 flex-row items-center justify-center p-4 rounded-2xl border-2 shadow-sm ${active ? activeClasses : inactiveClasses}`}
                                                    >
                                                        {m.value === 'EFECTIVO' ? <Banknote size={18} color={active ? '#fff' : (isDark ? '#3f3f46' : '#d4d4d8')} /> : <CreditCard size={18} color={active ? '#fff' : (isDark ? '#3f3f46' : '#d4d4d8')} />}
                                                        <Text className={`ml-3 font-black text-xs uppercase tracking-widest ${active ? 'text-white' : (isDark ? 'text-zinc-600' : 'text-zinc-400')}`}>
                                                            {m.label}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    </View>

                                    {/* Card Details */}
                                    {isCard && (
                                        <View className="gap-5 pt-5 border-t border-zinc-200/20">
                                            {/* Terminal Selection */}
                                            <View>
                                                <Text className={`text-[10px] font-black mb-2 uppercase tracking-widest ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Terminal de Pago</Text>
                                                <View className="flex-row gap-3">
                                                    {PAYMENT_TERMINALS.map((t) => {
                                                        const active = payment.terminal === t.value;

                                                        const activeClasses = isDark ? 'bg-zinc-100 border-zinc-200' : 'bg-zinc-900 border-zinc-800';
                                                        const inactiveClasses = isDark ? 'border-zinc-800 bg-black' : 'border-zinc-100 bg-white';

                                                        return (
                                                            <TouchableOpacity
                                                                key={t.value}
                                                                onPress={() => updatePayment(payment.id, 'terminal', t.value)}
                                                                className={`flex-1 p-4 rounded-2xl items-center border-2 shadow-sm ${active ? activeClasses : inactiveClasses}`}
                                                            >
                                                                <Text className={`font-black uppercase tracking-widest text-[10px] text-center ${active ? (isDark ? 'text-zinc-900' : 'text-white') : (isDark ? 'text-zinc-500' : 'text-zinc-400')}`}>
                                                                    {t.label}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </View>
                                            </View>

                                            {/* Details Row */}
                                            <View className="flex-row gap-3">
                                                <View className="flex-[0.8]">
                                                    <Text className={`text-[10px] font-black mb-2 uppercase tracking-widest ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Terminales</Text>
                                                    <TextInput
                                                        className={`p-4 rounded-2xl border-2 text-center text-xl font-black ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-100 text-zinc-800'}`}
                                                        value={payment.cardLast4 || ''}
                                                        onChangeText={(val) => updatePayment(payment.id, 'cardLast4', val.replace(/[^0-9]/g, '').substring(0, 4))}
                                                        keyboardType="numeric"
                                                        placeholder="0000"
                                                        placeholderTextColor={isDark ? '#3f3f46' : '#d4d4d8'}
                                                        maxLength={4}
                                                    />
                                                </View>
                                                <View className="flex-[1.2]">
                                                    <Text className={`text-[10px] font-black mb-2 uppercase tracking-widest ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Tipo de Tarjeta</Text>
                                                    <View className="flex-row gap-2">
                                                        {CARD_TYPES.map((ct) => {
                                                            const active = payment.cardType === ct.value;

                                                            const activeClasses = isDark ? 'bg-zinc-100 border-zinc-200' : 'bg-zinc-900 border-zinc-800';
                                                            const inactiveClasses = isDark ? 'border-zinc-800 bg-black' : 'border-zinc-100 bg-white shadow-sm';

                                                            return (
                                                                <TouchableOpacity
                                                                    key={ct.value}
                                                                    onPress={() => updatePayment(payment.id, 'cardType', ct.value)}
                                                                    className={`flex-1 p-4 rounded-2xl items-center justify-center border-2 shadow-sm ${active ? activeClasses : inactiveClasses}`}
                                                                >
                                                                    <Text className={`text-[10px] uppercase font-black tracking-widest ${active ? (isDark ? 'text-zinc-900' : 'text-white') : (isDark ? 'text-zinc-500' : 'text-zinc-400')}`}>
                                                                        {ct.label}
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            );
                                                        })}
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                    )}

                                    {/* Action buttons */}
                                    {payments.length > 1 && (
                                        <TouchableOpacity
                                            onPress={() => removePayment(payment.id)}
                                            className="flex-row items-center justify-center p-4 rounded-2xl bg-red-500/10 border-2 border-red-500/20"
                                        >
                                            <Trash2 size={18} color="#ef4444" />
                                            <Text className="ml-2 text-red-500 font-black text-sm uppercase tracking-wider">Eliminar Pago</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>

            {/* Add Payment Button */}
            <TouchableOpacity
                onPress={addPayment}
                className={`flex-row items-center justify-center p-5 rounded-2xl border-2 border-dashed ${isDark ? 'border-zinc-800 bg-zinc-900/20' : 'border-zinc-200 bg-zinc-50/50'}`}
            >
                <Plus size={20} color={isDark ? '#52525b' : '#a1a1aa'} strokeWidth={3} />
                <Text className={`ml-2 font-black uppercase tracking-widest text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Agregar otro pago</Text>
            </TouchableOpacity>
        </View>
    );

}
