export type DeliveryStatus = 'PENDING_VALET' | 'DELIVERED' | 'ACCEPTED' | 'CANCELLED';
export type PaymentMethod = 'EFECTIVO' | 'TARJETA';

export interface RoomType {
    id: string;
    name: string;
    description: string | null;
    base_price: number;
    extra_person_price: number;
    extra_hour_price: number;
}

export interface SalesOrderItem {
    id: string;
    sales_order_id: string;
    concept_type: string; // 'EXTRA_PERSON' | 'EXTRA_HOUR' | 'RENEWAL' | 'PROMO_4H' | 'DAMAGE_CHARGE' | etc.
    description: string;
    unit_price: number;
    qty: number;
    total: number;
    is_paid: boolean;
    delivery_status: DeliveryStatus | null;
    delivery_accepted_by: string | null;
    delivery_accepted_at: string | null;
    delivery_completed_at: string | null;
    delivery_notes: string | null;
    created_at: string;
}

export interface SalesOrder {
    id: string;
    check_in_id: string;
    status: string;
    remaining_amount: number;
    sales_order_items: SalesOrderItem[];
}

export interface RoomStay {
    id: string;
    room_id: string;
    status: 'ACTIVA' | 'FINALIZADA';
    check_in_at: string;
    check_out_at: string | null;
    vehicle_plate: string | null;
    vehicle_brand: string | null;
    vehicle_model: string | null;
    vehicle_requested_at: string | null;
    valet_employee_id: string | null;
    valet_checkout_requested_at: string | null;
    checkout_valet_employee_id: string | null;
    current_people: number;
    total_people: number;
    sales_order_id: string;
    sales_orders: SalesOrder[] | SalesOrder; // Can be array or single depending on query
}

export interface Room {
    id: string;
    number: string;
    status: string;
    room_type_id: string;
    room_types: RoomType;
    room_stays: RoomStay[]; // Usually fetched with !inner for active stays
}
