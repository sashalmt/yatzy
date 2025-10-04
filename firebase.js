const firebaseConfig = {
  apiKey: "AIzaSyCnYFbO9pbcdUB_BsjCx_V42ZVoRU3cYPo",
  authDomain: "yatzy-c2308.firebaseapp.com",
  databaseURL: "https://yatzy-c2308-default-rtdb.firebaseio.com",
  projectId: "yatzy-c2308",
  storageBucket: "yatzy-c2308.firebasestorage.app",
  messagingSenderId: "28328420169",
  appId: "1:28328420169:web:180c9d1f1aa6e08fc97098"
};

// Initialize Firebase
//const app = initializeApp(firebaseConfig);
const appFb = firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Helpers used by app.js
function roomRef(code){ return db.ref('rooms/' + code); }
function profileRef(uid){ return db.ref('profiles/' + uid); }
function genCode(){ return Math.random().toString(36).slice(2,7).toUpperCase(); }
