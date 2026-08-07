export interface CreateLabOrderItemDto {
    lab_order_id: string;
    lab_test_id: string;
    quantity?: number;
    discount?: number;
    remarks?: string;
    branch_id?: string;
    user_id?: string;
}

export interface UpdateLabOrderItemDto
    extends Partial<CreateLabOrderItemDto> {}