import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
// import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Car, CheckCircle2, LogOut, AlertTriangle, ArrowRightLeft } from 'lucide-react-native';
import { SalesOrderItem } from '../../lib/types';

export interface RoomCardProps {
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
    pendingExtras: SalesOrderItem[];
    onVerifyExtras: (roomId: string, items: SalesOrderItem[]) => void;
    onAcceptVerification: (roomId: string, items: SalesOrderItem[]) => Promise<void>;
    isCheckoutReviewed: boolean;
    // Room change props
    pendingRoomChangeItem?: SalesOrderItem | null;
    onVerifyRoomChange?: (roomId: string, item: SalesOrderItem) => void;
}

export const RoomCard = memo(({
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
    onAcceptVerification,
    isCheckoutReviewed,
    pendingRoomChangeItem,
    onVerifyRoomChange
}: RoomCardProps) => {
    const isPendingEntry = !vehiclePlate;
    const isPendingCheckout = !!vehiclePlate && !isCheckoutReviewed;

    // Group extras by status
    const pendingAcceptanceExtras = pendingExtras?.filter(i => !i.delivery_status || i.delivery_status === 'PENDING_VALET') || [];
    const acceptedExtras = pendingExtras?.filter(i => i.delivery_status === 'ACCEPTED') || [];

    // Determine which state to show (prioritize acceptance if any are pending)
    const showAcceptButton = pendingAcceptanceExtras.length > 0;
    const showVerifyButton = acceptedExtras.length > 0 && !showAcceptButton; // Only show verify if everything waiting is accepted

    const isUnassignedEntry = isPendingEntry && !valetEmployeeId;
    const isMyPendingEntry = isPendingEntry && valetEmployeeId === employeeId;

    return (
        <View
            className={`m-2 p-5 rounded-2xl border-2 shadow-sm ${isUrgent
                ? 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/50'
                : 'bg-white border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800'
                }`}>
            <View className="flex-row justify-between items-center mb-5">
                <View>
                    <Text className="text-[10px] uppercase font-black tracking-widest mb-1 text-zinc-400 dark:text-zinc-500">
                        Habitación
                    </Text>
                    <Text className="text-2xl font-black text-zinc-900 dark:text-white">
                        {roomNumber}
                    </Text>
                    {vehiclePlate && (
                        <View className="flex-row items-center mt-1">
                            <Car size={12} color={isDark ? '#a1a1aa' : '#52525b'} />
                            <Text className="ml-1.5 font-black text-xs text-zinc-500 dark:text-zinc-400">
                                {vehiclePlate} • {vehicleBrand}
                            </Text>
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
                        <View className="px-2 py-1 rounded-full border bg-black border-black dark:bg-zinc-100 dark:border-zinc-100">
                            <Text className="font-black text-[8px] uppercase text-white dark:text-black">MI ENTRADA</Text>
                        </View>
                    )}
                    {isProposed && (
                        <View className="px-2 py-1 rounded-full border bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/50">
                            <Text className="font-black text-[8px] uppercase text-amber-700 dark:text-amber-500">En Revisión</Text>
                        </View>
                    )}
                </View>
            </View>

            {showAcceptButton && (
                <TouchableOpacity
                    onPress={() => onAcceptVerification(roomId, pendingAcceptanceExtras)}
                    disabled={!hasActiveShift || actionLoading}
                    className="flex-row items-center justify-center p-4 rounded-xl shadow-sm mb-3 bg-indigo-500 dark:bg-indigo-600"
                >
                    <CheckCircle2 color="white" size={20} strokeWidth={3} />
                    <Text className="font-black uppercase tracking-widest text-xs ml-2 text-white">
                        Aceptar Solicitud ({pendingAcceptanceExtras.length})
                    </Text>
                </TouchableOpacity>
            )}

            {showVerifyButton && (
                <TouchableOpacity
                    onPress={() => onVerifyExtras(roomId, acceptedExtras)}
                    disabled={!hasActiveShift || actionLoading}
                    className="flex-row items-center justify-center p-4 rounded-xl shadow-sm mb-3 bg-amber-500 dark:bg-amber-600"
                >
                    <AlertTriangle color="white" size={20} strokeWidth={3} />
                    <Text className="font-black uppercase tracking-widest text-xs ml-2 text-white">
                        Verificar Extra ({acceptedExtras.length})
                    </Text>
                </TouchableOpacity>
            )}

            {pendingRoomChangeItem && onVerifyRoomChange && (
                <TouchableOpacity
                    onPress={() => onVerifyRoomChange(roomId, pendingRoomChangeItem)}
                    disabled={!hasActiveShift || actionLoading}
                    className="flex-row items-center justify-center p-4 rounded-xl shadow-sm mb-3 bg-blue-500 dark:bg-blue-600"
                >
                    <ArrowRightLeft color="white" size={20} strokeWidth={3} />
                    <Text className="font-black uppercase tracking-widest text-xs ml-2 text-white">
                        Verificar Cambio
                    </Text>
                </TouchableOpacity>
            )}

            {isUnassignedEntry ? (
                <TouchableOpacity
                    onPress={() => handleAcceptEntry(stayId, roomNumber, employeeId!)}
                    disabled={!hasActiveShift || actionLoading}
                    className={`flex-row items-center justify-center p-4 rounded-xl shadow-sm ${hasActiveShift
                        ? 'bg-zinc-900 dark:bg-white'
                        : 'bg-zinc-200'
                        }`}
                >
                    <CheckCircle2 color={isDark ? '#000' : '#fff'} size={20} strokeWidth={3} />
                    <Text className="font-black uppercase tracking-widest text-xs ml-2 text-white dark:text-black">
                        Aceptar Entrada
                    </Text>
                </TouchableOpacity>
            ) : isMyPendingEntry ? (
                <TouchableOpacity
                    onPress={() => handleOpenEntry(roomId)}
                    disabled={!hasActiveShift || actionLoading}
                    className={`flex-row items-center justify-center p-4 rounded-xl shadow-sm ${hasActiveShift
                        ? 'bg-zinc-900 dark:bg-white'
                        : 'bg-zinc-200'
                        }`}
                >
                    <Car color={isDark ? '#000' : '#fff'} size={20} strokeWidth={3} />
                    <Text className="font-black uppercase tracking-widest text-xs ml-2 text-white dark:text-black">
                        Registrar Auto
                    </Text>
                </TouchableOpacity>
            ) : isPendingCheckout ? (
                <View>
                    {isUrgent ? (
                        <TouchableOpacity
                            onPress={() => handleOpenCheckout(roomId)}
                            disabled={!hasActiveShift || actionLoading}
                            className={`flex-row items-center justify-center p-4 rounded-xl shadow-md ${hasActiveShift ? 'bg-red-600' : 'bg-zinc-200'
                                }`}
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
                                    className="flex-row items-center justify-center p-3 rounded-xl border-2 border-dashed mb-2 border-zinc-200 dark:border-zinc-700"
                                >
                                    <Text className="font-black uppercase tracking-widest text-[10px] text-zinc-400 dark:text-zinc-500">
                                        Avisar Salida
                                    </Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                onPress={() => handleOpenCheckout(roomId)}
                                disabled={!hasActiveShift || actionLoading}
                                className={`flex-row items-center justify-center p-4 rounded-xl border-2 ${hasActiveShift
                                    ? 'border-zinc-100 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800'
                                    : 'bg-zinc-200 border-zinc-200'
                                    }`}
                            >
                                <LogOut color={isDark ? '#a1a1aa' : '#52525b'} size={20} strokeWidth={3} />
                                <Text className="font-black uppercase tracking-widest text-xs ml-2 text-zinc-600 dark:text-zinc-300">
                                    Entregar
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            ) : (
                <View className="flex-row items-center justify-center p-4 rounded-xl border-2 border-dashed bg-zinc-50 border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
                    <Text className="font-black uppercase tracking-widest text-[10px] text-zinc-400 dark:text-zinc-600">
                        Revisión Enviada
                    </Text>
                </View>
            )}
        </View>
    );
});
