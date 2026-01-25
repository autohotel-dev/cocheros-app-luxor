import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { LogIn } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async () => {
        console.log("Intentando iniciar sesión con:", email);
        if (!email || !password) {
            Alert.alert('Error', 'Por favor ingresa correo y contraseña');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                console.error("Error de Supabase:", error);
                Alert.alert('Error de inicio de sesión', error.message);
            } else {
                console.log("Login exitoso:", data.user?.email);
                // Manual redirect as fallback if RootLayout fails
                router.replace('/(tabs)');
            }
        } catch (err: any) {
            console.error("Error inesperado:", err);
            Alert.alert('Error', 'Ocurrió un error inesperado al intentar entrar.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-white"
        >
            <View className="flex-1 justify-center px-8">
                <View className="items-center mb-12">
                    <View className="w-24 h-24 bg-blue-600 rounded-3xl items-center justify-center shadow-lg">
                        <LogIn color="white" size={48} />
                    </View>
                    <Text className="text-3xl font-bold mt-6 text-slate-800">Luxor Cocheros</Text>
                    <Text className="text-slate-500 mt-2">Gestión de Estacionamiento</Text>
                </View>

                <View className="space-y-4">
                    <View>
                        <Text className="text-sm font-medium text-slate-700 mb-1 ml-1">Correo Electrónico</Text>
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            placeholder="correo@ejemplo.com"
                            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800"
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <View className="mt-4">
                        <Text className="text-sm font-medium text-slate-700 mb-1 ml-1">Contraseña</Text>
                        <TextInput
                            value={password}
                            onChangeText={setPassword}
                            placeholder="••••••••"
                            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800"
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        onPress={handleLogin}
                        disabled={loading}
                        className="bg-blue-600 rounded-xl h-14 items-center justify-center mt-8 shadow-sm active:bg-blue-700"
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white font-bold text-lg">Entrar</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
