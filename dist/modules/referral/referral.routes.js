"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../../config/prisma"));
const router = (0, express_1.Router)();
// GET /referral/types
// Returns distinct referral_type values from patient_bio_data, merged with standard defaults.
router.get("/types", async (req, res) => {
    try {
        const typesFromPatients = await prisma_1.default.patient_bio_data.findMany({
            where: {
                referral_type: { not: null },
            },
            select: { referral_type: true },
            distinct: ["referral_type"],
        });
        const fromDbPatients = typesFromPatients
            .map((t) => t.referral_type?.trim())
            .filter((t) => Boolean(t) &&
            t.toLowerCase() !== "other" &&
            t.toLowerCase() !== "others");
        const defaultTypes = ["Hospital", "Clinic", "Doctor", "Patient", "Self"];
        const distinctTypes = Array.from(new Set([...defaultTypes, ...fromDbPatients]));
        res.json({ success: true, data: distinctTypes });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// GET /referral/options?type=Hospital
// Returns distinct referred_by / referral_contact / referral_branch_name /
// referral_address / referral_mail / referral_notes values from patient_bio_data
// for the given referral_type only (each referral type keeps its own option
// pool), plus name↔contact sync maps. Every referral field with a suggestion
// dropdown pulls its options from this one response.
router.get("/options", async (req, res) => {
    try {
        const { type } = req.query;
        const rows = await prisma_1.default.patient_bio_data.findMany({
            where: {
                ...(type
                    ? {
                        referral_type: {
                            equals: String(type),
                            mode: "insensitive",
                        },
                    }
                    : {}),
                OR: [
                    { referred_by: { not: null } },
                    { referral_contact: { not: null } },
                    { referral_branch_name: { not: null } },
                    { referral_address: { not: null } },
                    { referral_mail: { not: null } },
                    { referral_notes: { not: null } },
                ],
            },
            select: {
                referred_by: true,
                referral_contact: true,
                referral_branch_name: true,
                referral_address: true,
                referral_mail: true,
                referral_notes: true,
            },
        });
        const nameSet = new Set();
        const contactSet = new Set();
        const branchNameSet = new Set();
        const addressSet = new Set();
        const mailSet = new Set();
        const notesSet = new Set();
        const nameToContacts = {};
        const contactToNames = {};
        // Full saved record per referrer (keyed by name / by contact) so the form
        // can auto-fill hospital name, address, mail and notes like it fills the
        // contact. Each field keeps the first non-empty value found for that key.
        const nameToDetails = {};
        const contactToDetails = {};
        const emptyDetails = () => ({
            referred_by: "",
            referral_contact: "",
            referral_branch_name: "",
            referral_address: "",
            referral_mail: "",
            referral_notes: "",
        });
        const mergeDetails = (map, key, details) => {
            if (!key)
                return;
            if (!map[key])
                map[key] = emptyDetails();
            const target = map[key];
            for (const field of Object.keys(details)) {
                if (details[field] && !target[field])
                    target[field] = details[field];
            }
        };
        for (const r of rows) {
            const name = (r.referred_by ?? "").trim();
            const contact = (r.referral_contact ?? "").trim();
            const branchName = (r.referral_branch_name ?? "").trim();
            const address = (r.referral_address ?? "").trim();
            const mail = (r.referral_mail ?? "").trim();
            const notes = (r.referral_notes ?? "").trim();
            if (name)
                nameSet.add(name);
            if (contact)
                contactSet.add(contact);
            if (branchName)
                branchNameSet.add(branchName);
            if (address)
                addressSet.add(address);
            if (mail)
                mailSet.add(mail);
            if (notes)
                notesSet.add(notes);
            if (name && contact) {
                if (!nameToContacts[name])
                    nameToContacts[name] = [];
                if (!nameToContacts[name].includes(contact))
                    nameToContacts[name].push(contact);
                if (!contactToNames[contact])
                    contactToNames[contact] = [];
                if (!contactToNames[contact].includes(name))
                    contactToNames[contact].push(name);
            }
            const details = {
                referred_by: name,
                referral_contact: contact,
                referral_branch_name: branchName,
                referral_address: address,
                referral_mail: mail,
                referral_notes: notes,
            };
            mergeDetails(nameToDetails, name, details);
            mergeDetails(contactToDetails, contact, details);
        }
        res.json({
            success: true,
            data: {
                referred_by: Array.from(nameSet),
                referral_contact: Array.from(contactSet),
                referral_branch_name: Array.from(branchNameSet),
                referral_address: Array.from(addressSet),
                referral_mail: Array.from(mailSet),
                referral_notes: Array.from(notesSet),
                nameToContacts,
                contactToNames,
                nameToDetails,
                contactToDetails,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
exports.default = router;
