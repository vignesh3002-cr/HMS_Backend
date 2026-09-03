"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Nvidia_1 = require("../../Nvidia");
const router = (0, express_1.Router)();
router.post("/chat", async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ success: false, message: "Prompt is required" });
        }
        const { reasoning, content } = await (0, Nvidia_1.getNvidiaCompletion)(prompt);
        res.json({ success: true, data: { reasoning, content } });
    }
    catch (error) {
        console.error("Nvidia API error:", error?.message || error);
        res.status(500).json({ success: false, message: "Failed to get AI response" });
    }
});
exports.default = router;
