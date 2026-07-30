"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CancerTypeService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const cancerType_repository_1 = require("./cancerType.repository");
const repository = new cancerType_repository_1.CancerTypeRepository();
class CancerTypeService {
    async createCancerType(data, createdBy) {
        const existing = await repository.findByName(data.cancer_type_name);
        if (existing) {
            throw new Error("Cancer type code already exists");
        }
        return prisma_1.default.$transaction(async (tx) => {
            const cancerTypeId = await (0, idGenerator_1.generateId)(tx, "CANCER_TYPE");
            const cancerTypeCode = `CAN${Date.now()}`;
            const cancerType = await repository.create(tx, {
                cancer_type_id: cancerTypeId,
                cancer_type_code: cancerTypeCode,
                cancer_type_name: data.cancer_type_name,
                cancer_category: data.cancer_category,
                icd_o3_code: data.icd_o3_code,
                description: data.description,
                created_by: createdBy
            });
            return cancerType;
        });
    }
    async getCancerTypes(query) {
        return repository.list(query);
    }
    async getCancerTypeById(cancerTypeId) {
        const cancerType = await repository.findById(cancerTypeId);
        if (!cancerType) {
            throw new Error("Cancer type not found");
        }
        return cancerType;
    }
    async updateCancerType(cancerTypeId, data, updatedBy) {
        const existing = await repository.findById(cancerTypeId);
        if (!existing) {
            throw new Error("Cancer type not found");
        }
        if (data.cancer_type_code &&
            data.cancer_type_code !== existing.cancer_type_code) {
            const codeTaken = await repository.findByCode(data.cancer_type_code);
            if (codeTaken) {
                throw new Error("Cancer type code already exists");
            }
        }
        return repository.update(cancerTypeId, {
            cancer_type_code: data.cancer_type_code,
            cancer_type_name: data.cancer_type_name,
            cancer_category: data.cancer_category,
            icd_o3_code: data.icd_o3_code,
            description: data.description,
            is_active: data.is_active,
            updated_by: updatedBy
        });
    }
    async deleteCancerType(cancerTypeId, updatedBy) {
        const existing = await repository.findById(cancerTypeId);
        if (!existing) {
            throw new Error("Cancer type not found");
        }
        return repository.update(cancerTypeId, {
            is_active: false,
            updated_by: updatedBy
        });
    }
    async restoreCancerType(cancerTypeId, updatedBy) {
        const existing = await repository.findById(cancerTypeId);
        if (!existing) {
            throw new Error("Cancer type not found");
        }
        return repository.update(cancerTypeId, {
            is_active: true,
            updated_by: updatedBy
        });
    }
}
exports.CancerTypeService = CancerTypeService;
