import "dotenv/config";
import dns from "dns";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PERMISSIONS = [
  // Employee
  { key: "employee.create", name: "Create Employee", description: "Create new employee records", category: "employee" },
  { key: "employee.read", name: "View Employees", description: "View employee list and details", category: "employee" },
  { key: "employee.update", name: "Edit Employee", description: "Edit employee information", category: "employee" },
  { key: "employee.delete", name: "Delete Employee", description: "Delete/deactivate employee records", category: "employee" },

  // Patient
  { key: "patient.create", name: "Create Patient", description: "Register new patients", category: "patient" },
  { key: "patient.read", name: "View Patients", description: "View patient list and details", category: "patient" },
  { key: "patient.update", name: "Edit Patient", description: "Edit patient information", category: "patient" },
  { key: "patient.delete", name: "Delete Patient", description: "Delete/deactivate patient records", category: "patient" },

  // Appointment
  { key: "appointment.create", name: "Create Appointment", description: "Book new appointments", category: "appointment" },
  { key: "appointment.read", name: "View Appointments", description: "View appointment list and details", category: "appointment" },
  { key: "appointment.update", name: "Edit Appointment", description: "Modify appointment details", category: "appointment" },
  { key: "appointment.cancel", name: "Cancel Appointment", description: "Cancel appointments", category: "appointment" },

  // Encounter
  { key: "encounter.create", name: "Create Encounter", description: "Create patient encounters", category: "encounter" },
  { key: "encounter.read", name: "View Encounters", description: "View patient encounter details", category: "encounter" },
  { key: "encounter.update", name: "Edit Encounter", description: "Update encounter details", category: "encounter" },

  // Department
  { key: "department.create", name: "Create Department", description: "Create new departments", category: "department" },
  { key: "department.read", name: "View Departments", description: "View department list and details", category: "department" },

  // Branch
  { key: "branch.create", name: "Create Branch", description: "Create new branches", category: "branch" },
  { key: "branch.read", name: "View Branches", description: "View branch list and details", category: "branch" },
  { key: "branch.update", name: "Edit Branch", description: "Edit branch information", category: "branch" },
  { key: "branch.delete", name: "Delete Branch", description: "Delete/deactivate branches", category: "branch" },

  // Doctor
  { key: "doctor.create", name: "Create Doctor", description: "Add new doctors", category: "doctor" },
  { key: "doctor.read", name: "View Doctors", description: "View doctor list and details", category: "doctor" },
  { key: "doctor.update", name: "Edit Doctor", description: "Edit doctor information", category: "doctor" },
  { key: "doctor.transfer", name: "Transfer Doctor", description: "Initiate doctor transfers", category: "doctor" },

  // Report
  { key: "report.view", name: "View Reports", description: "View system reports", category: "report" },
  { key: "report.export", name: "Export Reports", description: "Export reports to PDF/Excel", category: "report" },
  { key: "report.download", name: "Download Reports", description: "Download report files", category: "report" },

  // System
  { key: "system.config", name: "System Configuration", description: "Manage system settings", category: "system" },
  { key: "system.audit", name: "View Audit Logs", description: "View system audit logs", category: "system" },
  { key: "permission.manage", name: "Manage Permissions", description: "Grant/revoke role permissions", category: "system" },

  // Lab
  { key: "lab.order", name: "Order Lab Tests", description: "Create lab orders", category: "lab" },
  { key: "lab.result", name: "View Lab Results", description: "View lab test results", category: "lab" },
  { key: "lab.manage", name: "Manage Lab", description: "Manage lab tests and categories", category: "lab" },

  // Pharmacy
  { key: "pharmacy.dispense", name: "Dispense Medication", description: "Dispense medications to patients", category: "pharmacy" },
  { key: "pharmacy.inventory", name: "Manage Inventory", description: "Manage pharmacy inventory", category: "pharmacy" },
  { key: "pharmacy.manage", name: "Manage Pharmacy", description: "Manage pharmacy settings", category: "pharmacy" },


  // Oncology reference data (cancer types/subtypes/staging/biomarkers/clinical parameters)
  { key: "oncology.reference.manage", name: "Manage Oncology Reference Data", description: "Seed/edit cancer types, subtypes, staging reference, biomarkers, clinical parameters", category: "oncology" },
  { key: "oncology.reference.read", name: "View Oncology Reference Data", description: "View cancer types, subtypes, staging reference, biomarkers", category: "oncology" },

  // Oncology staging/diagnosis (per-patient)
  { key: "oncology.diagnosis.create", name: "Create Oncology Diagnosis", description: "Create a patient's cancer staging/diagnosis record", category: "oncology" },
  { key: "oncology.diagnosis.read", name: "View Oncology Diagnosis", description: "View a patient's cancer staging/diagnosis record", category: "oncology" },
  { key: "oncology.diagnosis.update", name: "Update Oncology Diagnosis", description: "Update a patient's cancer staging/diagnosis record", category: "oncology" },

  // IHC / molecular biomarker panels
  { key: "oncology.ihc.write", name: "Record IHC Results", description: "Enter/update IHC biomarker panel results", category: "oncology" },
  { key: "oncology.molecular.write", name: "Record Molecular Results", description: "Enter/update molecular/NGS panel results", category: "oncology" },
  { key: "oncology.derived.read", name: "View Derived Oncology Fields", description: "View server-derived subtype/stage/suggested-therapy fields", category: "oncology" },

  // Chemotherapy plan / treatment lifecycle
  { key: "chemo.plan.create", name: "Create Chemotherapy Plan", description: "Create a patient-specific chemotherapy plan", category: "chemo" },
  { key: "chemo.plan.read", name: "View Chemotherapy Plan", description: "View chemotherapy plans and items", category: "chemo" },
  { key: "chemo.plan.update", name: "Update Chemotherapy Plan", description: "Update/close a chemotherapy plan", category: "chemo" },
  { key: "chemo.cycle.manage", name: "Manage Chemotherapy Cycles", description: "Create/update/complete chemotherapy cycles", category: "chemo" },
  { key: "chemo.administration.record", name: "Record Chemotherapy Administration", description: "Record drug administration for a cycle", category: "chemo" },
  { key: "chemo.vitals.record", name: "Record Chemotherapy Vitals", description: "Record patient vitals during a chemotherapy cycle", category: "chemo" },
  { key: "chemo.adverse_event.record", name: "Record Adverse Event", description: "Record a chemotherapy adverse event", category: "chemo" },
  { key: "chemo.followup.record", name: "Record Chemotherapy Followup", description: "Record chemotherapy follow-up visit outcomes", category: "chemo" },
  { key: "chemo.lab_review.record", name: "Record Chemotherapy Lab Review", description: "Record pre-cycle lab review results", category: "chemo" },
  { key: "chemo.protocol.read", name: "View Regimen Protocols", description: "View named regimen protocol templates (AC-T, TCH, TCHP, ...)", category: "chemo" },
  { key: "chemo.protocol.manage", name: "Manage Regimen Protocols", description: "Create/update regimen protocol templates and their drug lines", category: "chemo" },

  // Audit trail
  { key: "audit.read", name: "View Audit Log", description: "View the oncology/chemotherapy write audit trail", category: "audit" },

];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  // SUPER_ADMIN and HEAD_ADMIN get all permissions
  SUPER_ADMIN: PERMISSIONS.map(p => p.key),
  HEAD_ADMIN: PERMISSIONS.map(p => p.key),

  // BRANCH_ADMIN - branch-scoped full access
  BRANCH_ADMIN: [
    "employee.create",
    "employee.read",
    "employee.update",
    "patient.create",
    "patient.read",
    "patient.update",
    "appointment.create",
    "appointment.read",
    "appointment.update",
    "appointment.cancel",
    "encounter.create",
    "encounter.read",
    "encounter.update",
    "department.read",
    "doctor.create",
    "doctor.read",
    "doctor.update",
    "doctor.transfer",
    "report.view",
    "report.export",
    "report.download",
    "lab.order",
    "lab.result",
    "lab.manage",
    "pharmacy.dispense",
    "pharmacy.inventory",
    "pharmacy.manage",

    "oncology.reference.manage",
    "oncology.reference.read",
    "oncology.diagnosis.read",
    "oncology.derived.read",
    "chemo.plan.read",
    "chemo.protocol.read",
    "chemo.protocol.manage",
    "audit.read",

  ],

  // STAFF_ADMIN (ADMIN) - branch-scoped view/edit
  ADMIN: [
    "employee.read",
    "employee.update",
    "patient.create",
    "patient.read",
    "patient.update",
    "appointment.create",
    "appointment.read",
    "appointment.update",
    "encounter.read",
    "encounter.update",
    "department.read",
    "report.view",
    "lab.order",
    "lab.result",
    "pharmacy.dispense",
    "pharmacy.inventory",

    "oncology.reference.read",
    "oncology.diagnosis.read",
    "oncology.derived.read",
    "chemo.plan.read",
    "chemo.protocol.read",
    "chemo.protocol.manage",
    "audit.read",

  ],

  // RECEPTIONIST - patient/appointment only
  RECEPTIONIST: [
    "patient.create",
    "patient.read",
    "appointment.create",
    "appointment.read",
    "appointment.update",
    "encounter.read",
  ],

  // DOCTOR - own patients/appointments
  DOCTOR: [
    "patient.read",
    "appointment.read",
    "appointment.update",
    "encounter.create",
    "encounter.read",
    "encounter.update",
    "lab.order",
    "lab.result",

    // Oncology - a doctor makes the clinical calls: diagnosis/staging,
    // biomarker entry, and the plan/cycle/adverse-event/followup record.
    // Administration and vitals are recorded by NURSE, not DOCTOR.
    "oncology.reference.read",
    "oncology.diagnosis.create",
    "oncology.diagnosis.read",
    "oncology.diagnosis.update",
    "oncology.ihc.write",
    "oncology.molecular.write",
    "oncology.derived.read",
    "chemo.plan.create",
    "chemo.plan.read",
    "chemo.plan.update",
    "chemo.cycle.manage",
    "chemo.adverse_event.record",
    "chemo.followup.record",
    "chemo.lab_review.record",
    "chemo.protocol.read",

  ],

  // NURSE - patient care
  NURSE: [
    "patient.read",
    "patient.update",
    "appointment.read",
    "appointment.update",
    "encounter.read",
    "encounter.update",
    "lab.order",
    "lab.result",

    // Nurse administers and monitors - not diagnosing or planning
    "oncology.reference.read",
    "oncology.diagnosis.read",
    "oncology.derived.read",
    "chemo.plan.read",
    "chemo.protocol.read",
    "chemo.administration.record",
    "chemo.vitals.record",
    "chemo.adverse_event.record",

  ],

  // PHARMACIST
  PHARMACIST: [
    "patient.read",
    "department.read",
    "pharmacy.dispense",
    "pharmacy.inventory",

    // Verifies drug orders against the plan before dispensing
    "chemo.plan.read",

    // Verifies drug orders against the plan before dispensing
    "chemo.plan.read",

  ],

  // LAB_TECHNICIAN
  LAB_TECHNICIAN: [
    "patient.read",
    "department.read",
    "lab.order",
    "lab.result",
    "lab.manage",
  ],
};

// Role metadata only - ID prefixes and numbering live in id_sequences.
const ROLE_CONFIGS = [
  { role_type: "SUPER_ADMIN", description: "Super Administrator", display_name: "Super Admin", sort_order: 1, is_active: true },
  { role_type: "HEAD_ADMIN", description: "Head Administrator", display_name: "Head Admin", sort_order: 2, is_active: true },
  { role_type: "BRANCH_ADMIN", description: "Branch Administrator", display_name: "Branch Admin", sort_order: 3, is_active: true },
  { role_type: "ADMIN", description: "Staff Administrator", display_name: "Staff Admin", sort_order: 4, is_active: true },
  { role_type: "RECEPTIONIST", description: "Receptionist", display_name: "Receptionist", sort_order: 5, is_active: true },
  { role_type: "DOCTOR", description: "Doctor", display_name: "Doctor", sort_order: 6, is_active: true },
  { role_type: "NURSE", description: "Nurse", display_name: "Nurse", sort_order: 7, is_active: true },
  { role_type: "PHARMACIST", description: "Pharmacist", display_name: "Pharmacist", sort_order: 8, is_active: true },
  { role_type: "LAB_TECHNICIAN", description: "Lab Technician", display_name: "Lab Technician", sort_order: 9, is_active: true },
  { role_type: "STAFF", description: "Support Staff", display_name: "Staff", sort_order: 10, is_active: true },
  { role_type: "PATIENT", description: "Patient", display_name: "Patient", sort_order: 11, is_active: true },
];

async function seedPermissions() {
  console.log("🌱 Seeding permissions...");

  // Create permissions
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { name: perm.name, description: perm.description, category: perm.category, is_active: true },
      create: { ...perm, id: crypto.randomUUID(), updated_at: new Date() },
    });
  }
  console.log(`✅ Created/updated ${PERMISSIONS.length} permissions`);

  // Update role_id_config with display_name and sort_order
  for (const role of ROLE_CONFIGS) {
    await prisma.role_id_config.upsert({
      where: { role_type: role.role_type },
      update: { display_name: role.display_name, sort_order: role.sort_order, is_active: role.is_active, description: role.description },
      create: role,
    });
  }
  console.log(`✅ Updated ${ROLE_CONFIGS.length} role configs`);

  // Create role-permission mappings
  let grantCount = 0;
  for (const [roleType, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permKey of permissions) {
      const permission = await prisma.permission.findUnique({ where: { key: permKey } });
      if (!permission) {
        console.warn(`⚠️ Permission not found: ${permKey} for role ${roleType}`);
        continue;
      }

      await prisma.rolePermission.upsert({
        where: { role_type_permission_id: { role_type: roleType, permission_id: permission.id } },
        update: { revoked_at: null, revoked_by: null },
        create: {
          id: crypto.randomUUID(),
          role_type: roleType,
          permission_id: permission.id,
          granted_by: "SYSTEM_SEED",
        },
      });
      grantCount++;
    }
  }
  console.log(`✅ Created ${grantCount} role-permission grants`);

  console.log("🎉 Permission seeding completed!");
}

async function main() {
  try {
    await seedPermissions();
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
