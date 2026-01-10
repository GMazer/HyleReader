
import { db, storage, auth } from "./firebaseConfig";
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs, setDoc } from "firebase/firestore";
import { ref, uploadString, getDownloadURL, deleteObject } from "firebase/storage";
import { Book, BookStatus } from "./types";

// Upload văn bản dài lên Storage (để tránh giới hạn Firestore)
const uploadTextToStorage = async (text: string, bookId: string): Promise<string> => {
    if (!auth.currentUser) throw new Error("User not logged in");
    const storageRef = ref(storage, `users/${auth.currentUser.uid}/books/${bookId}/fullText.txt`);
    await uploadString(storageRef, text);
    return await getDownloadURL(storageRef);
};

// Tải văn bản từ Storage
export const fetchTextFromStorage = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url);
        return await response.text();
    } catch (error) {
        console.error("Error fetching text:", error);
        return "";
    }
};

export const addBookToFirebase = async (book: Book): Promise<Book> => {
    if (!auth.currentUser) throw new Error("Vui lòng đăng nhập");

    try {
        // 1. Tạo ID mới cho document trước
        const newBookRef = doc(collection(db, "books"));
        const bookId = newBookRef.id;

        // 2. Upload fullText lên Storage
        const textUrl = await uploadTextToStorage(book.fullText || "", bookId);

        // 3. Chuẩn bị dữ liệu để lưu Firestore (bỏ fullText nặng nề)
        const firestoreBookData = {
            ...book,
            id: bookId,
            userId: auth.currentUser.uid,
            textStorageUrl: textUrl,
            fullText: null // Không lưu fullText vào Firestore
        };

        // 4. Lưu vào Firestore
        await setDoc(newBookRef, firestoreBookData);

        return { ...book, id: bookId, textStorageUrl: textUrl };
    } catch (error) {
        console.error("Error adding book to Firebase:", error);
        throw error;
    }
};

export const getUserBooks = async (): Promise<Book[]> => {
    if (!auth.currentUser) return [];

    const q = query(collection(db, "books"), where("userId", "==", auth.currentUser.uid));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Trả về metadata, fullText sẽ load sau khi mở sách (lazy loading)
        return { ...data, id: doc.id } as Book;
    });
};

export const updateBookInFirebase = async (book: Book) => {
    if (!auth.currentUser || !book.id) return;

    try {
        const bookRef = doc(db, "books", book.id);
        // Chỉ update các trường metadata, không update lại textStorageUrl trừ khi cần thiết
        const { fullText, ...updateData } = book; 
        await updateDoc(bookRef, updateData as any);
    } catch (error) {
        console.error("Error updating book:", error);
    }
};

export const deleteBookFromFirebase = async (bookId: string) => {
    if (!auth.currentUser) return;
    try {
        // 1. Xóa doc trong Firestore
        await deleteDoc(doc(db, "books", bookId));
        
        // 2. Xóa file text trong Storage (Optional: Clean up)
        const storageRef = ref(storage, `users/${auth.currentUser.uid}/books/${bookId}/fullText.txt`);
        await deleteObject(storageRef).catch(err => console.log("File may not exist", err));
        
    } catch (error) {
        console.error("Error deleting book:", error);
    }
};
