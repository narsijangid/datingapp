import { ref, set, onValue, remove, push, onDisconnect, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js';
import { iceConfiguration } from './config.js';

// Global variables
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let currentRoom = null;
let isInitiator = false;
let isConnecting = false;
let audioEnabled = true;
let videoEnabled = true;

// DOM elements
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const localLabel = document.getElementById('localLabel');
const remoteLabel = document.getElementById('remoteLabel');
const status = document.getElementById('status');
const connectBtn = document.getElementById('connectBtn');
const skipBtn = document.getElementById('skipBtn');
const stopBtn = document.getElementById('stopBtn');
const muteBtn = document.getElementById('muteBtn');
const videoBtn = document.getElementById('videoBtn');

// Initialize user presence
function initializeUserPresence(user, database) {
    const userRef = ref(database, `users/${user.uid}`);
    const onlineRef = ref(database, `online/${user.uid}`);
    
    set(onlineRef, {
        username: user.displayName || user.email,
        timestamp: serverTimestamp()
    });

    onDisconnect(onlineRef).remove();
}

// Initialize media
async function initializeMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        localVideo.srcObject = localStream;
        const currentUser = JSON.parse(localStorage.getItem('currentUser')) || {};
        localLabel.textContent = `You (${currentUser.displayName || currentUser.email || 'User'})`;
    } catch (error) {
        console.error('Error accessing media devices:', error);
        status.textContent = 'Error: Could not access camera/microphone';
    }
}

// Find partner function
async function findPartner(database, currentUser) {
    if (isConnecting) return;
    
    isConnecting = true;
    connectBtn.disabled = true;
    status.textContent = 'Looking for partner...';

    try {
        // Check for waiting users
        const waitingRef = ref(database, 'waiting');
        const snapshot = await new Promise((resolve) => {
            onValue(waitingRef, resolve, { onlyOnce: true });
        });

        const waitingUsers = snapshot.val();
        let foundPartner = false;

        if (waitingUsers) {
            // Find available partner
            for (const [userId, userData] of Object.entries(waitingUsers)) {
                if (userId !== currentUser.uid) {
                    // Join existing room
                    currentRoom = userData.roomId;
                    isInitiator = false;
                    
                    // Remove partner from waiting list
                    await remove(ref(database, `waiting/${userId}`));
                    
                    foundPartner = true;
                    break;
                }
            }
        }

        if (!foundPartner) {
            // Create new room and wait
            currentRoom = push(ref(database, 'rooms')).key;
            isInitiator = true;
            
            await set(ref(database, `waiting/${currentUser.uid}`), {
                username: currentUser.displayName || currentUser.email,
                roomId: currentRoom,
                timestamp: serverTimestamp()
            });
        }

        await setupPeerConnection(database, currentUser);
        
    } catch (error) {
        console.error('Error finding partner:', error);
        status.textContent = 'Error finding partner';
        isConnecting = false;
        connectBtn.disabled = false;
    }
}

// Setup peer connection
async function setupPeerConnection(database, currentUser) {
    peerConnection = new RTCPeerConnection(iceConfiguration);

    // Add local stream
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }

    // Handle remote stream
    peerConnection.ontrack = (event) => {
        remoteStream = event.streams[0];
        remoteVideo.srcObject = remoteStream;
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            set(ref(database, `rooms/${currentRoom}/candidates/${currentUser.uid}/${Date.now()}`), {
                candidate: event.candidate.toJSON()
            });
        }
    };

    // Connection state monitoring
    peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        if (state === 'connected') {
            status.textContent = 'Connected!';
            connectBtn.disabled = true;
            skipBtn.disabled = false;
            stopBtn.disabled = false;
            isConnecting = false;
        } else if (state === 'disconnected' || state === 'failed') {
            handleDisconnection();
        }
    };

    // Listen for signaling
    setupSignalingListeners(database, currentUser);

    if (isInitiator) {
        status.textContent = 'Waiting for partner...';
    } else {
        // Join existing connection
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        await set(ref(database, `rooms/${currentRoom}/offer`), {
            sdp: offer.sdp,
            type: offer.type,
            from: currentUser.uid,
            username: currentUser.displayName || currentUser.email
        });
    }
}

// Setup signaling listeners
function setupSignalingListeners(database, currentUser) {
    // Listen for offers
    onValue(ref(database, `rooms/${currentRoom}/offer`), async (snapshot) => {
        const offer = snapshot.val();
        if (offer && offer.from !== currentUser.uid && peerConnection.signalingState === 'stable') {
            remoteLabel.textContent = offer.username;
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            await set(ref(database, `rooms/${currentRoom}/answer`), {
                sdp: answer.sdp,
                type: answer.type,
                from: currentUser.uid,
                username: currentUser.displayName || currentUser.email
            });
        }
    });

    // Listen for answers
    onValue(ref(database, `rooms/${currentRoom}/answer`), async (snapshot) => {
        const answer = snapshot.val();
        if (answer && answer.from !== currentUser.uid) {
            remoteLabel.textContent = answer.username;
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
    });

    // Listen for ICE candidates
    onValue(ref(database, `rooms/${currentRoom}/candidates`), (snapshot) => {
        const candidates = snapshot.val();
        if (candidates) {
            Object.keys(candidates).forEach(userId => {
                if (userId !== currentUser.uid) {
                    Object.values(candidates[userId]).forEach(async (candidateData) => {
                        try {
                            await peerConnection.addIceCandidate(new RTCIceCandidate(candidateData.candidate));
                        } catch (error) {
                            console.error('Error adding ICE candidate:', error);
                        }
                    });
                }
            });
        }
    });
}

// Skip partner
function skipPartner(database, currentUser) {
    cleanupConnection(database, currentUser);
    setTimeout(() => findPartner(database, currentUser), 1000);
}

// Stop connection
function stopConnection(database, currentUser) {
    cleanupConnection(database, currentUser);
    status.textContent = 'Disconnected. Click Connect to start again.';
    connectBtn.disabled = false;
}

// Toggle mute
function toggleMute() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioEnabled = !audioEnabled;
            audioTrack.enabled = audioEnabled;
            muteBtn.textContent = audioEnabled ? 'Mute' : 'Unmute';
        }
    }
}

// Toggle video
function toggleVideo() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoEnabled = !videoEnabled;
            videoTrack.enabled = videoEnabled;
            videoBtn.textContent = videoEnabled ? 'Video Off' : 'Video On';
        }
    }
}

// Handle disconnection
function handleDisconnection() {
    status.textContent = 'Partner disconnected. Click Connect to find another.';
    remoteLabel.textContent = 'Waiting...';
    cleanupConnection();
}

// Cleanup connection
function cleanupConnection(database, currentUser) {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    if (currentRoom) {
        remove(ref(database, `rooms/${currentRoom}`));
        currentRoom = null;
    }

    if (currentUser) {
        remove(ref(database, `waiting/${currentUser.uid}`));
    }

    remoteVideo.srcObject = null;
    remoteStream = null;
    isInitiator = false;
    isConnecting = false;
    
    connectBtn.disabled = false;
    skipBtn.disabled = true;
    stopBtn.disabled = true;
    remoteLabel.textContent = 'Waiting...';
}

// Cleanup on page reload/close
window.addEventListener('beforeunload', () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
});

// Export functions
export {
    initializeUserPresence,
    initializeMedia,
    findPartner,
    skipPartner,
    stopConnection,
    toggleMute,
    toggleVideo,
    cleanupConnection
};