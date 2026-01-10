
import { Book, VocabularyItem } from './types';

const DB_NAME = 'HyleReaderDB';
const DB_VERSION = 2; // Tăng version để trigger onupgradeneeded
const STORE_BOOKS = 'books';
const STORE_VOCAB = 'vocabulary';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_BOOKS)) {
        db.createObjectStore(STORE_BOOKS, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(STORE_VOCAB)) {
        db.createObjectStore(STORE_VOCAB, { keyPath: 'id' });
      }
    };
  });
};

// --- BOOK OPERATIONS ---

export const getAllBooks = async (userId: string): Promise<Book[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_BOOKS], 'readonly');
    const store = transaction.objectStore(STORE_BOOKS);
    const request = store.getAll();

    request.onsuccess = () => {
        const allBooks = request.result as Book[];
        const userBooks = allBooks.filter(book => book.userId === userId);
        resolve(userBooks.sort((a, b) => new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime()));
    };
    request.onerror = () => reject(request.error);
  });
};

export const saveBook = async (book: Book): Promise<Book> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_BOOKS], 'readwrite');
    const store = transaction.objectStore(STORE_BOOKS);
    
    const bookToSave = {
        ...book,
        id: book.id || crypto.randomUUID()
    };

    const request = store.put(bookToSave);

    request.onsuccess = () => resolve(bookToSave);
    request.onerror = () => reject(request.error);
  });
};

export const deleteBook = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_BOOKS], 'readwrite');
    const store = transaction.objectStore(STORE_BOOKS);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getBookById = async (id: string): Promise<Book | undefined> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_BOOKS], 'readonly');
      const store = transaction.objectStore(STORE_BOOKS);
      const request = store.get(id);
  
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
};

// --- VOCABULARY OPERATIONS ---

export const getAllVocabulary = async (userId: string): Promise<VocabularyItem[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        // Kiểm tra xem store có tồn tại không (phòng trường hợp user cũ chưa upgrade)
        if (!db.objectStoreNames.contains(STORE_VOCAB)) {
            resolve([]);
            return;
        }

        const transaction = db.transaction([STORE_VOCAB], 'readonly');
        const store = transaction.objectStore(STORE_VOCAB);
        const request = store.getAll();

        request.onsuccess = () => {
            const allVocab = request.result as VocabularyItem[];
            const userVocab = allVocab.filter(v => v.userId === userId);
            resolve(userVocab.sort((a, b) => new Date(b.learnedAt).getTime() - new Date(a.learnedAt).getTime()));
        };
        request.onerror = () => reject(request.error);
    });
};

export const saveVocabulary = async (vocab: VocabularyItem): Promise<VocabularyItem> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_VOCAB], 'readwrite');
        const store = transaction.objectStore(STORE_VOCAB);
        const request = store.put(vocab);
        request.onsuccess = () => resolve(vocab);
        request.onerror = () => reject(request.error);
    });
};

export const deleteVocabulary = async (id: string): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_VOCAB], 'readwrite');
        const store = transaction.objectStore(STORE_VOCAB);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};