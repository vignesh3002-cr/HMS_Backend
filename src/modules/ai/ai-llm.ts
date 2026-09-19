/**
 * Unified LLM client — supports OpenRouter (OpenAI-compatible) and OpenCode.
 * Handles function calling loop: LLM calls tool → execute locally → return result → LLM continues.
 */

import { getOpenAITools, getToolByName } from "./ai-tools";
import { canUseTool, getAllowedTools } from "./ai-permissions";
import { executeAITool } from "./ai-tool-executor";
import type { AIUserContext } from "./ai-types";

// ──── Config ────

const LLM_PROVIDER = process.env.LLM_PROVIDER || "openrouter"; // "openrouter" | "opencode"
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
const OPENCODE_BASE_URL = process.env.AI_BASE_URL || "http://127.0.0.1:4096";
const OPENCODE_API_KEY = process.env.AI_API_KEY || "opencode-local";
const OPENCODE_MODEL = process.env.AI_MODEL || "big-pickle";

const MAX_TOOL_ROUNDS = 10;

// ──── Public ────

export function isLLMConfigured(): boolean {
    if (LLM_PROVIDER === "openrouter") return Boolean(OPENROUTER_API_KEY);
    if (LLM_PROVIDER === "opencode") return Boolean(OPENCODE_BASE_URL);
    return false;
}

export function getLLMProvider(): string {
    return LLM_PROVIDER;
}

/**
 * Send a message to the LLM with HMS tool definitions.
 * Handles the full function-calling loop: tool calls → local execution → result → continue.
 * Returns the final natural-language response.
 */
export async function chatWithLLM(
    message: string,
    systemPrompt: string,
    user: AIUserContext,
    conversationMessages: Array<{ role: string; content: string | null; tool_call_id?: string; tool_calls?: any[] }>
): Promise<{ response: string; toolCalls: Array<{ tool: string; args: any; result: any; success: boolean }> }> {
    const tools = getOpenAITools();
    const allowedToolNames = new Set(getAllowedTools(user));
    const filteredTools = tools.filter(t => allowedToolNames.has(t.function.name));

    const allMessages: any[] = [
        { role: "system", content: systemPrompt },
        ...conversationMessages,
        { role: "user", content: message }
    ];

    const executedTools: Array<{ tool: string; args: any; result: any; success: boolean }> = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const llmResponse = await callLLM(allMessages, filteredTools);

        // No tool calls — return final text response
        if (!llmResponse.toolCalls || llmResponse.toolCalls.length === 0) {
            return { response: llmResponse.text || "I couldn't generate a response.", toolCalls: executedTools };
        }

        // Add assistant message with tool_calls to conversation
        allMessages.push({
            role: "assistant",
            content: llmResponse.text || null,
            tool_calls: llmResponse.toolCalls.map(tc => ({
                id: tc.id,
                type: "function",
                function: { name: tc.name, arguments: tc.arguments }
            }))
        });

        // Execute each tool call locally
        for (const toolCall of llmResponse.toolCalls) {
            if (!canUseTool(user, toolCall.name)) {
                const errorResult = { success: false, error: "Permission denied" };
                executedTools.push({ tool: toolCall.name, args: toolCall.parsedArgs, result: errorResult, success: false });
                allMessages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(errorResult)
                });
                continue;
            }

            try {
                const result = await executeAITool(toolCall.name, toolCall.parsedArgs, user);
                executedTools.push({ tool: toolCall.name, args: toolCall.parsedArgs, result: result.output, success: result.success });
                allMessages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(result.success ? result.output : { error: result.error })
                });
            } catch (err: any) {
                const errorResult = { success: false, error: err.message || "Tool execution failed" };
                executedTools.push({ tool: toolCall.name, args: toolCall.parsedArgs, result: errorResult, success: false });
                allMessages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(errorResult)
                });
            }
        }
        // Loop continues — LLM will process tool results and may call more tools
    }

    // Max rounds reached — return whatever we have
    return { response: "I've completed the available operations. Please ask if you need anything else.", toolCalls: executedTools };
}

// ──── OpenRouter (OpenAI-compatible) ────

interface LLMResponse {
    text: string | null;
    toolCalls: Array<{ id: string; name: string; arguments: string; parsedArgs: any }> | null;
}

async function callLLM(messages: any[], tools: any[]): Promise<LLMResponse> {
    if (LLM_PROVIDER === "opencode") return callOpenCode(messages, tools);
    return callOpenRouter(messages, tools);
}

async function callOpenRouter(messages: any[], tools: any[]): Promise<LLMResponse> {
    const body = {
        model: OPENROUTER_MODEL,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? "auto" : undefined,
        max_tokens: 4096,
    };

    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": "https://hms-app.local",
            "X-Title": "HMS AI Assistant",
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`OpenRouter API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) return { text: "No response from LLM.", toolCalls: null };

    const msg = choice.message;
    const text = msg.content || null;

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
        return { text, toolCalls: null };
    }

    const toolCalls = msg.tool_calls.map((tc: any) => {
        let parsedArgs: any = {};
        try { parsedArgs = JSON.parse(tc.function.arguments); } catch { /* invalid JSON */ }
        return { id: tc.id, name: tc.function.name, arguments: tc.function.arguments, parsedArgs };
    });

    return { text, toolCalls };
}

// ──── OpenCode (custom session API) ────

let opencodeSessionId: string | null = null;

async function callOpenCode(messages: any[], tools: any[]): Promise<LLMResponse> {
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${OPENCODE_API_KEY}` };

    // Create session if needed
    if (!opencodeSessionId) {
        const modelParts = OPENCODE_MODEL.split("/");
        const providerID = modelParts.shift() || "opencode";
        const modelID = modelParts.join("/") || "big-pickle";

        const sessionRes = await fetch(`${OPENCODE_BASE_URL}/session`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                title: "HMS AI Assistant",
                model: { providerID, id: modelID },
            }),
        });
        if (!sessionRes.ok) throw new Error(`OpenCode session creation failed (${sessionRes.status})`);
        const session = await sessionRes.json() as { id?: string };
        if (!session.id) throw new Error("OpenCode did not return a session id");
        opencodeSessionId = session.id;
    }

    // Extract system prompt and user message from messages array
    const systemMsg = messages.find(m => m.role === "system")?.content || "";
    const userMsg = messages.filter(m => m.role === "user").pop()?.content || "";

    // Build conversation context (skip system, include prior tool results)
    const contextParts: string[] = [];
    for (const m of messages) {
        if (m.role === "system") continue;
        if (m.role === "user") contextParts.push(`User: ${m.content}`);
        if (m.role === "assistant" && m.content) contextParts.push(`Assistant: ${m.content}`);
        if (m.role === "tool") contextParts.push(`Tool result: ${m.content}`);
    }

    const fullMessage = contextParts.length > 0
        ? `Previous context:\n${contextParts.join("\n")}\n\nCurrent user message: ${userMsg}`
        : userMsg;

    const modelParts = OPENCODE_MODEL.split("/");
    const providerID = modelParts.shift() || "opencode";
    const modelID = modelParts.join("/") || "big-pickle";

    const response = await fetch(`${OPENCODE_BASE_URL}/session/${opencodeSessionId}/message`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            model: { providerID, modelID },
            system: systemMsg,
            tools: tools.length > 0 ? tools : undefined,
            parts: [{ type: "text", text: fullMessage }],
        }),
    });

    if (!response.ok) {
        // Session may have expired — reset and retry once
        opencodeSessionId = null;
        throw new Error(`OpenCode request failed (${response.status})`);
    }

    const data = await response.json() as { parts?: Array<{ type?: string; text?: string; name?: string; input?: any; id?: string }> };
    const parts = data.parts || [];

    // Check for tool_use parts
    const toolUseParts = parts.filter(p => p.type === "tool_use");
    const textParts = parts.filter(p => p.type === "text");

    const text = textParts.map(p => p.text).join("\n") || null;

    if (toolUseParts.length === 0) {
        return { text, toolCalls: null };
    }

    const toolCalls = toolUseParts.map((p, i) => ({
        id: p.id || `tool_${Date.now()}_${i}`,
        name: p.name || "",
        arguments: JSON.stringify(p.input || {}),
        parsedArgs: p.input || {},
    }));

    return { text, toolCalls };
}

// ──── System prompt builder ────

export function buildSystemPrompt(user: AIUserContext): string {
    const allowedTools = getAllowedTools(user);
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
3. For destructive operations (cancel appointment), you MUST ask for explicit confirmation before executing. Do NOT execute cancel_appointment directly — instead, tell the user what will be cancelled and ask "Do you want to proceed?"
4. If required information is missing, ask the user for it. Do not guess.
5. If multiple patients match a search, list them and ask the user to select one.
6. Use the patient_id, appointment_no, employee_id etc. from previous tool results in follow-up messages.
7. When the user says "his" or "her" or "that patient", refer to the most recently mentioned patient.
8. Format your responses clearly with relevant details.
9. For read operations, present the data in a clear, organized way.
10. You are NOT a general-purpose chatbot. Focus on HMS operations.
11. Never fabricate clinical information or make medical diagnoses.
12. Always respect the user's role permissions.
13. When navigating to a page, respond with ONLY the JSON: {"__navigate__": "/path"} — no other text.

NAVIGATION:
When a user asks to go to, open, or navigate to a page, respond with a JSON object containing the route path. Examples:
- "go to appointments" → {"__navigate__": "/appointments"}
- "take me to patients" → {"__navigate__": "/patients"}
- "open dashboard" → {"__navigate__": "/dashboard"}

Available navigation routes: dashboard, appointments, patients, doctor, staff, orders, departments, notifications, profile, schedule, leave, reviews, chat, admin, permissions, roles, protocol, cancer, reschedule.

AVAILABLE TOOLS: ${allowedTools.join(", ")}

CONVERSATION CONTEXT:
Maintain context across the conversation. When the user refers to a previously found patient or appointment, use the IDs from the earlier tool results.`;
}
