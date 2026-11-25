import { generateId } from "../../utils/idGenerator";
import prisma from "../../config/prisma";
import { HospitalRepository } from "./hospital.repository";
import { CreateHospitalDto, UpdateHospitalDto, HospitalRecord } from "./hospital.types";

const repository = new HospitalRepository();

export class HospitalService {
  async create(data: CreateHospitalDto): Promise<HospitalRecord> {
    // Validate hospital name uniqueness
    const existing = await prisma.hospital.findFirst({
      where: { hospital_name: data.hospital_name },
    });
    if (existing) {
      throw new Error("A hospital with this name already exists");
    }

    const hospitalId = await generateId(prisma, "HOSPITAL");

    const created = await repository.create(data, hospitalId);
    return {
      ...created,
      branch_count: 0,
    };
  }

  async getById(hospitalId: string): Promise<HospitalRecord | null> {
    const hospital = await repository.findById(hospitalId);
    if (!hospital) return null;

    const branchCount = await repository.countBranches(hospitalId);
    return { ...hospital, branch_count: branchCount };
  }

  async getAll(page = 1, limit = 50) {
    const { hospitals, total, page: currentPage, limit: currentLimit, totalPages } =
      await repository.findAll(page, limit);

    // Add branch counts
    const hospitalsWithCounts = await Promise.all(
      hospitals.map(async (h) => {
        const branchCount = await repository.countBranches(h.hospital_id);
        return { ...h, branch_count: branchCount };
      })
    );

    return {
      hospitals: hospitalsWithCounts,
      total,
      page: currentPage,
      limit: currentLimit,
      totalPages,
    };
  }

  async update(hospitalId: string, data: UpdateHospitalDto): Promise<HospitalRecord> {
    // Validate hospital exists
    const existing = await repository.findById(hospitalId);
    if (!existing) {
      throw new Error("Hospital not found");
    }

    // Validate name uniqueness if changing
    if (data.hospital_name && data.hospital_name !== existing.hospital_name) {
      const duplicate = await prisma.hospital.findFirst({
        where: { hospital_name: data.hospital_name },
      });
      if (duplicate) {
        throw new Error("A hospital with this name already exists");
      }
    }

    const updated = await repository.update(hospitalId, data);
    const branchCount = await repository.countBranches(hospitalId);
    return { ...updated, branch_count: branchCount };
  }
}