"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PremedicationService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const premedication_repository_1 = require("./premedication.repository");
const repository = new premedication_repository_1.PremedicationRepository();
class PremedicationService {
    async createPremedication(data, createdBy) {
        const existing = await repository.findByCode(data.premed_code);
        if (existing) {
            throw new Error("Premedication code already exists");
        }
        if (data.linked_medicine_id) {
            const medicine = await repository.findLinkedMedicine(data.linked_medicine_id);
            if (!medicine) {
                throw new Error("Linked pharmacy medicine not found");
            }
        }
        return prisma_1.default.$transaction(async (tx) => {
            const premedicationId = await (0, idGenerator_1.generateId)(tx, "PREMEDICATION");
            return repository.create(tx, {
                premedication_id: premedicationId,
                premed_code: data.premed_code,
                premed_name: data.premed_name,
                premed_category: data.premed_category,
                standard_dose: data.standard_dose,
                route: data.route,
                timing_before_chemo_minutes: data.timing_before_chemo_minutes,
                linked_medicine_id: data.linked_medicine_id,
                created_by: createdBy
            });
        });
    }
    async getPremedications(query) {
        return repository.list(query);
    }
    async getPremedicationById(premedicationId) {
        const record = await repository.findById(premedicationId);
        if (!record) {
            throw new Error("Premedication not found");
        }
        return record;
    }
    async updatePremedication(premedicationId, data, updatedBy) {
        const existing = await repository.findById(premedicationId);
        if (!existing) {
            throw new Error("Premedication not found");
        }
        if (data.premed_code && data.premed_code !== existing.premed_code) {
            const codeTaken = await repository.findByCode(data.premed_code);
            if (codeTaken) {
                throw new Error("Premedication code already exists");
            }
        }
        if (data.linked_medicine_id) {
            const medicine = await repository.findLinkedMedicine(data.linked_medicine_id);
            if (!medicine) {
                throw new Error("Linked pharmacy medicine not found");
            }
        }
        return repository.update(premedicationId, {
            premed_code: data.premed_code,
            premed_name: data.premed_name,
            premed_category: data.premed_category,
            standard_dose: data.standard_dose,
            route: data.route,
            timing_before_chemo_minutes: data.timing_before_chemo_minutes,
            linked_medicine_id: data.linked_medicine_id,
            is_active: data.is_active,
            updated_by: updatedBy
        });
    }
    async deletePremedication(premedicationId, updatedBy) {
        const existing = await repository.findById(premedicationId);
        if (!existing) {
            throw new Error("Premedication not found");
        }
        return repository.update(premedicationId, {
            is_active: false,
            updated_by: updatedBy
        });
    }
    async restorePremedication(premedicationId, updatedBy) {
        const existing = await repository.findById(premedicationId);
        if (!existing) {
            throw new Error("Premedication not found");
        }
        return repository.update(premedicationId, {
            is_active: true,
            updated_by: updatedBy
        });
    }
}
exports.PremedicationService = PremedicationService;
