
import { GoogleGenAI, Type } from "@google/genai";
import { Book, VocabularyItem } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

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
    console.error("Gemini Analysis Error:", error);
    return {
      category: "Chưa phân loại",
      description: "Lỗi phân tích AI.",
      insightHtml: "<p>Không thể tạo bản giải phẫu tri thức vào lúc này.</p>"
    };
  }
};

export const translateText = async (text: string): Promise<string> => {
  try {
    if (!process.env.API_KEY) {
        throw new Error("Chưa cấu hình API Key");
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Translate the following text to Vietnamese. Maintain the original tone, formatting, and paragraph structure (keep newlines). return only the translated text.\n\nText to translate:\n${text}`,
    });
    return response.text || "Không thể dịch văn bản (Phản hồi rỗng).";
  } catch (error: any) {
    console.error("Translation Error Details:", {
        message: error.message,
        status: error.status, // HTTP Status code if available
        details: error
    });

    // Xử lý các mã lỗi phổ biến
    if (error.message?.includes('429') || error.status === 429) {
        return "Lỗi: Quá nhiều yêu cầu (Rate Limit). Vui lòng đợi 1 phút rồi thử lại.";
    }
    if (error.message?.includes('503') || error.status === 503) {
        return "Lỗi: Máy chủ AI đang quá tải. Vui lòng thử lại sau.";
    }
    if (error.message?.includes('SAFETY')) {
        return "Lỗi: Nội dung bị chặn bởi bộ lọc an toàn.";
    }

    return `Đã xảy ra lỗi khi dịch: ${error.message || "Lỗi không xác định"}`;
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
        console.error("Dictionary Lookup Error:", error);
        throw error;
    }
};
