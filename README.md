# Flutter Video Call App feat. Antigravity 

## Overview
This application allows video calling between devices using WebRTC and a Node.js signaling server.

## Prerequisites
- Node.js installed.
- Flutter SDK installed.
- Android Studio / Xcode for mobile development.

## Steps to Run

### 1. Start the Signaling Server
The signaling server facilitates the connection between peers.

```bash
cd signaling_server
node index.js
```
*The server will start on port 3000.*

### 2. Run the Flutter App

#### For Web
```bash
cd flutter_app
flutter run -d chrome
```

#### For Android (Emulator/Device)
**Note:** If using Android Emulator, the app is configured to connect to `10.0.2.2:3000`. If using a real device, update `lib/signaling.dart` with your machine's IP address.

```bash
cd flutter_app
flutter run -d <device_id>
```

#### For iOS (Simulator/Device)
**Note:** If using iOS Simulator, `localhost` works. For real device, use machine's IP.

```bash
cd flutter_app
flutter run -d <device_id>
```

### 3. Make a Call
1.  Open the app on two devices/browsers.
2.  Grant Camera and Microphone permissions.
3.  Enter the **same Room ID** (e.g., "test") on both devices.
4.  Click **Join Room**.
5.  Video should appear from both local and remote peers.

## Troubleshooting
- **Connection Failed**: Ensure both devices can reach the signaling server. Check IP addresses in `lib/signaling.dart`.
- **No Video**: Ensure permissions are granted. Check logs for WebRTC errors.

## Passed Test
1. Web to Web
2. Safari + Chrome (Safari + Safari cam not work in react verion) 