import prisma from "../../config/prisma";
import { qualification_master } from "@prisma/client";

export class QualificationMasterRepository {
  async create(data: {
    qualification_id: string;
    qualification_name: string;
    designation: string;
    is_active?: boolean;
  }): Promise<qualification_master> {
    const now = new Date();

    return prisma.qualification_master.create({
      data: {
        qualification_id: data.qualification_id,
        qualification_name: data.qualification_name,
        designation: data.designation,
        is_active: data.is_active !== false, // default to true if not specified
        updated_at: now,
      },
    });
  }

  async findAll(): Promise<qualification_master[]> {
    return prisma.qualification_master.findMany({
      where: {
        is_active: true,
      },
      orderBy: {
        qualification_name: "asc",
      },
    });
  }

  async findById(
    qualification_id: string
  ): Promise<qualification_master | null> {
    return prisma.qualification_master.findUnique({
      where: {
        qualification_id,
      },
    });
  }

  async findByQualificationName(
    qualification_name: string
  ): Promise<qualification_master | null> {
    return prisma.qualification_master.findFirst({
      where: {
        qualification_name: {
          equals: qualification_name,
          mode: "insensitive",
        },
      },
    });
  }

  async findByDesignation(
    designation: string
  ): Promise<qualification_master[]> {
    return prisma.qualification_master.findMany({
      where: {
        designation,
        is_active: true,
      },
      orderBy: {
        qualification_name: "asc",
      },
    });
  }

  async update(
    qualification_id: string,
    data: Partial<qualification_master>
  ): Promise<qualification_master> {
    const {
      id: _id,
      qualification_id: _qualification_id,
      created_at: _created_at,
      updated_at: _updated_at,
      ...updateData
    } = data;

    return prisma.qualification_master.update({
      where: {
        qualification_id,
      },
      data: {
        ...updateData,
        updated_at: new Date(),
      },
    });
  }

  async softDelete(
    qualification_id: string
  ): Promise<qualification_master> {
    return prisma.qualification_master.update({
      where: {
        qualification_id,
      },
      data: {
        is_active: false,
        updated_at: new Date(),
      },
    });
  }
  
}

export const qualificationMasterRepository =
  new QualificationMasterRepository();
