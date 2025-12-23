import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { RTCView, MediaStream } from 'react-native-webrtc';
import Signaling from './Signaling';

const signaling = new Signaling();

const App = () => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [roomId, setRoomId] = useState('');
  const [remoteLocation, setRemoteLocation] = useState<string | null>(null);

  useEffect(() => {
    signaling.onAddRemoteStream = (stream: MediaStream) => {
      setRemoteStream(stream);
    };

    signaling.onLocationReceived = (location: string) => {
      setRemoteLocation(location);
    };

    signaling.onCallEnded = () => {
      signaling.onRemoteHangUp(setRemoteStream);
      setRemoteLocation(null);
    };

    // Connect socket on mount
    signaling.connect();

    // Cleanup on unmount
    return () => {
      // Optional cleanup
    };
  }, []);

  const openCamera = async () => {
    await signaling.openUserMedia(setLocalStream, setRemoteStream);
  };

  const joinRoom = async () => {
    if (!roomId) {
      Alert.alert('Error', 'Please enter a Room ID');
      return;
    }
    // For simplicity, we assume camera is opened before joining or join opens it if needed
    // But typically we want stream ready. 
    if (!localStream) {
      await openCamera();
    }
    await signaling.joinRoom(roomId, setRemoteStream);
  };

  const hangUp = () => {
    signaling.hangUp(setLocalStream, setRemoteStream);
    setRemoteLocation(null);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerText}>React Native Video Call</Text>
        </View>

        <View style={styles.videoContainer}>
          <View style={styles.videoWrapper}>
            <Text style={styles.videoLabel}>Local</Text>
            {localStream ? (
              <RTCView
                objectFit="cover"
                style={styles.video}
                streamURL={localStream.toURL()}
                mirror={true}
              />
            ) : (
              <View style={[styles.video, styles.videoPlaceholder]} />
            )}
          </View>
          <View style={styles.videoWrapper}>
            <Text style={styles.videoLabel}>Remote</Text>
            {remoteStream ? (
              <RTCView
                objectFit="cover"
                style={styles.video}
                streamURL={remoteStream.toURL()}
              />
            ) : (
              <View style={[styles.video, styles.videoPlaceholder]} />
            )}
          </View>
        </View>

        {remoteLocation && (
          <View style={styles.locationContainer}>
            <Text style={styles.locationText}>Caller Location: {remoteLocation}</Text>
          </View>
        )}

        <View style={styles.controls}>
          <TouchableOpacity style={styles.button} onPress={openCamera}>
            <Text style={styles.buttonText}>Open Camera</Text>
          </TouchableOpacity>

          <View style={styles.joinContainer}>
            <TextInput
              style={styles.input}
              placeholder="Room ID"
              value={roomId}
              onChangeText={setRoomId}
            />
            <TouchableOpacity style={[styles.button, styles.joinButton]} onPress={joinRoom}>
              <Text style={styles.buttonText}>Join</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.button, styles.hangupButton]} onPress={hangUp}>
            <Text style={styles.buttonText}>Hangup</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  header: {
    padding: 16,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  headerText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  videoContainer: {
    flex: 1,
    flexDirection: 'row',
    padding: 10,
  },
  videoWrapper: {
    flex: 1,
    margin: 5,
    backgroundColor: 'black',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  videoLabel: {
    position: 'absolute',
    top: 5,
    left: 5,
    color: 'white',
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 4,
    borderRadius: 4,
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    backgroundColor: '#333',
  },
  locationContainer: {
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  locationText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  controls: {
    padding: 16,
    backgroundColor: 'white',
  },
  joinContainer: {
    flexDirection: 'row',
    marginVertical: 10,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 4,
    marginRight: 10,
    height: 48,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  joinButton: {
    backgroundColor: '#4CAF50',
    width: 80,
  },
  hangupButton: {
    backgroundColor: '#F44336',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default App;
