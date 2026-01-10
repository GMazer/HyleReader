
import { Book } from './types';

const DB_NAME = 'HyleReaderDB';
const DB_VERSION = 1;
const STORE_NAME = 'books';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const getAllBooks = async (userId: string): Promise<Book[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
        const allBooks = request.result as Book[];
        // Chỉ trả về sách của user hiện tại
        const userBooks = allBooks.filter(book => book.userId === userId);
        resolve(userBooks.sort((a, b) => new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime()));
    };
    request.onerror = () => reject(request.error);
  });
};

export const saveBook = async (book: Book): Promise<Book> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
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
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getBookById = async (id: string): Promise<Book | undefined> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
  
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
};
    