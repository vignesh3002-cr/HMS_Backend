export interface CreateSampleCollectionDto {
    lab_order_item_id: string;
    barcode?: string;
    container_type?: string;
    collection_datetime?: Date;
    collected_by?: string;
    collection_site?: string;
    collected_volume?: string;
    collection_status?: string;
    rejection_reason?: string;
    remarks?: string;
    branch_id?: string;
    user_id?: string;
}

export interface UpdateSampleCollectionDto
    extends Partial<CreateSampleCollectionDto> {}