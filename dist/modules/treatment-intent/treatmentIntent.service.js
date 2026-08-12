"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreatmentIntentService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const treatmentIntent_repository_1 = require("./treatmentIntent.repository");
const repository = new treatmentIntent_repository_1.TreatmentIntentRepository();
class TreatmentIntentService {
    async createTreatmentIntent(data, createdBy) {
        const existing = await repository.findByCode(data.intent_code);
        if (existing) {
            throw new Error("Intent code already exists");
        }
        return prisma_1.default.$transaction(async (tx) => {
            const treatmentIntentId = await (0, idGenerator_1.generateId)(tx, "TREATMENT_INTENT");
            return repository.create(tx, {
                treatment_intent_id: treatmentIntentId,
                intent_code: data.intent_code,
                intent_name: data.intent_name,
                description: data.description,
                created_by: createdBy
            });
        });
    }
    async getTreatmentIntents(query) {
        return repository.list(query);
    }
    async getTreatmentIntentById(treatmentIntentId) {
        const record = await repository.findById(treatmentIntentId);
        if (!record) {
            throw new Error("Treatment intent not found");
        }
        return record;
    }
    async updateTreatmentIntent(treatmentIntentId, data, updatedBy) {
        const existing = await repository.findById(treatmentIntentId);
        if (!existing) {
            throw new Error("Treatment intent not found");
        }
        if (data.intent_code && data.intent_code !== existing.intent_code) {
            const codeTaken = await repository.findByCode(data.intent_code);
            if (codeTaken) {
                throw new Error("Intent code already exists");
            }
        }
        return repository.update(treatmentIntentId, {
            intent_code: data.intent_code,
            intent_name: data.intent_name,
            description: data.description,
            is_active: data.is_active,
            updated_by: updatedBy
        });
    }
    async deleteTreatmentIntent(treatmentIntentId, updatedBy) {
        const existing = await repository.findById(treatmentIntentId);
        if (!existing) {
            throw new Error("Treatment intent not found");
        }
        return repository.update(treatmentIntentId, {
            is_active: false,
            updated_by: updatedBy
        });
    }
    async restoreTreatmentIntent(treatmentIntentId, updatedBy) {
        const existing = await repository.findById(treatmentIntentId);
        if (!existing) {
            throw new Error("Treatment intent not found");
        }
        return repository.update(treatmentIntentId, {
            is_active: true,
            updated_by: updatedBy
        });
    }
}
exports.TreatmentIntentService = TreatmentIntentService;
