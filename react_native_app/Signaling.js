import io from 'socket.io-client';
import {
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
    mediaDevices,
} from 'react-native-webrtc';
import Geolocation from 'react-native-geolocation-service';
import { Platform } from 'react-native';

export default class Signaling {
    constructor() {
        this.socket = null;
        this.roomId = null;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.candidateQueue = [];
        this.remoteDescriptionSet = false;

        // Callbacks
        this.onAddRemoteStream = null;
        this.onLocationReceived = null;
        this.onCallEnded = null;

        // Default config, updated by server
        this.configuration = {
            iceServers: [],
        };

        // Server URL
        // Android Emulator: 10.0.2.2, iOS Simulator: localhost
        this.serverUrl = Platform.OS === 'android'
            ? 'http://10.0.2.2:3000'
            : 'http://localhost:3000';
    }

    connect() {
        this.socket = io(this.serverUrl, {
            transports: ['websocket'],
            autoConnect: false,
        });

        this.socket.connect();

        this.socket.on('connect', () => {
            console.log('Connected to signaling server');
        });

        this.socket.on('ice_servers', (data) => {
            console.log('Received ICE servers:', data);
            this.configuration.iceServers = data;
        });

        this.socket.on('room_created', (data) => {
            console.log(`Room ${data} created`);
            this.roomId = data;
        });

        this.socket.on('room_joined', (data) => {
            console.log(`Room ${data} joined`);
            this.roomId = data;
            this._createOffer();
        });

        this.socket.on('full_room', (data) => {
            console.log(`Room ${data} is full`);
        });

        this.socket.on('user_left', () => {
            console.log('User left the room');
            if (this.onCallEnded) this.onCallEnded();
        });

        this.socket.on('webrtc_offer', async (data) => {
            console.log('Received offer');
            const sdp = new RTCSessionDescription(data);
            await this._createAnswer(sdp);
        });

        this.socket.on('webrtc_answer', async (data) => {
            console.log('Received answer');
            if (data.location) {
                console.log('Received location:', data.location);
                if (this.onLocationReceived) this.onLocationReceived(data.location);
            }
            const sdp = new RTCSessionDescription(data);
            await this.peerConnection.setRemoteDescription(sdp);
            this.remoteDescriptionSet = true;
            this._processCandidateQueue();
        });

        this.socket.on('webrtc_ice_candidate', async (data) => {
            console.log('Received ICE candidate');
            const candidate = new RTCIceCandidate(data);
            if (this.remoteDescriptionSet) {
                await this.peerConnection.addIceCandidate(candidate);
            } else {
                this.candidateQueue.push(candidate);
            }
        });
    }

    async _processCandidateQueue() {
        for (const candidate of this.candidateQueue) {
            await this.peerConnection.addIceCandidate(candidate);
        }
        this.candidateQueue = [];
    }

    async openUserMedia(localRenderSetter, remoteRenderSetter) {
        try {
            const stream = await mediaDevices.getUserMedia({
                audio: true,
                video: true,
            });

            // Callback to set local stream URL/object for display
            // Note: react-native-webrtc RTCView uses streamURL for older versions or object for newer
            // Assuming newer version based on install
            this.localStream = stream;
            localRenderSetter(stream);

            // Remote stream placeholder is usually handled when track is received
        } catch (err) {
            console.error('Error opening user media:', err);
        }
    }

    async joinRoom(roomId, remoteRenderSetter) {
        this.roomId = roomId;
        // Pass the setter so we can update UI when track arrives
        await this._initializePeerConnection(remoteRenderSetter);
        this.socket.emit('join', roomId);
    }

    async _initializePeerConnection(remoteRenderSetter) {
        this.peerConnection = new RTCPeerConnection(this.configuration);

        // Add local tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
        }

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('ICE candidate generated');
                this.socket.emit('webrtc_ice_candidate', {
                    candidate: event.candidate.candidate,
                    sdpMid: event.candidate.sdpMid,
                    sdpMLineIndex: event.candidate.sdpMLineIndex,
                    roomId: this.roomId,
                });
            }
        };

        this.peerConnection.ontrack = (event) => {
            console.log('Got remote track:', event.streams[0]);
            if (event.streams && event.streams.length > 0) {
                this.remoteStream = event.streams[0];
                remoteRenderSetter(event.streams[0]);
                if (this.onAddRemoteStream) this.onAddRemoteStream(event.streams[0]);

                // Start recording when remote stream is added (assuming 2 participants)
                this.startRecording();
            }
        };
    }

    async _createOffer() {
        const offer = await this.peerConnection.createOffer({ offerToReceiveVideo: 1 });
        await this.peerConnection.setLocalDescription(offer);

        this.socket.emit('webrtc_offer', {
            type: 'offer',
            sdp: offer.sdp,
            roomId: this.roomId,
        });
    }

    async _createAnswer(remoteOffer) {
        await this.peerConnection.setRemoteDescription(remoteOffer);
        this.remoteDescriptionSet = true;
        this._processCandidateQueue();

        const answer = await this.peerConnection.createAnswer({ offerToReceiveVideo: 1 });
        await this.peerConnection.setLocalDescription(answer);

        let locationString = null;
        try {
            const position = await this._determinePosition();
            locationString = `Lat: ${position.coords.latitude}, Lng: ${position.coords.longitude}`;
        } catch (e) {
            console.log('Error getting location:', e);
        }

        this.socket.emit('webrtc_answer', {
            type: 'answer',
            sdp: answer.sdp,
            roomId: this.roomId,
            location: locationString,
        });
    }

    _determinePosition() {
        return new Promise((resolve, reject) => {
            Geolocation.getCurrentPosition(
                (position) => {
                    resolve(position);
                },
                (error) => {
                    reject(error);
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
            );
        });
    }

    hangUp(localRenderSetter, remoteRenderSetter) {
        this.stopRecording();

        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        if (this.socket) {
            if (this.roomId) {
                this.socket.emit('leave_room', this.roomId);
            }
            // Do not disconnect socket
        }

        this.candidateQueue = [];
        this.remoteDescriptionSet = false;
        this.roomId = null;

        // Clear streams ui
        // localStream remains active for local view typically, unless we want to stop it
        // Flutter implementation closes tracks. 
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }

        localRenderSetter(null);
        remoteRenderSetter(null);
    }

    onRemoteHangUp(remoteRenderSetter) {
        this.stopRecording();

        if (this.peerConnection) {
            this.peerConnection.close();
        }

        // Do not disconnect socket
        this.candidateQueue = [];
        this.remoteDescriptionSet = false;
        remoteRenderSetter(null);

        // Re-init happens when joining again or handled by caller logic
        // In Flutter we re-init PC immediately. Here we can wait for join call or do it lightly.
        // For simplicity, we just clean up. `joinRoom` calls `_initializePeerConnection` anyway.
    }

    startRecording() {
        if (Platform.OS === 'web' && window.MediaRecorder && this.remoteStream) {
            try {
                this.mediaRecorder = new MediaRecorder(this.remoteStream);
                this.recordedChunks = [];

                this.mediaRecorder.ondataavailable = (event) => {
                    if (event.data && event.data.size > 0) {
                        this.recordedChunks.push(event.data);
                    }
                };

                this.mediaRecorder.start();
                console.log('Recording started');
            } catch (e) {
                console.error('Error starting recording:', e);
            }
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            console.log('Recording stopped');

            // On web, define what to do on stop (e.g., save/download)
            if (Platform.OS === 'web') {
                this.mediaRecorder.onstop = () => {
                    const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = `recording_${new Date().toISOString()}.webm`;
                    document.body.appendChild(a);
                    a.click();
                    URL.revokeObjectURL(url);
                    console.log('Recording saved');
                };
            }
            this.mediaRecorder = null;
        }
    }
}
