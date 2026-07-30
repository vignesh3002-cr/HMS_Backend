"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistologicalGradeService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const histologicalGrade_repository_1 = require("./histologicalGrade.repository");
const repository = new histologicalGrade_repository_1.HistologicalGradeRepository();
class HistologicalGradeService {
    async createHistologicalGrade(data, createdBy) {
        const existing = await repository.findByCode(data.grade_code);
        if (existing) {
            throw new Error("Grade code already exists");
        }
        return prisma_1.default.$transaction(async (tx) => {
            const histologicalGradeId = await (0, idGenerator_1.generateId)(tx, "HISTOLOGICAL_GRADE");
            return repository.create(tx, {
                histological_grade_id: histologicalGradeId,
                grade_code: data.grade_code,
                grade_name: data.grade_name,
                description: data.description,
                created_by: createdBy
            });
        });
    }
    async getHistologicalGrades(query) {
        return repository.list(query);
    }
    async getHistologicalGradeById(histologicalGradeId) {
        const record = await repository.findById(histologicalGradeId);
        if (!record) {
            throw new Error("Histological grade not found");
        }
        return record;
    }
    async updateHistologicalGrade(histologicalGradeId, data, updatedBy) {
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
    async deleteHistologicalGrade(histologicalGradeId, updatedBy) {
        const existing = await repository.findById(histologicalGradeId);
        if (!existing) {
            throw new Error("Histological grade not found");
        }
        return repository.update(histologicalGradeId, {
            is_active: false,
            updated_by: updatedBy
        });
    }
    async restoreHistologicalGrade(histologicalGradeId, updatedBy) {
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
exports.HistologicalGradeService = HistologicalGradeService;
