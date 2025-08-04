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
        let chatMessagesRef = null;
        let chatMessagesListener = null;
        let unreadMessages = 0;

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
        const userProfilePic = document.getElementById('userProfilePic');
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
        const chatIcon = document.getElementById('chatIcon');
        const chatSidebar = document.getElementById('chatSidebar');
        const closeChat = document.getElementById('closeChat');
        const chatMessages = document.getElementById('chatMessages');
        const chatInput = document.getElementById('chatInput');
        const sendChatBtn = document.getElementById('sendChatBtn');
        const chatBadge = document.getElementById('chatBadge');

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
                
                // Set profile picture - use default if none available
                const defaultPhotoURL = 'https://img.freepik.com/free-vector/man-profile-account-picture_24908-81754.jpg?semt=ais_hybrid&w=740&q=80';
                const profilePicUrl = user.photoURL || defaultPhotoURL;
                userProfilePic.src = profilePicUrl;
                
                // Update sidebar profile pic if element exists
                const sidebarProfilePic = document.getElementById('sidebarProfilePic');
                if (sidebarProfilePic) {
                    sidebarProfilePic.src = profilePicUrl;
                }
                
                chatContainer.style.display = 'block';
                initializeUserPresence();
                initializeMedia();
                initializeOnlineCount();
                initializeChat();
                
                // Initialize sidebar if it exists
                if (typeof initProfileSidebar === 'function') {
                    initProfileSidebar();
                }
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

        // Initialize online user count
        function initializeOnlineCount() {
            const onlineRef = ref(database, 'online');
            const onlineCountElement = document.getElementById('onlineCount');
            
            if (!onlineCountElement) return;
            
            // Listen for changes in the online users
            onValue(onlineRef, (snapshot) => {
                const onlineUsers = snapshot.val();
                const count = onlineUsers ? Object.keys(onlineUsers).length : 0;
                onlineCountElement.textContent = count;
            });
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

        // Chat functionality
        function initializeChat() {
            const chatIcon = document.getElementById('chatIcon');
            const chatSidebar = document.getElementById('chatSidebar');
            const closeChat = document.getElementById('closeChat');
            const chatMessages = document.getElementById('chatMessages');
            const chatInput = document.getElementById('chatInput');
            const sendChatBtn = document.getElementById('sendChatBtn');
            const chatBadge = document.getElementById('chatBadge');

            if (!chatIcon || !chatSidebar) {
                console.error('Chat elements not found');
                return;
            }

            // Open chat sidebar
            chatIcon.addEventListener('click', () => {
                console.log('Chat icon clicked');
                chatSidebar.classList.add('active');
                document.body.style.overflow = 'hidden';
                
                // Mark messages as read when opening chat
                unreadMessages = 0;
                updateChatBadge();
            });

            // Close chat sidebar
            closeChat.addEventListener('click', closeChatSidebar);
            document.addEventListener('click', (e) => {
                if (e.target === chatSidebar) {
                    closeChatSidebar();
                }
            });

            function closeChatSidebar() {
                chatSidebar.classList.remove('active');
                document.body.style.overflow = '';
            }

            // Send message
            sendChatBtn.addEventListener('click', sendMessage);
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });

            function sendMessage() {
                const message = chatInput.value.trim();
                if (!message || !currentRoom || !currentUser) return;

                const messageData = {
                    text: message,
                    sender: currentUser.uid,
                    username: currentUser.displayName || currentUser.email,
                    timestamp: serverTimestamp()
                };

                push(ref(database, `rooms/${currentRoom}/messages`), messageData);
                chatInput.value = '';
            }

            // Listen for messages
            function setupChatListeners() {
                if (chatMessagesListener) {
                    chatMessagesListener();
                }

                if (!currentRoom) return;

                chatMessagesRef = ref(database, `rooms/${currentRoom}/messages`);
                chatMessagesListener = onValue(chatMessagesRef, (snapshot) => {
                    const messages = snapshot.val();
                    displayMessages(messages);
                });
            }

            function displayMessages(messages) {
                if (!messages) {
                    chatMessages.innerHTML = `
                        <div class="chat-welcome">
                            <i class="fas fa-comments"></i>
                            <p>Start chatting with your match!</p>
                        </div>
                    `;
                    return;
                }

                chatMessages.innerHTML = '';
                const messageArray = Object.entries(messages).map(([key, value]) => ({
                    id: key,
                    ...value
                })).sort((a, b) => a.timestamp - b.timestamp);

                messageArray.forEach(message => {
                    const messageDiv = document.createElement('div');
                    messageDiv.className = `chat-message ${message.sender === currentUser.uid ? 'sent' : 'received'}`;
                    
                    const time = message.timestamp ? new Date(message.timestamp).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                    }) : '';
                    
                    messageDiv.innerHTML = `
                        ${message.text}
                        ${time ? `<div class="timestamp">${time}</div>` : ''}
                    `;
                    
                    chatMessages.appendChild(messageDiv);
                });

                // Auto-scroll to bottom
                chatMessages.scrollTop = chatMessages.scrollHeight;

                // Count unread messages if chat is closed
                if (!chatSidebar.classList.contains('active')) {
                    const newMessages = messageArray.filter(msg => 
                        msg.sender !== currentUser.uid && 
                        !msg.read && 
                        msg.timestamp > (Date.now() - 300000) // Last 5 minutes
                    );
                    unreadMessages = newMessages.length;
                    updateChatBadge();
                }
            }



            // Expose functions for use in other parts
            window.setupChatListeners = setupChatListeners;
            window.closeChatSidebar = closeChatSidebar;
        }

        // Update connection setup to include chat
        const originalSetupPeerConnection = setupPeerConnection;
        setupPeerConnection = async function() {
            await originalSetupPeerConnection();
            if (typeof setupChatListeners === 'function') {
                setupChatListeners();
            }
        };

        // Update cleanup to include chat
        const originalCleanupConnection = cleanupConnection;
        cleanupConnection = function() {
            originalCleanupConnection();
            
            // Clean up chat listeners
            if (chatMessagesListener) {
                chatMessagesListener();
                chatMessagesListener = null;
            }
            
            // Clear chat messages
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                chatMessages.innerHTML = `
                    <div class="chat-welcome">
                        <i class="fas fa-comments"></i>
                        <p>Start chatting with your match!</p>
                    </div>
                `;
            }
            
            unreadMessages = 0;
            updateChatBadge();
        };

        // Global chat badge update function
        window.updateChatBadge = function() {
            const chatBadge = document.getElementById('chatBadge');
            if (chatBadge) {
                if (unreadMessages > 0) {
                    chatBadge.textContent = unreadMessages;
                    chatBadge.style.display = 'flex';
                } else {
                    chatBadge.style.display = 'none';
                }
            }
        };

        // Cleanup on page reload/close
        window.addEventListener('beforeunload', () => {
            cleanupConnection();
            if (currentUser) {
                remove(ref(database, `online/${currentUser.uid}`));
            }
        });
