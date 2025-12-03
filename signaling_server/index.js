const http = require('http');
const { Server } = require("socket.io");

const httpServer = http.createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (roomId) => {
    const roomClients = io.sockets.adapter.rooms.get(roomId) || { size: 0 };
    const numberOfClients = roomClients.size;

    if (numberOfClients == 0) {
      console.log(`Creating room ${roomId} and emitting room_created socket event`);
      socket.join(roomId);
      socket.emit("room_created", roomId);
    } else if (numberOfClients == 1) {
      console.log(`Joining room ${roomId} and emitting room_joined socket event`);
      socket.join(roomId);
      socket.emit("room_joined", roomId);
    } else {
      console.log(`Can't join room ${roomId}, emitting full_room socket event. Current clients: ${numberOfClients}`);
      socket.emit("full_room", roomId);
    }
  });

  socket.on("start_call", (roomId) => {
    console.log(`Broadcasting start_call event to peers in room ${roomId}`);
    socket.broadcast.to(roomId).emit("start_call");
  });

  socket.on("webrtc_offer", (event) => {
    console.log(`Broadcasting webrtc_offer event to peers in room ${event.roomId}`);
    socket.broadcast.to(event.roomId).emit("webrtc_offer", event);
  });

  socket.on("webrtc_answer", (event) => {
    console.log(`Broadcasting webrtc_answer event to peers in room ${event.roomId}`);
    socket.broadcast.to(event.roomId).emit("webrtc_answer", event);
  });

  socket.on("webrtc_ice_candidate", (event) => {
    console.log(`Broadcasting webrtc_ice_candidate event to peers in room ${event.roomId}`);
    socket.broadcast.to(event.roomId).emit("webrtc_ice_candidate", event);
  });

  socket.on("leave_room", (roomId) => {
    console.log(`User ${socket.id} left room ${roomId}`);
    socket.leave(roomId);
    socket.broadcast.to(roomId).emit("user_left");
  });

  socket.on("disconnecting", () => {
    console.log("User disconnecting:", socket.id);
    socket.rooms.forEach((room) => {
      if (room !== socket.id) {
        socket.broadcast.to(room).emit("user_left");
      }
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
