import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useFeedback } from '../contexts/feedback-context';
import { PaymentEntry } from '../lib/payment-types';
import { SalesOrderItem } from '../lib/types';

export function useConsumptionActions(onRefresh: () => Promise<void>) {
    const [loading, setLoading] = useState(false);
    const { showFeedback } = useFeedback();

    const handleAcceptConsumption = useCallback(async (consumptionId: string, roomNumber: string, valetId: string) => {
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
            showFeedback('¡Éxito!', `Entrega asignada para Hab. ${roomNumber}`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error("Error accepting consumption:", error);
            showFeedback('Error', 'Error al aceptar el consumo', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    const handleAcceptAllConsumptions = useCallback(async (items: any[], roomNumber: string, valetId: string) => {
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
            showFeedback('¡Éxito!', `${items.length} entregas asignadas para Hab. ${roomNumber}`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error("Error accepting all:", error);
            showFeedback('Error', 'Error al aceptar los servicios', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    const handleConfirmDelivery = useCallback(async (
        consumptionId: string,
        roomNumber: string,
        payments: PaymentEntry[],
        notes?: string,
        valetId?: string
    ) => {
        setLoading(true);
        try {
            const { data: session } = await supabase
                .from('shift_sessions')
                .select('id')
                .eq('employee_id', valetId)
                .eq('status', 'active')
                .maybeSingle();

            const { error: updateError } = await supabase
                .from('sales_order_items')
                .update({
                    delivery_status: 'DELIVERED',
                    delivery_completed_at: new Date().toISOString(),
                    delivery_notes: notes || null,
                    is_paid: false
                })
                .eq('id', consumptionId);

            if (updateError) throw updateError;

            for (const p of payments) {
                await supabase.from('payments').insert({
                    sales_order_id: (await supabase.from('sales_order_items').select('sales_order_id').eq('id', consumptionId).single()).data?.sales_order_id,
                    amount: p.amount,
                    payment_method: p.method,
                    terminal_code: p.terminal,
                    card_last_4: p.cardLast4,
                    card_type: p.cardType,
                    reference: p.reference || `VALET_ITEM:${consumptionId}`,
                    concept: 'CONSUMPTION',
                    status: 'COBRADO_POR_VALET',
                    collected_by: valetId,
                    collected_at: new Date().toISOString(),
                    shift_session_id: session?.id || null,
                });
            }

            showFeedback('✅ Entrega Informada', `Hab. ${roomNumber}: Lleva el cobro a recepción para corroborar.`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error("Error confirming delivery:", error);
            showFeedback('Error', 'Error al confirmar la entrega', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    const handleConfirmAllDeliveries = useCallback(async (
        items: any[],
        roomNumber: string,
        payments: PaymentEntry[],
        notes?: string,
        valetId?: string
    ) => {
        if (items.length === 0) return false;
        setLoading(true);
        try {
            const { data: session } = await supabase
                .from('shift_sessions')
                .select('id')
                .eq('employee_id', valetId)
                .eq('status', 'active')
                .maybeSingle();

            const itemIds = items.map(item => item.id);
            const salesOrderIds = [...new Set(items.map(i => i.sales_order_id))];

            const { error } = await supabase
                .from('sales_order_items')
                .update({
                    delivery_status: 'DELIVERED',
                    delivery_completed_at: new Date().toISOString(),
                    delivery_notes: notes || null,
                    is_paid: false
                })
                .in('id', itemIds);

            if (error) throw error;

            const mainOrderId = salesOrderIds[0];
            const itemsRef = itemIds.length > 1 ? `VALET_BATCH:${itemIds.length}` : `VALET_ITEM:${itemIds[0]}`;

            for (const p of payments) {
                await supabase.from('payments').insert({
                    sales_order_id: mainOrderId,
                    amount: p.amount,
                    payment_method: p.method,
                    terminal_code: p.terminal,
                    card_last_4: p.cardLast4,
                    card_type: p.cardType,
                    reference: p.reference || itemsRef,
                    concept: 'CONSUMPTION',
                    status: 'COBRADO_POR_VALET',
                    collected_by: valetId,
                    collected_at: new Date().toISOString(),
                    shift_session_id: session?.id || null,
                });
            }

            showFeedback('✅ Entregas Informadas', `Hab. ${roomNumber}: ${items.length} servicios informados. Corrobora los cobros en recepción.`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error("Error confirming all deliveries:", error);
            showFeedback('Error', 'Error al confirmar las entregas', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    const handleCancelConsumption = useCallback(async (consumptionId: string) => {
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
            showFeedback('Error', 'Error al cancelar', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    const handleAcceptVerification = useCallback(async (items: SalesOrderItem[], roomNumber: string, valetId: string) => {
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
            showFeedback('¡En Camino! 🫡', `Has aceptado verificar la Hab. ${roomNumber}`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error("Error accepting verification:", error);
            showFeedback('Error', 'Error al aceptar la verificación', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    return {
        loading,
        handleAcceptConsumption,
        handleAcceptAllConsumptions,
        handleAcceptVerification,
        handleConfirmDelivery,
        handleConfirmAllDeliveries,
        handleCancelConsumption,
    };
}
