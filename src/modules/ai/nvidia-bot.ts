/**
 * Standalone Nvidia NIM bot example
 * Uses OpenAI-compatible SDK to call Nvidia Integrate API
 */

import OpenAI from 'openai';
import 'dotenv/config';

const openai = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY || '',
  baseURL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
});

export async function chatWithNvidia(prompt: string) {
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
    const reasoning = (chunk.choices[0]?.delta as any)?.reasoning_content;
    if (reasoning) process.stdout.write(reasoning);
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
