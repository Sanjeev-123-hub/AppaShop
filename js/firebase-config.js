// =============================================
// 🔥 Firebase Configuration
// Replace these values with YOUR Firebase project settings
// Go to: Firebase Console → Project Settings → Your Apps → SDK Setup
// =============================================

const firebaseConfig = {
  apiKey: "AIzaSyAdPHz3vWBxIyyiknpLdpa174GUUvazVUk",
  authDomain: "janagan-store-s.firebaseapp.com",
  databaseURL: "https://janagan-store-s-default-rtdb.firebaseio.com",
  projectId: "janagan-store-s",
  storageBucket: "janagan-store-s.firebasestorage.app",
  messagingSenderId: "704467623562",
  appId: "1:704467623562:web:ed2edeb1487526e28cd773"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firestore & Auth references
const db = firebase.firestore();
const auth = firebase.auth();

// =============================================
// 🏪 Shop Owner WhatsApp Number
// Change this to the shop owner's WhatsApp number (with country code)
// =============================================
const SHOP_WHATSAPP = "919876543210"; // Example: India +91 98765 43210
const SHOP_NAME = "Appa Kadai 🛒";

// =============================================
// 👤 Admin Email (used to check if user is admin)
// =============================================
const ADMIN_EMAIL = "admin@gmail.com";