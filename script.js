import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js';
        import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js';
        import { getDatabase, ref, set, onValue, remove, push, onDisconnect, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js';

        const firebaseConfig = {
            apiKey: "AIzaSyBs_Xx7blYUpsTyXwhQPk59qtQwlt5RSqg",
            authDomain: "datting-1.firebaseapp.com",
            databaseURL: "https://datting-1-default-rtdb.firebaseio.com",
            projectId: "datting-1",
            storageBucket: "datting-1.firebasestorage.app",
            messagingSenderId: "370882374309",
            appId: "1:370882374309:web:f84b7f4badb601c26ebb4c",
            measurementId: "G-PRHCFHPYF3"
        };

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const database = getDatabase(app);

        // Global variables
        let localStream = null;
        let remoteStream = null;
        let peerConnection = null;
        let currentUser = null;
        let currentRoom = null;
        let isInitiator = false;
        let isConnecting = false;
        let audioEnabled = true;
        let videoEnabled = true;

        // ICE servers configuration
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        // DOM elements
        const chatContainer = document.getElementById('chatContainer');
        const currentUserSpan = document.getElementById('currentUser');
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

        // Logout function
        window.logout = function() {
            signOut(auth).then(() => {
                window.location.href = 'auth.html';
            }).catch((error) => {
                console.error('Error signing out:', error);
            });
        };

        // Auth state observer
        onAuthStateChanged(auth, (user) => {
            if (user) {
                currentUser = user;
                currentUserSpan.textContent = user.displayName || user.email;
                chatContainer.style.display = 'block';
                initializeUserPresence();
                initializeMedia();
            } else {
                // Redirect to auth page if not logged in
                window.location.href = 'auth.html';
            }
        });

        // Initialize user presence
        function initializeUserPresence() {
            const userRef = ref(database, `users/${currentUser.uid}`);
            const onlineRef = ref(database, `online/${currentUser.uid}`);
            
            set(onlineRef, {
                username: currentUser.displayName || currentUser.email,
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
                localLabel.textContent = `You (${currentUser.displayName || currentUser.email})`;
            } catch (error) {
                console.error('Error accessing media devices:', error);
                status.textContent = 'Error: Could not access camera/microphone';
            }
        }

        // Find partner function
        window.findPartner = async function() {
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

                await setupPeerConnection();
                
            } catch (error) {
                console.error('Error finding partner:', error);
                status.textContent = 'Error finding partner';
                isConnecting = false;
                connectBtn.disabled = false;
            }
        };

        // Setup peer connection
        async function setupPeerConnection() {
            peerConnection = new RTCPeerConnection(configuration);

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
            setupSignalingListeners();

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
        function setupSignalingListeners() {
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
        window.skipPartner = function() {
            cleanupConnection();
            setTimeout(() => findPartner(), 1000);
        };

        // Stop connection
        window.stopConnection = function() {
            cleanupConnection();
            status.textContent = 'Disconnected. Click Connect to start again.';
            connectBtn.disabled = false;
        };

        // Toggle mute
        window.toggleMute = function() {
            if (localStream) {
                const audioTrack = localStream.getAudioTracks()[0];
                if (audioTrack) {
                    audioEnabled = !audioEnabled;
                    audioTrack.enabled = audioEnabled;
                    muteBtn.textContent = audioEnabled ? 'Mute' : 'Unmute';
                }
            }
        };

        // Toggle video
        window.toggleVideo = function() {
            if (localStream) {
                const videoTrack = localStream.getVideoTracks()[0];
                if (videoTrack) {
                    videoEnabled = !videoEnabled;
                    videoTrack.enabled = videoEnabled;
                    videoBtn.textContent = videoEnabled ? 'Video Off' : 'Video On';
                }
            }
        };

        // Handle disconnection
        function handleDisconnection() {
            status.textContent = 'Partner disconnected. Click Connect to find another.';
            remoteLabel.textContent = 'Waiting...';
            cleanupConnection();
        }

        // Cleanup connection
        function cleanupConnection() {
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

        // Logout function
        window.logout = async function() {
            try {
                cleanupConnection();
                if (localStream) {
                    localStream.getTracks().forEach(track => track.stop());
                    localStream = null;
                }
                await signOut(auth);
            } catch (error) {
                console.error('Error logging out:', error);
            }
        };

        // Cleanup on page reload/close
        window.addEventListener('beforeunload', () => {
            cleanupConnection();
            if (currentUser) {
                remove(ref(database, `online/${currentUser.uid}`));
            }
        });