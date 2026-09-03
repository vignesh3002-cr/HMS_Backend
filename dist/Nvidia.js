"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NVIDIA_MODEL = void 0;
exports.getNvidiaCompletion = getNvidiaCompletion;
const openai_1 = __importDefault(require("openai"));
const client = new openai_1.default({
    apiKey: process.env.NVIDIA_API_KEY,
    baseURL: "https://integrate.api.nvidia.com/v1",
});
exports.NVIDIA_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";
async function getNvidiaCompletion(prompt, options) {
    const stream = options?.stream ?? false;
    const maxTokens = options?.maxTokens ?? 500;
    const enableThinking = options?.enableThinking ?? false;
    const baseParams = {
        model: exports.NVIDIA_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 1,
        top_p: 0.95,
        max_tokens: maxTokens,
        ...(enableThinking ? { reasoning_budget: 2000 } : {}),
        ...(enableThinking ? { chat_template_kwargs: { enable_thinking: true } } : {}),
    };
    if (stream) {
        const completion = (await client.chat.completions.create({
            ...baseParams,
            stream: true,
        }));
        let reasoning = "";
        let content = "";
        for await (const chunk of completion) {
            const delta = chunk.choices?.[0]?.delta;
            reasoning += delta?.reasoning_content || "";
            content += delta?.content || "";
        }
        return { reasoning, content };
    }
    const completion = await client.chat.completions.create({
        ...baseParams,
    });
    const rawMessage = completion.choices[0]?.message;
    const reasoning = rawMessage?.reasoning || rawMessage?.reasoning_content || "";
    const content = rawMessage?.content || "";
    return { reasoning, content };
}
