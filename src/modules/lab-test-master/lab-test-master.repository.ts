import prisma from "../../config/prisma";
import {
    CreateLabTestMasterDto,
    UpdateLabTestMasterDto
} from "./lab-test-master.types";

class LabTestMasterRepository {

    async create(
        data: CreateLabTestMasterDto & {
            lab_test_id: string;
            branch_id?: string;
            user_id?: string;
        }
    ) {
        const { parameters, category_name, ...masterData } = data;

        return prisma.$transaction(async (tx) => {
            const created = await tx.lab_test_master.create({
                data: {
                    ...masterData,
                    lab_test_category_id: masterData.lab_test_category_id!,
                    price: masterData.price !== undefined && masterData.price !== null ? masterData.price : null,
                    walkin_price: masterData.walkin_price !== undefined && masterData.walkin_price !== null ? masterData.walkin_price : null,
                    tat_hours: masterData.tat_hours !== undefined && masterData.tat_hours !== null ? masterData.tat_hours : null,
                    tat_text: masterData.tat_text || null,
                    expiry_time_hours: masterData.expiry_time_hours !== undefined && masterData.expiry_time_hours !== null ? masterData.expiry_time_hours : 2,
                    test_status: masterData.test_status !== undefined && masterData.test_status !== null ? masterData.test_status : 1,
                    is_panel: masterData.is_panel ?? (Array.isArray(parameters) && parameters.length > 1),
                    is_outsourced: masterData.is_outsourced ?? false,
                    outsource_lab: masterData.outsource_lab || null,
                    result_type: masterData.result_type || null,
                }
            });

            if (Array.isArray(parameters) && parameters.length > 0) {
                for (let i = 0; i < parameters.length; i++) {
                    const p = parameters[i];
                    if (!p.parameter_name || !p.parameter_name.trim()) continue;

                    const paramId = p.lab_test_parameter_id && !p.lab_test_parameter_id.startsWith("param-")
                        ? p.lab_test_parameter_id
                        : `LTP${Date.now().toString().slice(-6)}${String(i + 1).padStart(3, "0")}`;

                    await tx.lab_test_parameter.create({
                        data: {
                            lab_test_parameter_id: paramId,
                            lab_test_id: created.lab_test_id,
                            parameter_name: p.parameter_name.trim(),
                            unit: p.unit || null,
                            ref_range_low: p.ref_range_low !== undefined && p.ref_range_low !== null ? p.ref_range_low : null,
                            ref_range_high: p.ref_range_high !== undefined && p.ref_range_high !== null ? p.ref_range_high : null,
                            ref_range_text: p.ref_range_text || null,
                            gender: p.gender || "Both",
                            critical_low: p.critical_low !== undefined && p.critical_low !== null ? p.critical_low : null,
                            critical_high: p.critical_high !== undefined && p.critical_high !== null ? p.critical_high : null,
                            remarks: p.remarks || null,
                            value_type: p.value_type || "NUMBER",
                            sort_order: p.sort_order ?? (i + 1),
                            age_min: p.age_min ?? null,
                            age_max: p.age_max ?? null,
                        }
                    });
                }
            }

            return tx.lab_test_master.findUnique({
                where: {
                    lab_test_id: created.lab_test_id
                },
                include: {
                    lab_test_category: true,
                    lab_test_parameter: {
                        orderBy: { sort_order: "asc" }
                    }
                }
            });
        });
    }

    async findById(lab_test_id: string) {
        return prisma.lab_test_master.findUnique({
            where: {
                lab_test_id
            },
            include: {
                lab_test_category: true,
                lab_test_parameter: {
                    orderBy: { sort_order: "asc" }
                }
            }
        });
    }

    async findByCode(test_code: string) {
        return prisma.lab_test_master.findUnique({
            where: {
                test_code
            }
        });
    }

    async findByName(test_name: string) {
        return prisma.lab_test_master.findFirst({
            where: {
                test_name: {
                    equals: test_name,
                    mode: "insensitive"
                }
            }
        });
    }

    async findCategory(lab_test_category_id: string) {
        return prisma.lab_test_category.findUnique({
            where: {
                lab_test_category_id
            }
        });
    }

    async findAllParameters() {
        return prisma.lab_test_parameter.findMany({
            include: {
                lab_test_master: {
                    select: {
                        test_name: true,
                        test_code: true,
                        unit: true,
                        reference_range: true,
                        sample_type: true
                    }
                }
            },
            orderBy: [
                { lab_test_id: "asc" },
                { sort_order: "asc" }
            ]
        });
    }

    async findAll() {
        return prisma.lab_test_master.findMany({
            include: {
                lab_test_category: true,
                lab_test_parameter: {
                    orderBy: { sort_order: "asc" }
                }
            },
            orderBy: {
                created_at: "desc"
            }
        });
    }

    async update(
        lab_test_id: string,
        data: UpdateLabTestMasterDto
    ) {
        const { parameters, category_name, ...masterData } = data;

        return prisma.$transaction(async (tx) => {
            const updateFields: any = {
                updated_at: new Date()
            };

            if (masterData.lab_test_category_id !== undefined) updateFields.lab_test_category_id = masterData.lab_test_category_id;
            if (masterData.test_name !== undefined) updateFields.test_name = masterData.test_name.trim();
            if (masterData.test_code !== undefined) updateFields.test_code = masterData.test_code.trim().toUpperCase();
            if (masterData.sample_type !== undefined) updateFields.sample_type = masterData.sample_type;
            if (masterData.required_volume !== undefined) updateFields.required_volume = masterData.required_volume;
            if (masterData.unit !== undefined) updateFields.unit = masterData.unit;
            if (masterData.reference_range !== undefined) updateFields.reference_range = masterData.reference_range;
            if (masterData.price !== undefined) updateFields.price = masterData.price;
            if (masterData.tat_hours !== undefined) updateFields.tat_hours = masterData.tat_hours;
            if (masterData.tat_text !== undefined) updateFields.tat_text = masterData.tat_text;
            if (masterData.expiry_time_hours !== undefined) updateFields.expiry_time_hours = masterData.expiry_time_hours;
            if (masterData.test_status !== undefined) updateFields.test_status = masterData.test_status;
            if (masterData.is_panel !== undefined) updateFields.is_panel = masterData.is_panel;
            if (masterData.includes_details !== undefined) updateFields.includes_details = masterData.includes_details;
            if (masterData.is_outsourced !== undefined) updateFields.is_outsourced = masterData.is_outsourced;
            if (masterData.outsource_lab !== undefined) updateFields.outsource_lab = masterData.outsource_lab;
            if (masterData.result_type !== undefined) updateFields.result_type = masterData.result_type;
            if (masterData.walkin_price !== undefined) updateFields.walkin_price = masterData.walkin_price;

            if (Array.isArray(parameters) && parameters.length > 1) {
                updateFields.is_panel = true;
            }

            await tx.lab_test_master.update({
                where: {
                    lab_test_id
                },
                data: updateFields
            });

            if (Array.isArray(parameters)) {
                const existingParams = await tx.lab_test_parameter.findMany({
                    where: { lab_test_id }
                });

                const handledIds = new Set<string>();

                for (let i = 0; i < parameters.length; i++) {
                    const p = parameters[i];
                    if (!p.parameter_name || !p.parameter_name.trim()) continue;

                    const matched = existingParams.find(
                        (ep) =>
                            (p.lab_test_parameter_id && ep.lab_test_parameter_id === p.lab_test_parameter_id) ||
                            ep.parameter_name.toLowerCase().trim() === p.parameter_name.toLowerCase().trim()
                    );

                    if (matched) {
                        await tx.lab_test_parameter.update({
                            where: { lab_test_parameter_id: matched.lab_test_parameter_id },
                            data: {
                                parameter_name: p.parameter_name.trim(),
                                unit: p.unit || null,
                                ref_range_low: p.ref_range_low !== undefined && p.ref_range_low !== null ? p.ref_range_low : null,
                                ref_range_high: p.ref_range_high !== undefined && p.ref_range_high !== null ? p.ref_range_high : null,
                                ref_range_text: p.ref_range_text || null,
                                gender: p.gender || "Both",
                                critical_low: p.critical_low !== undefined && p.critical_low !== null ? p.critical_low : null,
                                critical_high: p.critical_high !== undefined && p.critical_high !== null ? p.critical_high : null,
                                remarks: p.remarks || null,
                                value_type: p.value_type || "NUMBER",
                                sort_order: p.sort_order ?? (i + 1),
                                updated_at: new Date()
                            }
                        });
                        handledIds.add(matched.lab_test_parameter_id);
                    } else {
                        const newParamId = (p.lab_test_parameter_id && !p.lab_test_parameter_id.startsWith("param-"))
                            ? p.lab_test_parameter_id
                            : `LTP${Date.now().toString().slice(-6)}${String(i + 1).padStart(3, "0")}`;

                        const created = await tx.lab_test_parameter.create({
                            data: {
                                lab_test_parameter_id: newParamId,
                                lab_test_id,
                                parameter_name: p.parameter_name.trim(),
                                unit: p.unit || null,
                                ref_range_low: p.ref_range_low !== undefined && p.ref_range_low !== null ? p.ref_range_low : null,
                                ref_range_high: p.ref_range_high !== undefined && p.ref_range_high !== null ? p.ref_range_high : null,
                                ref_range_text: p.ref_range_text || null,
                                gender: p.gender || "Both",
                                critical_low: p.critical_low !== undefined && p.critical_low !== null ? p.critical_low : null,
                                critical_high: p.critical_high !== undefined && p.critical_high !== null ? p.critical_high : null,
                                remarks: p.remarks || null,
                                value_type: p.value_type || "NUMBER",
                                sort_order: p.sort_order ?? (i + 1),
                            }
                        });
                        handledIds.add(created.lab_test_parameter_id);
                    }
                }

                // Clean up removed parameters if safe (not referenced by lab_result)
                const toRemove = existingParams.filter((ep) => !handledIds.has(ep.lab_test_parameter_id));
                for (const oldP of toRemove) {
                    const referencedInResult = await tx.lab_result.findFirst({
                        where: { lab_test_parameter_id: oldP.lab_test_parameter_id }
                    });
                    if (!referencedInResult) {
                        await tx.lab_test_parameter.delete({
                            where: { lab_test_parameter_id: oldP.lab_test_parameter_id }
                        });
                    }
                }
            }

            return tx.lab_test_master.findUnique({
                where: {
                    lab_test_id
                },
                include: {
                    lab_test_category: true,
                    lab_test_parameter: {
                        orderBy: { sort_order: "asc" }
                    }
                }
            });
        });
    }

    async delete(lab_test_id: string) {
        return prisma.lab_test_master.delete({
            where: {
                lab_test_id
            }
        });
    }

}

export default new LabTestMasterRepository();
