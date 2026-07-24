import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
import { HistologicalGradeRepository } from "./histologicalGrade.repository";
import {
    CreateHistologicalGradeDto,
    UpdateHistologicalGradeDto,
    GetHistologicalGradesQuery
} from "./histologicalGrade.types";

const repository = new HistologicalGradeRepository();

export class HistologicalGradeService {

    async createHistologicalGrade(data: CreateHistologicalGradeDto, createdBy: string) {

        const existing = await repository.findByCode(data.grade_code);

        if (existing) {
            throw new Error("Grade code already exists");
        }

        return prisma.$transaction(async (tx) => {

            const histologicalGradeId = await generateId(tx, "HISTOLOGICAL_GRADE");

            return repository.create(tx, {

                histological_grade_id: histologicalGradeId,

                grade_code: data.grade_code,

                grade_name: data.grade_name,

                description: data.description,

                created_by: createdBy

            });

        });

    }

    async getHistologicalGrades(query: GetHistologicalGradesQuery) {

        return repository.list(query);

    }

    async getHistologicalGradeById(histologicalGradeId: string) {

        const record = await repository.findById(histologicalGradeId);

        if (!record) {
            throw new Error("Histological grade not found");
        }

        return record;

    }

    async updateHistologicalGrade(
        histologicalGradeId: string,
        data: UpdateHistologicalGradeDto,
        updatedBy: string
    ) {

        const existing = await repository.findById(histologicalGradeId);

        if (!existing) {
            throw new Error("Histological grade not found");
        }

        if (data.grade_code && data.grade_code !== existing.grade_code) {

            const codeTaken = await repository.findByCode(data.grade_code);

            if (codeTaken) {
                throw new Error("Grade code already exists");
            }

        }

        return repository.update(histologicalGradeId, {

            grade_code: data.grade_code,

            grade_name: data.grade_name,

            description: data.description,

            is_active: data.is_active,

            updated_by: updatedBy

        });

    }

    async deleteHistologicalGrade(histologicalGradeId: string, updatedBy: string) {

        const existing = await repository.findById(histologicalGradeId);

        if (!existing) {
            throw new Error("Histological grade not found");
        }

        return repository.update(histologicalGradeId, {
            is_active: false,
            updated_by: updatedBy
        });

    }

    async restoreHistologicalGrade(histologicalGradeId: string, updatedBy: string) {

        const existing = await repository.findById(histologicalGradeId);

        if (!existing) {
            throw new Error("Histological grade not found");
        }

        return repository.update(histologicalGradeId, {
            is_active: true,
            updated_by: updatedBy
        });

    }

}
