"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CancerStageService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const cancerStage_repository_1 = require("./cancerStage.repository");
const repository = new cancerStage_repository_1.CancerStageRepository();
class CancerStageService {
    async createCancerStage(data, createdBy) {
        const existing = await repository.findByCode(data.stage_code);
        if (existing) {
            throw new Error("Stage code already exists");
        }
        return prisma_1.default.$transaction(async (tx) => {
            const cancerStageId = await (0, idGenerator_1.generateId)(tx, "CANCER_STAGE");
            return repository.create(tx, {
                cancer_stage_id: cancerStageId,
                stage_code: data.stage_code,
                stage_name: data.stage_name,
                stage_group: data.stage_group,
                description: data.description,
                created_by: createdBy
            });
        });
    }
    async getCancerStages(query) {
        return repository.list(query);
    }
    async getCancerStageById(cancerStageId) {
        const stage = await repository.findById(cancerStageId);
        if (!stage) {
            throw new Error("Cancer stage not found");
        }
        return stage;
    }
    async updateCancerStage(cancerStageId, data, updatedBy) {
        const existing = await repository.findById(cancerStageId);
        if (!existing) {
            throw new Error("Cancer stage not found");
        }
        if (data.stage_code && data.stage_code !== existing.stage_code) {
            const codeTaken = await repository.findByCode(data.stage_code);
            if (codeTaken) {
                throw new Error("Stage code already exists");
            }
        }
        return repository.update(cancerStageId, {
            stage_code: data.stage_code,
            stage_name: data.stage_name,
            stage_group: data.stage_group,
            description: data.description,
            is_active: data.is_active,
            updated_by: updatedBy
        });
    }
    async deleteCancerStage(cancerStageId, updatedBy) {
        const existing = await repository.findById(cancerStageId);
        if (!existing) {
            throw new Error("Cancer stage not found");
        }
        return repository.update(cancerStageId, {
            is_active: false,
            updated_by: updatedBy
        });
    }
    async restoreCancerStage(cancerStageId, updatedBy) {
        const existing = await repository.findById(cancerStageId);
        if (!existing) {
            throw new Error("Cancer stage not found");
        }
        return repository.update(cancerStageId, {
            is_active: true,
            updated_by: updatedBy
        });
    }
}
exports.CancerStageService = CancerStageService;
