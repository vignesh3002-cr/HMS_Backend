import repository from "./lab-test-category.repository";
import {
    CreateLabTestCategoryDto,
    UpdateLabTestCategoryDto
} from "./lab-test-category.types";

export class LabTestCategoryService {

    async create(data: CreateLabTestCategoryDto) {

        // Check duplicate code
        const codeExists = await repository.findByCode(data.category_code);

        if (codeExists) {
            throw new Error("Category Code already exists");
        }

        // Check duplicate name
        const nameExists = await repository.findByName(data.category_name);

        if (nameExists) {
            throw new Error("Category Name already exists");
        }

        // Generate Category ID
        const lab_test_category_id = `LTC${Date.now()}`;

        return repository.create({
            ...data,
            lab_test_category_id
        });

    }

    async getAll() {
        return repository.findAll();
    }

    async getById(id: string) {

        const category = await repository.findById(id);

        if (!category) {
            throw new Error("Category not found");
        }

        return category;
    }

    async update(
        id: string,
        data: UpdateLabTestCategoryDto
    ) {

        await this.getById(id);

        return repository.update(id, data);

    }

    async delete(id: string) {

        await this.getById(id);

        return repository.delete(id);

    }

}

export default new LabTestCategoryService();