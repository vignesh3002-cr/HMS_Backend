import repository from "./lab-test-master.repository";

import {
    CreateLabTestMasterDto,
    UpdateLabTestMasterDto
} from "./lab-test-master.types";

class LabTestMasterService {

    async create(data: CreateLabTestMasterDto) {

        // Check Category
        const category = await repository.findCategory(
            data.lab_test_category_id
        );

        if (!category) {
            throw new Error("Lab Test Category not found");
        }

        // Check Duplicate Test Code
        const code = await repository.findByCode(data.test_code);

        if (code) {
            throw new Error("Test Code already exists");
        }

        // Check Duplicate Test Name
        const name = await repository.findByName(data.test_name);

        if (name) {
            throw new Error("Test Name already exists");
        }

        // Generate Lab Test ID
        const lab_test_id = `LABTEST${Date.now()}`;

        return repository.create({
            ...data,
            lab_test_id
        });

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

        await this.getById(id);

        return repository.update(id, data);

    }

    async delete(id: string) {

        await this.getById(id);

        return repository.delete(id);

    }

}

export default new LabTestMasterService();