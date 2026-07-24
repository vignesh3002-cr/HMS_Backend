import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
import { HistomorphologyRepository } from "./histomorphology.repository";
import {
    CreateHistomorphologyDto,
    UpdateHistomorphologyDto,
    GetHistomorphologiesQuery
} from "./histomorphology.types";

const repository = new HistomorphologyRepository();

export class HistomorphologyService {

    async createHistomorphology(data: CreateHistomorphologyDto, createdBy: string) {

        const existing = await repository.findByCode(data.morphology_code);

        if (existing) {
            throw new Error("Morphology code already exists");
        }

        return prisma.$transaction(async (tx) => {

            const histomorphologyId = await generateId(tx, "HISTOMORPHOLOGY");

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

    async getHistomorphologies(query: GetHistomorphologiesQuery) {

        return repository.list(query);

    }

    async getHistomorphologyById(histomorphologyId: string) {

        const record = await repository.findById(histomorphologyId);

        if (!record) {
            throw new Error("Histomorphology not found");
        }

        return record;

    }

    async updateHistomorphology(
        histomorphologyId: string,
        data: UpdateHistomorphologyDto,
        updatedBy: string
    ) {

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

    async deleteHistomorphology(histomorphologyId: string, updatedBy: string) {

        const existing = await repository.findById(histomorphologyId);

        if (!existing) {
            throw new Error("Histomorphology not found");
        }

        return repository.update(histomorphologyId, {
            is_active: false,
            updated_by: updatedBy
        });

    }

    async restoreHistomorphology(histomorphologyId: string, updatedBy: string) {

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
