
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { Book, VocabularyItem } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

// Hàm xử lý lỗi chung cho Gemini
export const handleGeminiError = (error: any, action: string): string => {
  console.error(`Gemini ${action} Error:`, error);
  
  const msg = error.message || "";
  const status = error.status;

  if (status === 429 || msg.includes("429") || msg.includes("quota") || msg.includes("Resource has been exhausted")) {
    return "429"; // Trả về mã lỗi đặc biệt để UI xử lý logic đổi model
  }
  if (status === 503 || msg.includes("503")) {
    return "⚠️ Máy chủ AI đang bận. Vui lòng thử lại sau.";
  }
  if (msg.includes("SAFETY")) {
    return "⚠️ Nội dung bị chặn bởi bộ lọc an toàn của Google.";
  }
  
  return `Không thể ${action}: ${msg.substring(0, 100)}...`;
};

export const analyzeBook = async (title: string, author: string, rawText?: string): Promise<Partial<Book>> => {
  try {
    const prompt = rawText 
      ? `Dựa trên nội dung văn bản trích xuất từ PDF sau đây: "${rawText.substring(0, 15000)}". 
         Hãy thực hiện một bản "Giải phẫu tri thức" cho cuốn sách "${title}".
         Yêu cầu nội dung trả về là JSON.`
      : `Phân tích cuốn sách "${title}" của tác giả "${author}". Cung cấp thể loại và tóm tắt JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            description: { type: Type.STRING },
            summary: { type: Type.STRING },
            insightHtml: { 
              type: Type.STRING, 
              description: "HTML Content mang phong cách 'Giải phẫu tri thức'. Sử dụng h1 cho tiêu đề, h2 cho các phần như 'LUẬN ĐIỂM TRUNG TÂM', blockquote cho các câu trích dẫn quan trọng, và các đoạn p cho phân tích sâu." 
            }
          },
          required: ["category", "description", "summary", "insightHtml"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    return {
      category: data.category || "Chưa phân loại",
      description: data.description || "Không có mô tả",
      summary: data.summary || "",
      insightHtml: data.insightHtml || ""
    };
  } catch (error) {
    const friendlyError = handleGeminiError(error, "phân tích sách");
    return {
      category: "Chưa phân loại",
      description: "Lỗi phân tích AI.",
      insightHtml: `<div class="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800">
        <h3 class="font-bold text-lg mb-2">Lỗi phân tích Insight</h3>
        <p>${friendlyError}</p>
        <p class="mt-2 text-sm opacity-80">Bạn vẫn có thể đọc nội dung sách bình thường.</p>
      </div>`
    };
  }
};

export const translateText = async (text: string): Promise<string> => {
  if (!text || text.trim().length === 0) return "";

  try {
    const prompt = `Translate the following text into natural, fluent Vietnamese. 
    Maintain the original tone, literary style, and formatting.
    Do not include any introductory or concluding remarks, just the translation.
    
    Text:
    """
    ${text}
    """`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text?.trim() || "Không có kết quả dịch.";
  } catch (error: any) {
    const msg = handleGeminiError(error, "dịch thuật");
    return `(Lỗi dịch AI: ${msg})`;
  }
};

export const lookupDictionary = async (word: string, context?: string): Promise<Partial<VocabularyItem>> => {
    try {
        const prompt = `Act as a dictionary. Look up the word "${word}". 
        Context sentence where the word appears: "${context || 'No context provided'}".
        Provide the Vietnamese meaning, IPA phonetic transcription, part of speech, synonyms, and a usage example.
        Return JSON.`;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        word: { type: Type.STRING },
                        phonetic: { type: Type.STRING, description: "IPA format" },
                        partOfSpeech: { type: Type.STRING },
                        meaning: { type: Type.STRING, description: "Vietnamese meaning" },
                        synonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
                        exampleOriginal: { type: Type.STRING, description: "Example sentence in original language" },
                        exampleTranslated: { type: Type.STRING, description: "Example sentence translated to Vietnamese" }
                    },
                    required: ["word", "phonetic", "partOfSpeech", "meaning", "synonyms", "exampleOriginal", "exampleTranslated"]
                }
            }
        });

        const data = JSON.parse(response.text || "{}");
        return {
            word: data.word,
            phonetic: data.phonetic,
            partOfSpeech: data.partOfSpeech,
            meaning: data.meaning,
            synonyms: data.synonyms || [],
            exampleOriginal: data.exampleOriginal,
            exampleTranslated: data.exampleTranslated
        };
    } catch (error) {
        const msg = handleGeminiError(error, "tra từ điển");
        throw new Error(msg);
    }
};

// --- CHAT FEATURE ---

export const createBookChat = (bookTitle: string, bookAuthor: string, contextSnippet: string, modelName: string = 'gemini-3-flash-preview'): Chat => {
  return ai.chats.create({
    model: modelName,
    config: {
      systemInstruction: `Bạn là trợ lý đọc sách thông minh AI.
      Bạn đang hỗ trợ người dùng đọc cuốn sách: "${bookTitle}" của tác giả "${bookAuthor}".
      
      Dưới đây là một phần nội dung tóm tắt hoặc trích đoạn của sách để bạn tham khảo ngữ cảnh:
      ---
      ${contextSnippet.substring(0, 5000)}
      ---
      
      Nhiệm vụ của bạn:
      1. Trả lời các câu hỏi liên quan đến nội dung sách.
      2. Giải thích các khái niệm khó hiểu.
      3. Tóm tắt các ý chính khi được hỏi.
      4. Luôn trả lời ngắn gọn, súc tích và thân thiện bằng Tiếng Việt.
      `,
    }
  });
};
