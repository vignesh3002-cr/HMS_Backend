import prisma from "../../config/prisma";
import { Prisma } from "@prisma/client";

const userAuthInclude = {
  branch: {
    include: { hospital: true },
  },
  employees: {
    include: {
      branch: {
        include: { hospital: true },
      },
    },
  },
  patient_bio_data: true,
  user_branch_mapping: {
    where: { status: 1 },
    include: {
      branch: {
        include: { hospital: true },
      },
    },
  },
} satisfies Prisma.user_tableInclude;

export class AuthRepository {

  async findUserById(userId: string) {
    return prisma.user_table.findFirst({
      where: { user_id: userId },
    });
  }

  async findUserByUsername(username: string) {
    const trimmed = (username || "").trim();

    let user = await prisma.user_table.findFirst({
      where: {
        OR: [
          {
            username: {
              equals: trimmed,
              mode: "insensitive",
            },
          },
          {
            patient_bio_data: {
              some: {
                OR: [
                  { patient_id: { equals: trimmed, mode: "insensitive" } },
                  { patient_primary_mobile: { equals: trimmed } },
                  { patient_email: { equals: trimmed, mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      },
      include: userAuthInclude,
    });

    // If not found or if patient_bio_data was not populated, query patient_bio_data directly
    if (!user || (!user.patient_bio_data?.length && !user.employees)) {
      const patient = await prisma.patient_bio_data.findFirst({
        where: {
          OR: [
            { patient_id: { equals: trimmed, mode: "insensitive" } },
            { patient_primary_mobile: { equals: trimmed } },
            { patient_email: { equals: trimmed, mode: "insensitive" } },
          ],
        },
        include: {
          user_table: {
            include: userAuthInclude,
          },
        },
      });

      if (patient?.user_table) {
        const resolvedUser = patient.user_table;
        if (!resolvedUser.patient_bio_data || resolvedUser.patient_bio_data.length === 0) {
          (resolvedUser as any).patient_bio_data = [patient];
        }
        user = resolvedUser;
      }
    }

    return user;
  }

  async updateKpiPreferences(userId: string, kpiPreferences: string | null) {
    return prisma.user_table.update({
      where: { user_id: userId },
      data: { kpi_preferences: kpiPreferences },
    });
  }

  async updateKpiUsage(userId: string, kpiUsage: string | null) {
    return prisma.user_table.update({
      where: { user_id: userId },
      data: { kpi_usage: kpiUsage },
    });
  }

}