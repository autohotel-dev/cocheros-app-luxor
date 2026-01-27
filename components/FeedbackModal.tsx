import React from 'react';
import { Modal, View, Text, TouchableOpacity, Animated } from 'react-native';
import { CheckCircle2, AlertCircle, XCircle, Info } from 'lucide-react-native';
import { useTheme } from '../contexts/theme-context';

export type FeedbackType = 'success' | 'error' | 'info' | 'warning';

interface FeedbackModalProps {
    visible: boolean;
    title: string;
    message: string;
    type?: FeedbackType;
    onConfirm: () => void;
}

export function FeedbackModal({ visible, title, message, type = 'success', onConfirm }: FeedbackModalProps) {
    const { isDark } = useTheme();

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <CheckCircle2 size={48} color={isDark ? '#10b981' : '#059669'} strokeWidth={2.5} />;
            case 'error':
                return <XCircle size={48} color="#ef4444" strokeWidth={2.5} />;
            case 'warning':
                return <AlertCircle size={48} color="#f59e0b" strokeWidth={2.5} />;
            default:
                return <Info size={48} color={isDark ? '#e4e4e7' : '#18181b'} strokeWidth={2.5} />;
        }
    };

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
        >
            <View className="flex-1 justify-center items-center bg-black/80 px-6">
                <View
                    style={{ elevation: 10 }}
                    className={`w-full max-w-sm rounded-[40px] p-8 items-center border-2 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'
                        }`}
                >
                    <View className={`w-24 h-24 rounded-[32px] items-center justify-center mb-8 shadow-2xl ${isDark ? 'bg-zinc-950/50' : 'bg-zinc-50'
                        }`}>
                        <View className={`w-16 h-16 rounded-3xl items-center justify-center ${type === 'success' ? (isDark ? 'bg-emerald-500/10' : 'bg-emerald-50') :
                                type === 'error' ? (isDark ? 'bg-red-500/10' : 'bg-red-50') :
                                    type === 'warning' ? (isDark ? 'bg-amber-500/10' : 'bg-amber-50') :
                                        (isDark ? 'bg-zinc-800' : 'bg-zinc-100')
                            }`}>
                            {getIcon()}
                        </View>
                    </View>

                    <Text className={`text-3xl font-black text-center mb-3 tracking-tighter ${isDark ? 'text-white' : 'text-zinc-900'
                        }`}>
                        {title}
                    </Text>

                    <View className="px-2">
                        <Text className={`text-base text-center mb-10 leading-6 font-bold ${isDark ? 'text-zinc-500' : 'text-zinc-400'
                            }`}>
                            {message}
                        </Text>
                    </View>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={onConfirm}
                        className={`w-full h-16 rounded-2xl items-center justify-center shadow-2xl border-2 ${isDark ? 'bg-white border-zinc-100' : 'bg-zinc-900 border-zinc-900'
                            }`}
                    >
                        <Text className={`font-black uppercase tracking-[0.2em] text-xs ${isDark ? 'text-zinc-950' : 'text-white'
                            }`}>
                            Entendido
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}
