
import { GoogleGenAI, Type } from "@google/genai";
import { Book } from "./types";

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
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Translate the following text to Vietnamese. Maintain the original tone, formatting, and paragraph structure (keep newlines). return only the translated text.\n\nText to translate:\n${text}`,
    });
    return response.text || "Không thể dịch văn bản.";
  } catch (error) {
    console.error("Translation Error:", error);
    return "Đã xảy ra lỗi khi dịch văn bản.";
  }
};
