import prisma from "../../config/prisma";
import {
  CreateQualificationDto,
  UpdateQualificationDto,
} from "./qualification-master.dto";
import { qualificationMasterRepository } from "./qualification-master.repository";

export class QualificationMasterService {
  /**
   * Generate Qualification ID
   * Example: QUAL000001
   */
  private async generateQualificationId(): Promise<string> {
    const lastQualification = await prisma.qualification_master.findFirst({
      orderBy: {
        id: "desc",
      },
    });

    if (!lastQualification) {
      return "QUAL000001";
    }

    const lastNumber = parseInt(
      lastQualification.qualification_id.replace("QUAL", ""),
      10
    );

    return `QUAL${String(lastNumber + 1).padStart(6, "0")}`;
  }

  async create(data: CreateQualificationDto) {
    const exists =
      await qualificationMasterRepository.findByQualificationName(
        data.qualification_name
      );

    if (exists) {
      throw new Error("Qualification already exists");
    }

    const qualification_id = await this.generateQualificationId();

    return qualificationMasterRepository.create({
      qualification_id,
      qualification_name: data.qualification_name,
      designation: data.designation,
      is_active: data.is_active ?? true,
    });
  }

  async getAll() {
    return qualificationMasterRepository.findAll();
  }

  async getById(qualification_id: string) {
    const qualification =
      await qualificationMasterRepository.findById(qualification_id);

    if (!qualification) {
      throw new Error("Qualification not found");
    }

    return qualification;
  }

  async getByDesignation(designation: string) {
    return qualificationMasterRepository.findByDesignation(designation);
  }

  async update(
    qualification_id: string,
    data: UpdateQualificationDto
  ) {
    const qualification =
      await qualificationMasterRepository.findById(qualification_id);

    if (!qualification) {
      throw new Error("Qualification not found");
    }

    if (data.qualification_name) {
      const duplicate =
        await qualificationMasterRepository.findByQualificationName(
          data.qualification_name
        );

      if (
        duplicate &&
        duplicate.qualification_id !== qualification_id
      ) {
        throw new Error("Qualification already exists");
      }
    }

    return qualificationMasterRepository.update(
      qualification_id,
      data
    );
  }

  async delete(qualification_id: string) {
    const qualification =
      await qualificationMasterRepository.findById(qualification_id);

    if (!qualification) {
      throw new Error("Qualification not found");
    }

    return qualificationMasterRepository.softDelete(
      qualification_id
    );
  }
  
}

export const qualificationMasterService =
  new QualificationMasterService();