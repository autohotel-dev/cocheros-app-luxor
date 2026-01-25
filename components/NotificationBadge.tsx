import React from 'react';
import { View, Text } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useTheme } from '../contexts/theme-context';

interface NotificationBadgeProps {
    count: number;
    size?: number;
}

export function NotificationBadge({ count, size = 24 }: NotificationBadgeProps) {
    const { isDark } = useTheme();
    
    return (
        <View className="relative">
            <Bell color={isDark ? '#94a3b8' : '#64748b'} size={size} />
            {count > 0 && (
                <View className="absolute -top-1 -right-1 bg-red-500 rounded-full min-w-[18px] h-[18px] items-center justify-center">
                    <Text className="text-white text-[10px] font-bold">
                        {count > 99 ? '99+' : count}
                    </Text>
                </View>
            )}
        </View>
    );
}
