import "dotenv/config";
import dns from "node:dns";
dns.setServers(["1.1.1.1", "8.8.8.8"]);
import prisma from "./src/config/prisma";
import { EmployeeService } from "./src/modules/employee/employee.service";

const TARGET_ID = "DOC026";

function fmtDate(d: any): string {
  if (!d) return "null";
  return new Date(d).toISOString();
}

function fmtTime(t: any): string {
  if (!t) return "null";
  const dt = new Date(t);
  return `${String(dt.getUTCHours()).padStart(2, "0")}:${String(dt.getUTCMinutes()).padStart(2, "0")}`;
}

async function snapshot(label: string) {
  console.log("\n========== " + label + " ==========");

  const emp = await prisma.employees.findUnique({
    where: { employee_id: TARGET_ID },
    select: {
      employee_id: true,
      first_name: true,
      last_name: true,
      branch_id: true,
      emp_status: true,
      deleted_at: true,
      user_id: true,
      user_table: { select: { username: true, user_status: true, role_type: true } },
    },
  });
  console.log("employees       :", JSON.stringify(emp));

  const mappings = await prisma.user_branch_mapping.count({
    where: { user_id: emp?.user_id ?? "" },
  });
  console.log("user_branch_map :", mappings, "row(s)");

  const schedules = await prisma.doctor_schedule.findMany({
    where: { employee_id: TARGET_ID },
    select: {
      schedule_id: true,
      branch_id: true,
      day_of_week: true,
      is_active: true,
      start_time: true,
      end_time: true,
    },
  });
  console.log(
    "doctor_schedule :",
    schedules.map((s) => ({
      id: String(s.schedule_id),
      day: s.day_of_week,
      start: fmtTime(s.start_time),
      end: fmtTime(s.end_time),
      active: s.is_active,
    })),
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const future = await prisma.appointment_history.findMany({
    where: {
      employee_id: TARGET_ID,
      appointment_date: { gte: today },
      status: { notIn: ["COMPLETED", "CANCELLED", "NO_SHOW"] },
    },
    select: {
      appointment_id: true,
      appointment_date: true,
      appointment_time: true,
      status: true,
      employee_id: true,
      schedule_id: true,
      token_number: true,
    },
    orderBy: { appointment_date: "asc" },
  });
  console.log(
    "future appts    :",
    future.map((a) => ({
      appt: a.appointment_id,
      date: fmtDate(a.appointment_date),
      time: fmtTime(a.appointment_time),
      status: a.status,
      doctor: a.employee_id,
      token: a.token_number,
    })),
  );

  const queued = await prisma.appointment_reschedule_queue.findMany({
    where: { employee_id: TARGET_ID },
    select: {
      queue_id: true,
      appointment_id: true,
      status: true,
      priority: true,
      created_at: true,
    },
  });
  console.log("reschedule_queue:", queued);

  const logs = await prisma.appointment_reschedule_action_log.count();
  console.log("action_log rows :", logs, "(table total)");
}

async function main() {
  await snapshot("BEFORE");

  const service = new EmployeeService();
  console.log("\n>>> running EmployeeService.softDeleteEmployee(" + TARGET_ID + ') ...\n');
  const result = await service.softDeleteEmployee(TARGET_ID, "SCRIPT_TEST");
  console.log("RESULT:", JSON.stringify(result));

  await snapshot("AFTER");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("FAILED:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});