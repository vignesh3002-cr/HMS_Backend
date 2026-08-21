export interface CreateLabTestCategoryDto {
    category_name: string;
    category_code: string;
    description?: string;
    display_order?: number;
}

export interface UpdateLabTestCategoryDto {
    category_name?: string;
    category_code?: string;
    description?: string;
    display_order?: number;
    category_status?: number;
}