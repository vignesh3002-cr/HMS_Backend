"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabResultRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class LabResultRepository {
    async findByOrderItemId(lab_order_item_id) {
        return prisma_1.default.lab_result.findMany({
            where: { lab_order_item_id },
            include: {
                lab_test_parameter: true,
                sample_collection: true,
                employees: {
                    select: {
                        employee_id: true,
                        first_name: true,
                        last_name: true,
                        designation: true
                    }
                }
            },
            orderBy: { id: "asc" }
        });
    }
    async findById(lab_result_id) {
        return prisma_1.default.lab_result.findUnique({
            where: { lab_result_id },
            include: {
                lab_test_parameter: true,
                sample_collection: true
            }
        });
    }
    async create(data) {
        // Validate verified_by foreign key against employees table
        let validVerifiedBy = null;
        if (data.verified_by) {
            const emp = await prisma_1.default.employees.findFirst({
                where: {
                    OR: [
                        { employee_id: data.verified_by },
                        { first_name: { equals: data.verified_by, mode: "insensitive" } }
                    ]
                },
                select: { employee_id: true }
            });
            if (emp)
                validVerifiedBy = emp.employee_id;
        }
        // Validate lab_test_parameter_id foreign key against lab_test_parameter table
        let validParamId = null;
        if (data.lab_test_parameter_id) {
            const p = await prisma_1.default.lab_test_parameter.findUnique({
                where: { lab_test_parameter_id: data.lab_test_parameter_id },
                select: { lab_test_parameter_id: true }
            });
            if (p)
                validParamId = p.lab_test_parameter_id;
        }
        return prisma_1.default.lab_result.create({
            data: {
                lab_result_id: data.lab_result_id,
                sample_collection_id: data.sample_collection_id,
                lab_order_item_id: data.lab_order_item_id,
                parameter_name: data.parameter_name,
                result_value: data.result_value ?? null,
                abnormal_flag: data.abnormal_flag ?? "NORMAL",
                result_comment: data.result_comment ?? null,
                verified_by: validVerifiedBy,
                verified_datetime: data.verified_datetime ?? new Date(),
                result_status: data.result_status ?? "Completed",
                lab_test_parameter_id: validParamId,
                lab_report_id: data.lab_report_id ?? null,
                branch_id: data.branch_id ?? null,
                user_id: data.user_id ?? null
            }
        });
    }
    async update(lab_result_id, data) {
        return prisma_1.default.lab_result.update({
            where: { lab_result_id },
            data
        });
    }
    async batchSave(payload) {
        const { lab_order_item_id, barcode, sample_type, parameters, comments, markCompleted = false, verified_by, branch_id, user_id } = payload;
        // 1. Fetch the target lab order item (support prefix stripping or numeric id fallback)
        let targetId = lab_order_item_id;
        if (targetId.startsWith("item-")) {
            targetId = targetId.replace("item-", "");
        }
        let orderItem = await prisma_1.default.lab_order_item.findUnique({
            where: { lab_order_item_id: targetId },
            include: {
                sample_collection: true,
                lab_test_master: true
            }
        });
        if (!orderItem && !isNaN(Number(targetId))) {
            orderItem = await prisma_1.default.lab_order_item.findFirst({
                where: { id: Number(targetId) },
                include: {
                    sample_collection: true,
                    lab_test_master: true
                }
            });
        }
        if (!orderItem) {
            throw new Error(`Lab order item with ID ${lab_order_item_id} not found.`);
        }
        const resolvedOrderItemId = orderItem.lab_order_item_id;
        // 2. Ensure sample_collection exists (required foreign key in lab_result)
        let sampleCollection = orderItem.sample_collection?.[0];
        if (!sampleCollection) {
            const generatedBarcode = barcode ||
                (orderItem.remarks?.match(/Barcode:\s*([A-Za-z0-9_-]+)/i)?.[1]) ||
                `BC${Date.now().toString().slice(-8)}`;
            // Reuse existing collection if barcode is already present in DB
            const existingCollection = await prisma_1.default.sample_collection.findFirst({
                where: { barcode: generatedBarcode }
            });
            if (existingCollection) {
                sampleCollection = existingCollection;
            }
            else {
                sampleCollection = await prisma_1.default.sample_collection.create({
                    data: {
                        sample_collection_id: `SC${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                        lab_order_item_id: resolvedOrderItemId,
                        barcode: generatedBarcode,
                        container_type: sample_type || orderItem.lab_test_master?.sample_type || "Standard Specimen",
                        collection_status: "Collected",
                        remarks: `Barcode: ${generatedBarcode}`,
                        branch_id: branch_id || orderItem.branch_id || null,
                        user_id: user_id || orderItem.user_id || null
                    }
                });
            }
        }
        // 3. Foreign key validation for verified_by
        let validVerifiedBy = null;
        if (verified_by) {
            const emp = await prisma_1.default.employees.findFirst({
                where: {
                    OR: [
                        { employee_id: verified_by },
                        { first_name: { equals: verified_by, mode: "insensitive" } }
                    ]
                },
                select: { employee_id: true }
            });
            if (emp)
                validVerifiedBy = emp.employee_id;
        }
        // 4. Foreign key validation for lab_test_parameter_id
        const incomingParamIds = parameters
            .map((p) => p.lab_test_parameter_id)
            .filter((id) => Boolean(id && !id.startsWith("single-") && !id.startsWith("ts-")));
        const existingDbParams = incomingParamIds.length > 0
            ? await prisma_1.default.lab_test_parameter.findMany({
                where: { lab_test_parameter_id: { in: incomingParamIds } },
                select: { lab_test_parameter_id: true }
            })
            : [];
        const validParamIdSet = new Set(existingDbParams.map((p) => p.lab_test_parameter_id));
        // 5. Find existing lab_results for this order item
        const existingResults = await prisma_1.default.lab_result.findMany({
            where: { lab_order_item_id: resolvedOrderItemId }
        });
        const savedResults = [];
        const timestamp = new Date();
        const resultStatus = markCompleted ? "Completed" : "Pending";
        for (const param of parameters) {
            const validatedParamId = param.lab_test_parameter_id && validParamIdSet.has(param.lab_test_parameter_id)
                ? param.lab_test_parameter_id
                : null;
            // Match existing by lab_test_parameter_id or parameter_name
            const existing = existingResults.find((r) => (validatedParamId && r.lab_test_parameter_id === validatedParamId) ||
                r.parameter_name.toLowerCase().trim() === param.parameter_name.toLowerCase().trim());
            if (existing) {
                const updated = await prisma_1.default.lab_result.update({
                    where: { lab_result_id: existing.lab_result_id },
                    data: {
                        result_value: String(param.result_value ?? ""),
                        abnormal_flag: param.abnormal_flag || "NORMAL",
                        result_comment: param.result_comment || comments || existing.result_comment,
                        verified_by: validVerifiedBy ?? existing.verified_by,
                        verified_datetime: timestamp,
                        result_status: param.result_status || resultStatus,
                        lab_test_parameter_id: validatedParamId || existing.lab_test_parameter_id,
                        updated_at: timestamp
                    }
                });
                savedResults.push(updated);
            }
            else {
                const created = await prisma_1.default.lab_result.create({
                    data: {
                        lab_result_id: `RES${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                        sample_collection_id: sampleCollection.sample_collection_id,
                        lab_order_item_id: resolvedOrderItemId,
                        lab_test_parameter_id: validatedParamId,
                        parameter_name: param.parameter_name,
                        result_value: String(param.result_value ?? ""),
                        abnormal_flag: param.abnormal_flag || "NORMAL",
                        result_comment: param.result_comment || comments || null,
                        verified_by: validVerifiedBy,
                        verified_datetime: timestamp,
                        result_status: param.result_status || resultStatus,
                        branch_id: branch_id || orderItem.branch_id || null,
                        user_id: user_id || orderItem.user_id || null,
                        created_at: timestamp,
                        updated_at: timestamp
                    }
                });
                savedResults.push(created);
            }
        }
        // 6. Construct formatted summary string for lab_order_item.remarks
        const summaryList = parameters
            .filter((p) => p.result_value && String(p.result_value).trim() !== "")
            .map((p) => `${p.parameter_name.split(" ")[0]}: ${p.result_value}${p.unit ? " " + p.unit : ""}`);
        const summaryText = summaryList.length > 0 ? summaryList.join(", ") : "Results recorded";
        // 7. Update lab_order_item status and remarks
        await prisma_1.default.lab_order_item.update({
            where: { lab_order_item_id: resolvedOrderItemId },
            data: {
                item_status: markCompleted ? "Completed" : orderItem.item_status,
                remarks: summaryText,
                updated_at: timestamp
            }
        });
        // 8. If marked completed, check if parent lab_order can be updated
        if (markCompleted && orderItem.lab_order_id) {
            const siblingItems = await prisma_1.default.lab_order_item.findMany({
                where: { lab_order_id: orderItem.lab_order_id }
            });
            const allSiblingsCompleted = siblingItems.every((si) => si.lab_order_item_id === resolvedOrderItemId ||
                ["Completed", "Report Generated", "Delivered", "Cancelled"].includes(si.item_status || ""));
            if (allSiblingsCompleted) {
                await prisma_1.default.lab_order.update({
                    where: { lab_order_id: orderItem.lab_order_id },
                    data: {
                        order_status: "Completed",
                        updated_at: timestamp
                    }
                }).catch(() => { });
            }
        }
        // 9. Audit log in lab_history
        await prisma_1.default.lab_history.create({
            data: {
                lab_history_id: `LH${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                lab_order_id: orderItem.lab_order_id,
                lab_order_item_id: resolvedOrderItemId,
                sample_collection_id: sampleCollection.sample_collection_id,
                sample_id: sampleCollection.barcode,
                quality_action: markCompleted ? "Results Completed" : "Results Draft Saved",
                quality_completed_date: timestamp,
                quality_completed_by: validVerifiedBy,
                quality_check_comment: comments || summaryText,
                completed_on: markCompleted ? timestamp : null,
                branch_id: branch_id || orderItem.branch_id || null
            }
        }).catch(() => { });
        return {
            sample_collection: sampleCollection,
            results: savedResults
        };
    }
    async delete(lab_result_id) {
        return prisma_1.default.lab_result.delete({
            where: { lab_result_id }
        });
    }
}
exports.LabResultRepository = LabResultRepository;
