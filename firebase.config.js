const firebaseConfig = {
  apiKey: "AIzaSyDA_0xr9chjViETqPA1Qdj-_Sla31buQcY",
  authDomain: "rse-by-design.firebaseapp.com",
  databaseURL: "https://rse-by-design-default-rtdb.firebaseio.com",
  projectId: "rse-by-design",
  storageBucket: "rse-by-design.firebasestorage.app",
  messagingSenderId: "1083661648116",
  appId: "1:1083661648116:web:f4e918cc05a7909aac1ea1",
  measurementId: "G-B4HQPLZJ7C"
};

// Initialize Firebase (compat)
firebase.initializeApp(firebaseConfig);

// Realtime database reference
const db = firebase.database();
