import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { LabReportRepository } from "./lab-report.repository";
import {
  CreateLabReportDto,
  UpdateLabReportDto,
  TransferLabReportDto,
} from "./lab-report.types";

const repository = new LabReportRepository();

/* report_comment is a jsonb column holding the report's comment object:
   { text, parameters, clinicalCorrelation, overallDecision }. A comment
   sent as that object's JSON string (as the report screens send it) is
   stored as the object; plain text is stored as { text }. */
const toReportComment = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return value as Prisma.InputJsonValue;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") return parsed as Prisma.InputJsonValue;
  } catch {
    // plain text
  }
  return { text: value };
};

/* The comment's text, from a stored comment object or older string. */
const reportCommentText = (value: unknown): string => {
  const comment = typeof value === "string" ? toReportComment(value) : value;
  const text = comment && typeof comment === "object" ? (comment as { text?: unknown }).text : undefined;
  return typeof text === "string" ? text : "";
};

export class LabReportService {
  async getAll() {
    return repository.findAll();
  }

  async getById(id: string) {
    const report = await repository.findById(id);
    if (!report) {
      throw new Error(`Lab report with id ${id} not found`);
    }
    return report;
  }

  async getByOrderId(orderId: string) {
    const report = await repository.findByOrderId(orderId);
    if (!report) {
      throw new Error(`Lab report for order id ${orderId} not found`);
    }
    return report;
  }

  async create(data: CreateLabReportDto) {
    // 1. Generate unique lab_report_id and report_number
    const timestamp = Date.now();
    const lab_report_id = `RPT${timestamp}`;
    const report_number =
      data.report_number ||
      `RPT-${new Date().getFullYear()}-${timestamp.toString().slice(-6)}`;

    // 2. Validate FK approved_by safely
    let validApprovedBy: string | null = null;
    if (data.approved_by) {
      try {
        const emp = await prisma.employees.findUnique({
          where: { employee_id: data.approved_by },
        });
        if (emp) {
          validApprovedBy = emp.employee_id;
        }
      } catch {
        validApprovedBy = null;
      }
    }

    // 3. Validate branch_id safely
    let validBranchId: string | null = null;
    if (data.branch_id) {
      try {
        const b = await prisma.branch.findUnique({
          where: { branch_id: data.branch_id },
        });
        if (b) {
          validBranchId = b.branch_id;
        }
      } catch {
        validBranchId = null;
      }
    }

    // 4. Validate user_id safely
    let validUserId: string | null = null;
    if (data.user_id) {
      try {
        const u = await prisma.user_table.findUnique({
          where: { user_id: data.user_id },
        });
        if (u) {
          validUserId = u.user_id;
        }
      } catch {
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
        await prisma.lab_order_item.update({
          where: { lab_order_item_id: data.lab_order_item_id },
          data: {
            item_status: "Report Generated",
            updated_at: new Date(),
          },
        });
      } catch (err) {
        console.warn("Could not update lab_order_item status:", err);
      }
    }

    // 7. Update parent lab_order status
    try {
      await prisma.lab_order.update({
        where: { lab_order_id: data.lab_order_id },
        data: {
          order_status: "Completed",
          updated_at: new Date(),
        },
      });
    } catch (err) {
      console.warn("Could not update lab_order status:", err);
    }

    return createdReport;
  }

  async update(id: string, data: UpdateLabReportDto) {
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

    const updateData: any = {
      updated_at: new Date(),
    };

    if (data.report_number !== undefined) updateData.report_number = data.report_number;
    if (data.generated_datetime !== undefined)
      updateData.generated_datetime = data.generated_datetime
        ? new Date(data.generated_datetime)
        : null;
    if (data.approved_datetime !== undefined)
      updateData.approved_datetime = data.approved_datetime
        ? new Date(data.approved_datetime)
        : null;
    if (data.report_status !== undefined) updateData.report_status = data.report_status;
    if (data.report_file !== undefined) updateData.report_file = data.report_file;
    if (data.digital_signature !== undefined)
      updateData.digital_signature = data.digital_signature;
    if (commentPayload !== undefined) updateData.report_comment = commentPayload;
    if (data.delivered_to !== undefined) updateData.delivered_to = data.delivered_to;
    if (data.delivered_datetime !== undefined)
      updateData.delivered_datetime = data.delivered_datetime
        ? new Date(data.delivered_datetime)
        : null;

    return repository.update(id, updateData);
  }

  async transfer(id: string, data: TransferLabReportDto) {
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

  async delete(id: string) {
    const existing = await repository.findById(id);
    if (!existing) {
      throw new Error(`Lab report with id ${id} not found`);
    }
    return repository.delete(id);
  }
}
