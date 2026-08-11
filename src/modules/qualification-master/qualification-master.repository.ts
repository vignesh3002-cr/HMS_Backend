import prisma from "../../config/prisma";
import { qualification_master } from "@prisma/client";

export class QualificationMasterRepository {
  async create(data: {
    qualification_id: string;
    qualification_name: string;
    designation: string;
    is_active?: boolean;
  }): Promise<qualification_master> {
    return prisma.qualification_master.create({
      data,
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
    return prisma.qualification_master.update({
      where: {
        qualification_id,
      },
      data,
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
      },
    });
  }
  
}

export const qualificationMasterRepository =
  new QualificationMasterRepository();