import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js';
import { getDatabase, ref, remove } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js';
import { firebaseConfig } from './config.js';
import { auth, database, currentUser } from './auth.js';
import { findPartner, skipPartner, stopConnection, toggleMute, toggleVideo } from './video.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Set up global functions for HTML buttons
window.findPartner = () => findPartner(database, currentUser);
window.skipPartner = () => skipPartner(database, currentUser);
window.stopConnection = () => stopConnection(database, currentUser);
window.toggleMute = toggleMute;
window.toggleVideo = toggleVideo;

// Cleanup on page reload/close
window.addEventListener('beforeunload', () => {
    if (currentUser) {
        remove(ref(database, `online/${currentUser.uid}`));
    }
});