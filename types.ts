
export enum BookStatus {
  WANT_TO_READ = 'WANT_TO_READ',
  READING = 'READING',
  FINISHED = 'FINISHED'
}

export interface Note {
  id: string;
  text: string; // Nội dung văn bản được highlight
  content?: string; // Nội dung ghi chú của người dùng
  color: 'yellow' | 'green' | 'blue' | 'red';
  createdAt: string;
}

export interface Chapter {
  title: string;
  index: number; // Chỉ số của đoạn văn (paragraph index) bắt đầu chương
  id?: string; // ID tham chiếu của epub
}

export type BookFormat = 'pdf' | 'epub';

export interface Book {
  id: string;
  userId?: string; // ID của người dùng sở hữu sách
  title: string;
  author: string;
  category: string;
  description: string;
  coverUrl: string;
  status: BookStatus;
  rating?: number;
  addedDate: string;
  summary?: string;
  
  // Dữ liệu file
  pdfData?: string; // Giữ lại để tương thích ngược hoặc đánh dấu loại file
  format?: BookFormat;
  
  // Dữ liệu văn bản
  insightHtml?: string; 
  fullText?: string; // Nội dung đầy đủ (khi load lên app)
  textStorageUrl?: string; // Đường dẫn file text trên Firebase Storage (để tránh giới hạn 1MB Firestore)
  
  notes?: Note[]; 
  chapters?: Chapter[];
  progress?: number; // 0 - 100
  lastScrollPosition?: number; // Pixel position
  lastReadDate?: string;
}

export interface LibraryState {
  books: Book[];
  isLoading: boolean;
  error: string | null;
}

export type ThemeType = 'light' | 'dark' | 'sepia';
export type FontFamily = 'serif' | 'sans' | 'mono' | 'bookerly';

export interface ReaderSettings {
  fontSize: number;
  fontFamily: FontFamily;
  theme: ThemeType;
  lineHeight: number;
}
