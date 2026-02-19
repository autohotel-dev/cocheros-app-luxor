import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useFeedback } from '../contexts/feedback-context';
import { PaymentEntry } from '../lib/payment-types';

interface VehicleData {
    plate: string;
    brand: string;
    model: string;
}

export function useEntryActions(onRefresh: () => Promise<void>) {
    const [loading, setLoading] = useState(false);
    const { showFeedback } = useFeedback();

    const handleAcceptEntry = useCallback(async (stayId: string, roomNumber: string, valetId: string) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('room_stays')
                .update({ valet_employee_id: valetId })
                .eq('id', stayId);

            if (error) throw error;

            showFeedback('¡Éxito!', `Te has asignado la Habitación ${roomNumber}`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error('Error accepting entry:', error);
            showFeedback('Error', error.message || 'Error al aceptar la entrada', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    const handleRegisterVehicleAndPayment = useCallback(async (
        stayId: string,
        salesOrderId: string,
        roomNumber: string,
        vehicleData: VehicleData,
        payments: PaymentEntry[],
        valetId: string,
        personCount: number,
        totalPeople?: number
    ) => {
        setLoading(true);

        try {
            const { error: stayError, count } = await supabase
                .from('room_stays')
                .update({
                    vehicle_plate: vehicleData.plate.trim().toUpperCase(),
                    vehicle_brand: vehicleData.brand.trim(),
                    vehicle_model: vehicleData.model.trim(),
                    valet_employee_id: valetId,
                    current_people: personCount,
                    total_people: Math.max(personCount, totalPeople || 0),
                    vehicle_requested_at: null,
                    valet_checkout_requested_at: null,
                    // Guardar datos de pago para el checkout (Fix para recepción)
                    checkout_payment_data: payments.map(p => ({
                        amount: p.amount,
                        method: p.method,
                        reference: p.reference,
                        concept: 'ENTRADA'
                    }))
                })
                .eq('id', stayId)
                .or(`valet_employee_id.is.null,valet_employee_id.eq.${valetId}`);

            if (stayError) {
                console.error('Error updating room stay:', stayError);
                throw stayError;
            }

            if (count === 0) {
                showFeedback('Entrada ya asignada', 'Otro cochero ya aceptó esta entrada.', 'warning');
                return false;
            }

            const { data: session } = await supabase
                .from('shift_sessions')
                .select('id')
                .eq('employee_id', valetId)
                .eq('status', 'active')
                .maybeSingle();

            const { data: pendingMain, error: pendingMainError } = await supabase
                .from('payments')
                .select('id, amount')
                .eq('sales_order_id', salesOrderId)
                .eq('concept', 'ESTANCIA')
                .eq('status', 'PENDIENTE')
                .is('parent_payment_id', null)
                .order('created_at', { ascending: true })
                .maybeSingle();

            if (pendingMainError) throw pendingMainError;

            if (!pendingMain?.id) {
                showFeedback('Sin pago pendiente', 'No se encontró el cargo de la estancia.', 'warning');
                return false;
            }

            for (let i = 0; i < payments.length; i++) {
                const p = payments[i];
                if (i === 0) {
                    await supabase.from('payments').update({
                        amount: p.amount,
                        payment_method: p.method,
                        terminal_code: p.terminal,
                        card_last_4: p.cardLast4,
                        card_type: p.cardType,
                        reference: p.reference || null,
                        status: 'COBRADO_POR_VALET',
                        collected_by: valetId,
                        collected_at: new Date().toISOString(),
                        shift_session_id: session?.id || null,
                    }).eq('id', pendingMain.id);
                } else {
                    await supabase.from('payments').insert({
                        sales_order_id: salesOrderId,
                        amount: p.amount,
                        payment_method: p.method,
                        terminal_code: p.terminal,
                        card_last_4: p.cardLast4,
                        card_type: p.cardType,
                        reference: p.reference || null,
                        concept: 'ESTANCIA',
                        status: 'COBRADO_POR_VALET',
                        payment_type: 'PARCIAL',
                        parent_payment_id: pendingMain.id,
                        collected_by: valetId,
                        collected_at: new Date().toISOString(),
                        shift_session_id: session?.id || null,
                    });
                }
            }

            showFeedback('Entrada registrada', `Hab. ${roomNumber}: Lleva el dinero/vouchers a recepción.`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error('Error registering vehicle and payment:', error);
            showFeedback('Error', error.message || 'Error al registrar entrada', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    return {
        loading,
        handleAcceptEntry,
        handleRegisterVehicleAndPayment
    };
}
