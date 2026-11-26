"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabReportService = void 0;
exports.doesReportBelongToItem = doesReportBelongToItem;
const prisma_1 = __importDefault(require("../../config/prisma"));
const lab_report_repository_1 = require("./lab-report.repository");
const repository = new lab_report_repository_1.LabReportRepository();
/* report_comment is a jsonb column holding the report's comment object:
   { text, parameters, clinicalCorrelation, overallDecision }. A comment
   sent as that object's JSON string (as the report screens send it) is
   stored as the object; plain text is stored as { text }. */
const toReportComment = (value) => {
    if (value === undefined || value === null || value === "")
        return undefined;
    if (typeof value !== "string")
        return value;
    try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === "object")
            return parsed;
    }
    catch {
        // plain text
    }
    return { text: value };
};
/* The stored comment as an object, from a jsonb object or an older JSON
   string / plain text. */
const asComment = (value) => {
    if (!value)
        return null;
    if (typeof value === "object")
        return value;
    if (typeof value !== "string")
        return null;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" ? parsed : { text: value };
    }
    catch {
        return { text: value };
    }
};
/* The comment's text, from a stored comment object or older string. */
const reportCommentText = (value) => {
    const comment = typeof value === "string" ? toReportComment(value) : value;
    const text = comment && typeof comment === "object" ? comment.text : undefined;
    return typeof text === "string" ? text : "";
};
const parametersOf = (rep) => {
    const comment = asComment(rep?.report_comment);
    return Array.isArray(comment?.parameters) ? comment.parameters : [];
};
function doesReportBelongToItem(item, report, orderItems) {
    if (!report || !item)
        return false;
    // Single-item orders: the only test in the order
    if (!orderItems || orderItems.length <= 1)
        return true;
    const comment = asComment(report.report_comment);
    const repParams = Array.isArray(comment?.parameters) ? comment.parameters : [];
    const itemResults = Array.isArray(item.lab_result) ? item.lab_result : [];
    const itemResultIds = new Set(itemResults.map((r) => String(r.lab_result_id)));
    const itemParamNames = new Set(itemResults
        .map((r) => String(r.parameter_name || "").toLowerCase().trim())
        .filter(Boolean));
    // If the report has parameters saved in comment:
    if (repParams.length > 0) {
        // 1. Direct result ID match
        const hasMatchingResultId = repParams.some((p) => itemResultIds.has(String(p?.id ?? "")));
        if (hasMatchingResultId)
            return true;
        // Check if report parameters belong to other items in this order
        const otherResultIds = new Set();
        for (const other of orderItems) {
            if (other.lab_order_item_id === item.lab_order_item_id)
                continue;
            (other.lab_result || []).forEach((r) => {
                otherResultIds.add(String(r.lab_result_id));
            });
        }
        const hasOtherResultId = repParams.some((p) => otherResultIds.has(String(p?.id ?? "")));
        if (hasOtherResultId) {
            // The parameters in this report belong to another item in the order!
            return false;
        }
        // 2. Parameter name match
        if (itemParamNames.size > 0) {
            const hasMatchingParam = repParams.some((p) => {
                const pName = String(p?.parameter || p?.name || "").toLowerCase().trim();
                return pName && itemParamNames.has(pName);
            });
            if (hasMatchingParam)
                return true;
        }
        // Report has specific parameters and none of them belong to this item
        return false;
    }
    // If report has NO parameters in comment (older or file-only report):
    // 3. Match by item ID suffix in report_number
    const itemSuffix = String(item.lab_order_item_id || "").slice(-6);
    const repNum = String(report.report_number || "");
    if (itemSuffix && itemSuffix.length >= 4 && repNum.includes(itemSuffix)) {
        if (itemResults.length > 0 || ["REPORT GENERATED", "DELIVERED", "VERIFIED", "COMPLETED"].includes((item.item_status || "").toUpperCase())) {
            return true;
        }
    }
    // 4. If lab_result has lab_report_id, verify item actually has non-empty results
    const hasLinkedResult = itemResults.some((r) => r.lab_report_id === report.lab_report_id && r.result_value && r.result_value.trim() !== "");
    if (hasLinkedResult && itemResults.length > 0) {
        return true;
    }
    return false;
}
class LabReportService {
    async getAll() {
        return repository.findAll();
    }
    async getById(id) {
        const report = await repository.findById(id);
        if (!report) {
            throw new Error(`Lab report with id ${id} not found`);
        }
        return report;
    }
    async getByOrderId(orderId) {
        const report = await repository.findByOrderId(orderId);
        if (!report) {
            throw new Error(`Lab report for order id ${orderId} not found`);
        }
        return report;
    }
    /* One order item's report for the doctor's "View Report" action.
       lab_report only carries lab_order_id, so the item is resolved through
       lab_result first, then through the order's reports. */
    async getByOrderItem(labOrderItemId) {
        const data = await repository.findByOrderItem(labOrderItemId);
        if (!data) {
            throw new Error(`Lab order item with id ${labOrderItemId} not found`);
        }
        const { item, results, orderReports, patient } = data;
        const orderItems = data.item?.lab_order?.lab_order_item || [item];
        const itemWithResults = {
            ...item,
            lab_result: results,
        };
        const candidateReports = orderReports.filter((r) => doesReportBelongToItem(itemWithResults, r, orderItems));
        const report = candidateReports.find((r) => Boolean(r.report_file)) ??
            candidateReports[0] ??
            null;
        const reportParameters = parametersOf(report).map((parameter) => ({
            name: parameter?.parameter ?? parameter?.name ?? "",
            value: parameter?.result ??
                parameter?.observedValue ??
                parameter?.value ??
                "",
            unit: parameter?.unit ?? "",
            referenceRange: parameter?.referenceRange ?? parameter?.reference_range ?? "",
            status: parameter?.status ?? "",
            comment: parameter?.comment ?? parameter?.remarks ?? "",
        }));
        /* Fall back to the stored lab_result rows when the report comment has
           no parameter list (older reports). */
        const resultParameters = results.map((result) => {
            const testParameter = result.lab_test_parameter;
            const range = testParameter?.ref_range_text ||
                (testParameter?.ref_range_low != null && testParameter?.ref_range_high != null
                    ? `${testParameter.ref_range_low} - ${testParameter.ref_range_high}`
                    : "");
            return {
                name: testParameter?.parameter_name ?? result.parameter_name,
                value: result.result_value ?? "",
                unit: testParameter?.unit ?? "",
                referenceRange: range,
                status: result.abnormal_flag || result.result_status || "",
                comment: result.result_comment ?? "",
            };
        });
        const order = item.lab_order;
        const patientName = patient
            ? [
                patient.patient_first_name,
                patient.patient_middle_name,
                patient.patient_last_name,
            ]
                .filter(Boolean)
                .join(" ")
            : "";
        return {
            item: {
                lab_order_item_id: item.lab_order_item_id,
                lab_order_id: item.lab_order_id,
                lab_test_id: item.lab_test_id,
                item_status: item.item_status,
                remarks: item.remarks,
                created_at: item.created_at,
                lab_test_master: item.lab_test_master,
            },
            order: {
                lab_order_id: order?.lab_order_id ?? item.lab_order_id,
                order_datetime: order?.order_datetime ?? null,
                priority: order?.priority ?? null,
                clinical_notes: order?.clinical_notes ?? null,
                department: order?.department_master?.department_name ?? "",
                doctor: order?.employees
                    ? `Dr. ${order.employees.first_name ?? ""} ${order.employees.last_name ?? ""}`.trim()
                    : "",
            },
            patient: {
                patient_id: patient?.patient_id ?? order?.patient_history?.patient_id ?? "",
                name: patientName,
                age: patient?.patient_age ?? null,
                gender: patient?.patient_gender ?? null,
                dob: patient?.patient_dob ?? null,
                mrn_no: order?.patient_history?.mrn_no ?? null,
            },
            /* The selected report carries the stored PDF; the others are listed
               without their (large) files. */
            report,
            otherReports: orderReports
                .filter((candidate) => candidate.lab_report_id !== report?.lab_report_id)
                .map((candidate) => ({
                lab_report_id: candidate.lab_report_id,
                report_number: candidate.report_number,
                report_status: candidate.report_status,
                generated_datetime: candidate.generated_datetime,
                has_file: Boolean(candidate.report_file),
            })),
            parameters: reportParameters.length > 0 ? reportParameters : resultParameters,
        };
    }
    async create(data) {
        // 0. If a report already exists for this report_number or lab_order_id, update it
        let existingReport = null;
        if (data.report_number) {
            existingReport = await prisma_1.default.lab_report.findFirst({
                where: { report_number: data.report_number },
            });
        }
        if (!existingReport && data.lab_order_id) {
            existingReport = await prisma_1.default.lab_report.findFirst({
                where: { lab_order_id: data.lab_order_id },
            });
        }
        if (existingReport) {
            return this.update(existingReport.lab_report_id, {
                report_status: data.report_status || "Generated",
                report_file: data.report_file,
                digital_signature: data.digital_signature,
                approved_datetime: data.approved_datetime || new Date(),
                approved_by: data.approved_by,
                parameters: data.parameters,
                clinical_correlation: data.clinical_correlation,
                overall_decision: data.overall_decision,
                report_comment: data.report_comment,
            });
        }
        // 1. Generate unique lab_report_id and report_number
        const timestamp = Date.now();
        const lab_report_id = `RPT${timestamp}`;
        const report_number = data.report_number ||
            `RPT-${new Date().getFullYear()}-${timestamp.toString().slice(-6)}`;
        // 2. Validate FK approved_by safely
        let validApprovedBy = null;
        if (data.approved_by) {
            try {
                const emp = await prisma_1.default.employees.findUnique({
                    where: { employee_id: data.approved_by },
                });
                if (emp) {
                    validApprovedBy = emp.employee_id;
                }
            }
            catch {
                validApprovedBy = null;
            }
        }
        // 3. Validate branch_id safely
        let validBranchId = null;
        if (data.branch_id) {
            try {
                const b = await prisma_1.default.branch.findUnique({
                    where: { branch_id: data.branch_id },
                });
                if (b) {
                    validBranchId = b.branch_id;
                }
            }
            catch {
                validBranchId = null;
            }
        }
        // 4. Validate user_id safely
        let validUserId = null;
        if (data.user_id) {
            try {
                const u = await prisma_1.default.user_table.findUnique({
                    where: { user_id: data.user_id },
                });
                if (u) {
                    validUserId = u.user_id;
                }
            }
            catch {
                validUserId = null;
            }
        }
        // 5. Structure report_comment to preserve parameters and QC decision
        let commentPayload = toReportComment(data.report_comment);
        if (data.parameters || data.clinical_correlation || data.overall_decision) {
            commentPayload = {
                text: reportCommentText(commentPayload) || "Laboratory diagnostic report generated.",
                parameters: data.parameters || [],
                clinicalCorrelation: data.clinical_correlation || "",
                overallDecision: data.overall_decision || "APPROVED",
            };
        }
        const createdReport = await repository.create({
            lab_report_id,
            lab_order_id: data.lab_order_id,
            report_number,
            generated_datetime: data.generated_datetime
                ? new Date(data.generated_datetime)
                : new Date(),
            approved_by: validApprovedBy,
            approved_datetime: data.approved_datetime
                ? new Date(data.approved_datetime)
                : new Date(),
            report_status: data.report_status || "Generated",
            report_file: data.report_file || null,
            digital_signature: data.digital_signature || null,
            report_comment: commentPayload,
            delivered_to: data.delivered_to || null,
            delivered_datetime: data.delivered_datetime
                ? new Date(data.delivered_datetime)
                : null,
            branch_id: validBranchId,
            user_id: validUserId,
        });
        // 6. Update lab_order_item status if specified
        if (data.lab_order_item_id) {
            try {
                await prisma_1.default.lab_order_item.update({
                    where: { lab_order_item_id: data.lab_order_item_id },
                    data: {
                        item_status: "Report Generated",
                        updated_at: new Date(),
                    },
                });
            }
            catch (err) {
                console.warn("Could not update lab_order_item status:", err);
            }
        }
        // 7. Update parent lab_order status
        try {
            await prisma_1.default.lab_order.update({
                where: { lab_order_id: data.lab_order_id },
                data: {
                    order_status: "Completed",
                    updated_at: new Date(),
                },
            });
        }
        catch (err) {
            console.warn("Could not update lab_order status:", err);
        }
        return createdReport;
    }
    async update(id, data) {
        const existing = await repository.findById(id);
        if (!existing) {
            throw new Error(`Lab report with id ${id} not found`);
        }
        let commentPayload = toReportComment(data.report_comment);
        if (data.parameters || data.clinical_correlation || data.overall_decision) {
            commentPayload = {
                text: reportCommentText(commentPayload) || reportCommentText(existing.report_comment),
                parameters: data.parameters || [],
                clinicalCorrelation: data.clinical_correlation || "",
                overallDecision: data.overall_decision || "APPROVED",
            };
        }
        const updateData = {
            updated_at: new Date(),
        };
        if (data.report_number !== undefined)
            updateData.report_number = data.report_number;
        if (data.generated_datetime !== undefined)
            updateData.generated_datetime = data.generated_datetime
                ? new Date(data.generated_datetime)
                : null;
        if (data.approved_datetime !== undefined)
            updateData.approved_datetime = data.approved_datetime
                ? new Date(data.approved_datetime)
                : null;
        if (data.report_status !== undefined)
            updateData.report_status = data.report_status;
        if (data.approved_by !== undefined) {
            let validApprovedBy = null;
            if (data.approved_by) {
                try {
                    const emp = await prisma_1.default.employees.findUnique({
                        where: { employee_id: data.approved_by },
                    });
                    if (emp)
                        validApprovedBy = emp.employee_id;
                }
                catch {
                    validApprovedBy = null;
                }
            }
            updateData.approved_by = validApprovedBy;
        }
        if (data.report_file !== undefined)
            updateData.report_file = data.report_file;
        if (data.digital_signature !== undefined)
            updateData.digital_signature = data.digital_signature;
        if (commentPayload !== undefined)
            updateData.report_comment = commentPayload;
        if (data.delivered_to !== undefined)
            updateData.delivered_to = data.delivered_to;
        if (data.delivered_datetime !== undefined)
            updateData.delivered_datetime = data.delivered_datetime
                ? new Date(data.delivered_datetime)
                : null;
        return repository.update(id, updateData);
    }
    async transfer(id, data) {
        const existing = await repository.findById(id);
        if (!existing) {
            throw new Error(`Lab report with id ${id} not found`);
        }
        return repository.transfer(id, {
            delivered_to: data.delivered_to,
            delivered_datetime: data.delivered_datetime
                ? new Date(data.delivered_datetime)
                : new Date(),
            report_status: data.report_status || "Delivered",
        });
    }
    async delete(id) {
        const existing = await repository.findById(id);
        if (!existing) {
            throw new Error(`Lab report with id ${id} not found`);
        }
        return repository.delete(id);
    }
}
exports.LabReportService = LabReportService;
