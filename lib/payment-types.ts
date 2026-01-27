export type PaymentMethod = 'EFECTIVO' | 'TARJETA';
export type PaymentTerminal = 'BBVA' | 'GETNET';
export type CardType = 'CREDITO' | 'DEBITO';

export interface PaymentEntry {
    id: string;
    amount: number;
    method: PaymentMethod;
    terminal?: PaymentTerminal;
    reference?: string;
    cardLast4?: string;
    cardType?: CardType;
}

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string; color: string }[] = [
    { value: 'EFECTIVO', label: 'Efectivo', icon: 'banknote', color: '#22c55e' },
    { value: 'TARJETA', label: 'Tarjeta', icon: 'credit-card', color: '#3b82f6' },
];

export const PAYMENT_TERMINALS: { value: PaymentTerminal; label: string; color: string }[] = [
    { value: 'BBVA', label: 'BBVA', color: '#004481' },
    { value: 'GETNET', label: 'GETNET', color: '#e30613' },
];

export const CARD_TYPES: { value: CardType; label: string; icon: string }[] = [
    { value: 'CREDITO', label: 'Crédito', icon: 'credit-card' },
    { value: 'DEBITO', label: 'Débito', icon: 'banknotes' },
];
