import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { CreateLabReportDto, UpdateLabReportDto, TransferLabReportDto } from "./lab-report.types";

export class LabReportRepository {
  async findAll() {
    return prisma.lab_report.findMany({
      orderBy: {
        id: "desc",
      },
      include: {
        employees: {
          select: {
            employee_id: true,
            first_name: true,
            last_name: true,
            designation: true,
          },
        },
        lab_order: {
          include: {
            patient_history: true,
            employees: {
              select: {
                employee_id: true,
                first_name: true,
                last_name: true,
                designation: true,
              },
            },
            department_master: true,
            lab_order_item: {
              include: {
                lab_test_master: true,
                sample_collection: true,
              },
            },
          },
        },
        branch: true,
      },
    });
  }

  async findById(lab_report_id: string) {
    return prisma.lab_report.findUnique({
      where: { lab_report_id },
      include: {
        employees: true,
        lab_order: {
          include: {
            patient_history: true,
            employees: true,
            department_master: true,
            lab_order_item: {
              include: {
                lab_test_master: true,
                sample_collection: true,
              },
            },
          },
        },
        branch: true,
      },
    });
  }

  /* Everything needed to show one order item's report: the item, its
     lab_result rows (which link it to a lab_report), every report of the
     parent order and the patient. Read-only; used by the doctor's
     "View Report" action. */
  async findByOrderItem(lab_order_item_id: string) {
    const item = await prisma.lab_order_item.findUnique({
      where: { lab_order_item_id },
      include: {
        lab_test_master: true,
        sample_collection: true,
        lab_order: {
          include: {
            patient_history: true,
            employees: {
              select: {
                employee_id: true,
                first_name: true,
                last_name: true,
                designation: true,
              },
            },
            department_master: true,
          },
        },
      },
    });

    if (!item) return null;

    const [results, orderReports] = await Promise.all([
      prisma.lab_result.findMany({
        where: { lab_order_item_id },
        orderBy: { id: "desc" },
        include: { lab_test_parameter: true, lab_report: true },
      }),
      prisma.lab_report.findMany({
        where: { lab_order_id: item.lab_order_id },
        orderBy: { id: "desc" },
      }),
    ]);

    const patientId = item.lab_order?.patient_history?.patient_id;
    const patient = patientId
      ? await prisma.patient_bio_data.findUnique({ where: { patient_id: patientId } })
      : null;

    return { item, results, orderReports, patient };
  }

  async findByOrderId(lab_order_id: string) {
    return prisma.lab_report.findFirst({
      where: { lab_order_id },
      include: {
        employees: true,
        lab_order: {
          include: {
            patient_history: true,
            employees: true,
            department_master: true,
            lab_order_item: {
              include: {
                lab_test_master: true,
                sample_collection: true,
              },
            },
          },
        },
        branch: true,
      },
    });
  }

  async create(data: {
    lab_report_id: string;
    lab_order_id: string;
    report_number?: string | null;
    generated_datetime?: Date | null;
    approved_by?: string | null;
    approved_datetime?: Date | null;
    report_status?: string | null;
    report_file?: string | null;
    digital_signature?: string | null;
    report_comment?: any;
    delivered_to?: string | null;
    delivered_datetime?: Date | null;
    branch_id?: string | null;
    user_id?: string | null;
  }) {
    return prisma.lab_report.create({
      data: data as any,
      include: {
        employees: true,
        lab_order: {
          include: {
            patient_history: true,
            employees: true,
            lab_order_item: {
              include: {
                lab_test_master: true,
                sample_collection: true,
              },
            },
          },
        },
      },
    });
  }

  async update(lab_report_id: string, data: any) {
    return prisma.lab_report.update({
      where: { lab_report_id },
      data,
      include: {
        employees: true,
        lab_order: {
          include: {
            patient_history: true,
            employees: true,
            lab_order_item: {
              include: {
                lab_test_master: true,
                sample_collection: true,
              },
            },
          },
        },
      },
    });
  }

  async transfer(
    lab_report_id: string,
    data: {
      delivered_to: string;
      delivered_datetime: Date;
      report_status: string;
    }
  ) {
    return prisma.lab_report.update({
      where: { lab_report_id },
      data: {
        delivered_to: data.delivered_to,
        delivered_datetime: data.delivered_datetime,
        report_status: data.report_status,
        updated_at: new Date(),
      },
      include: {
        employees: true,
        lab_order: {
          include: {
            patient_history: true,
            employees: true,
            lab_order_item: {
              include: {
                lab_test_master: true,
                sample_collection: true,
              },
            },
          },
        },
      },
    });
  }

  async delete(lab_report_id: string) {
    return prisma.lab_report.delete({
      where: { lab_report_id },
    });
  }
}
