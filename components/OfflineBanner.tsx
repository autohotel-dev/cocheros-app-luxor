import React, { useState, useEffect } from 'react';
import { View, Text, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { WifiOff } from 'lucide-react-native';

export function OfflineBanner() {
    const [isConnected, setIsConnected] = useState<boolean | null>(true);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsConnected(state.isConnected);
        });
        return () => unsubscribe();
    }, []);

    if (isConnected === false) {
        return (
            <View className="bg-red-500 absolute top-0 w-full z-50 flex-row items-center justify-center py-2 px-4 shadow-lg safe-area-top">
                <WifiOff color="white" size={16} strokeWidth={3} />
                <Text className="text-white font-black text-xs uppercase tracking-widest ml-2">Sin Conexión a Internet</Text>
            </View>
        );
    }
    return null;
}
