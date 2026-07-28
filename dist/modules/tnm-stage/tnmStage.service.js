"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TnmStageService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const tnmStage_repository_1 = require("./tnmStage.repository");
const repository = new tnmStage_repository_1.TnmStageRepository();
class TnmStageService {
    async createTnmStage(data, createdBy) {
        if (data.cancer_type_id) {
            const cancerType = await repository.findCancerType(data.cancer_type_id);
            if (!cancerType) {
                throw new Error("Cancer type not found");
            }
        }
        const existing = await repository.findByCombinedCode(data.cancer_type_id, data.tnm_combined_code || "");
        if (existing) {
            throw new Error("This TNM combination already exists for the selected cancer type");
        }
        return prisma_1.default.$transaction(async (tx) => {
            const tnmStageId = await (0, idGenerator_1.generateId)(tx, "TNM_STAGE");
            return repository.create(tx, {
                tnm_stage_id: tnmStageId,
                cancer_type_id: data.cancer_type_id,
                t_category: data.t_category,
                n_category: data.n_category,
                m_category: data.m_category,
                tnm_combined_code: data.tnm_combined_code,
                staging_edition: data.staging_edition,
                overall_stage_group: data.overall_stage_group,
                description: data.description,
                created_by: createdBy
            });
        });
    }
    async getTnmStages(query) {
        return repository.list(query);
    }
    async getTnmStageById(tnmStageId) {
        const stage = await repository.findById(tnmStageId);
        if (!stage) {
            throw new Error("TNM stage not found");
        }
        return stage;
    }
    async updateTnmStage(tnmStageId, data, updatedBy) {
        const existing = await repository.findById(tnmStageId);
        if (!existing) {
            throw new Error("TNM stage not found");
        }
        if (data.cancer_type_id) {
            const cancerType = await repository.findCancerType(data.cancer_type_id);
            if (!cancerType) {
                throw new Error("Cancer type not found");
            }
        }
        return repository.update(tnmStageId, {
            cancer_type_id: data.cancer_type_id,
            t_category: data.t_category,
            n_category: data.n_category,
            m_category: data.m_category,
            tnm_combined_code: data.tnm_combined_code,
            staging_edition: data.staging_edition,
            overall_stage_group: data.overall_stage_group,
            description: data.description,
            is_active: data.is_active,
            updated_by: updatedBy
        });
    }
    async deleteTnmStage(tnmStageId, updatedBy) {
        const existing = await repository.findById(tnmStageId);
        if (!existing) {
            throw new Error("TNM stage not found");
        }
        return repository.update(tnmStageId, {
            is_active: false,
            updated_by: updatedBy
        });
    }
    async restoreTnmStage(tnmStageId, updatedBy) {
        const existing = await repository.findById(tnmStageId);
        if (!existing) {
            throw new Error("TNM stage not found");
        }
        return repository.update(tnmStageId, {
            is_active: true,
            updated_by: updatedBy
        });
    }
}
exports.TnmStageService = TnmStageService;
