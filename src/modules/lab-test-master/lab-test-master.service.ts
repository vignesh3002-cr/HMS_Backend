import repository from "./lab-test-master.repository";
import prisma from "../../config/prisma";
import {
    CreateLabTestMasterDto,
    UpdateLabTestMasterDto
} from "./lab-test-master.types";

class LabTestMasterService {

    async resolveCategoryId(categoryId?: string, categoryName?: string): Promise<string> {
        if (categoryId) {
            const existingCat = await repository.findCategory(categoryId);
            if (existingCat) return existingCat.lab_test_category_id;
        }

        const nameToFind = (categoryName || "").trim();
        if (nameToFind) {
            const foundByName = await prisma.lab_test_category.findFirst({
                where: {
                    category_name: {
                        equals: nameToFind,
                        mode: "insensitive"
                    }
                }
            });
            if (foundByName) return foundByName.lab_test_category_id;

            // Partial match
            const partialMatch = await prisma.lab_test_category.findFirst({
                where: {
                    category_name: {
                        contains: nameToFind,
                        mode: "insensitive"
                    }
                }
            });
            if (partialMatch) return partialMatch.lab_test_category_id;

            // Create new category if not found
            const newCatId = `LTC${Date.now()}`;
            const created = await prisma.lab_test_category.create({
                data: {
                    lab_test_category_id: newCatId,
                    category_name: nameToFind,
                    category_code: nameToFind.substring(0, 4).toUpperCase(),
                    category_status: 1
                }
            });
            return created.lab_test_category_id;
        }

        // Fallback to any existing category
        const anyCat = await prisma.lab_test_category.findFirst();
        if (anyCat) return anyCat.lab_test_category_id;

        // Otherwise create default
        const defaultCat = await prisma.lab_test_category.create({
            data: {
                lab_test_category_id: `LTC${Date.now()}`,
                category_name: "General Diagnostics",
                category_code: "GEN",
                category_status: 1
            }
        });
        return defaultCat.lab_test_category_id;
    }

    async create(
        data: CreateLabTestMasterDto,
        authContext?: { branch_id?: string; user_id?: string }
    ) {
        const resolvedCategoryId = await this.resolveCategoryId(
            data.lab_test_category_id,
            data.category_name
        );

        // Check Duplicate Test Code
        const code = await repository.findByCode(data.test_code.trim());
        if (code) {
            throw new Error(`Test Code "${data.test_code}" already exists`);
        }

        // Check Duplicate Test Name
        const name = await repository.findByName(data.test_name.trim());
        if (name) {
            throw new Error(`Test Name "${data.test_name}" already exists`);
        }

        // Generate Lab Test ID
        const lab_test_id = `LT${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;

        return repository.create({
            ...data,
            lab_test_category_id: resolvedCategoryId,
            lab_test_id,
            branch_id: authContext?.branch_id,
            user_id: authContext?.user_id
        });
    }

    async getAllParameters() {
        return repository.findAllParameters();
    }

    async getAll() {
        return repository.findAll();
    }

    async getById(id: string) {
        const test = await repository.findById(id);
        if (!test) {
            throw new Error("Lab Test not found");
        }
        return test;
    }

    async update(
        id: string,
        data: UpdateLabTestMasterDto
    ) {
        const existing = await this.getById(id);

        if (data.test_code && data.test_code.trim().toUpperCase() !== existing.test_code.toUpperCase()) {
            const code = await repository.findByCode(data.test_code.trim());
            if (code && code.lab_test_id !== id) {
                throw new Error(`Test Code "${data.test_code}" is already in use by another test`);
            }
        }

        if (data.test_name && data.test_name.trim().toLowerCase() !== existing.test_name.toLowerCase()) {
            const name = await repository.findByName(data.test_name.trim());
            if (name && name.lab_test_id !== id) {
                throw new Error(`Test Name "${data.test_name}" is already in use by another test`);
            }
        }

        let resolvedCategoryId = data.lab_test_category_id;
        if (data.category_name || data.lab_test_category_id) {
            resolvedCategoryId = await this.resolveCategoryId(
                data.lab_test_category_id,
                data.category_name
            );
        }

        return repository.update(id, {
            ...data,
            lab_test_category_id: resolvedCategoryId
        });
    }

    async delete(id: string) {
        await this.getById(id);
        return repository.delete(id);
    }

}

export default new LabTestMasterService();
