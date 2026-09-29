"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processAIChat = processAIChat;
const ai_permissions_1 = require("./ai-permissions");
const ai_tool_executor_1 = require("./ai-tool-executor");
const ai_llm_1 = require("./ai-llm");
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
        lastActivity: Date.now(),
    };
    conversations.set(id, store);
    return { id, store };
}
function isDestructiveTool(toolName) {
    const destructiveTools = ["cancel_appointment"];
    return destructiveTools.includes(toolName);
}
async function processAIChat(request, user) {
    const { id: conversationId, store } = getConversation(request.conversationId);
    const performedActions = [];
    // ── No LLM configured — local-only mode ──
    if (!(0, ai_llm_1.isLLMConfigured)()) {
        const response = "AI is not configured. Please set LLM_PROVIDER and API key in the backend .env file.";
        store.messages.push({ role: "user", content: request.message });
        store.messages.push({ role: "assistant", content: response });
        return { success: true, message: response, conversationId, performedActions };
    }
    // ── Handle confirmation messages ──
    const confirmMatch = request.message.trim().toLowerCase();
    if (confirmMatch === "yes" || confirmMatch === "confirm" || confirmMatch === "proceed" || confirmMatch === "do it") {
        for (const [key, pending] of store.pendingConfirmations.entries()) {
            if (pending.expiresAt > Date.now()) {
                store.pendingConfirmations.delete(key);
                if (!(0, ai_permissions_1.canUseTool)(user, pending.toolName)) {
                    const msg = "You do not have permission to perform this operation.";
                    store.messages.push({ role: "assistant", content: msg });
                    return { success: true, message: msg, conversationId, performedActions: [] };
                }
                const result = await (0, ai_tool_executor_1.executeAITool)(pending.toolName, pending.args, user);
                performedActions.push({
                    tool: pending.toolName,
                    description: `Executed ${pending.toolName}`,
                    success: result.success,
                    result: result.output,
                    error: result.error,
                });
                const summary = result.success
                    ? `Operation completed successfully.\n\n${typeof result.output === "string" ? result.output : JSON.stringify(result.output, null, 2)}`
                    : `Operation failed: ${result.error}`;
                store.messages.push({ role: "assistant", content: summary });
                return { success: true, message: summary, conversationId, performedActions };
            }
        }
    }
    // ── Send to LLM with tool definitions ──
    try {
        const systemPrompt = (0, ai_llm_1.buildSystemPrompt)(user);
        // Build conversation history for LLM (skip old tool messages, keep last 20 for context)
        const recentMessages = store.messages.slice(-20).map(m => ({
            role: m.role,
            content: m.content,
        }));
        const { response: llmResponse, toolCalls } = await (0, ai_llm_1.chatWithLLM)(request.message, systemPrompt, user, recentMessages);
        // Track executed tools
        for (const tc of toolCalls) {
            performedActions.push({
                tool: tc.tool,
                description: `Executed ${tc.tool}`,
                success: tc.success,
                result: tc.result,
                error: tc.success ? undefined : tc.result?.error,
            });
            // Handle destructive tools — require confirmation on next message
            if (isDestructiveTool(tc.tool) && tc.success) {
                const confirmKey = `confirm_${Date.now()}`;
                store.pendingConfirmations.set(confirmKey, {
                    toolName: tc.tool,
                    args: tc.args,
                    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
                });
            }
        }
        // Store messages in conversation
        store.messages.push({ role: "user", content: request.message });
        store.messages.push({ role: "assistant", content: llmResponse });
        return { success: true, message: llmResponse, conversationId, performedActions };
    }
    catch (err) {
        console.error("LLM chat error:", err);
        const errorMsg = err?.message?.includes("API error")
            ? `AI service error: ${err.message}`
            : "Unable to reach the AI service. Please try again.";
        store.messages.push({ role: "user", content: request.message });
        store.messages.push({ role: "assistant", content: errorMsg });
        return { success: true, message: errorMsg, conversationId, performedActions };
    }
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
