    import prisma from "../../config/prisma";
    import { generateId } from "../../utils/idGenerator";
    import { CancerTypeRepository } from "./cancerType.repository";
    import {
        CreateCancerTypeDto,
        UpdateCancerTypeDto,
        GetCancerTypesQuery
    } from "./cancerType.types";

    const repository = new CancerTypeRepository();

    export class CancerTypeService {

        async createCancerType(data: CreateCancerTypeDto, createdBy: string) {

            const existing = await repository.findByName(data.cancer_type_name);

            if (existing) {
                throw new Error("Cancer type code already exists");
            }

            return prisma.$transaction(async (tx) => {

                const cancerTypeId = await generateId(tx, "CANCER_TYPE");
                const cancerTypeCode = `CAN${Date.now()}`;

                const cancerType = await repository.create(tx, {

                    cancer_type_id: cancerTypeId,

                    cancer_type_code: cancerTypeCode,

                    cancer_type_name: data.cancer_type_name,

                    cancer_category: data.cancer_category,

                    icd_o3_code: data.icd_o3_code,

                    description: data.description,

                    created_by: createdBy

                });

                return cancerType;

            });

        }

        async getCancerTypes(query: GetCancerTypesQuery) {

            return repository.list(query);

        }

        async getCancerTypeById(cancerTypeId: string) {

            const cancerType = await repository.findById(cancerTypeId);

            if (!cancerType) {
                throw new Error("Cancer type not found");
            }

            return cancerType;

        }

        async updateCancerType(
            cancerTypeId: string,
            data: UpdateCancerTypeDto,
            updatedBy: string
        ) {

            const existing = await repository.findById(cancerTypeId);

            if (!existing) {
                throw new Error("Cancer type not found");
            }

            if (
                data.cancer_type_code &&
                data.cancer_type_code !== existing.cancer_type_code
            ) {

                const codeTaken = await repository.findByCode(data.cancer_type_code);

                if (codeTaken) {
                    throw new Error("Cancer type code already exists");
                }

            }

            return repository.update(cancerTypeId, {

                cancer_type_code: data.cancer_type_code,

                cancer_type_name: data.cancer_type_name,

                cancer_category: data.cancer_category,

                icd_o3_code: data.icd_o3_code,

                description: data.description,

                is_active: data.is_active,

                updated_by: updatedBy

            } as any);

        }

        async deleteCancerType(cancerTypeId: string, updatedBy: string) {

            const existing = await repository.findById(cancerTypeId);

            if (!existing) {
                throw new Error("Cancer type not found");
            }

            return repository.update(cancerTypeId, {
                is_active: false,
                updated_by: updatedBy
            } as any);

        }

        async restoreCancerType(cancerTypeId: string, updatedBy: string) {

            const existing = await repository.findById(cancerTypeId);

            if (!existing) {
                throw new Error("Cancer type not found");
            }

            return repository.update(cancerTypeId, {
                is_active: true,
                updated_by: updatedBy
            } as any);

        }

    }
