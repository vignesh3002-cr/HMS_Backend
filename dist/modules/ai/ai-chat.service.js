"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processAIChat = processAIChat;
const openai_1 = __importDefault(require("openai"));
const ai_tools_1 = require("./ai-tools");
const ai_permissions_1 = require("./ai-permissions");
const ai_tool_executor_1 = require("./ai-tool-executor");
let _openai = null;
const AI_BASE_URL = process.env.AI_BASE_URL || "http://127.0.0.1:4096";
const AI_API_KEY = process.env.AI_API_KEY || "opencode-local";
const MODEL = process.env.AI_MODEL || "opencode/big-pickle";
function isAIConfigured() {
    return Boolean(process.env.AI_BASE_URL || process.env.AI_API_KEY || process.env.OPENAI_API_KEY);
}
function getOpenAI() {
    if (!_openai) {
        if (!isAIConfigured()) {
            throw new Error("AI provider is not configured. Set AI_BASE_URL and AI_MODEL in the backend .env file.");
        }
        _openai = new openai_1.default({
            apiKey: AI_API_KEY,
            baseURL: AI_BASE_URL
        });
    }
    return _openai;
}
async function askOpenCode(message, systemPrompt, store) {
    const modelParts = MODEL.split("/");
    const providerID = modelParts.shift() || "opencode";
    const modelID = modelParts.join("/") || "big-pickle";
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${AI_API_KEY}` };
    if (!store.openCodeSessionId) {
        const sessionResponse = await fetch(`${AI_BASE_URL}/session`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                title: "HMS AI Assistant",
                model: { providerID, id: modelID }
            })
        });
        if (!sessionResponse.ok)
            throw new Error(`OpenCode session creation failed (${sessionResponse.status})`);
        const session = await sessionResponse.json();
        if (!session.id)
            throw new Error("OpenCode did not return a session id");
        store.openCodeSessionId = session.id;
    }
    const response = await fetch(`${AI_BASE_URL}/session/${store.openCodeSessionId}/message`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            model: { providerID, modelID },
            system: systemPrompt,
            parts: [{ type: "text", text: message }]
        })
    });
    if (!response.ok)
        throw new Error(`OpenCode request failed (${response.status})`);
    const result = await response.json();
    return (result.parts || [])
        .filter((part) => part.type === "text" && part.text)
        .map((part) => part.text)
        .join("\n") || "OpenCode returned an empty response.";
}
const conversations = new Map();
const CONVERSATION_TTL = 30 * 60 * 1000; // 30 minutes
function getConversationId() {
    return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
function getConversation(conversationId) {
    if (conversationId && conversations.has(conversationId)) {
        const store = conversations.get(conversationId);
        store.lastActivity = Date.now();
        return { id: conversationId, store };
    }
    const id = conversationId || getConversationId();
    const store = {
        messages: [],
        pendingConfirmations: new Map(),
        lastActivity: Date.now()
    };
    conversations.set(id, store);
    return { id, store };
}
function buildSystemPrompt(user) {
    const allowedTools = (0, ai_permissions_1.getAllowedTools)(user);
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return `You are an AI agent for a Hospital Management System (HMS). You can perform real operations in the HMS through the tools available to you.

CURRENT USER:
- Username: ${user.username}
- Role: ${user.role}
- User ID: ${user.user_id}
- Employee ID: ${user.employee_id || "N/A"}
- Branch ID: ${user.branch_id || "N/A"}

TODAY'S DATE: ${todayStr}

YOUR CAPABILITIES:
You have access to HMS tools that can search, create, update, and manage hospital data. When a user asks you to do something, use the appropriate tool to perform the actual operation.

IMPORTANT RULES:
1. Always use tools to fetch real data. Never make up patient names, appointment numbers, vitals, or any medical data.
2. When a user asks to perform an operation (create, update, cancel, reschedule), always use the appropriate tool.
3. For destructive operations (cancel appointment, delete patient), you MUST ask for explicit confirmation before executing.
4. If required information is missing, ask the user for it. Do not guess.
5. If multiple patients match a search, list them and ask the user to select one.
6. Use the patient_id, appointment_no, employee_id etc. from previous tool results in follow-up messages.
7. When the user says "his" or "her" or "that patient", refer to the most recently mentioned patient.
8. Format your responses clearly with relevant details.
9. For read operations, present the data in a clear, organized way.
10. You are NOT a general-purpose chatbot. Focus on HMS operations.
11. Never fabricate clinical information or make medical diagnoses.
12. Always respect the user's role permissions.

AVAILABLE TOOLS: ${allowedTools.join(", ")}

CONVERSATION CONTEXT:
Maintain context across the conversation. When the user refers to a previously found patient or appointment, use the IDs from the earlier tool results.`;
}
function getConfirmationKey(toolName, args) {
    return `${toolName}:${JSON.stringify(args)}`;
}
// ──── Parameter extraction helpers ────
function extractAfterKeyword(message, patterns) {
    const match = message.match(patterns);
    return match?.[1]?.trim() || null;
}
function extractPatientRef(msg) {
    // "patient Arunkumar", "patient P10023", "patient 10023"
    const byKeyword = extractAfterKeyword(msg, /(?:patient|for)\s+(?:id\s+)?([A-Za-z0-9][\w\s.-]{0,50})/i);
    if (byKeyword)
        return byKeyword;
    // Standalone ID pattern like P10023
    const byId = msg.match(/\b(P\d{3,6})\b/);
    if (byId)
        return byId[1];
    return null;
}
function extractDoctorRef(msg) {
    // "dr kumar", "doctor kumar", "dr. kumar"
    const byKeyword = extractAfterKeyword(msg, /(?:dr\.?|doctor|physician)\s+([A-Za-z][\w\s.-]{0,40})/i);
    if (byKeyword)
        return byKeyword;
    return null;
}
function extractDateRef(msg) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    if (/\b(today|tonight|this morning|this afternoon)\b/i.test(msg)) {
        return `${yyyy}-${mm}-${dd}`;
    }
    if (/\b(tomorrow)\b/i.test(msg)) {
        const t = new Date(today);
        t.setDate(t.getDate() + 1);
        return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    }
    if (/\b(yesterday)\b/i.test(msg)) {
        const t = new Date(today);
        t.setDate(t.getDate() - 1);
        return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    }
    // Explicit date like 2026-09-17 or 17/09/2026 or 17-09-2026
    const explicit = msg.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (explicit)
        return explicit[1];
    const dmy = msg.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
    if (dmy)
        return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    // "on 17th", "on 17 sept" — assume current month/year
    const dayMonth = msg.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(\w+)?\b/i);
    if (dayMonth && !/\b(today|tomorrow|yesterday)\b/i.test(msg)) {
        const day = parseInt(dayMonth[1]);
        if (day >= 1 && day <= 31) {
            if (dayMonth[2]) {
                const parsed = new Date(`${dayMonth[2]} ${day}, ${yyyy}`);
                if (!isNaN(parsed.getTime())) {
                    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
                }
            }
            else {
                return `${yyyy}-${mm}-${String(day).padStart(2, "0")}`;
            }
        }
    }
    return undefined;
}
function extractTimeRef(msg) {
    // "at 10:30", "at 10am", "at 10:30 AM"
    const timeMatch = msg.match(/\b(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?\b/i);
    if (timeMatch) {
        let hour = parseInt(timeMatch[1]);
        const min = timeMatch[2];
        const ampm = timeMatch[3]?.toLowerCase();
        if (ampm === "pm" && hour < 12)
            hour += 12;
        if (ampm === "am" && hour === 12)
            hour = 0;
        return `${String(hour).padStart(2, "0")}:${min}`;
    }
    const simpleMatch = msg.match(/\b(?:at\s+)?(\d{1,2})\s*(am|pm)\b/i);
    if (simpleMatch) {
        let hour = parseInt(simpleMatch[1]);
        const ampm = simpleMatch[2].toLowerCase();
        if (ampm === "pm" && hour < 12)
            hour += 12;
        if (ampm === "am" && hour === 12)
            hour = 0;
        return `${String(hour).padStart(2, "0")}:00`;
    }
    return undefined;
}
function formatToolOutput(toolName, output) {
    if (output === null || output === undefined)
        return "No data found.";
    // Array results
    if (Array.isArray(output)) {
        if (output.length === 0)
            return "No results found.";
        const items = output.slice(0, 15); // limit display
        let result = `Found ${output.length} result(s):\n\n`;
        for (const item of items) {
            if (toolName === "search_patient" || toolName === "get_patient") {
                result += `• ${item.name || "N/A"} (ID: ${item.patient_id || "N/A"})\n  Phone: ${item.mobile || "N/A"} | Gender: ${item.gender || "N/A"} | Age: ${item.age || "N/A"} | Type: ${item.type || "N/A"}\n\n`;
            }
            else if (toolName === "search_appointments" || toolName === "get_today_appointments") {
                const appt = item.appointments || item;
                if (Array.isArray(appt)) {
                    for (const a of appt) {
                        result += `• ${a.appointment_no || "N/A"} | Patient: ${a.patient_first_name || "N/A"} ${a.patient_last_name || ""} | Doctor: ${a.employee_first_name || "N/A"} ${a.employee_last_name || ""} | ${a.appointment_date || "N/A"} ${a.appointment_time || ""} | Status: ${a.status || "N/A"}\n`;
                    }
                }
                else {
                    result += `• ${appt.appointment_no || JSON.stringify(item).substring(0, 100)}\n`;
                }
                result += "\n";
            }
            else if (toolName === "search_doctor") {
                result += `• Dr. ${item.name || "N/A"} (ID: ${item.employee_id || "N/A"})\n  Dept: ${item.department || "N/A"} | Spec: ${item.specialization || "N/A"} | Designation: ${item.designation || "N/A"}\n\n`;
            }
            else if (toolName === "get_doctor_schedule") {
                result += `• ${item.day || "N/A"} | ${item.shift || "N/A"} | ${item.start_time || ""} - ${item.end_time || ""} | ${item.consultation_minutes || 0}min | Branch: ${item.branch || "N/A"}\n`;
            }
            else if (toolName === "get_patient_vitals") {
                result += `• ${item.date ? new Date(item.date).toLocaleDateString() : "N/A"} | BP: ${item.systolic_bp || "—"}/${item.diastolic_bp || "—"} | Pulse: ${item.pulse || "—"} | Temp: ${item.temperature || "—"}°C | SpO2: ${item.spo2 || "—"}% | BS: ${item.blood_sugar || "—"}\n`;
            }
            else {
                result += `• ${JSON.stringify(item).substring(0, 200)}\n`;
            }
        }
        if (output.length > 15)
            result += `... and ${output.length - 15} more.\n`;
        return result;
    }
    // Object results (single item)
    if (typeof output === "object") {
        if (output.patients)
            return formatToolOutput(toolName, output.patients);
        if (output.appointments)
            return formatToolOutput(toolName, output.appointments);
        const entries = Object.entries(output).filter(([_, v]) => v !== null && v !== undefined);
        if (entries.length === 0)
            return "No data found.";
        let result = "";
        for (const [key, value] of entries) {
            if (typeof value === "object" && value !== null) {
                result += `${key}: ${JSON.stringify(value, null, 2)}\n`;
            }
            else {
                result += `${key}: ${value}\n`;
            }
        }
        return result;
    }
    return String(output);
}
function parseIntent(message, user) {
    const msg = message.trim().toLowerCase();
    const branchId = user.branch_id;
    // ─── TODAY'S APPOINTMENTS ───
    if (/\b(today'?s?\s+appointments?|appointments?\s+(?:for\s+)?today|show\s+(?:me\s+)?(?:all\s+)?appointments?)\b/i.test(msg)) {
        const doctorRef = extractDoctorRef(msg);
        return {
            tool: "get_today_appointments",
            args: { branch_id: branchId },
            description: "Fetching today's appointments"
        };
    }
    // ─── SEARCH PATIENT ───
    if (/\b(find|search|show|look\s+up|get|who\s+(?:is|are))\b.*\bpatient/i.test(msg) ||
        /\bpatient\b.*\b(find|search|show|look|get)\b/i.test(msg)) {
        const ref = extractPatientRef(msg);
        if (ref) {
            return {
                tool: "search_patient",
                args: { query: ref, branch_id: branchId },
                description: `Searching patient: ${ref}`
            };
        }
    }
    // ─── SEARCH DOCTOR ───
    if (/\b(find|search|show|look\s+up|get)\b.*\b(doctor|dr\.?|physician|specialist)\b/i.test(msg) ||
        /\b(doctor|dr\.?)\b.*\b(find|search|show|look|get)\b/i.test(msg) ||
        /\bshow\s+(?:me\s+)?(?:all\s+)?doctors?\b/i.test(msg)) {
        const ref = extractDoctorRef(msg);
        if (ref) {
            return {
                tool: "search_doctor",
                args: { query: ref, branch_id: branchId },
                description: `Searching doctor: ${ref}`
            };
        }
    }
    // ─── DOCTOR SCHEDULE ───
    if (/\b(schedule|availability|timing|hours?|shift|roster)\b.*\b(doctor|dr\.?)\b/i.test(msg) ||
        /\b(doctor|dr\.?)\b.*\b(schedule|availability|timing|hours?|shift)\b/i.test(msg) ||
        /\bdoctor'?s?\s+schedule\b/i.test(msg)) {
        const ref = extractDoctorRef(msg);
        if (ref) {
            // Need to search doctor first to get employee_id — return special marker
            return {
                tool: "__search_doctor_for_schedule__",
                args: { query: ref, branch_id: branchId },
                description: `Finding doctor schedule for: ${ref}`
            };
        }
    }
    // ─── PATIENT VITALS ───
    if (/\b(vital|bp|blood\s+pressure|heart\s+rate|pulse|temperature|spo2|weight|height|bmi|blood\s+sugar)\b/i.test(msg)) {
        const ref = extractPatientRef(msg);
        if (ref) {
            const isLatest = /\b(latest|recent|last|current)\b/i.test(msg);
            return {
                tool: isLatest ? "get_latest_vitals" : "get_patient_vitals",
                args: { patient_id: ref },
                description: `Fetching ${isLatest ? "latest" : "recent"} vitals`
            };
        }
        // No patient specified — ask for it
        return null;
    }
    // ─── PATIENT PRESCRIPTIONS ───
    if (/\b(prescription|rx|medication|drug|medicine)\b/i.test(msg)) {
        const ref = extractPatientRef(msg);
        if (ref) {
            return {
                tool: "get_patient_prescriptions",
                args: { patient_id: ref },
                description: "Fetching patient prescriptions"
            };
        }
    }
    // ─── PATIENT LAB ORDERS ───
    if (/\b(lab\s*order|lab\s*result|test\s*result|blood\s*test|investigation)\b/i.test(msg)) {
        const ref = extractPatientRef(msg);
        if (ref) {
            // Need patient_history_id — try searching patient first
            return {
                tool: "__search_patient_for_lab__",
                args: { patient_id: ref },
                description: "Fetching patient lab orders"
            };
        }
    }
    // ─── PATIENT ENCOUNTERS ───
    if (/\b(encounter|visit|consultation|visit\s*history)\b/i.test(msg)) {
        const ref = extractPatientRef(msg);
        if (ref) {
            return {
                tool: "get_patient_encounters",
                args: { patient_id: ref },
                description: "Fetching patient encounters"
            };
        }
    }
    // ─── DEPARTMENTS ───
    if (/\b(department|dept\.?|all\s+departments?)\b/i.test(msg) && !/\b(patient|doctor|appointment)\b/i.test(msg)) {
        return {
            tool: "get_department",
            args: {},
            description: "Fetching all departments"
        };
    }
    // ─── NOTIFICATIONS ───
    if (/\b(notifications?|alerts?|bell)\b/i.test(msg) && !/\b(patient|doctor|appointment)\b/i.test(msg)) {
        return {
            tool: "get_notifications",
            args: {},
            description: "Fetching notifications"
        };
    }
    // ─── DASHBOARD SUMMARY ───
    if (/\b(dashboard|summary|overview|stats|statistics|count)\b/i.test(msg) && !/\b(patient|doctor)\b/i.test(msg)) {
        return {
            tool: "get_dashboard_summary",
            args: { branch_id: branchId },
            description: "Fetching dashboard summary"
        };
    }
    // ─── CREATE APPOINTMENT (needs multiple params) ───
    if (/\b(book|create|make|schedule|set\s+up)\b.*\b(appointment|appt|consultation)\b/i.test(msg) ||
        /\bappointment\b.*\b(book|create|make|schedule)\b/i.test(msg)) {
        const patientRef = extractPatientRef(msg);
        const doctorRef = extractDoctorRef(msg);
        const date = extractDateRef(msg);
        const time = extractTimeRef(msg);
        // If we have enough info, create it
        if (patientRef && doctorRef && date && time) {
            return {
                tool: "__create_appointment__",
                args: { patientQuery: patientRef, doctorQuery: doctorRef, appointment_date: date, appointment_time: time },
                description: "Creating appointment"
            };
        }
        // Missing info — return a helpful message
        const missing = [];
        if (!patientRef)
            missing.push("patient name/ID");
        if (!doctorRef)
            missing.push("doctor name");
        if (!date)
            missing.push("date");
        if (!time)
            missing.push("time");
        return {
            tool: "__ask_appointment_info__",
            args: { missing, patientRef, doctorRef, date, time },
            description: "Need more info for appointment"
        };
    }
    // ─── AVAILABLE SLOTS ───
    if (/\b(available|free|open)\s*(slot|time|timing)s?\b/i.test(msg) || /\bslots?\b.*\b(available|free|open)\b/i.test(msg)) {
        const doctorRef = extractDoctorRef(msg);
        const date = extractDateRef(msg);
        if (doctorRef && date) {
            return {
                tool: "__get_slots__",
                args: { doctorQuery: doctorRef, date, branch_id: branchId },
                description: "Fetching available slots"
            };
        }
    }
    return null;
}
async function generateFallbackResponse(message, user) {
    const msg = message.trim().toLowerCase();
    const today = new Date();
    const todayStr = today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    // ─── Greetings ───
    if (/^(hi|hello|hey|good\s*(morning|afternoon|evening)|greetings)/i.test(msg)) {
        return `Hello ${user.username}!\n\nI'm your HMS AI Assistant. I can help you with:\n\n• Searching patients by name or ID\n• Viewing today's appointments\n• Checking patient vitals and lab results\n• Managing doctor schedules\n• Creating appointments\n• Viewing prescriptions and medicines\n• Getting dashboard summaries\n\nJust ask me anything about the Hospital Management System!`;
    }
    // ─── Help ───
    if (/(what can you do|help|capabilities|features|commands)/i.test(msg)) {
        return `Here's what I can do:\n\n📋 **Patient Management**\n• "Find patient Arunkumar" — search by name\n• "Find patient P10023" — search by ID\n• "Show patient details P10023"\n\n📅 **Appointments**\n• "Show today's appointments"\n• "Show Dr Kumar's schedule"\n• "Create appointment for patient P10023 with Dr Kumar on 2026-09-18 at 10:00"\n• "Book appointment patient Arunkumar doctor Kumar tomorrow 2pm"\n\n👨‍⚕️ **Doctors**\n• "Find doctor Kumar"\n• "Show doctor schedule"\n\n💊 **Prescriptions & Lab**\n• "Show prescriptions for patient P10023"\n• "Show lab orders for patient P10023"\n\n🔬 **Vitals**\n• "Show vitals for patient P10023"\n• "Latest vitals for P10023"\n\n📊 **Dashboard & More**\n• "Show dashboard summary"\n• "Show my notifications"\n• "Show all departments"`;
    }
    // ─── Who am I ───
    if (/(who am i|my info|my details|about me|my role)/i.test(msg)) {
        return `Here are your details:\n\nName: ${user.username}\nRole: ${user.role}\nUser ID: ${user.user_id}\nBranch ID: ${user.branch_id || "Not assigned"}\nHospital ID: ${user.hospital_id || "Not assigned"}`;
    }
    // ─── Today's date ───
    if (/(what('?s| is) (the )?date|today|current date)/i.test(msg)) {
        return `Today is **${todayStr}**.`;
    }
    // ─── Thanks ───
    if (/(thank|thanks|thx)/i.test(msg)) {
        return `You're welcome, ${user.username}! Is there anything else I can help you with?`;
    }
    // ─── Goodbye ───
    if (/(bye|goodbye|see you|take care)/i.test(msg)) {
        return `Goodbye, ${user.username}! Have a great day!`;
    }
    // ─── Try to parse intent and execute real tool ───
    const intent = parseIntent(message, user);
    if (!intent) {
        // Could not parse — give contextual help
        return `I received: "${message.trim()}"\n\nI'm not sure what you mean. Try asking:\n• "Find patient [name]"\n• "Show today's appointments"\n• "Find doctor [name]"\n• "Show vitals for patient [id]"\n• "Create appointment for patient [id] with Dr [name] on [date] at [time]"\n• "Show dashboard summary"\n\nType "help" to see all available commands.`;
    }
    // ─── Special multi-step intents ───
    // Doctor schedule — search first, then get schedule
    if (intent.tool === "__search_doctor_for_schedule__") {
        const doctorResult = await (0, ai_tool_executor_1.executeAITool)("search_doctor", { query: intent.args.query, branch_id: intent.args.branch_id }, user);
        if (!doctorResult.success || !doctorResult.output || (Array.isArray(doctorResult.output) && doctorResult.output.length === 0)) {
            return `Could not find a doctor matching "${intent.args.query}". Please check the name and try again.`;
        }
        const doctor = Array.isArray(doctorResult.output) ? doctorResult.output[0] : doctorResult.output;
        const empId = doctor.employee_id;
        if (!empId)
            return "Found doctor but couldn't get their ID.";
        const scheduleResult = await (0, ai_tool_executor_1.executeAITool)("get_doctor_schedule", { employee_id: empId, branch_id: intent.args.branch_id }, user);
        if (!scheduleResult.success) {
            return `Found Dr. ${doctor.name}, but couldn't fetch schedule: ${scheduleResult.error}`;
        }
        const scheduleText = formatToolOutput("get_doctor_schedule", scheduleResult.output);
        return `Schedule for Dr. ${doctor.name} (${doctor.department || "N/A"}):\n\n${scheduleText}`;
    }
    // Patient lab orders — need patient_history_id
    if (intent.tool === "__search_patient_for_lab__") {
        const patientResult = await (0, ai_tool_executor_1.executeAITool)("search_patient", { query: intent.args.patient_id, limit: 1 }, user);
        if (!patientResult.success || !patientResult.output || (Array.isArray(patientResult.output) && patientResult.output.length === 0)) {
            return `Could not find a patient matching "${intent.args.patient_id}". Please check and try again.`;
        }
        const patient = Array.isArray(patientResult.output) ? patientResult.output[0] : patientResult.output;
        const labResult = await (0, ai_tool_executor_1.executeAITool)("get_patient_lab_orders", { patient_history_id: patient.patient_id }, user);
        if (!labResult.success)
            return `Found patient ${patient.name}, but couldn't fetch lab orders: ${labResult.error}`;
        const labText = formatToolOutput("get_patient_lab_orders", labResult.output);
        return `Lab orders for ${patient.name} (${patient.patient_id}):\n\n${labText}`;
    }
    // Create appointment — multi-step resolution
    if (intent.tool === "__create_appointment__") {
        const { patientQuery, doctorQuery, appointment_date, appointment_time } = intent.args;
        // Resolve patient
        const patientResult = await (0, ai_tool_executor_1.executeAITool)("search_patient", { query: patientQuery, limit: 1 }, user);
        if (!patientResult.success || !patientResult.output || (Array.isArray(patientResult.output) && patientResult.output.length === 0)) {
            return `Could not find a patient matching "${patientQuery}". Please check the name/ID and try again.`;
        }
        const patient = Array.isArray(patientResult.output) ? patientResult.output[0] : patientResult.output;
        // Resolve doctor
        const doctorResult = await (0, ai_tool_executor_1.executeAITool)("search_doctor", { query: doctorQuery, branch_id: user.branch_id }, user);
        if (!doctorResult.success || !doctorResult.output || (Array.isArray(doctorResult.output) && doctorResult.output.length === 0)) {
            return `Could not find a doctor matching "${doctorQuery}". Please check the name and try again.`;
        }
        const doctor = Array.isArray(doctorResult.output) ? doctorResult.output[0] : doctorResult.output;
        // Create the appointment
        const createResult = await (0, ai_tool_executor_1.executeAITool)("create_appointment", {
            patient_id: patient.patient_id,
            employee_id: doctor.employee_id,
            branch_id: user.branch_id,
            appointment_date,
            appointment_time
        }, user);
        if (createResult.success) {
            return `Appointment created successfully!\n\nPatient: ${patient.name} (${patient.patient_id})\nDoctor: Dr. ${doctor.name}\nDate: ${appointment_date}\nTime: ${appointment_time}`;
        }
        return `Failed to create appointment: ${createResult.error}`;
    }
    // Ask for missing appointment info
    if (intent.tool === "__ask_appointment_info__") {
        const { missing, patientRef, doctorRef, date, time } = intent.args;
        let msg = "To create an appointment, I need a few more details:\n\n";
        if (!patientRef)
            msg += "- Patient name or ID (e.g., \"patient Arunkumar\" or \"patient P10023\")\n";
        if (!doctorRef)
            msg += "- Doctor name (e.g., \"Dr Kumar\")\n";
        if (!date)
            msg += "- Date (e.g., \"today\", \"tomorrow\", or \"2026-09-18\")\n";
        if (!time)
            msg += "- Time (e.g., \"10:00\" or \"2pm\")\n";
        msg += `\nExample: "Create appointment for patient ${patientRef || "P10023"} with Dr ${doctorRef || "Kumar"} on ${date || "tomorrow"} at ${time || "10:00"}"`;
        return msg;
    }
    // Available slots — resolve doctor first
    if (intent.tool === "__get_slots__") {
        const doctorResult = await (0, ai_tool_executor_1.executeAITool)("search_doctor", { query: intent.args.doctorQuery, branch_id: intent.args.branch_id }, user);
        if (!doctorResult.success || !doctorResult.output || (Array.isArray(doctorResult.output) && doctorResult.output.length === 0)) {
            return `Could not find a doctor matching "${intent.args.doctorQuery}". Please check and try again.`;
        }
        const doctor = Array.isArray(doctorResult.output) ? doctorResult.output[0] : doctorResult.output;
        const slotsResult = await (0, ai_tool_executor_1.executeAITool)("get_available_slots", {
            employee_id: doctor.employee_id,
            branch_id: intent.args.branch_id,
            date: intent.args.date
        }, user);
        if (!slotsResult.success)
            return `Found Dr. ${doctor.name}, but couldn't fetch slots: ${slotsResult.error}`;
        return `Available slots for Dr. ${doctor.name} on ${intent.args.date}:\n\n${formatToolOutput("get_available_slots", slotsResult.output)}`;
    }
    // ─── Standard tool execution ───
    try {
        const result = await (0, ai_tool_executor_1.executeAITool)(intent.tool, intent.args, user);
        if (result.success) {
            const formatted = formatToolOutput(intent.tool, result.output);
            return `${intent.description}:\n\n${formatted}`;
        }
        return `${intent.description} failed: ${result.error || "Unknown error"}`;
    }
    catch (err) {
        return `${intent.description} failed: ${err.message || "Unexpected error"}`;
    }
}
async function processAIChat(request, user) {
    const { id: conversationId, store } = getConversation(request.conversationId);
    const performedActions = [];
    // Keep the local tool-only mode available when no provider is configured.
    if (!isAIConfigured()) {
        const fallbackResponse = await generateFallbackResponse(request.message, user);
        store.messages.push({ role: "user", content: request.message });
        store.messages.push({ role: "assistant", content: fallbackResponse });
        return {
            success: true,
            message: fallbackResponse,
            conversationId,
            performedActions
        };
    }
    // Check if this is a confirmation message
    const confirmMatch = request.message.trim().toLowerCase();
    if (confirmMatch === "yes" || confirmMatch === "confirm" || confirmMatch === "proceed" || confirmMatch === "do it") {
        for (const [key, pending] of store.pendingConfirmations.entries()) {
            if (pending.expiresAt > Date.now()) {
                store.pendingConfirmations.delete(key);
                if (!(0, ai_permissions_1.canUseTool)(user, pending.toolName)) {
                    return {
                        success: true,
                        message: "You do not have permission to perform this operation.",
                        conversationId,
                        performedActions: []
                    };
                }
                const result = await (0, ai_tool_executor_1.executeAITool)(pending.toolName, pending.args, user);
                performedActions.push({
                    tool: pending.toolName,
                    description: `Executed ${pending.toolName}`,
                    success: result.success,
                    result: result.output,
                    error: result.error
                });
                const summary = result.success
                    ? `Operation completed successfully.\n\nResult:\n${JSON.stringify(result.output, null, 2)}`
                    : `Operation failed: ${result.error}`;
                store.messages.push({
                    role: "assistant",
                    content: summary
                });
                return {
                    success: true,
                    message: summary,
                    conversationId,
                    performedActions
                };
            }
        }
    }
    const intent = parseIntent(request.message, user);
    const isSimpleConversation = /^(hi|hello|hey|good\s*(morning|afternoon|evening)|greetings|help|what can you do|capabilities|features|commands|who am i|my info|my details|about me|my role|thanks?|thank you|bye|goodbye|see you|take care)\b/i.test(request.message.trim());
    // HMS operations use the server-side executor so permissions and branch scope
    // are enforced. OpenCode handles requests outside the structured HMS intents.
    if (intent || isSimpleConversation) {
        const fallbackResponse = await generateFallbackResponse(request.message, user);
        store.messages.push({ role: "user", content: request.message });
        store.messages.push({ role: "assistant", content: fallbackResponse });
        return { success: true, message: fallbackResponse, conversationId, performedActions };
    }
    store.messages.push({ role: "user", content: request.message });
    const openCodeResponse = await askOpenCode(request.message, buildSystemPrompt(user), store);
    store.messages.push({ role: "assistant", content: openCodeResponse });
    return { success: true, message: openCodeResponse, conversationId, performedActions };
    // Add user message
    store.messages.push({
        role: "user",
        content: request.message
    });
    // Clean expired confirmations
    for (const [key, pending] of store.pendingConfirmations.entries()) {
        if (pending.expiresAt <= Date.now()) {
            store.pendingConfirmations.delete(key);
        }
    }
    // Build messages for OpenAI
    const systemPrompt = buildSystemPrompt(user);
    const openaiMessages = [
        { role: "system", content: systemPrompt },
        ...store.messages.map(m => ({
            role: m.role,
            content: m.content,
            ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
            ...(m.tool_call_id ? { tool_call_id: m.tool_call_id, name: m.name } : {})
        }))
    ];
    const tools = (0, ai_tools_1.getOpenAITools)();
    // Call OpenAI
    const response = await getOpenAI().chat.completions.create({
        model: MODEL,
        messages: openaiMessages,
        tools,
        tool_choice: "auto",
        temperature: 0.3,
        max_tokens: 2000
    });
    const choice = response.choices[0];
    const assistantMessage = choice.message;
    // Handle tool calls
    const toolCalls = assistantMessage.tool_calls || [];
    if (toolCalls.length > 0) {
        store.messages.push({
            role: "assistant",
            content: assistantMessage.content,
            tool_calls: toolCalls.map((tc) => ({
                id: tc.id,
                type: "function",
                function: {
                    name: tc.function.name,
                    arguments: tc.function.arguments
                }
            }))
        });
        // Process each tool call
        for (const toolCall of toolCalls) {
            const tc = toolCall;
            const toolName = tc.function.name;
            let args;
            try {
                args = JSON.parse(tc.function.arguments);
            }
            catch {
                args = {};
            }
            const toolDef = (0, ai_tools_1.getToolByName)(toolName);
            // Check destructive confirmation
            if (toolDef && (0, ai_permissions_1.isDestructiveTool)(toolName)) {
                const confirmationKey = getConfirmationKey(toolName, args);
                store.pendingConfirmations.set(confirmationKey, {
                    toolName,
                    args,
                    expiresAt: Date.now() + 5 * 60 * 1000 // 5 min to confirm
                });
                const confirmMsg = `⚠️ **Confirmation Required**\n\nThis operation (${toolName}) requires your confirmation.\n\nDetails:\n\`\`\`json\n${JSON.stringify(args, null, 2)}\n\`\`\`\n\nDo you want me to proceed? (yes/no)`;
                store.messages.push({
                    role: "assistant",
                    content: confirmMsg
                });
                return {
                    success: true,
                    message: confirmMsg,
                    conversationId,
                    performedActions: []
                };
            }
            // Execute the tool
            const result = await (0, ai_tool_executor_1.executeAITool)(toolName, args, user);
            performedActions.push({
                tool: toolName,
                description: `Executed ${toolName}`,
                success: result.success,
                result: result.output,
                error: result.error
            });
            // Add tool result to conversation
            store.messages.push({
                role: "tool",
                content: result.error || JSON.stringify(result.output),
                tool_call_id: tc.id,
                name: toolName
            });
        }
        // After tool execution, get AI to summarize results
        const followUpMessages = [
            { role: "system", content: systemPrompt },
            ...store.messages.map(m => ({
                role: m.role,
                content: m.content,
                ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
                ...(m.tool_call_id ? { tool_call_id: m.tool_call_id, name: m.name } : {})
            }))
        ];
        const followUp = await getOpenAI().chat.completions.create({
            model: MODEL,
            messages: followUpMessages,
            temperature: 0.3,
            max_tokens: 2000
        });
        const followUpContent = followUp.choices[0].message.content || "Operation completed.";
        store.messages.push({
            role: "assistant",
            content: followUpContent
        });
        return {
            success: true,
            message: followUpContent,
            conversationId,
            performedActions
        };
    }
    // Simple text response (no tool calls)
    const textContent = assistantMessage.content || "I'm sorry, I couldn't process that request.";
    store.messages.push({
        role: "assistant",
        content: textContent
    });
    return {
        success: true,
        message: textContent,
        conversationId,
        performedActions
    };
}
// Cleanup old conversations periodically
setInterval(() => {
    const now = Date.now();
    for (const [id, store] of conversations.entries()) {
        if (now - store.lastActivity > CONVERSATION_TTL) {
            conversations.delete(id);
        }
    }
}, 60 * 1000);
