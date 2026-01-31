import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useFeedback } from '../contexts/feedback-context';
import { PaymentEntry } from '../lib/payment-types';

export function useCheckoutActions(onRefresh: () => Promise<void>) {
    const [loading, setLoading] = useState(false);
    const { showFeedback } = useFeedback();

    const handleConfirmCheckout = useCallback(async (stayId: string, roomNumber: string, valetId: string, personCount: number) => {
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

            showFeedback('¡Éxito!', `Hab. ${roomNumber}: Revisión completada.`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error('Error confirming checkout:', error);
            showFeedback('Error', 'Error al confirmar salida', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    const handleProposeCheckout = useCallback(async (stayId: string, roomNumber: string, valetId: string) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('room_stays')
                .update({
                    valet_checkout_requested_at: new Date().toISOString(),
                    checkout_valet_employee_id: valetId
                })
                .eq('id', stayId);

            if (error) throw error;
            showFeedback('¡Éxito!', `Hab. ${roomNumber}: Salida notificada correctamente.`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error('Error proposing checkout:', error);
            showFeedback('Error', 'Error al notificar salida', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    const handleReportDamage = useCallback(async (
        stayId: string,
        salesOrderId: string,
        roomNumber: string,
        description: string,
        amount: number,
        payments: PaymentEntry[],
        valetId: string
    ) => {
        setLoading(true);
        try {
            const { data: session } = await supabase
                .from('shift_sessions')
                .select('id')
                .eq('employee_id', valetId)
                .eq('status', 'active')
                .maybeSingle();

            const { data: item, error: itemError } = await supabase
                .from('sales_order_items')
                .insert({
                    sales_order_id: salesOrderId,
                    concept_type: 'DAMAGE_CHARGE',
                    description: `DAÑO: ${description}`,
                    unit_price: amount,
                    qty: 1,
                    total: amount,
                    is_paid: false
                })
                .select()
                .single();

            if (itemError) throw itemError;

            for (const p of payments) {
                await supabase.from('payments').insert({
                    sales_order_id: salesOrderId,
                    amount: p.amount,
                    payment_method: p.method,
                    terminal_code: p.terminal,
                    card_last_4: p.cardLast4,
                    card_type: p.cardType,
                    reference: p.reference || `VALET_DAMAGE:${item?.id}`,
                    concept: 'DAMAGE_CHARGE',
                    status: 'COBRADO_POR_VALET',
                    collected_by: valetId,
                    collected_at: new Date().toISOString(),
                    shift_session_id: session?.id || null,
                });
            }

            showFeedback('✅ Daño Informado', `Hab. ${roomNumber}: Cargo por $${amount.toFixed(2)} generado. Corrobora el cobro en recepción.`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error('Error reporting damage:', error);
            showFeedback('Error', 'No se pudo registrar el daño.', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    const handleRegisterExtraHour = useCallback(async (
        salesOrderId: string,
        roomNumber: string,
        amount: number,
        payments: PaymentEntry[],
        valetId: string
    ) => {
        setLoading(true);
        try {
            const { data: session } = await supabase
                .from('shift_sessions')
                .select('id')
                .eq('employee_id', valetId)
                .eq('status', 'active')
                .maybeSingle();

            const { data: item, error: itemError } = await supabase
                .from('sales_order_items')
                .insert({
                    sales_order_id: salesOrderId,
                    concept_type: 'EXTRA_HOUR',
                    description: 'HORA EXTRA (VALET)',
                    unit_price: amount,
                    qty: 1,
                    total: amount,
                    is_paid: false
                })
                .select()
                .single();

            if (itemError) throw itemError;

            for (const p of payments) {
                await supabase.from('payments').insert({
                    sales_order_id: salesOrderId,
                    amount: p.amount,
                    payment_method: p.method,
                    terminal_code: p.terminal,
                    card_last_4: p.cardLast4,
                    card_type: p.cardType,
                    reference: p.reference || `VALET_HOUR:${item?.id}`,
                    concept: 'HORA_EXTRA',
                    status: 'COBRADO_POR_VALET',
                    collected_by: valetId,
                    collected_at: new Date().toISOString(),
                    shift_session_id: session?.id || null,
                });
            }

            showFeedback('✅ Hora Extra Informada', `Hab. ${roomNumber}: Cobro registrado. Entrega el dinero en recepción.`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error('Error registering extra hour:', error);
            showFeedback('Error', 'No se pudo registrar la hora extra.', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    const handleRegisterExtraPerson = useCallback(async (
        salesOrderId: string,
        roomNumber: string,
        amount: number,
        payments: PaymentEntry[],
        valetId: string
    ) => {
        setLoading(true);
        try {
            const { data: session } = await supabase
                .from('shift_sessions')
                .select('id')
                .eq('employee_id', valetId)
                .eq('status', 'active')
                .maybeSingle();

            const { data: item, error: itemError } = await supabase
                .from('sales_order_items')
                .insert({
                    sales_order_id: salesOrderId,
                    concept_type: 'EXTRA_PERSON',
                    description: 'PERSONA EXTRA (VALET)',
                    unit_price: amount,
                    qty: 1,
                    total: amount,
                    is_paid: false
                })
                .select()
                .single();

            if (itemError) throw itemError;

            for (const p of payments) {
                await supabase.from('payments').insert({
                    sales_order_id: salesOrderId,
                    amount: p.amount,
                    payment_method: p.method,
                    terminal_code: p.terminal,
                    card_last_4: p.cardLast4,
                    card_type: p.cardType,
                    reference: p.reference || `VALET_PERSON:${item?.id}`,
                    concept: 'PERSONA_EXTRA',
                    status: 'COBRADO_POR_VALET',
                    collected_by: valetId,
                    collected_at: new Date().toISOString(),
                    shift_session_id: session?.id || null,
                });
            }

            showFeedback('✅ Persona Extra Informada', `Hab. ${roomNumber}: Cobro registrado. Entrega el dinero en recepción.`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error('Error registering extra person:', error);
            showFeedback('Error', 'No se pudo registrar la persona extra.', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    return {
        loading,
        handleConfirmCheckout,
        handleProposeCheckout,
        handleReportDamage,
        handleRegisterExtraHour,
        handleRegisterExtraPerson
    };
}
