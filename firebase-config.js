/*******************************************************
 *  FIREBASE CONFIGURATION
 *  RSE by Design - Ethical Ecosystem Game
 *******************************************************/

// Your Firebase configuration
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDA_0xr9chjViETqPA1Qdj-_Sla31buQcY",
    authDomain: "rse-by-design.firebaseapp.com",
    databaseURL: "https://rse-by-design-default-rtdb.firebaseio.com",
    projectId: "rse-by-design",
    storageBucket: "rse-by-design.firebasestorage.app",
    messagingSenderId: "1083661648116",
    appId: "1:1083661648116:web:f4e918cc05a7909aac1ea1",
    measurementId: "G-B4HQPLZJ7C"
};

// Make it globally available
if (typeof window !== 'undefined') {
    window.FIREBASE_CONFIG = FIREBASE_CONFIG;
}