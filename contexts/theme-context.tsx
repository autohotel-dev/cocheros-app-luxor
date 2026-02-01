import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { colorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: 'light' | 'dark';
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@valet_theme_mode';

export function ThemeProvider({ children }: { children: ReactNode }) {
    const systemColorScheme = useColorScheme();
    const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
    const [isLoaded, setIsLoaded] = useState(false);

    // Cargar tema guardado
    useEffect(() => {
        AsyncStorage.getItem(THEME_STORAGE_KEY).then((savedTheme) => {
            if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
                setThemeModeState(savedTheme as ThemeMode);
            }
            setIsLoaded(true);
        });
    }, []);

    // Sincronizar con NativeWind cuando cambie el tema (después del render)
    useEffect(() => {
        if (isLoaded) {
            // Usar setTimeout para evitar conflictos durante el render
            const timer = setTimeout(() => {
                colorScheme.set(themeMode);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [themeMode, isLoaded]);

    // Guardar tema cuando cambie
    const setThemeMode = (mode: ThemeMode) => {
        setThemeModeState(mode);
        AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    };

    // Determinar tema actual
    const theme: 'light' | 'dark' =
        themeMode === 'system'
            ? (systemColorScheme || 'light')
            : themeMode;

    const isDark = theme === 'dark';

    if (!isLoaded) {
        return null; // O un loading spinner
    }

    return (
        <ThemeContext.Provider value={{ theme, themeMode, setThemeMode, isDark }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
