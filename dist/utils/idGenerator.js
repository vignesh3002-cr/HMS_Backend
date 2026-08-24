"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
// Table + id column that each entity's generated ID lands in. Used to
// detect collisions when a sequence's current_number has fallen out of
// sync with the real data (e.g. after manual seeds/imports bypassed it).
const ENTITY_TARGET = {
    APPOINTMENT: { table: "appointment_history", column: "appointment_id" },
    BRANCH: { table: "branch", column: "branch_id" },
    BRANCH_ADMIN: { table: "employees", column: "employee_id" },
    DEPARTMENT: { table: "department_master", column: "department_id" },
    DOCTOR: { table: "employees", column: "employee_id" },
    EMPLOYEE: { table: "employees", column: "employee_id" },
    ENCOUNTER: { table: "encounter", column: "encounter_no" },
    LOGIN_OTP: { table: "login_otp", column: "otp_id" },
    NOTIFICATION: { table: "appointment_notification", column: "notification_id" },
    PATIENT: { table: "patient_bio_data", column: "patient_id" },
    RESCHEDULE_QUEUE: { table: "appointment_reschedule_queue", column: "queue_id" },
    SAMPLE_COLLECTION: { table: "sample_collection", column: "sample_collection_id" },
    USER: { table: "user_table", column: "user_id" },
    DOCTOR_TRANSFER: { table: "doctor_transfer", column: "transfer_id" },
    REGIMEN_PROTOCOL: { table: "chemotherapy_regimen_protocol", column: "protocol_id" },
    REGIMEN_PROTOCOL_ITEM: { table: "chemotherapy_regimen_protocol_items", column: "protocol_item_id" },
    REGIMEN_PROTOCOL_DAY: { table: "chemotherapy_regimen_protocol_days", column: "protocol_day_id" },
    REGIMEN_PROTOCOL_DILUTION: { table: "chemotherapy_protocol_dilutions", column: "protocol_dilution_id" },
};
async function generateId(tx, entity) {
    // Lock the row
    const rows = await tx.$queryRawUnsafe(`
        SELECT *
        FROM id_sequences
        WHERE entity_name='${entity}'
        FOR UPDATE
    `);
    if (rows.length === 0) {
        throw new Error(`Sequence not found for ${entity}`);
    }
    const sequence = rows[0];
    const target = ENTITY_TARGET[entity];
    let nextNumber = sequence.current_number;
    let generatedId;
    do {
        nextNumber += 1;
        generatedId = sequence.prefix +
            nextNumber
                .toString()
                .padStart(3, "0");
        if (!target)
            break;
        const existing = await tx.$queryRawUnsafe(`SELECT 1 FROM ${target.table} WHERE ${target.column} = '${generatedId}'`);
        if (existing.length === 0)
            break;
    } while (true);
    await tx.id_sequences.update({
        where: {
            entity_name: entity
        },
        data: {
            current_number: nextNumber,
            updated_at: new Date()
        }
    });
    return generatedId;
}
