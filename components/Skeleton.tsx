import React, { useEffect } from 'react';
import { View, StyleSheet, ViewProps, DimensionValue } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    interpolate,
    Easing
} from 'react-native-reanimated';
import { useTheme } from '../contexts/theme-context';

interface SkeletonProps extends ViewProps {
    width?: DimensionValue;
    height?: DimensionValue;
    borderRadius?: number;
}

export const Skeleton = ({ width, height, borderRadius = 8, style, ...props }: SkeletonProps) => {
    const { isDark } = useTheme();
    const opacity = useSharedValue(0.3);

    useEffect(() => {
        opacity.value = withRepeat(
            withTiming(0.7, {
                duration: 1000,
                easing: Easing.inOut(Easing.ease),
            }),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const backgroundColor = isDark ? '#27272a' : '#f4f4f5'; // zinc-800 : zinc-100

    return (
        <Animated.View
            style={[
                {
                    width,
                    height,
                    backgroundColor,
                    borderRadius,
                },
                animatedStyle,
                style,
            ]}
            {...props}
        />
    );
};

export const RoomCardSkeleton = () => {
    const { isDark } = useTheme();
    return (
        <View className={`m-2 p-5 rounded-2xl border-2 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'}`}>
            <View className="flex-row justify-between items-center mb-5">
                <View>
                    <Skeleton width={60} height={10} borderRadius={4} style={{ marginBottom: 4 }} />
                    <Skeleton width={100} height={28} borderRadius={4} />
                    <View className="flex-row items-center mt-2">
                        <Skeleton width={12} height={12} borderRadius={6} />
                        <Skeleton width={120} height={12} borderRadius={4} style={{ marginLeft: 6 }} />
                    </View>
                </View>
                <Skeleton width={60} height={20} borderRadius={10} />
            </View>
            <View className="flex-row gap-3">
                <Skeleton width="48%" height={48} borderRadius={12} />
                <Skeleton width="48%" height={48} borderRadius={12} />
            </View>
        </View>
    );
};
