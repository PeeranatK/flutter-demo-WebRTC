import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'signaling.dart';

void main() {
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Video Call',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: MyHomePage(),
    );
  }
}

class MyHomePage extends StatefulWidget {
  MyHomePage({Key? key}) : super(key: key);

  @override
  _MyHomePageState createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  Signaling signaling = Signaling();
  RTCVideoRenderer _localRenderer = RTCVideoRenderer();
  RTCVideoRenderer _remoteRenderer = RTCVideoRenderer();
  String? roomId;
  String? remoteLocation;
  TextEditingController textEditingController = TextEditingController(text: '');

  @override
  void initState() {
    _localRenderer.initialize();
    _remoteRenderer.initialize();

    signaling.onAddRemoteStream = ((stream) {
      _remoteRenderer.srcObject = stream;
      setState(() {});
    });

    signaling.onLocationReceived = (location) {
      if (mounted) {
        setState(() {
          remoteLocation = location;
        });
      }
    };

    signaling.onCallEnded = () {
      signaling.onRemoteHangUp(_remoteRenderer);
      if (mounted) {
        setState(() {
          remoteLocation = null;
        });
      }
    };

    signaling.openUserMedia(_localRenderer, _remoteRenderer);
    signaling.connect();
    super.initState();
  }

  @override
  void dispose() {
    _localRenderer.dispose();
    _remoteRenderer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Flutter Video Call"),
      ),
      body: Column(
        children: [
          SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              ElevatedButton(
                onPressed: () {
                  signaling.openUserMedia(_localRenderer, _remoteRenderer);
                },
                child: Text("Open Camera & Microphone"),
              ),
              SizedBox(width: 8),
              ElevatedButton(
                onPressed: () async {
                  roomId = await showDialog<String>(
                      context: context,
                      builder: (BuildContext context) {
                        return AlertDialog(
                          title: Text("Enter Room ID"),
                          content: TextField(
                            controller: textEditingController,
                            decoration: InputDecoration(hintText: "Room ID"),
                          ),
                          actions: [
                            TextButton(
                              onPressed: () {
                                Navigator.of(context).pop(textEditingController.text);
                              },
                              child: Text("Join"),
                            )
                          ],
                        );
                      });
                  if (roomId != null && roomId!.isNotEmpty) {
                    signaling.joinRoom(
                      roomId!,
                      _remoteRenderer,
                    );
                  }
                },
                child: Text("Join Room"),
              ),
              SizedBox(width: 8),
              ElevatedButton(
                onPressed: () {
                  signaling.hangUp(_localRenderer, _remoteRenderer);
                  textEditingController.clear();
                  if (mounted) {
                    setState(() {
                      remoteLocation = null;
                    });
                  }
                },
                child: Text("Hangup"),
              )
            ],
          ),
          SizedBox(height: 8),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(8.0),
              child: Column(
                children: [
                  Expanded(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Expanded(child: RTCVideoView(_localRenderer, mirror: true)),
                        Expanded(
                          child: _remoteRenderer.srcObject != null
                              ? RTCVideoView(_remoteRenderer)
                              : Container(color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                  if (remoteLocation != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8.0),
                      child: Text(
                        "Caller Location: $remoteLocation",
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                    ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text("Room ID: "),
                Flexible(
                  child: TextField(
                    controller: textEditingController,
                    decoration: InputDecoration(
                      hintText: "Enter Room ID to join",
                    ),
                  ),
                ),
                IconButton(
                  icon: Icon(Icons.send),
                  onPressed: () {
                    if (textEditingController.text.isNotEmpty) {
                      signaling.joinRoom(
                        textEditingController.text,
                        _remoteRenderer,
                      );
                    }
                  },
                )
              ],
            ),
          ),
        ],
      ),
    );
  }
}
