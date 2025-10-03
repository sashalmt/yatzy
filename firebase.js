// Replace with your Firebase project settings
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

// Initialize
const appFb = firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Helpers for DB paths
function roomRef(code){ return db.ref('rooms/'+code); }
function profileRef(uid){ return db.ref('profiles/'+uid); }
function genCode(){ return Math.random().toString(36).slice(2,7).toUpperCase(); }
