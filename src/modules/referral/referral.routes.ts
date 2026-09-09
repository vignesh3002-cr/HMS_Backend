import { Router } from "express";
import prisma from "../../config/prisma";

const router = Router();

// GET /referral/types
// Returns distinct referral_type values from patient_bio_data, merged with standard defaults.
router.get("/types", async (req, res) => {
  try {
    const typesFromPatients = await (prisma as any).patient_bio_data.findMany({
      where: {
        referral_type: { not: null },
      },
      select: { referral_type: true },
      distinct: ["referral_type"],
    });

    const fromDbPatients = typesFromPatients
      .map((t: any) => t.referral_type?.trim())
      .filter(
        (t: any): t is string =>
          Boolean(t) &&
          t.toLowerCase() !== "other" &&
          t.toLowerCase() !== "others",
      );

    const defaultTypes = ["Hospital", "Clinic", "Doctor", "Patient", "Self"];
    const distinctTypes = Array.from(
      new Set([...defaultTypes, ...fromDbPatients]),
    );
    res.json({ success: true, data: distinctTypes });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /referral/options?type=Hospital
// Returns distinct referred_by / referral_contact values from patient_bio_data
// for the given referral_type, plus name↔contact sync maps.
router.get("/options", async (req, res) => {
  try {
    const { type } = req.query as { type?: string };

    const rows = await (prisma as any).patient_bio_data.findMany({
      where: {
        ...(type
          ? {
              referral_type: {
                equals: String(type),
                mode: "insensitive" as const,
              },
            }
          : {}),
        OR: [
          { referred_by: { not: null } },
          { referral_contact: { not: null } },
        ],
      },
      select: {
        referred_by: true,
        referral_contact: true,
      },
    });

    const nameSet = new Set<string>();
    const contactSet = new Set<string>();
    const nameToContacts: Record<string, string[]> = {};
    const contactToNames: Record<string, string[]> = {};

    for (const r of rows) {
      const name = (r.referred_by ?? "").trim();
      const contact = (r.referral_contact ?? "").trim();
      if (name) nameSet.add(name);
      if (contact) contactSet.add(contact);
      if (name && contact) {
        if (!nameToContacts[name]) nameToContacts[name] = [];
        if (!nameToContacts[name].includes(contact)) nameToContacts[name].push(contact);
        if (!contactToNames[contact]) contactToNames[contact] = [];
        if (!contactToNames[contact].includes(name)) contactToNames[contact].push(name);
      }
    }

    res.json({
      success: true,
      data: {
        referred_by: Array.from(nameSet),
        referral_contact: Array.from(contactSet),
        nameToContacts,
        contactToNames,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
