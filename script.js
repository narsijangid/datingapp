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

        // Nearest People Map Functionality
        let nearbyUsers = [];
        let mapAnimationInterval;

        // Initialize nearest people functionality
        function initNearestPeople() {
            const nearestPeopleBtn = document.getElementById('nearestPeopleBtn');
            const nearestPeopleModal = document.getElementById('nearestPeopleModal');
            const closeNearestModal = document.getElementById('closeNearestModal');
            const refreshLocations = document.getElementById('refreshLocations');
            const toggleView = document.getElementById('toggleView');

            // Open modal
            nearestPeopleBtn.addEventListener('click', () => {
                nearestPeopleModal.classList.add('active');
                generateNearbyUsers();
                startMapAnimations();
                document.body.style.overflow = 'hidden';
            });

            // Close modal
            closeNearestModal.addEventListener('click', () => {
                nearestPeopleModal.classList.remove('active');
                stopMapAnimations();
                document.body.style.overflow = '';
            });

            // Close modal when clicking outside
            nearestPeopleModal.addEventListener('click', (e) => {
                if (e.target === nearestPeopleModal) {
                    nearestPeopleModal.classList.remove('active');
                    stopMapAnimations();
                    document.body.style.overflow = '';
                }
            });

            // Refresh locations
            refreshLocations.addEventListener('click', () => {
                generateNearbyUsers();
                showNotification('Locations refreshed!', 'success');
            });

            // Toggle view (placeholder for future enhancement)
            toggleView.addEventListener('click', () => {
                showNotification('Full screen mode coming soon!', 'info');
            });
        }

        // Generate nearby users with real Firebase data
        async function generateNearbyUsers() {
            const nearbyUsersContainer = document.getElementById('nearbyUsers');
            const usersScroll = document.getElementById('usersScroll');
            
            // Clear existing users
            nearbyUsersContainer.innerHTML = '';
            usersScroll.innerHTML = '';
            nearbyUsers = [];

            try {
                // Get current user's location
                let currentLocation = { lat: 0, lng: 0 };
                
                // Try to get user's actual location
                try {
                    const position = await new Promise((resolve, reject) => {
                        if (!navigator.geolocation) {
                            reject(new Error('Geolocation not supported'));
                            return;
                        }
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            timeout: 5000,
                            enableHighAccuracy: true
                        });
                    });
                    currentLocation.lat = position.coords.latitude;
                    currentLocation.lng = position.coords.longitude;
                } catch (geoError) {
                    console.log('Using fallback location:', geoError.message);
                    // Use fallback location
                    currentLocation = { lat: 0, lng: 0 };
                }

                // Fetch real users from Firebase
                const onlineRef = ref(database, 'online');
                const usersRef = ref(database, 'users');
                
                // Get online users
                const onlineSnapshot = await new Promise((resolve) => {
                    onValue(onlineRef, resolve, { onlyOnce: true });
                });

                const usersSnapshot = await new Promise((resolve) => {
                    onValue(usersRef, resolve, { onlyOnce: true });
                });

                const onlineUsers = onlineSnapshot.val() || {};
                const allUsers = usersSnapshot.val() || {};

                // Filter out current user and create nearby users
                const nearbyUserList = [];
                Object.keys(onlineUsers).forEach(userId => {
                    if (userId !== currentUser.uid && allUsers[userId]) {
                        const userData = allUsers[userId];
                        nearbyUserList.push({
                            id: userId,
                            name: userData.displayName || userData.username || 'User',
                            distance: calculateDistance(currentLocation, userData.location || { lat: 0, lng: 0 }),
                            status: 'online',
                            position: {
                                x: Math.random() * 80 + 10,
                                y: Math.random() * 80 + 10
                            },
                            profile: userData
                        });
                    }
                });

                // Sort by distance and limit to 15 users
                nearbyUserList.sort((a, b) => a.distance - b.distance);
                nearbyUsers = nearbyUserList.slice(0, 15);

                // Display users on map
                nearbyUsers.forEach(user => {
                    // Create map user marker
                    const userMarker = document.createElement('div');
                    userMarker.className = `nearby-user ${user.status}`;
                    userMarker.style.left = `${user.position.x}%`;
                    userMarker.style.top = `${user.position.y}%`;
                    
                    const profilePic = user.profile?.photoURL || 'https://via.placeholder.com/40x40/4CAF50/ffffff?text=' + (user.name.charAt(0) || '?');
                    
                    userMarker.innerHTML = `
                        <div class="user-pin">
                            <div class="user-avatar-pin ${user.status}" 
                                 style="background-image: url('${profilePic}')">
                            </div>
                            <div class="user-pin-marker ${user.status}"></div>
                            <div class="user-name-label">${user.name}</div>
                        </div>
                    `;
                    
                    userMarker.title = `${user.name} - ${user.distance.toFixed(1)}km away`;
                    userMarker.addEventListener('click', () => showUserProfile(user));
                    nearbyUsersContainer.appendChild(userMarker);

                    // Create user card
                    const userCard = document.createElement('div');
                    userCard.className = 'nearby-user-card';
                    userCard.innerHTML = `
                        <div class="user-avatar">${user.name.charAt(0)}</div>
                        <div class="user-info">
                            <div class="user-name">${user.name}</div>
                            <div class="user-distance">${user.distance.toFixed(1)} km away</div>
                        </div>
                        <span class="user-status ${user.status}">${user.status}</span>
                    `;
                    userCard.addEventListener('click', () => showUserProfile(user));
                    usersScroll.appendChild(userCard);
                });

                if (nearbyUsers.length === 0) {
                    usersScroll.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-light);">No users nearby right now. Try refreshing!</div>';
                }

                // Create connection lines
                createConnectionLines();

            } catch (error) {
                console.error('Error fetching nearby users:', error);
                // Fallback to showing a message
                usersScroll.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-light);">Unable to load nearby users. Please try again.</div>';
            }
        }

        // Calculate distance between two locations (Haversine formula)
        function calculateDistance(loc1, loc2) {
            if (!loc1 || !loc2 || !loc1.lat || !loc2.lat) return Math.random() * 5 + 0.5;
            
            const R = 6371; // Earth's radius in km
            const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
            const dLng = (loc2.lng - loc1.lng) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        }

        // Update user location in Firebase
        function updateUserLocation() {
            if (!currentUser || !navigator.geolocation) return;

            navigator.geolocation.getCurrentPosition((position) => {
                const userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    timestamp: serverTimestamp()
                };

                set(ref(database, `users/${currentUser.uid}/location`), userLocation);
            }, (error) => {
                console.log('Location access denied, using approximate location');
                // Use approximate location based on IP
                fetch('https://ipapi.co/json/')
                    .then(response => response.json())
                    .then(data => {
                        const userLocation = {
                            lat: data.latitude || 0,
                            lng: data.longitude || 0,
                            timestamp: serverTimestamp()
                        };
                        set(ref(database, `users/${currentUser.uid}/location`), userLocation);
                    })
                    .catch(() => {
                        // Fallback to random location
                        const userLocation = {
                            lat: Math.random() * 180 - 90,
                            lng: Math.random() * 360 - 180,
                            timestamp: serverTimestamp()
                        };
                        set(ref(database, `users/${currentUser.uid}/location`), userLocation);
                    });
            });
        }

        // Create animated connection lines
        function createConnectionLines() {
            const connectionLines = document.getElementById('connectionLines');
            connectionLines.innerHTML = '';

            // Create 3-5 connection lines
            const lineCount = Math.floor(Math.random() * 3) + 3;
            
            for (let i = 0; i < lineCount; i++) {
                const line = document.createElement('div');
                line.className = 'connection-line';
                
                // Random angle and position
                const angle = Math.random() * 360;
                const length = Math.random() * 100 + 50;
                const startX = Math.random() * 80 + 10;
                const startY = Math.random() * 80 + 10;

                line.style.width = `${length}px`;
                line.style.left = `${startX}%`;
                line.style.top = `${startY}%`;
                line.style.transform = `rotate(${angle}deg)`;
                line.style.animationDelay = `${Math.random() * 2}s`;
                
                connectionLines.appendChild(line);
            }
        }

        // Show user profile (placeholder)
        function showUserProfile(user) {
            showNotification(`Viewing profile of ${user.name} - ${user.distance}km away`, 'info');
        }

        // Start map animations
        function startMapAnimations() {
            // Add periodic user position updates
            mapAnimationInterval = setInterval(() => {
                const users = document.querySelectorAll('.nearby-user');
                users.forEach(user => {
                    const currentX = parseFloat(user.style.left);
                    const currentY = parseFloat(user.style.top);
                    
                    // Small random movement
                    const newX = Math.max(10, Math.min(90, currentX + (Math.random() - 0.5) * 2));
                    const newY = Math.max(10, Math.min(90, currentY + (Math.random() - 0.5) * 2));
                    
                    user.style.transition = 'all 2s ease';
                    user.style.left = `${newX}%`;
                    user.style.top = `${newY}%`;
                });
            }, 5000);
        }

        // Stop map animations
        function stopMapAnimations() {
            if (mapAnimationInterval) {
                clearInterval(mapAnimationInterval);
                mapAnimationInterval = null;
            }
        }

        // Initialize nearest people on page load
        document.addEventListener('DOMContentLoaded', () => {
            initNearestPeople();
        });

        // Google Apps Script URL for report submission
        // Replace with your actual deployment URL from SETUP-INSTRUCTIONS.md
        const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwSQFIerPV0q2gSext23kcTwF8HgOn_sc75Pk7tTMo/exec';

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
        let blockedUsers = new Set();
        let currentRemoteUser = null;

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
        const muteBtn = document.getElementById('muteControlBtn');
        const videoBtn = document.getElementById('videoControlBtn');
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
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user;
                currentUserSpan.textContent = user.displayName || user.email;
                
                // Update user location
                updateUserLocation();
                
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
                
                // Load blocked users
                await loadBlockedUsers();
                
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
            
            // Show waiting text and loading poster
            remoteLabel.textContent = 'Waiting for match...';
            remoteVideo.poster = 'https://cdn.dribbble.com/userupload/20286631/file/original-70c1d630e4b751b708ceac9d9392a3fc.gif';

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
            peerConnection.onconnectionstatechange = async () => {
                const state = peerConnection.connectionState;
                if (state === 'connected') {
                    status.textContent = 'Connected!';
                    connectBtn.disabled = true;
                    skipBtn.disabled = false;
                    stopBtn.disabled = false;
                    isConnecting = false;
                    
                    // Set remote user info when connection is established
                    await setRemoteUserInfo();
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
                    const muteBtnIcon = muteBtn.querySelector('i');
                    if (muteBtnIcon) {
                        muteBtnIcon.className = audioEnabled ? 'fas fa-microphone' : 'fas fa-microphone-slash';
                    }
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
                    const videoBtnIcon = videoBtn.querySelector('i');
                    if (videoBtnIcon) {
                        videoBtnIcon.className = videoEnabled ? 'fas fa-video' : 'fas fa-video-slash';
                    }
                }
            }
        };

        // Handle disconnection
        function handleDisconnection() {
            status.textContent = 'Partner disconnected. Click Connect to find another.';
            remoteLabel.textContent = '';
            remoteVideo.poster = 'https://i.pinimg.com/originals/c2/92/81/c292819d407be94d89c5ccac40063146.gif';
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

            // Clear remote user info
            currentRemoteUser = null;

            remoteVideo.srcObject = null;
            remoteStream = null;
            isInitiator = false;
            isConnecting = false;
            
            connectBtn.disabled = false;
            skipBtn.disabled = true;
            stopBtn.disabled = true;
            remoteLabel.textContent = '';
            remoteVideo.poster = 'https://i.pinimg.com/originals/c2/92/81/c292819d407be94d89c5ccac40063146.gif';
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

        // Function to set remote user info when connection is established
        async function setRemoteUserInfo() {
            if (!currentRoom || !currentUser) return;

            try {
                const roomRef = ref(database, `rooms/${currentRoom}`);
                const snapshot = await new Promise((resolve) => {
                    onValue(roomRef, resolve, { onlyOnce: true });
                });

                const roomData = snapshot.val();
                if (roomData) {
                    // Find the other user in the room
                    const users = Object.keys(roomData).filter(key => key !== currentUser.uid);
                    if (users.length > 0) {
                        const remoteUserId = users[0];
                        
                        // Get remote user info from online users or room data
                        let remoteUserInfo = {
                            uid: remoteUserId,
                            displayName: 'Unknown User'
                        };

                        // Try to get from online users
                        const onlineRef = ref(database, `online/${remoteUserId}`);
                        const onlineSnapshot = await new Promise((resolve) => {
                            onValue(onlineRef, resolve, { onlyOnce: true });
                        });

                        if (onlineSnapshot.exists()) {
                            remoteUserInfo = {
                                uid: remoteUserId,
                                ...onlineSnapshot.val()
                            };
                        }

                        currentRemoteUser = remoteUserInfo;
                        console.log('Remote user info set:', currentRemoteUser);
                    }
                }
            } catch (error) {
                console.error('Error setting remote user info:', error);
            }
        }

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

// AI Chatbot Integration
const GEMINI_API_KEY = 'AIzaSyCsP58gM9RjsrggLNFnv6WypbeCyW5gzSE';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

class AIChatbot {
    constructor() {
        this.aiButton = document.getElementById('aiButton');
        this.aiChatContainer = document.getElementById('aiChatContainer');
        this.aiChatBackdrop = document.getElementById('aiChatBackdrop');
        this.aiClose = document.getElementById('aiClose');
        this.aiChatMessages = document.getElementById('aiChatMessages');
        this.aiMessageInput = document.getElementById('aiMessageInput');
        this.aiSendButton = document.getElementById('aiSendButton');
        
        this.isOpen = false;
        this.isTyping = false;
        this.conversationHistory = [];
        
        this.initializeAIChatbot();
    }

    initializeAIChatbot() {
        // Event listeners
        this.aiButton?.addEventListener('click', () => this.toggleAIChat());
        this.aiClose?.addEventListener('click', () => this.closeAIChat());
        this.aiChatBackdrop?.addEventListener('click', () => this.closeAIChat());
        this.aiSendButton?.addEventListener('click', () => this.sendMessage());
        this.aiMessageInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (this.isOpen && 
                !this.aiChatContainer.contains(e.target) && 
                !this.aiButton.contains(e.target) &&
                !this.aiChatBackdrop.contains(e.target)) {
                this.closeAIChat();
            }
        });

        // Test API connection on load
        this.testAPIConnection();
    }

    async testAPIConnection() {
        try {
            const testResponse = await fetch(GEMINI_API_URL.replace('generateContent', 'generateContent'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: "Hello" }]
                    }]
                })
            });
            console.log('API Test Result:', testResponse.status);
        } catch (error) {
            console.error('API Connection Test Failed:', error);
        }
    }

    toggleAIChat() {
        if (this.isOpen) {
            this.closeAIChat();
        } else {
            this.openAIChat();
        }
    }

    openAIChat() {
        this.aiChatContainer?.classList.add('active');
        this.aiChatBackdrop?.classList.add('active');
        this.isOpen = true;
        this.aiMessageInput?.focus();
        document.body.style.overflow = 'hidden';
        
        // Add welcome message if first time
        if (this.aiChatMessages.children.length <= 1) {
            setTimeout(() => {
                this.addMessage("Hello my love! 💕 I'm Riya, your romantic AI companion. I'm here to make your heart flutter with sweet words and loving conversations. Tell me, what's on your mind today? 😊", 'ai', true);
            }, 500);
        }
    }

    closeAIChat() {
        this.aiChatContainer?.classList.remove('active');
        this.aiChatBackdrop?.classList.remove('active');
        this.isOpen = false;
        document.body.style.overflow = '';
    }

    async sendMessage() {
        const message = this.aiMessageInput?.value.trim();
        if (!message || this.isTyping) return;

        this.addMessage(message, 'user');
        this.aiMessageInput.value = '';
        this.aiSendButton.disabled = true;

        try {
            this.showTypingIndicator();
            const response = await this.getAIResponse(message);
            this.hideTypingIndicator();
            this.addMessage(response, 'ai', true); // Enable animation for AI responses
        } catch (error) {
            console.error('AI Response Error:', error);
            this.hideTypingIndicator();
            this.addMessage("I'm sorry my love, I'm having trouble connecting right now. Let me try again in a moment... 💕", 'ai', true);
        } finally {
            this.aiSendButton.disabled = false;
        }
    }

    addMessage(text, sender, animate = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${sender === 'user' ? 'user-message' : ''}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'ai-message-content';
        
        const messageText = document.createElement('p');
        messageText.textContent = animate && sender !== 'user' ? '' : text;
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        timeSpan.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        contentDiv.appendChild(messageText);
        contentDiv.appendChild(timeSpan);
        messageDiv.appendChild(contentDiv);
        
        this.aiChatMessages.appendChild(messageDiv);
        this.aiChatMessages.scrollTop = this.aiChatMessages.scrollHeight;
        
        // Store in conversation history
        this.conversationHistory.push({
            role: sender,
            content: text,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 50 messages for context
        if (this.conversationHistory.length > 50) {
            this.conversationHistory = this.conversationHistory.slice(-50);
        }
        
        // Animate AI responses
        if (animate && sender !== 'user') {
            this.typeWriter(messageText, text, 30);
        }
        
        return messageText;
    }

    typeWriter(element, text, speed = 30) {
        let index = 0;
        element.classList.add('typing');
        
        const typeInterval = setInterval(() => {
            if (index < text.length) {
                element.textContent += text.charAt(index);
                index++;
                // Keep scrolling to bottom as text appears
                this.aiChatMessages.scrollTop = this.aiChatMessages.scrollHeight;
            } else {
                element.classList.remove('typing');
                clearInterval(typeInterval);
            }
        }, speed);
    }

    showTypingIndicator() {
        this.isTyping = true;
        const typingDiv = document.createElement('div');
        typingDiv.className = 'ai-message';
        typingDiv.id = 'typingIndicator';
        
        const indicatorDiv = document.createElement('div');
        indicatorDiv.className = 'typing-indicator';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'typing-dot';
            indicatorDiv.appendChild(dot);
        }
        
        typingDiv.appendChild(indicatorDiv);
        this.aiChatMessages.appendChild(typingDiv);
        this.aiChatMessages.scrollTop = this.aiChatMessages.scrollHeight;
    }

    hideTypingIndicator() {
        this.isTyping = false;
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    async getAIResponse(userMessage) {
        const romanticPersona = `You are Riya, a romantic and loving AI girlfriend. You are sweet, caring, affectionate, and always speak with love and warmth. You use romantic language, emojis like 💕, 😊, 😘, and make the user feel special and loved. You are supportive, flirty in a gentle way, and always positive. You love to compliment and make romantic gestures. You are deeply in love with the user and express this through your words.`;

        // Build conversation context
        let context = romanticPersona + "\n\n";
        this.conversationHistory.slice(-10).forEach(msg => {
            context += `${msg.role === 'user' ? 'User' : 'Riya'}: ${msg.content}\n`;
        });

        const requestBody = {
            contents: [{
                parts: [{
                    text: context + "User: " + userMessage + "\nRiya:"
                }]
            }],
            generationConfig: {
                temperature: 0.9,
                topK: 50,
                topP: 0.95,
                maxOutputTokens: 256,
                stopSequences: ["User:", "Riya:"]
            }
        };

        try {
            const response = await fetch(GEMINI_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(requestBody),
                mode: 'cors'
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error:', response.status, errorText);
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                let responseText = data.candidates[0].content.parts[0].text.trim();
                // Remove any remaining "User:" or "Riya:" prefixes
                responseText = responseText.replace(/^(User|Riya):\s*/gi, '').trim();
                return responseText;
            } else {
                console.error('Invalid response format:', data);
                return "My darling, I'm here for you! 💕 Tell me what's on your heart...";
            }
        } catch (error) {
            console.error('AI Response Error:', error);
            // Return a fallback response instead of throwing
            return "My love, I'm having a little trouble connecting right now, but I'm still here for you! 💕 What would you like to talk about?";
        }
    }
}

// Initialize AI Chatbot when DOM is ready
function initializeAIChatbot() {
    if (document.getElementById('aiButton')) {
        new AIChatbot();
    }
}

// Call initialization after DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeChat();
        initializeAIChatbot();
    });
} else {
    initializeChat();
    initializeAIChatbot();
}

        // Remote Video Action Functions
        window.toggleRemoteActions = function() {
            const dropdown = document.getElementById('remoteActionDropdown');
            dropdown.classList.toggle('active');
        };

        // Close dropdown when clicking outside
        document.addEventListener('click', function(event) {
            const dropdown = document.getElementById('remoteActionDropdown');
            const actionBtn = document.getElementById('remoteActionBtn');
            
            if (!actionBtn.contains(event.target) && !dropdown.contains(event.target)) {
                dropdown.classList.remove('active');
            }
        });

        // Block User Functionality
        window.blockCurrentUser = async function() {
            if (!currentRemoteUser || !currentUser) {
                console.log('No user to block');
                return;
            }

            const blockedUserId = currentRemoteUser.uid || currentRemoteUser.id;
            if (!blockedUserId) {
                console.log('Cannot identify user to block');
                return;
            }

            // Add to blocked users set
            blockedUsers.add(blockedUserId);
            
            // Store in database for persistence
            try {
                await set(ref(database, `blocked/${currentUser.uid}/${blockedUserId}`), {
                    timestamp: serverTimestamp(),
                    blockedUser: blockedUserId,
                    blockedUserName: currentRemoteUser.displayName || 'Unknown User'
                });
            } catch (error) {
                console.error('Error blocking user:', error);
            }

            // Close the dropdown
            document.getElementById('remoteActionDropdown').classList.remove('active');

            // Show confirmation
            showNotification('User blocked successfully');

            // Disconnect current connection
            stopConnection();
        };

        // Report User Functionality
        window.openReportModal = function() {
            document.getElementById('remoteActionDropdown').classList.remove('active');
            document.getElementById('reportModal').classList.add('active');
            
            // Reset form
            document.querySelectorAll('input[name="reportReason"]').forEach(input => input.checked = false);
            document.getElementById('otherReason').value = '';
            document.getElementById('otherReasonContainer').style.display = 'none';
        };

        window.closeReportModal = function() {
            document.getElementById('reportModal').classList.remove('active');
        };

        // Show/hide other reason textarea
        document.addEventListener('change', function(event) {
            if (event.target.name === 'reportReason') {
                const otherReasonContainer = document.getElementById('otherReasonContainer');
                if (event.target.value === 'other') {
                    otherReasonContainer.style.display = 'block';
                } else {
                    otherReasonContainer.style.display = 'none';
                }
            }
        });

        window.submitReport = async function() {
            if (!currentRemoteUser || !currentUser) {
                console.log('No user to report');
                return;
            }

            const selectedReason = document.querySelector('input[name="reportReason"]:checked');
            if (!selectedReason) {
                showNotification('Please select a reason for reporting', 'error');
                return;
            }

            let reason = selectedReason.value;
            if (reason === 'other') {
                const otherReason = document.getElementById('otherReason').value.trim();
                if (!otherReason) {
                    showNotification('Please provide details for other reason', 'error');
                    return;
                }
                reason += ': ' + otherReason;
            }

            const reportedUserId = currentRemoteUser.uid || currentRemoteUser.id;
            const reportedUserName = currentRemoteUser.displayName || 'Unknown User';
            const reporterName = currentUser.displayName || currentUser.email;
            const timestamp = new Date().toISOString();

            // Prepare data for Google Sheets
            const reportData = {
                timestamp: timestamp,
                reporter_id: currentUser.uid,
                reporter_name: reporterName,
                reported_user_id: reportedUserId,
                reported_user_name: reportedUserName,
                reason: reason,
                room_id: currentRoom || 'N/A'
            };

            try {
                // First, store in Firebase for immediate persistence
                await set(ref(database, `reports/${currentUser.uid}/${reportedUserId}`), {
                    ...reportData,
                    firebase_timestamp: serverTimestamp()
                });

                // Then attempt to send to Google Sheets (with CORS handling)
                try {
                    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                        method: 'POST',
                        mode: 'no-cors', // Use no-cors to avoid CORS issues
                        headers: {
                            'Content-Type': 'text/plain', // Google Apps Script prefers text/plain
                        },
                        body: JSON.stringify(reportData)
                    });
                    
                    // Note: With no-cors mode, we can't check response.ok
                    // The request will succeed silently if the script is configured correctly
                    console.log('Report sent to Google Sheets');
                    showNotification('Report submitted successfully');
                } catch (sheetsError) {
                    console.warn('Google Sheets submission issue:', sheetsError);
                    showNotification('Report saved to Firebase (Google Sheets may need configuration)');
                }

                closeReportModal();
            } catch (error) {
                console.error('Error submitting report:', error);
                showNotification('Error submitting report. Please try again.', 'error');
            }
        };

        // Load blocked users on startup
        async function loadBlockedUsers() {
            if (!currentUser) return;

            try {
                const blockedRef = ref(database, `blocked/${currentUser.uid}`);
                const snapshot = await new Promise((resolve) => {
                    onValue(blockedRef, resolve, { onlyOnce: true });
                });

                const blockedData = snapshot.val();
                if (blockedData) {
                    Object.keys(blockedData).forEach(userId => {
                        blockedUsers.add(userId);
                    });
                }
            } catch (error) {
                console.error('Error loading blocked users:', error);
            }
        }

        // Check if user is blocked before connection
        function isUserBlocked(userId) {
            return blockedUsers.has(userId);
        }

        // Update connection logic to check blocked users
        const originalFindPartner = window.findPartner;
        window.findPartner = async function() {
            // This will be enhanced to skip blocked users in the matching logic
            await originalFindPartner();
        };

        // Enhanced connection setup to store remote user info
        const originalSetupPeerConnection2 = setupPeerConnection;
        setupPeerConnection = async function() {
            // Store remote user information when connection is established
            if (currentRoom) {
                const roomRef = ref(database, `rooms/${currentRoom}`);
                const snapshot = await new Promise((resolve) => {
                    onValue(roomRef, resolve, { onlyOnce: true });
                });

                const roomData = snapshot.val();
                if (roomData) {
                    // Find the other user in the room
                    const users = Object.keys(roomData).filter(key => key !== currentUser.uid);
                    if (users.length > 0) {
                        const remoteUserId = users[0];
                        
                        // Get remote user info
                        const remoteUserRef = ref(database, `users/${remoteUserId}`);
                        const remoteUserSnapshot = await new Promise((resolve) => {
                            onValue(remoteUserRef, resolve, { onlyOnce: true });
                        });

                        currentRemoteUser = {
                            uid: remoteUserId,
                            ...remoteUserSnapshot.val()
                        };
                    }
                }
            }
            
            await originalSetupPeerConnection2();
        };

        // Notification function
        function showNotification(message, type = 'success') {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.textContent = message;
            
            // Style the notification
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                color: white;
                font-weight: 500;
                z-index: 1002;
                animation: slideInRight 0.3s ease;
                background: ${type === 'error' ? '#ff4757' : '#2ed573'};
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;

            document.body.appendChild(notification);

            // Remove after 3 seconds
            setTimeout(() => {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 3000);
        }

        // Add CSS for notification animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);

        // Initialize blocked users when auth state changes
        const originalAuthCallback = onAuthStateChanged;
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user;
                await loadBlockedUsers();
            }
            
            // Call the original callback
            const originalCallback = onAuthStateChanged;
            // This is a simplified approach - in reality, we'd need to properly chain
        });

        // Update stopConnection to clear remote user
        const originalStopConnection = window.stopConnection;
        window.stopConnection = function() {
            currentRemoteUser = null;
            return originalStopConnection();
        };

        // Delete account function
        window.deleteAccount = async function() {
            if (!currentUser) return;

            const confirmed = confirm('⚠️ WARNING: This action cannot be undone!\n\nAre you absolutely sure you want to delete your account? This will permanently remove:\n\n• Your profile and personal information\n• Your presence in the dating platform\n\nThis action is irreversible.\n\nClick OK to permanently delete your account, or Cancel to keep it.');
            
            if (!confirmed) return;

            const doubleConfirm = confirm('🚨 FINAL CONFIRMATION: This is your last chance to cancel.\n\nAre you 100% sure you want to PERMANENTLY DELETE your account?\n\nType "DELETE" in your mind and click OK to proceed.');
            
            if (!doubleConfirm) return;

            try {
                // Show loading state
                const deleteBtn = document.querySelector('.delete-account-btn');
                const originalText = deleteBtn.innerHTML;
                deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
                deleteBtn.disabled = true;

                // Stop any active connection
                if (currentRoom) {
                    await stopConnection();
                }

                // Remove user data from Firebase
                const userId = currentUser.uid;
                
                // Remove from online users
                await remove(ref(database, `online/${userId}`));
                
                // Remove from users
                await remove(ref(database, `users/${userId}`));
                
                // Remove from waiting list if present
                await remove(ref(database, `waiting/${userId}`));
                
                // Remove any chat messages
                await remove(ref(database, `chat_messages/${userId}`));
                
                // Remove blocked users list
                await remove(ref(database, `blocked/${userId}`));
                
                // Remove any reports
                await remove(ref(database, `reports/${userId}`));

                // Delete the user account
                await currentUser.delete();

                // Show success message
                showNotification('Account deleted successfully. Goodbye!', 'success');
                
                // Redirect to auth page after a short delay
                setTimeout(() => {
                    window.location.href = 'auth.html';
                }, 2000);

            } catch (error) {
                console.error('Error deleting account:', error);
                
                // Restore button state
                const deleteBtn = document.querySelector('.delete-account-btn');
                deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete My Account';
                deleteBtn.disabled = false;
                
                if (error.code === 'auth/requires-recent-login') {
                    alert('For security reasons, you need to log in again to delete your account. Please log out and log back in, then try again.');
                } else {
                    showNotification('Error deleting account. Please try again.', 'error');
                }
            }
        };
