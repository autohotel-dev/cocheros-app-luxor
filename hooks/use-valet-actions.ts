import { useEntryActions } from './use-entry-actions';
import { useCheckoutActions } from './use-checkout-actions';
import { useConsumptionActions } from './use-consumption-actions';

// Facade hook to maintain backward compatibility and group all actions
export function useValetActions(onRefresh: () => Promise<void>) {
    const entry = useEntryActions(onRefresh);
    const checkout = useCheckoutActions(onRefresh);
    const consumption = useConsumptionActions(onRefresh);

    const loading = entry.loading || checkout.loading || consumption.loading;

    return {
        loading,
        // Entry Actions
        handleAcceptEntry: entry.handleAcceptEntry,
        handleRegisterVehicleAndPayment: entry.handleRegisterVehicleAndPayment,

        // Checkout & Extra Actions
        handleConfirmCheckout: checkout.handleConfirmCheckout,
        handleProposeCheckout: checkout.handleProposeCheckout,
        handleReportDamage: checkout.handleReportDamage,
        handleRegisterExtraHour: checkout.handleRegisterExtraHour,
        handleRegisterExtraPerson: checkout.handleRegisterExtraPerson,

        // Consumption Actions
        handleAcceptConsumption: consumption.handleAcceptConsumption,
        handleAcceptAllConsumptions: consumption.handleAcceptAllConsumptions,
        handleConfirmDelivery: consumption.handleConfirmDelivery,
        handleConfirmAllDeliveries: consumption.handleConfirmAllDeliveries,
        handleCancelConsumption: consumption.handleCancelConsumption,
    };
}
