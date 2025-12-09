import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:path_provider/path_provider.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:url_launcher/url_launcher.dart';

typedef void StreamStateCallback(MediaStream stream);

class Signaling {
  Map<String, dynamic> configuration = {
    'iceServers': []
  };

  IO.Socket? socket;
  String? roomId;
  RTCPeerConnection? peerConnection;
  MediaStream? localStream;
  List<RTCIceCandidate> _candidateQueue = [];
  bool _remoteDescriptionSet = false;
  MediaStream? remoteStream;
  Function(MediaStream stream)? onAddRemoteStream;

  VoidCallback? onCallEnded;
  MediaRecorder? _mediaRecorder;

  // Replace with your machine's IP address if running on a real device
  // For Android Emulator use 10.0.2.2
  // For iOS Simulator use localhost
  String get serverUrl {
    if (kIsWeb) {
      return 'http://localhost:3000';
    } else if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:3000';
    }
    return 'http://localhost:3000';
  }

  void connect() {
    socket = IO.io(serverUrl, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
    });

    socket!.connect();

    socket!.onConnect((_) {
      print('Connected to signaling server');
    });

    socket!.on('ice_servers', (data) {
      print('Received ICE servers: $data');
      configuration['iceServers'] = data;
    });

    socket!.on('room_created', (data) async {
      print('Room $data created');
      roomId = data;
    });

    socket!.on('room_joined', (data) async {
      print('Room $data joined');
      roomId = data;
      _createOffer();
    });

    socket!.on('full_room', (data) {
      print('Room $data is full');
    });

    socket!.on('user_left', (data) {
      print('User left the room');
      onCallEnded?.call();
    });

    socket!.on('webrtc_offer', (data) async {
      print('Received offer');
      var sdp = RTCSessionDescription(data['sdp'], data['type']);
      await _createAnswer(sdp);
    });

    socket!.on('webrtc_answer', (data) async {
      print('Received answer');
      var sdp = RTCSessionDescription(data['sdp'], data['type']);
      await peerConnection?.setRemoteDescription(sdp);
      _remoteDescriptionSet = true;
      _processCandidateQueue();
    });

    socket!.on('webrtc_ice_candidate', (data) async {
      print('Received ICE candidate');
      // Fix for type error: ensure sdpMLineIndex is int
      int? sdpMLineIndex = data['sdpMLineIndex'] is int 
          ? data['sdpMLineIndex'] 
          : int.tryParse(data['sdpMLineIndex'].toString());
          
      var candidate = RTCIceCandidate(
        data['candidate'],
        data['sdpMid'],
        sdpMLineIndex,
      );
      
      if (_remoteDescriptionSet) {
        await peerConnection?.addCandidate(candidate);
      } else {
        _candidateQueue.add(candidate);
      }
    });
  }

  Future<void> _processCandidateQueue() async {
    for (var candidate in _candidateQueue) {
      await peerConnection?.addCandidate(candidate);
    }
    _candidateQueue.clear();
  }

  Future<void> openUserMedia(
      RTCVideoRenderer localVideo, RTCVideoRenderer remoteVideo) async {
    var stream = await navigator.mediaDevices
        .getUserMedia({'video': true, 'audio': true});

    localVideo.srcObject = stream;
    localStream = stream;

    remoteVideo.srcObject = await createLocalMediaStream('key');
  }

  Future<void> joinRoom(String roomId, RTCVideoRenderer remoteVideo) async {
    this.roomId = roomId;
    await _initializePeerConnection(remoteVideo);
    socket!.emit('join', roomId);
  }

  Future<void> _createOffer() async {
    RTCSessionDescription description =
        await peerConnection!.createOffer({'offerToReceiveVideo': 1});
    var session = parse(description.sdp!);
    print(json.encode(session));
    
    await peerConnection!.setLocalDescription(description);

    socket!.emit('webrtc_offer', {
      'type': 'offer',
      'sdp': description.sdp,
      'roomId': roomId,
    });
  }

  Future<void> _createAnswer(RTCSessionDescription remoteOffer) async {
    await peerConnection!.setRemoteDescription(remoteOffer);
    _remoteDescriptionSet = true;
    _processCandidateQueue();

    RTCSessionDescription description =
        await peerConnection!.createAnswer({'offerToReceiveVideo': 1});

    await peerConnection!.setLocalDescription(description);

    socket!.emit('webrtc_answer', {
      'type': 'answer',
      'sdp': description.sdp,
      'roomId': roomId,
    });
  }

  void registerPeerConnectionListeners() {
    peerConnection?.onIceGatheringState = (RTCIceGatheringState state) {
      print('ICE gathering state changed: $state');
    };

    peerConnection?.onConnectionState = (RTCPeerConnectionState state) {
      print('Connection state changed: $state');
    };

    peerConnection?.onSignalingState = (RTCSignalingState state) {
      print('Signaling state changed: $state');
    };

    peerConnection?.onIceCandidate = (RTCIceCandidate candidate) {
      print('ICE candidate generated');
      socket!.emit('webrtc_ice_candidate', {
        'candidate': candidate.candidate,
        'sdpMid': candidate.sdpMid,
        'sdpMLineIndex': candidate.sdpMLineIndex,
        'roomId': roomId,
      });
    };
  }
  
  // Helper to parse SDP (optional, for debugging)
  dynamic parse(String sdp) {
    return sdp; // Placeholder
  }

  void hangUp(RTCVideoRenderer localVideo, RTCVideoRenderer remoteVideo) {
    stopRecording();
    if (localStream != null) {
      localStream!.dispose();
    }
    if (remoteStream != null) {
      remoteStream!.dispose();
    }
    if (peerConnection != null) {
      peerConnection!.close();
    }
    if (socket != null) {
      if (roomId != null) {
        socket!.emit('leave_room', roomId);
      }
      // Do not disconnect the socket, so we can join again later
      // socket!.disconnect();
    }
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    _candidateQueue.clear();
    _remoteDescriptionSet = false;
    roomId = null;
  }
  void onRemoteHangUp(RTCVideoRenderer remoteVideo) {
    stopRecording();
    if (remoteStream != null) {
      remoteStream!.dispose();
    }
    if (peerConnection != null) {
      peerConnection!.close();
    }
    // Do NOT disconnect socket or clear roomId
    // Just clear remote video and connection state
    remoteVideo.srcObject = null;
    _candidateQueue.clear();
    _remoteDescriptionSet = false;
    
    // Re-initialize peer connection for next call
    if (roomId != null) {
      _initializePeerConnection(remoteVideo);
    }
  }

  Future<void> startRecording(MediaStream stream) async {
    if (_mediaRecorder != null) return;
    
    print("Starting recording...");
    
    _mediaRecorder = MediaRecorder();
    
    if (kIsWeb) {
      // Web uses startWeb()
      _mediaRecorder!.startWeb(stream);
      print("Recording started on web");
    } else {
      // Mobile/Desktop uses start()
      final appDocDir = await getApplicationDocumentsDirectory();
      final videoDir = Directory('${appDocDir.path}/videos');
      if (!await videoDir.exists()) {
        await videoDir.create(recursive: true);
      }
      String filePath = '${videoDir.path}/video_call_${DateTime.now().millisecondsSinceEpoch}.mp4';
      
      await _mediaRecorder!.start(
        filePath, 
        videoTrack: stream.getVideoTracks().isNotEmpty ? stream.getVideoTracks().first : null,
      );
      print("Recording started at $filePath");
    }
  }

  Future<void> stopRecording() async {
    if (_mediaRecorder != null) {
      print("Stopping recording...");
      final result = await _mediaRecorder!.stop();
      print("Recording stopped: $result");
      
      if (kIsWeb && result != null) {
        // On web, result might be a blob URL
        // We can try to open it to trigger download/view
        if (result is String) {
          await launchUrl(Uri.parse(result));
        }
      }
      
      _mediaRecorder = null;
    }
  }

  Future<void> _initializePeerConnection(RTCVideoRenderer remoteVideo) async {
    peerConnection = await createPeerConnection(configuration);
    registerPeerConnectionListeners();
    localStream?.getTracks().forEach((track) {
      peerConnection?.addTrack(track, localStream!);
    });
    
    peerConnection?.onTrack = (RTCTrackEvent event) {
      print('Got remote track: ${event.streams[0]}');
      if (event.streams.isNotEmpty) {
        remoteVideo.srcObject = event.streams[0];
        onAddRemoteStream?.call(event.streams[0]);
        // Start recording when we receive the remote stream (2 people in room)
        startRecording(event.streams[0]);
      }
    };
  }
}
