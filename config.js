// Firebase configuration
export const firebaseConfig = {
    apiKey: "AIzaSyBs_Xx7blYUpsTyXwhQPk59qtQwlt5RSqg",
    authDomain: "datting-1.firebaseapp.com",
    databaseURL: "https://datting-1-default-rtdb.firebaseio.com",
    projectId: "datting-1",
    storageBucket: "datting-1.firebasestorage.app",
    messagingSenderId: "370882374309",
    appId: "1:370882374309:web:f84b7f4badb601c26ebb4c",
    measurementId: "G-PRHCFHPYF3"
};

// ICE servers configuration
export const iceConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};