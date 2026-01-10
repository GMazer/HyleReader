
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDlIOa8tLH353j8uqhD0LmOWPpecK1RVAw",
  authDomain: "hylebook.firebaseapp.com",
  projectId: "hylebook",
  storageBucket: "hylebook.firebasestorage.app",
  messagingSenderId: "622499423410",
  appId: "1:622499423410:web:1fe9ad3a688b76e5ef15ab",
  measurementId: "G-KNCTXBPGBS"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
