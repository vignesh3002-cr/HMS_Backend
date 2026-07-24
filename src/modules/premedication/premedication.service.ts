import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
import { PremedicationRepository } from "./premedication.repository";
import {
    CreatePremedicationDto,
    UpdatePremedicationDto,
    GetPremedicationsQuery
} from "./premedication.types";

const repository = new PremedicationRepository();

export class PremedicationService {

    async createPremedication(data: CreatePremedicationDto, createdBy: string) {

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

        return prisma.$transaction(async (tx) => {

            const premedicationId = await generateId(tx, "PREMEDICATION");

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

    async getPremedications(query: GetPremedicationsQuery) {

        return repository.list(query);

    }

    async getPremedicationById(premedicationId: string) {

        const record = await repository.findById(premedicationId);

        if (!record) {
            throw new Error("Premedication not found");
        }

        return record;

    }

    async updatePremedication(
        premedicationId: string,
        data: UpdatePremedicationDto,
        updatedBy: string
    ) {

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

    async deletePremedication(premedicationId: string, updatedBy: string) {

        const existing = await repository.findById(premedicationId);

        if (!existing) {
            throw new Error("Premedication not found");
        }

        return repository.update(premedicationId, {
            is_active: false,
            updated_by: updatedBy
        });

    }

    async restorePremedication(premedicationId: string, updatedBy: string) {

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
