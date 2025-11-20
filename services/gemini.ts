import { GoogleGenAI, Modality } from "@google/genai";
import { base64ToBytes } from "../utils/audio";

const MODEL_NAME = "gemini-2.5-flash-preview-tts";

// Specialized prompt to enforce the specific tone requested
const STYLE_INSTRUCTION = `
(Directing the narrator: Speak in a deep, warm Indian male voice with a neutral accent. 
The delivery must feel like a premium National Geographic-style Hindi documentary. 
Be calm, emotional, and knowledgeable. 
Maintain a natural rhythm of Hindi speech, blending English words naturally where appropriate (Hinglish). 
Ensure the pacing is slow and deliberate, suitable for a documentary intro.)
`;

export async function generateSpeech(text: string, apiKey: string): Promise<Uint8Array> {
  if (!apiKey) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Combine style instruction with user text
  const fullPrompt = `${STYLE_INSTRUCTION} \n\n Script to read: "${text}"`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ parts: [{ text: fullPrompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            // 'Fenrir' is often deeper/rougher, 'Kore' is balanced. 
            // For "Deep Indian Male", Fenrir usually provides the best "gravitas".
            prebuiltVoiceConfig: { voiceName: 'Fenrir' }, 
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      throw new Error("No audio data received from the model.");
    }

    return base64ToBytes(base64Audio);
  } catch (err: any) {
    console.error("Gemini API Error:", err);
    throw new Error(err.message || "Failed to generate speech");
  }
}
