import { Handler } from '@netlify/functions';
import { GoogleGenAI } from '@google/genai';

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { text, explanation, alternatives, type } = JSON.parse(event.body || '{}');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "GEMINI_API_KEY not configured." }) };
    }

    const ai = new GoogleGenAI({ apiKey });

    let prompt = `You are a medical student assistant and study material generator. 
I have a question, its alternatives, and its explanation. 
`;
    if (type === 'flashcards') {
      prompt += `Your task is to synthesize this knowledge into 5 distinct Flashcards.
Please return ONLY a valid JSON object matching this structure exactly (no markdown formatting):
{
  "flashcards": [
    {
      "front": "string (synthesized question)",
      "back": "string (synthesized answer + key explanation)"
    }
  ]
}
`;
    } else {
      prompt += `Your task is to synthesize this knowledge into a Note containing the core concepts extracted from the explanation, strictly up to 1000 characters.
Please return ONLY a valid JSON object matching this structure exactly (no markdown formatting):
{
  "note": "string (up to 1000 chars, synthesizing the core knowledge formatted as HTML)"
}
`;
    }

    prompt += `
Input data:
Question: ${text}
Explanation: ${explanation}
Alternatives: ${alternatives ? JSON.stringify(alternatives) : ''}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    let responseText = response.text || "{}";
    responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();

    const result = JSON.parse(responseText);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(result)
    };
  } catch (err: any) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
