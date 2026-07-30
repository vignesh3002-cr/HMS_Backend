"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IcdCodeService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const icdCode_repository_1 = require("./icdCode.repository");
const repository = new icdCode_repository_1.IcdCodeRepository();
class IcdCodeService {
    async createIcdCode(data, createdBy) {
        const existing = await repository.findByCode(data.icd_code);
        if (existing) {
            throw new Error("ICD code already exists");
        }
        return prisma_1.default.$transaction(async (tx) => {
            const icdCodeId = await (0, idGenerator_1.generateId)(tx, "ICD_CODE");
            return repository.create(tx, {
                icd_code_id: icdCodeId,
                icd_code: data.icd_code,
                icd_version: data.icd_version,
                icd_description: data.icd_description,
                icd_category: data.icd_category,
                created_by: createdBy
            });
        });
    }
    async getIcdCodes(query) {
        return repository.list(query);
    }
    async getIcdCodeById(icdCodeId) {
        const record = await repository.findById(icdCodeId);
        if (!record) {
            throw new Error("ICD code not found");
        }
        return record;
    }
    async updateIcdCode(icdCodeId, data, updatedBy) {
        const existing = await repository.findById(icdCodeId);
        if (!existing) {
            throw new Error("ICD code not found");
        }
        if (data.icd_code && data.icd_code !== existing.icd_code) {
            const codeTaken = await repository.findByCode(data.icd_code);
            if (codeTaken) {
                throw new Error("ICD code already exists");
            }
        }
        return repository.update(icdCodeId, {
            icd_code: data.icd_code,
            icd_version: data.icd_version,
            icd_description: data.icd_description,
            icd_category: data.icd_category,
            is_active: data.is_active,
            updated_by: updatedBy
        });
    }
    async deleteIcdCode(icdCodeId, updatedBy) {
        const existing = await repository.findById(icdCodeId);
        if (!existing) {
            throw new Error("ICD code not found");
        }
        return repository.update(icdCodeId, {
            is_active: false,
            updated_by: updatedBy
        });
    }
    async restoreIcdCode(icdCodeId, updatedBy) {
        const existing = await repository.findById(icdCodeId);
        if (!existing) {
            throw new Error("ICD code not found");
        }
        return repository.update(icdCodeId, {
            is_active: true,
            updated_by: updatedBy
        });
    }
}
exports.IcdCodeService = IcdCodeService;
