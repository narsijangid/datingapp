import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js';
import { getDatabase, ref, set, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js';
import { firebaseConfig } from './config.js';
import { initializeUserPresence, initializeMedia, cleanupConnection } from './video.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// Authentication state
let isSignup = false;
let currentUser = null;

// Wait for DOM to be fully loaded before accessing elements
document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const authContainer = document.getElementById('authContainer');
    const chatContainer = document.getElementById('chatContainer');
    const authTitle = document.getElementById('authTitle');
    const authBtn = document.getElementById('authBtn');
    const toggleAuth = document.getElementById('toggleAuth');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const usernameInput = document.getElementById('username');
    const currentUserSpan = document.getElementById('currentUser');

    // Authentication event listeners
    toggleAuth.addEventListener('click', () => {
        isSignup = !isSignup;
        if (isSignup) {
            authTitle.textContent = 'Sign Up';
            authBtn.textContent = 'Sign Up';
            toggleAuth.textContent = 'Already have an account? Login';
            usernameInput.style.display = 'block';
        } else {
            authTitle.textContent = 'Login';
            authBtn.textContent = 'Login';
            toggleAuth.textContent = "Don't have an account? Sign up";
            usernameInput.style.display = 'none';
        }
    });

    authBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const username = usernameInput.value.trim();

        if (!email || !password || (isSignup && !username)) {
            alert('Please fill all fields');
            return;
        }

        try {
            if (isSignup) {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName: username });
                await set(ref(database, `users/${userCredential.user.uid}`), {
                    username: username,
                    email: email,
                    lastSeen: serverTimestamp()
                });
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (error) {
            alert('Authentication failed: ' + error.message);
        }
    });

    // Auth state observer
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            currentUserSpan.textContent = user.displayName || user.email;
            authContainer.style.display = 'none';
            chatContainer.style.display = 'block';
            initializeUserPresence(user, database);
            initializeMedia();
        } else {
            currentUser = null;
            authContainer.style.display = 'block';
            chatContainer.style.display = 'none';
            cleanupConnection();
        }
    });

    // Logout function
    window.logout = async function() {
        try {
            cleanupConnection();
            await signOut(auth);
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };
});

export { auth, database, currentUser };