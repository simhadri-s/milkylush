import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAc8-Aq07DwyGIuK_4XxsEUhPJ_GwEax4A",
  authDomain: "milkylush-5b0ae.firebaseapp.com",
  projectId: "milkylush-5b0ae",
  storageBucket: "milkylush-5b0ae.firebasestorage.app",
  messagingSenderId: "396394872038",
  appId: "1:396394872038:web:c8070779d912031c5c4f27",
  measurementId: "G-Y6C6GR66PR"
};


// Init Firebase & Firestore
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
