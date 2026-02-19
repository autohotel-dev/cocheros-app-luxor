import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import * as Updates from 'expo-updates';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        // Here you would normally log to Sentry
    }

    private handleReset = async () => {
        try {
            await Updates.reloadAsync();
        } catch (e) {
            // Fallback if Updates API fails (e.g. dev client)
            this.setState({ hasError: false, error: null });
        }
    };

    public render() {
        if (this.state.hasError) {
            return (
                <View className="flex-1 items-center justify-center bg-zinc-900 p-6">
                    <View className="bg-zinc-800 p-8 rounded-3xl items-center w-full max-w-sm border border-zinc-700">
                        <Text className="text-4xl mb-4">😔</Text>
                        <Text className="text-white text-xl font-black mb-2 text-center">
                            Algo salió mal
                        </Text>
                        <Text className="text-zinc-400 text-center mb-8 leading-relaxed">
                            La aplicación encontró un error inesperado. Por favor intenta recargar.
                        </Text>

                        <TouchableOpacity
                            onPress={this.handleReset}
                            className="bg-white px-8 py-4 rounded-xl w-full"
                        >
                            <Text className="text-black font-black text-center uppercase tracking-widest">
                                Recargar App
                            </Text>
                        </TouchableOpacity>

                        {__DEV__ && (
                            <Text className="text-red-400 mt-8 text-xs font-mono">
                                {this.state.error?.toString()}
                            </Text>
                        )}
                    </View>
                </View>
            );
        }

        return this.props.children;
    }
}
