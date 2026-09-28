"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIChatController = void 0;
const ai_chat_service_1 = require("./ai-chat.service");
class AIChatController {
    async chat(req, res) {
        try {
            const authUser = req.user;
            if (!authUser) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required."
                });
            }
            const user = {
                user_id: authUser.user_id || authUser.id,
                employee_id: authUser.employee_id,
                role: authUser.role || authUser.role_type,
                branch_id: authUser.branch_id,
                hospital_id: authUser.hospital_id,
                username: authUser.username || "unknown"
            };
            const { message, conversationId, navRoutes } = req.body;
            if (!message || typeof message !== "string" || message.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Message is required."
                });
            }
            if (message.length > 2000) {
                return res.status(400).json({
                    success: false,
                    message: "Message is too long. Maximum 2000 characters."
                });
            }
            const result = await (0, ai_chat_service_1.processAIChat)({ message: message.trim(), conversationId, navRoutes }, user);
            return res.json(result);
        }
        catch (error) {
            console.error("AI Chat error:", error);
            if (error?.message?.includes("AI provider is not configured")) {
                return res.status(503).json({
                    success: false,
                    message: "AI provider is not configured. Start OpenCode and check AI_BASE_URL and AI_MODEL in the backend .env file."
                });
            }
            if (error?.status === 401) {
                return res.status(500).json({
                    success: false,
                    message: "AI service authentication failed. Please check the API key configuration."
                });
            }
            if (error?.status === 429) {
                return res.status(429).json({
                    success: false,
                    message: "AI service rate limit exceeded. Please try again later."
                });
            }
            return res.status(500).json({
                success: false,
                message: "An error occurred while processing your request. Please try again."
            });
        }
    }
}
exports.AIChatController = AIChatController;
