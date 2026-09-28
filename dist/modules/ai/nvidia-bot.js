"use strict";
/**
 * Standalone Nvidia NIM bot example
 * Uses OpenAI-compatible SDK to call Nvidia Integrate API
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatWithNvidia = chatWithNvidia;
const openai_1 = __importDefault(require("openai"));
require("dotenv/config");
const openai = new openai_1.default({
    apiKey: process.env.NVIDIA_API_KEY || '',
    baseURL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
});
async function chatWithNvidia(prompt) {
    const model = process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b';
    const completion = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 1,
        top_p: 0.95,
        max_tokens: 16384,
        stream: true,
    });
    let fullResponse = '';
    for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content || '';
        const reasoning = chunk.choices[0]?.delta?.reasoning_content;
        if (reasoning)
            process.stdout.write(reasoning);
        process.stdout.write(content);
        fullResponse += content;
    }
    return fullResponse;
}
// CLI usage
if (require.main === module) {
    const prompt = process.argv.slice(2).join(' ') || 'Write a limerick about the wonders of GPU computing.';
    chatWithNvidia(prompt).catch(console.error);
}
