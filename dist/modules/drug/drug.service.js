"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DrugService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const drug_repository_1 = require("./drug.repository");
const repository = new drug_repository_1.DrugRepository();
class DrugService {
    async createDrug(data, createdBy) {
        const existing = await repository.findByCode(data.drug_code);
        if (existing) {
            throw new Error("Drug code already exists");
        }
        // Reuse existing Pharmacy medicine_master instead of duplicating stock data
        if (data.linked_medicine_id) {
            const medicine = await repository.findLinkedMedicine(data.linked_medicine_id);
            if (!medicine) {
                throw new Error("Linked pharmacy medicine not found");
            }
        }
        return prisma_1.default.$transaction(async (tx) => {
            const drugId = await (0, idGenerator_1.generateId)(tx, "CHEMO_DRUG");
            return repository.create(tx, {
                drug_id: drugId,
                drug_code: data.drug_code,
                drug_name: data.drug_name,
                generic_name: data.generic_name,
                brand_name: data.brand_name,
                drug_class: data.drug_class,
                vesicant_status: data.vesicant_status,
                administration_route: data.administration_route,
                standard_unit: data.standard_unit,
                max_dose_per_cycle: data.max_dose_per_cycle,
                storage_condition: data.storage_condition,
                is_high_alert: data.is_high_alert,
                linked_medicine_id: data.linked_medicine_id,
                created_by: createdBy
            });
        });
    }
    async getDrugs(query) {
        return repository.list(query);
    }
    async getDrugById(drugId) {
        const record = await repository.findById(drugId);
        if (!record) {
            throw new Error("Drug not found");
        }
        return record;
    }
    async updateDrug(drugId, data, updatedBy) {
        const existing = await repository.findById(drugId);
        if (!existing) {
            throw new Error("Drug not found");
        }
        if (data.drug_code && data.drug_code !== existing.drug_code) {
            const codeTaken = await repository.findByCode(data.drug_code);
            if (codeTaken) {
                throw new Error("Drug code already exists");
            }
        }
        if (data.linked_medicine_id) {
            const medicine = await repository.findLinkedMedicine(data.linked_medicine_id);
            if (!medicine) {
                throw new Error("Linked pharmacy medicine not found");
            }
        }
        return repository.update(drugId, {
            drug_code: data.drug_code,
            drug_name: data.drug_name,
            generic_name: data.generic_name,
            brand_name: data.brand_name,
            drug_class: data.drug_class,
            vesicant_status: data.vesicant_status,
            administration_route: data.administration_route,
            standard_unit: data.standard_unit,
            max_dose_per_cycle: data.max_dose_per_cycle,
            storage_condition: data.storage_condition,
            is_high_alert: data.is_high_alert,
            linked_medicine_id: data.linked_medicine_id,
            is_active: data.is_active,
            updated_by: updatedBy
        });
    }
    async deleteDrug(drugId, updatedBy) {
        const existing = await repository.findById(drugId);
        if (!existing) {
            throw new Error("Drug not found");
        }
        return repository.update(drugId, {
            is_active: false,
            updated_by: updatedBy
        });
    }
    async restoreDrug(drugId, updatedBy) {
        const existing = await repository.findById(drugId);
        if (!existing) {
            throw new Error("Drug not found");
        }
        return repository.update(drugId, {
            is_active: true,
            updated_by: updatedBy
        });
    }
}
exports.DrugService = DrugService;
