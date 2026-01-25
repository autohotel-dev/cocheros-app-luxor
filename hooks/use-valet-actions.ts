import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Alert } from 'react-native';

interface VehicleData {
    plate: string;
    brand: string;
    model: string;
}

interface PaymentData {
    amount: number;
    method: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';
    reference?: string;
}

export function useValetActions(onRefresh: () => Promise<void>) {
    const [loading, setLoading] = useState(false);

    /**
     * Aceptar una entrada (asignar valet a la estancia)
     * Solo asigna el valet, no registra vehículo ni cobro
     */
    const handleAcceptEntry = async (stayId: string, roomNumber: string, valetId: string) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('room_stays')
                .update({ valet_employee_id: valetId })
                .eq('id', stayId);

            if (error) throw error;

            Alert.alert('Éxito', `Te has asignado la Habitación ${roomNumber}`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error('Error accepting entry:', error);
            Alert.alert('Error', error.message || 'Error al aceptar la entrada');
            return false;
        } finally {
            setLoading(false);
        }
    };

    /**
     * Registrar vehículo y cobro para entrada
     * 
     * Flujo:
     * 1. Actualizar room_stay con datos de vehículo
     * 2. Auto-asignar valet_employee_id (con validación para evitar conflictos)
     * 3. Buscar payment pendiente y marcarlo como COBRADO_POR_VALET
     * 4. Notificar recepción para confirmación
     */
    const handleRegisterVehicleAndPayment = async (
        stayId: string,
        salesOrderId: string,
        roomNumber: string,
        vehicleData: VehicleData,
        paymentData: PaymentData,
        valetId: string,
        personCount: number,
        totalPeople?: number
    ) => {
        setLoading(true);

        try {
            // 1. Actualizar vehículo y asignar valet
            // Permitir actualización si: NO tiene valet O el valet soy YO
            const { error: stayError, count } = await supabase
                .from('room_stays')
                .update({
                    vehicle_plate: vehicleData.plate.trim().toUpperCase(),
                    vehicle_brand: vehicleData.brand.trim(),
                    vehicle_model: vehicleData.model.trim(),
                    valet_employee_id: valetId,
                    current_people: personCount,
                    total_people: Math.max(personCount, totalPeople || 0),
                    vehicle_requested_at: null, // Limpiar cualquier solicitud previa
                    valet_checkout_requested_at: null // Limpiar si hubiera
                })
                .eq('id', stayId)
                .or(`valet_employee_id.is.null,valet_employee_id.eq.${valetId}`);

            if (stayError) {
                console.error('Error updating room stay:', stayError);
                throw stayError;
            }

            // Si count es 0, significa que otro valet ya está asignado
            if (count === 0) {
                Alert.alert('Entrada ya asignada', 'Otro cochero ya aceptó esta entrada.');
                return false;
            }

            // 2. Obtener shift actual del valet
            const { data: session } = await supabase
                .from('shift_sessions')
                .select('id')
                .eq('employee_id', valetId)
                .eq('status', 'active')
                .maybeSingle();

            // 3. El cochero NO crea un pago nuevo.
            // Debe tomar el pago principal creado por recepción (ESTANCIA, PENDIENTE)
            // y marcarlo como COBRADO_POR_VALET para que recepción lo confirme.
            const { data: pendingMain, error: pendingMainError } = await supabase
                .from('payments')
                .select('id')
                .eq('sales_order_id', salesOrderId)
                .eq('concept', 'ESTANCIA')
                .eq('status', 'PENDIENTE')
                .is('parent_payment_id', null)
                .order('created_at', { ascending: true })
                .maybeSingle();

            if (pendingMainError) {
                console.error('Error finding pending main payment:', pendingMainError);
                throw pendingMainError;
            }

            if (!pendingMain?.id) {
                Alert.alert(
                    'Sin pago pendiente',
                    'No se encontró el pago pendiente de la estancia. Pide a recepción que genere/valide el cargo de la habitación antes de registrar el cobro.'
                );
                return false;
            }

            const { error: paymentUpdateError } = await supabase
                .from('payments')
                .update({
                    amount: paymentData.amount,
                    payment_method: paymentData.method,
                    reference: paymentData.reference || null,
                    status: 'COBRADO_POR_VALET',
                    payment_type: 'COMPLETO',
                    collected_by: valetId,
                    collected_at: new Date().toISOString(),
                    shift_session_id: session?.id || null,
                })
                .eq('id', pendingMain.id);

            if (paymentUpdateError) {
                console.error('Error updating payment as COBRADO_POR_VALET:', paymentUpdateError);
                throw paymentUpdateError;
            }

            const methodLabel = paymentData.method === 'EFECTIVO' ? 'el dinero' :
                paymentData.method === 'TARJETA' ? 'el voucher' : 'el comprobante';

            Alert.alert('✅ Entrada registrada', `Hab. ${roomNumber}: Lleva ${methodLabel} a recepción para confirmar`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error('Error registering vehicle and payment:', error);
            Alert.alert('Error', error.message || 'Error al registrar entrada');
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptConsumption = async (consumptionId: string, roomNumber: string, valetId: string) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('sales_order_items')
                .update({
                    delivery_accepted_by: valetId,
                    delivery_accepted_at: new Date().toISOString(),
                    delivery_status: 'ACCEPTED'
                })
                .eq('id', consumptionId);

            if (error) throw error;
            Alert.alert('Éxito', `Entrega asignada para Hab. ${roomNumber}`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error("Error accepting consumption:", error);
            Alert.alert('Error', 'Error al aceptar el consumo');
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptAllConsumptions = async (items: any[], roomNumber: string, valetId: string) => {
        if (items.length === 0) return false;
        setLoading(true);
        try {
            const itemIds = items.map(item => item.id);
            const { error } = await supabase
                .from('sales_order_items')
                .update({
                    delivery_accepted_by: valetId,
                    delivery_accepted_at: new Date().toISOString(),
                    delivery_status: 'ACCEPTED'
                })
                .in('id', itemIds);

            if (error) throw error;
            Alert.alert('Éxito', `${items.length} entregas asignadas para Hab. ${roomNumber}`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error("Error accepting all:", error);
            Alert.alert('Error', 'Error al aceptar los servicios');
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmDelivery = async (consumptionId: string, roomNumber: string, tipData?: { amount: number, method: string }, notes?: string) => {
        setLoading(true);
        try {
            const updateData: any = {
                delivery_status: 'DELIVERED',
                delivery_completed_at: new Date().toISOString(),
                delivery_notes: notes || null,
            };

            if (tipData && tipData.amount > 0) {
                updateData.tip_amount = tipData.amount;
                updateData.tip_method = tipData.method;
            }

            const { error } = await supabase
                .from('sales_order_items')
                .update(updateData)
                .eq('id', consumptionId);

            if (error) throw error;
            Alert.alert('Éxito', `Entrega confirmada en Hab. ${roomNumber}`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error("Error confirming delivery:", error);
            Alert.alert('Error', 'Error al confirmar la entrega');
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleCancelConsumption = async (consumptionId: string) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('sales_order_items')
                .update({
                    delivery_status: 'CANCELLED',
                    cancellation_reason: 'Cancelado desde app móvil'
                })
                .eq('id', consumptionId);

            if (error) throw error;
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error("Error cancelling:", error);
            Alert.alert('Error', 'Error al cancelar');
            return false;
        } finally {
            setLoading(false);
        }
    };

    /**
     * Confirmar todas las entregas de una habitación
     * Solo confirma items que estén en estado IN_TRANSIT
     */
    const handleConfirmAllDeliveries = async (items: any[], roomNumber: string) => {
        if (items.length === 0) return false;
        setLoading(true);
        try {
            const itemIds = items.map(item => item.id);

            const { error } = await supabase
                .from('sales_order_items')
                .update({
                    delivery_status: 'DELIVERED',
                    delivery_completed_at: new Date().toISOString()
                })
                .in('id', itemIds);

            if (error) throw error;

            Alert.alert('Éxito', `${items.length} entregas confirmadas en Hab. ${roomNumber}`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error("Error confirming all deliveries:", error);
            Alert.alert('Error', 'Error al confirmar las entregas');
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmCheckout = async (stayId: string, roomNumber: string, valetId: string, personCount: number) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('room_stays')
                .update({
                    checkout_valet_employee_id: valetId,
                    current_people: personCount
                })
                .eq('id', stayId);

            if (error) throw error;

            Alert.alert('Éxito', `Hab. ${roomNumber}: Revisión completada.`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error('Error confirming checkout:', error);
            Alert.alert('Error', 'Error al confirmar salida');
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleProposeCheckout = async (stayId: string, roomNumber: string, valetId: string) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('room_stays')
                .update({
                    valet_checkout_requested_at: new Date().toISOString(),
                    valet_employee_id: valetId // Usar el mismo si ya existe o el actual
                })
                .eq('id', stayId);

            if (error) throw error;
            Alert.alert('Éxito', `Hab. ${roomNumber}: Salida notificada correctamente.`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error('Error proposing checkout:', error);
            Alert.alert('Error', 'Error al notificar salida');
            return false;
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        handleAcceptEntry,
        handleRegisterVehicleAndPayment,
        handleConfirmCheckout,
        handleProposeCheckout,
        handleAcceptConsumption,
        handleAcceptAllConsumptions,
        handleConfirmDelivery,
        handleConfirmAllDeliveries,
        handleCancelConsumption,
    };
}
