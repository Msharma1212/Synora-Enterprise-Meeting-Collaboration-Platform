import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY is not defined. AI features will not work.");
}

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const getChatCompletion = async (prompt: string, history: { role: 'user' | 'model', parts: { text: string }[] }[] = []) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("AI Assistant is not configured.");
  }

  try {
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const chat = model.startChat({
      history: history,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      },
    });

    const result = await chat.sendMessage(prompt + "\n\nIMPORTANT: Be concise but never return a blank response. If you cannot help, explain why briefly.");
    const response = await result.response;
    const text = response.text();
    
    if (!text || text.trim() === "") {
      return "I'm here to help with your meeting. How can I assist you today?";
    }
    
    return text;
  } catch (error: any) {
    console.error("Gemini AI Chat Error:", error);
    return "I apologize, but I'm having trouble connecting right now. Please try again in a moment.";
  }
};

export const getMeetingSummary = async (messages: string[], language: string = "English (US)") => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("AI Assistant is not configured.");
  }

  const prompt = `
    You are an AI Meeting Assistant for a professional video conferencing app called Synora.
    Below is a transcript of a meeting chat conversation. 
    Please provide a concise, professional summary of the key points discussed, 
    decisions made, and any action items identified.
    
    The summary should be formatted with clear headings (Summary, Decisions, Actions).
    The summary should be written in ${language}.
    
    Chat Transcript:
    ${messages.join('\n')}
  `;

  try {
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    if (!text || text.trim() === "") {
      return "No sufficient discussion was found in the chat to generate a meaningful summary.";
    }
    
    return text;
  } catch (error: any) {
    console.error("Gemini AI Error:", error);
    return "Failed to generate meeting summary. Please ensure there is enough conversation data.";
  }
};
