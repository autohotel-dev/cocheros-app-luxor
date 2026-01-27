import { Tabs } from 'expo-router';
import { Home, LayoutDashboard, UserCircle, ShoppingBag } from 'lucide-react-native';
import { useTheme } from '../../contexts/theme-context';

export default function TabLayout() {
    const { isDark } = useTheme();

    return (
        <Tabs screenOptions={{
            tabBarActiveTintColor: isDark ? '#ffffff' : '#09090b',
            tabBarInactiveTintColor: isDark ? '#71717a' : '#a1a1aa',
            tabBarStyle: {
                backgroundColor: isDark ? '#09090b' : '#fafafa',
                borderTopColor: isDark ? '#27272a' : '#e4e4e7',
                borderTopWidth: 1,
            },
            headerShown: true,
            headerStyle: {
                backgroundColor: isDark ? '#09090b' : '#fafafa',
                borderBottomWidth: 1,
                borderBottomColor: isDark ? '#27272a' : '#e4e4e7',
            },
            headerTitleStyle: {
                fontWeight: 'bold',
                color: isDark ? '#ffffff' : '#09090b',
            },
            headerTintColor: isDark ? '#ffffff' : '#09090b',
        }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Panel',
                    tabBarIcon: ({ color }) => <LayoutDashboard color={color} size={24} />,
                    headerTitle: 'Luxor Cocheros',
                }}
            />
            <Tabs.Screen
                name="rooms"
                options={{
                    title: 'Habitaciones',
                    tabBarIcon: ({ color }) => <Home color={color} size={24} />,
                    headerTitle: 'Control de Habitaciones',
                }}
            />
            <Tabs.Screen
                name="services"
                options={{
                    title: 'Servicios',
                    tabBarIcon: ({ color }) => <ShoppingBag color={color} size={24} />,
                    headerTitle: 'Servicios de Tienda',
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Perfil',
                    tabBarIcon: ({ color }) => <UserCircle color={color} size={24} />,
                    headerTitle: 'Mi Perfil',
                }}
            />
        </Tabs>
    );
}
