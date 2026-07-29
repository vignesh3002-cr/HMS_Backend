"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HydrationService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const hydration_repository_1 = require("./hydration.repository");
const repository = new hydration_repository_1.HydrationRepository();
class HydrationService {
    async createHydration(data, createdBy) {
        const existing = await repository.findByCode(data.hydration_code);
        if (existing) {
            throw new Error("Hydration code already exists");
        }
        if (data.linked_medicine_id) {
            const medicine = await repository.findLinkedMedicine(data.linked_medicine_id);
            if (!medicine) {
                throw new Error("Linked pharmacy medicine not found");
            }
        }
        return prisma_1.default.$transaction(async (tx) => {
            const hydrationId = await (0, idGenerator_1.generateId)(tx, "HYDRATION");
            return repository.create(tx, {
                hydration_id: hydrationId,
                hydration_code: data.hydration_code,
                fluid_name: data.fluid_name,
                fluid_type: data.fluid_type,
                standard_volume_ml: data.standard_volume_ml,
                infusion_rate: data.infusion_rate,
                timing: data.timing,
                indication: data.indication,
                linked_medicine_id: data.linked_medicine_id,
                created_by: createdBy
            });
        });
    }
    async getHydrations(query) {
        return repository.list(query);
    }
    async getHydrationById(hydrationId) {
        const record = await repository.findById(hydrationId);
        if (!record) {
            throw new Error("Hydration not found");
        }
        return record;
    }
    async updateHydration(hydrationId, data, updatedBy) {
        const existing = await repository.findById(hydrationId);
        if (!existing) {
            throw new Error("Hydration not found");
        }
        if (data.hydration_code && data.hydration_code !== existing.hydration_code) {
            const codeTaken = await repository.findByCode(data.hydration_code);
            if (codeTaken) {
                throw new Error("Hydration code already exists");
            }
        }
        if (data.linked_medicine_id) {
            const medicine = await repository.findLinkedMedicine(data.linked_medicine_id);
            if (!medicine) {
                throw new Error("Linked pharmacy medicine not found");
            }
        }
        return repository.update(hydrationId, {
            hydration_code: data.hydration_code,
            fluid_name: data.fluid_name,
            fluid_type: data.fluid_type,
            standard_volume_ml: data.standard_volume_ml,
            infusion_rate: data.infusion_rate,
            timing: data.timing,
            indication: data.indication,
            linked_medicine_id: data.linked_medicine_id,
            is_active: data.is_active,
            updated_by: updatedBy
        });
    }
    async deleteHydration(hydrationId, updatedBy) {
        const existing = await repository.findById(hydrationId);
        if (!existing) {
            throw new Error("Hydration not found");
        }
        return repository.update(hydrationId, {
            is_active: false,
            updated_by: updatedBy
        });
    }
    async restoreHydration(hydrationId, updatedBy) {
        const existing = await repository.findById(hydrationId);
        if (!existing) {
            throw new Error("Hydration not found");
        }
        return repository.update(hydrationId, {
            is_active: true,
            updated_by: updatedBy
        });
    }
}
exports.HydrationService = HydrationService;
