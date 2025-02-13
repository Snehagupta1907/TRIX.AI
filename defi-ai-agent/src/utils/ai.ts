import OpenAI from 'openai';

const HYPERBOLIC_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzbmVoYWd1cHRhOTg5MzBAZ21haWwuY29tIiwiaWF0IjoxNzM4NTI3ODMxfQ.Yf34haWiFDYqC5ShvcFG-KDhBNGPBLcwb1DWZ4bgu28";

export const aiClient = new OpenAI({
  apiKey: HYPERBOLIC_API_KEY,
  baseURL: 'https://api.hyperbolic.xyz/v1',
});

export async function queryLLM(prompt: string) {
  try {
    const response = await aiClient.chat.completions.create({
      model: 'meta-llama/Meta-Llama-3-70B-Instruct',
      messages: [{ role: 'system', content: 'You are a DeFi assistant.' }, { role: 'user', content: prompt }],
    });

    return response.choices[0]?.message?.content?.trim() || 'No response';
  } catch (error) {
    console.error('LLM Query Error:', error);
    throw new Error('AI processing failed.');
  }
}
