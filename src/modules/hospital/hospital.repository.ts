import prisma from "../../config/prisma";
import { CreateHospitalDto, UpdateHospitalDto, HospitalRecord } from "./hospital.types";

export class HospitalRepository {
  async create(data: CreateHospitalDto, hospitalId: string) {
    return prisma.hospital.create({
      data: {
        hospital_id: hospitalId,
        hospital_name: data.hospital_name,
        Hospital_address: data.hospital_address ?? null,
        contact_number: data.contact_number ?? null,
        email_id: data.email_id ?? null,
        website_address: data.website_address ?? null,
        hospital_type: data.hospital_type ?? null,
        hospital_license_no: data.hospital_license_no ?? null,
        hospital_country: data.hospital_country ?? "India",
        hospital_state: data.hospital_state ?? "Tamil nadu",
        hospital_district: data.hospital_district ?? "Chennai",
        hospital_area: data.hospital_area ?? "Tambaram",
        pincode: data.pincode ?? null,
        timezone: data.timezone ?? "Asia/Kolkata",
      },
      select: {
        hospital_id: true,
        hospital_name: true,
        Hospital_address: true,
        pincode: true,
        contact_number: true,
        fax_number: true,
        email_id: true,
        website_address: true,
        hospital_type: true,
        hospital_license_no: true,
        hospital_country: true,
        hospital_state: true,
        hospital_district: true,
        hospital_area: true,
        timezone: true,
      },
    });
  }

  async findById(hospitalId: string) {
    return prisma.hospital.findUnique({
      where: { hospital_id: hospitalId },
      select: {
        hospital_id: true,
        hospital_name: true,
        Hospital_address: true,
        pincode: true,
        contact_number: true,
        fax_number: true,
        email_id: true,
        website_address: true,
        hospital_type: true,
        hospital_license_no: true,
        hospital_country: true,
        hospital_state: true,
        hospital_district: true,
        hospital_area: true,
        timezone: true,
      },
    });
  }

  async findAll(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [hospitals, total] = await Promise.all([
      prisma.hospital.findMany({
        skip,
        take: limit,
        orderBy: { hospital_id: "desc" },
        select: {
          hospital_id: true,
          hospital_name: true,
          Hospital_address: true,
          pincode: true,
          contact_number: true,
          fax_number: true,
          email_id: true,
          website_address: true,
          hospital_type: true,
          hospital_license_no: true,
          hospital_country: true,
          hospital_state: true,
          hospital_district: true,
          hospital_area: true,
          timezone: true,
        },
      }),
      prisma.hospital.count(),
    ]);

    return { hospitals, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async update(hospitalId: string, data: UpdateHospitalDto) {
    return prisma.hospital.update({
      where: { hospital_id: hospitalId },
      data: {
        hospital_name: data.hospital_name,
        hospital_address: data.hospital_address,
        contact_number: data.contact_number,
        email_id: data.email_id,
        website_address: data.website_address,
        hospital_type: data.hospital_type,
        hospital_license_no: data.hospital_license_no,
        hospital_country: data.hospital_country,
        hospital_state: data.hospital_state,
        hospital_district: data.hospital_district,
        hospital_area: data.hospital_area,
        pincode: data.pincode,
        timezone: data.timezone,
      },
      select: {
        hospital_id: true,
        hospital_name: true,
        Hospital_address: true,
        pincode: true,
        contact_number: true,
        fax_number: true,
        email_id: true,
        website_address: true,
        hospital_type: true,
        hospital_license_no: true,
        hospital_country: true,
        hospital_state: true,
        hospital_district: true,
        hospital_area: true,
        timezone: true,
      },
    });
  }

  async countBranches(hospitalId: string) {
    return prisma.branch.count({
      where: { hospital_id: hospitalId },
    });
  }
}