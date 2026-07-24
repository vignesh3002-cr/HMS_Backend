export interface CreateHistologicalGradeDto {

    grade_code: string;

    grade_name: string;

    description?: string;

}

export interface UpdateHistologicalGradeDto {

    grade_code?: string;

    grade_name?: string;

    description?: string;

    is_active?: boolean;

}

export interface GetHistologicalGradesQuery {

    search?: string;

    isActive?: string;

    page?: number;

    limit?: number;

    sortBy?: string;

    sortOrder?: "asc" | "desc";

}
