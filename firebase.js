// firebase.js

const firebaseConfig = {
  apiKey: "AIzaSyDudE8w4AZx9o3sB3pdaVFQah1GeIGJI3M",
  authDomain: "applev1demo.firebaseapp.com",
  projectId: "applev1demo",
  storageBucket: "applev1demo.firebasestorage.app",
  messagingSenderId: "1046800874782",
  appId: "1:1046800874782:web:11ce7b86b406035808dd0f",
  measurementId: "G-SC03N02S0R"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// 🔥 Variables globales para todos los archivos
window.auth = firebase.auth();
window.db = firebase.firestore();
window.rtdb = firebase.database();

try {
  window.db.settings({
    experimentalForceLongPolling: true
  });
} catch (e) {
  console.warn("Firestore settings ya estaban aplicadas:", e);
}

window.storage = null;

if (firebase.storage) {
  window.storage = firebase.storage();
}

console.log("Firebase conectado correctamente:", {
  auth: !!window.auth,
  db: !!window.db,
  rtdb: !!window.rtdb,
  storage: !!window.storage
});