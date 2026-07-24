import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
import { HydrationRepository } from "./hydration.repository";
import {
    CreateHydrationDto,
    UpdateHydrationDto,
    GetHydrationsQuery
} from "./hydration.types";

const repository = new HydrationRepository();

export class HydrationService {

    async createHydration(data: CreateHydrationDto, createdBy: string) {

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

        return prisma.$transaction(async (tx) => {

            const hydrationId = await generateId(tx, "HYDRATION");

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

    async getHydrations(query: GetHydrationsQuery) {

        return repository.list(query);

    }

    async getHydrationById(hydrationId: string) {

        const record = await repository.findById(hydrationId);

        if (!record) {
            throw new Error("Hydration not found");
        }

        return record;

    }

    async updateHydration(
        hydrationId: string,
        data: UpdateHydrationDto,
        updatedBy: string
    ) {

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

    async deleteHydration(hydrationId: string, updatedBy: string) {

        const existing = await repository.findById(hydrationId);

        if (!existing) {
            throw new Error("Hydration not found");
        }

        return repository.update(hydrationId, {
            is_active: false,
            updated_by: updatedBy
        });

    }

    async restoreHydration(hydrationId: string, updatedBy: string) {

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
