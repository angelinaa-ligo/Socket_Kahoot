const { Server } = require('socket.io');
const http = require('http');
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(cors()); 

const mongoUri = process.env.MONGO_URI;
const client = new MongoClient(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

let quizzesCollection, usersCollection;

client.connect()
  .then(() => {
    console.log("Connected to MongoDB");
    const db = client.db("quizApp"); 
    quizzesCollection = db.collection("quizzes");
    usersCollection = db.collection("users");
  })

const server = http.createServer(app);

// Set up Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*', 
    methods: ['GET', 'POST'],
  },
});

io.on("connection", (socket) => {
  console.log(`User is connected: ${socket.id}`);

  socket.on("send_code", async (code) => {
    console.log("Received quiz code:", code);
    try {
      const quiz = await quizzesCollection.findOne({ quizId: Number(code) });

      if (quiz && quiz.isValid) {
        socket.emit('checkQuizCode', { isValid: true });
      } else {
        socket.emit('checkQuizCode', { isValid: false });
      }
    } catch (err) {
      console.error("Error querying database:", err);
      socket.emit('checkQuizCode', { isValid: false });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start the server
server.listen(3001, () => {
  console.log('Socket server is running on port 3001!');
});
