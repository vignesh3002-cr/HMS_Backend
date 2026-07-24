import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
import { TreatmentIntentRepository } from "./treatmentIntent.repository";
import {
    CreateTreatmentIntentDto,
    UpdateTreatmentIntentDto,
    GetTreatmentIntentsQuery
} from "./treatmentIntent.types";

const repository = new TreatmentIntentRepository();

export class TreatmentIntentService {

    async createTreatmentIntent(data: CreateTreatmentIntentDto, createdBy: string) {

        const existing = await repository.findByCode(data.intent_code);

        if (existing) {
            throw new Error("Intent code already exists");
        }

        return prisma.$transaction(async (tx) => {

            const treatmentIntentId = await generateId(tx, "TREATMENT_INTENT");

            return repository.create(tx, {

                treatment_intent_id: treatmentIntentId,

                intent_code: data.intent_code,

                intent_name: data.intent_name,

                description: data.description,

                created_by: createdBy

            });

        });

    }

    async getTreatmentIntents(query: GetTreatmentIntentsQuery) {

        return repository.list(query);

    }

    async getTreatmentIntentById(treatmentIntentId: string) {

        const record = await repository.findById(treatmentIntentId);

        if (!record) {
            throw new Error("Treatment intent not found");
        }

        return record;

    }

    async updateTreatmentIntent(
        treatmentIntentId: string,
        data: UpdateTreatmentIntentDto,
        updatedBy: string
    ) {

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

    async deleteTreatmentIntent(treatmentIntentId: string, updatedBy: string) {

        const existing = await repository.findById(treatmentIntentId);

        if (!existing) {
            throw new Error("Treatment intent not found");
        }

        return repository.update(treatmentIntentId, {
            is_active: false,
            updated_by: updatedBy
        });

    }

    async restoreTreatmentIntent(treatmentIntentId: string, updatedBy: string) {

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
