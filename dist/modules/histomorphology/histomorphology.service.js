"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistomorphologyService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const histomorphology_repository_1 = require("./histomorphology.repository");
const repository = new histomorphology_repository_1.HistomorphologyRepository();
class HistomorphologyService {
    async createHistomorphology(data, createdBy) {
        const existing = await repository.findByCode(data.morphology_code);
        if (existing) {
            throw new Error("Morphology code already exists");
        }
        return prisma_1.default.$transaction(async (tx) => {
            const histomorphologyId = await (0, idGenerator_1.generateId)(tx, "HISTOMORPHOLOGY");
            return repository.create(tx, {
                histomorphology_id: histomorphologyId,
                morphology_code: data.morphology_code,
                morphology_name: data.morphology_name,
                behavior: data.behavior,
                description: data.description,
                created_by: createdBy
            });
        });
    }
    async getHistomorphologies(query) {
        return repository.list(query);
    }
    async getHistomorphologyById(histomorphologyId) {
        const record = await repository.findById(histomorphologyId);
        if (!record) {
            throw new Error("Histomorphology not found");
        }
        return record;
    }
    async updateHistomorphology(histomorphologyId, data, updatedBy) {
        const existing = await repository.findById(histomorphologyId);
        if (!existing) {
            throw new Error("Histomorphology not found");
        }
        if (data.morphology_code && data.morphology_code !== existing.morphology_code) {
            const codeTaken = await repository.findByCode(data.morphology_code);
            if (codeTaken) {
                throw new Error("Morphology code already exists");
            }
        }
        return repository.update(histomorphologyId, {
            morphology_code: data.morphology_code,
            morphology_name: data.morphology_name,
            behavior: data.behavior,
            description: data.description,
            is_active: data.is_active,
            updated_by: updatedBy
        });
    }
    async deleteHistomorphology(histomorphologyId, updatedBy) {
        const existing = await repository.findById(histomorphologyId);
        if (!existing) {
            throw new Error("Histomorphology not found");
        }
        return repository.update(histomorphologyId, {
            is_active: false,
            updated_by: updatedBy
        });
    }
    async restoreHistomorphology(histomorphologyId, updatedBy) {
        const existing = await repository.findById(histomorphologyId);
        if (!existing) {
            throw new Error("Histomorphology not found");
        }
        return repository.update(histomorphologyId, {
            is_active: true,
            updated_by: updatedBy
        });
    }
}
exports.HistomorphologyService = HistomorphologyService;
