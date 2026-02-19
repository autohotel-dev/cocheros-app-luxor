import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, useColorScheme, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { ShieldCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useFeedback } from '../contexts/feedback-context';
import * as Updates from 'expo-updates';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const isDark = useColorScheme() === 'dark';
    const { showFeedback } = useFeedback();

    useEffect(() => {
        async function checkUpdates() {
            try {
                const update = await Updates.checkForUpdateAsync();
                if (update.isAvailable) {
                    await Updates.fetchUpdateAsync();
                    Alert.alert(
                        "Actualización Disponible",
                        "Se descargó una nueva versión. La aplicación se reiniciará.",
                        [{ text: "OK", onPress: () => Updates.reloadAsync() }],
                        { cancelable: false }
                    );
                }
            } catch (error) {
                console.log("Error checking updates:", error);
            }
        }
        checkUpdates();
    }, []);

    const handleLogin = async () => {
        if (!email || !password) {
            showFeedback('Datos incompletos', 'Por favor ingresa correo y contraseña', 'warning');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                showFeedback('Error de acceso', error.message, 'error');
            } else {
                router.replace('/(tabs)');
            }
        } catch (err: any) {
            showFeedback('Error', 'Ocurrió un error inesperado al intentar entrar.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className={`flex-1 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}
        >
            <View className="flex-1 justify-center px-10">
                <View className="items-center mb-16">
                    <View className={`w-24 h-24 rounded-3xl items-center justify-center shadow-2xl ${isDark ? 'bg-white' : 'bg-zinc-900'}`}>
                        <ShieldCheck color={isDark ? '#000' : '#fff'} size={48} strokeWidth={2.5} />
                    </View>
                    <Text className={`text-4xl font-black mt-8 tracking-tighter ${isDark ? 'text-white' : 'text-zinc-900'}`}>LUXOR</Text>
                    <Text className={`text-xs font-black uppercase tracking-[0.3em] mt-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Sistema de Cocheros</Text>
                </View>

                <View className="gap-5">
                    <View>
                        <Text className={`text-[10px] font-black uppercase tracking-widest mb-2 ml-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Correo Electrónico</Text>
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            placeholder="usuario@autohotelluxor.com"
                            placeholderTextColor={isDark ? '#3f3f46' : '#d4d4d8'}
                            className={`border-2 rounded-2xl px-5 py-4 font-bold text-lg ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-100 text-zinc-900'}`}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <View>
                        <Text className={`text-[10px] font-black uppercase tracking-widest mb-2 ml-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Contraseña</Text>
                        <TextInput
                            value={password}
                            onChangeText={setPassword}
                            placeholder="••••••••"
                            placeholderTextColor={isDark ? '#3f3f46' : '#d4d4d8'}
                            className={`border-2 rounded-2xl px-5 py-4 font-bold text-lg ${isDark ? 'bg-black border-zinc-800 text-white' : 'bg-white border-zinc-100 text-zinc-900'}`}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        onPress={handleLogin}
                        disabled={loading}
                        className={`rounded-2xl h-16 items-center justify-center mt-6 shadow-xl ${isDark ? 'bg-white' : 'bg-zinc-900'}`}
                    >
                        {loading ? (
                            <ActivityIndicator color={isDark ? 'black' : 'white'} />
                        ) : (
                            <Text className={`font-black uppercase tracking-widest ${isDark ? 'text-zinc-900' : 'text-white'}`}>Entrar al Turno</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View className="absolute bottom-12 left-0 right-0 items-center">
                    <Text className={`text-[10px] font-bold ${isDark ? 'text-zinc-700' : 'text-zinc-300'}`}>AHLM v2.0 • LUXOR MANAGER</Text>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
