import { Tabs } from 'expo-router';
import { Home, LayoutDashboard, UserCircle, ShoppingBag } from 'lucide-react-native';
import { useTheme } from '../../contexts/theme-context';

export default function TabLayout() {
    const { isDark } = useTheme();
    
    return (
        <Tabs screenOptions={{
            tabBarActiveTintColor: '#3b82f6',
            tabBarInactiveTintColor: isDark ? '#64748b' : '#94a3b8',
            tabBarStyle: {
                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                borderTopColor: isDark ? '#334155' : '#e2e8f0',
                borderTopWidth: 1,
            },
            headerShown: true,
            headerStyle: { 
                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                borderBottomWidth: 1, 
                borderBottomColor: isDark ? '#334155' : '#e2e8f0',
            },
            headerTitleStyle: { 
                fontWeight: 'bold',
                color: isDark ? '#ffffff' : '#1e293b',
            },
            headerTintColor: isDark ? '#ffffff' : '#1e293b',
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
