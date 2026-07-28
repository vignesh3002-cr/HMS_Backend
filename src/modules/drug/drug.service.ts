import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
import { DrugRepository } from "./drug.repository";
import {
    CreateDrugDto,
    UpdateDrugDto,
    GetDrugsQuery
} from "./drug.types";

const repository = new DrugRepository();

export class DrugService {

    async createDrug(data: CreateDrugDto, createdBy: string) {

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

        return prisma.$transaction(async (tx) => {

            const drugId = await generateId(tx, "CHEMO_DRUG");

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

    async getDrugs(query: GetDrugsQuery) {

        return repository.list(query);

    }

    async getDrugById(drugId: string) {

        const record = await repository.findById(drugId);

        if (!record) {
            throw new Error("Drug not found");
        }

        return record;

    }

    async updateDrug(drugId: string, data: UpdateDrugDto, updatedBy: string) {

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

    async deleteDrug(drugId: string, updatedBy: string) {

        const existing = await repository.findById(drugId);

        if (!existing) {
            throw new Error("Drug not found");
        }

        return repository.update(drugId, {
            is_active: false,
            updated_by: updatedBy
        });

    }

    async restoreDrug(drugId: string, updatedBy: string) {

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
