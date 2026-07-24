import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
import { IcdCodeRepository } from "./icdCode.repository";
import {
    CreateIcdCodeDto,
    UpdateIcdCodeDto,
    GetIcdCodesQuery
} from "./icdCode.types";

const repository = new IcdCodeRepository();

export class IcdCodeService {

    async createIcdCode(data: CreateIcdCodeDto, createdBy: string) {

        const existing = await repository.findByCode(data.icd_code);

        if (existing) {
            throw new Error("ICD code already exists");
        }

        return prisma.$transaction(async (tx) => {

            const icdCodeId = await generateId(tx, "ICD_CODE");

            return repository.create(tx, {

                icd_code_id: icdCodeId,

                icd_code: data.icd_code,

                icd_version: data.icd_version,

                icd_description: data.icd_description,

                icd_category: data.icd_category,

                created_by: createdBy

            });

        });

    }

    async getIcdCodes(query: GetIcdCodesQuery) {

        return repository.list(query);

    }

    async getIcdCodeById(icdCodeId: string) {

        const record = await repository.findById(icdCodeId);

        if (!record) {
            throw new Error("ICD code not found");
        }

        return record;

    }

    async updateIcdCode(
        icdCodeId: string,
        data: UpdateIcdCodeDto,
        updatedBy: string
    ) {

        const existing = await repository.findById(icdCodeId);

        if (!existing) {
            throw new Error("ICD code not found");
        }

        if (data.icd_code && data.icd_code !== existing.icd_code) {

            const codeTaken = await repository.findByCode(data.icd_code);

            if (codeTaken) {
                throw new Error("ICD code already exists");
            }

        }

        return repository.update(icdCodeId, {

            icd_code: data.icd_code,

            icd_version: data.icd_version,

            icd_description: data.icd_description,

            icd_category: data.icd_category,

            is_active: data.is_active,

            updated_by: updatedBy

        });

    }

    async deleteIcdCode(icdCodeId: string, updatedBy: string) {

        const existing = await repository.findById(icdCodeId);

        if (!existing) {
            throw new Error("ICD code not found");
        }

        return repository.update(icdCodeId, {
            is_active: false,
            updated_by: updatedBy
        });

    }

    async restoreIcdCode(icdCodeId: string, updatedBy: string) {

        const existing = await repository.findById(icdCodeId);

        if (!existing) {
            throw new Error("ICD code not found");
        }

        return repository.update(icdCodeId, {
            is_active: true,
            updated_by: updatedBy
        });

    }

}
