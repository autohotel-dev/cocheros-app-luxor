import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useFeedback } from '../contexts/feedback-context';

import { PaymentEntry } from '../lib/payment-types';

interface VehicleData {
    plate: string;
    brand: string;
    model: string;
}

export function useValetActions(onRefresh: () => Promise<void>) {
    const [loading, setLoading] = useState(false);
    const { showFeedback } = useFeedback();

    /**
     * Aceptar una entrada (asignar valet a la estancia)
     * Solo asigna el valet, no registra vehículo ni cobro
     */
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

    /**
     * Registrar vehículo y cobro para entrada
     * 
     * Flujo:
     * 1. Actualizar room_stay con datos de vehículo
     * 2. Auto-asignar valet_employee_id (con validación para evitar conflictos)
     * 3. Buscar payment pendiente y marcarlo como COBRADO_POR_VALET
     * 4. Notificar recepción para confirmación
     */
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
                showFeedback('Entrada ya asignada', 'Otro cochero ya aceptó esta entrada.', 'warning');
                return false;
            }

            // 2. Obtener shift actual del valet
            const { data: session } = await supabase
                .from('shift_sessions')
                .select('id')
                .eq('employee_id', valetId)
                .eq('status', 'active')
                .maybeSingle();

            // 3. Registrar los pagos
            // Si es un solo pago y es el principal, lo actualizamos.
            // Si son múltiples, actualizamos el principal y creamos los adicionales,
            // o simplemente los marcamos todos como COBRADO_POR_VALET.

            // Primero buscamos el pago principal pendiente
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

            // Procesar pagos
            for (let i = 0; i < payments.length; i++) {
                const p = payments[i];
                if (i === 0) {
                    // Actualizar el principal
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
                    // Crear pagos adicionales
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
            // 1. Obtener shift actual del valet
            const { data: session } = await supabase
                .from('shift_sessions')
                .select('id')
                .eq('employee_id', valetId)
                .eq('status', 'active')
                .maybeSingle();

            // 2. Registrar los pagos del consumo
            const { error: updateError } = await supabase
                .from('sales_order_items')
                .update({
                    delivery_status: 'DELIVERED',
                    delivery_completed_at: new Date().toISOString(),
                    delivery_notes: notes || null,
                    is_paid: false // Reception will mark as paid when confirming valet payment
                })
                .eq('id', consumptionId);

            if (updateError) throw updateError;

            // 3. Crear registros de pago en la tabla payments
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

    /**
     * Confirmar todas las entregas de una habitación
     * Solo confirma items que estén en estado IN_TRANSIT
     */
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
            // 1. Obtener shift actual
            const { data: session } = await supabase
                .from('shift_sessions')
                .select('id')
                .eq('employee_id', valetId)
                .eq('status', 'active')
                .maybeSingle();

            const itemIds = items.map(item => item.id);
            const salesOrderIds = [...new Set(items.map(i => i.sales_order_id))];

            // 2. Actualizar items
            const { error } = await supabase
                .from('sales_order_items')
                .update({
                    delivery_status: 'DELIVERED',
                    delivery_completed_at: new Date().toISOString(),
                    delivery_notes: notes || null,
                    is_paid: false // Reception will mark as paid when confirming valet payment
                })
                .in('id', itemIds);

            if (error) throw error;

            // 3. Registrar pagos
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

    /**
     * Reportar un daño encontrado durante la revisión
     */
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

    /**
     * Registrar una hora extra informada por el valet
     */
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

            // 1. Crear el item en sales_order_items
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

            // 2. Registrar el pago
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

    /**
     * Registrar una persona extra informada por el valet
     */
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

            // 1. Crear el item en sales_order_items
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

            // 2. Registrar el pago
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
        handleAcceptEntry,
        handleRegisterVehicleAndPayment,
        handleConfirmCheckout,
        handleProposeCheckout,
        handleAcceptConsumption,
        handleAcceptAllConsumptions,
        handleConfirmDelivery,
        handleConfirmAllDeliveries,
        handleCancelConsumption,
        handleReportDamage,
        handleRegisterExtraHour,
        handleRegisterExtraPerson,
    };
}
