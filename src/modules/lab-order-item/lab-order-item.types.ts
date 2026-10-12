export interface CreateLabOrderItemDto {
    lab_order_id: string;
    lab_test_id: string;
    quantity?: number;
    discount?: number;
    remarks?: string;
    /* Doctor's per-test order details (Consultation > Investigations).
       target_date is an ISO date (YYYY-MM-DD). */
    clinical_notes?: string;
    priority?: string;
    target_date?: string | null;
    branch_id?: string;
    user_id?: string;
}

export interface UpdateLabOrderItemDto
    extends Partial<CreateLabOrderItemDto> {
    item_status?: string;
}