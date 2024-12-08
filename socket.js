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

let lobbies = {};

io.on("connection", (socket) => {
  console.log(`User is connected: ${socket.id}`);

  //quiz lobby creation by the teacher 
  socket.on('create-quiz-lobby', async (data) => {
    if (!data || !data.code) {
      console.error('Invalid data received for create-quiz-lobby:', data);
      return;
    }

    const { code } = data;
    // console.log(`Quiz lobby created: ${code}`);

    // initialize the lobby if it doesn't exist
    if (!lobbies[code]) {
      lobbies[code] = [];
      console.log(`new lobby created with code ${code}`);
    }
    else {
      console.log(`lobby already exists for code ${code}`);
    }

    socket.join(code); // teacher joins the room
  });

  // player joins the quiz lobby
  socket.on('join-quiz-lobby', ({ code, nickname }) => {
    if (!code || !nickname) {
      console.error('Invalid data received for join-quiz-lobby:', { code, nickname });
      return;
    }

    console.log(`Player joined quiz ${code}: ${nickname}`);
    const playerData = { id: socket.id, nickname };

    if (lobbies[code]) {
      lobbies[code].push(playerData); // add player to the lobby
      socket.join(code); // join the room for real-time updates

      console.log(`Sockets in room ${code}:`, Array.from(io.sockets.adapter.rooms.get(code) || [])); //harsh log


      // notify the teacher and other connected players in the lobby
      io.to(code).emit('player-joined', { playerData, playerCount: lobbies[code].length });   //harsh, emitting num of players as well
    } else {
      // quiz lobby does not exist
      socket.emit('error', { message: 'Quiz lobby does not exist.' });
    }
  });

  // start the quiz
  socket.on('start-quiz', ({ code }) => {
    if (!code) {
      console.error('Quiz code missing for start-quiz event');
      return;
    }

    console.log(`Quiz started for code: ${code}`);
    // notify all users in the quiz room
    io.to(code).emit('quiz-started', { message: 'The quiz has started!' });
  });

  //send student to the lobby
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




//handling send-question event coming TeacherQuiz and then emitting question to sockets in lobby (to StudentQuiz)   (h add)
socket.on("send-question", ({ code, question }) => {
  if (!code || !question) {
      console.error("Invalid data received for send-question:", { code, question });
      return;
  }

  console.log(`Broadcasting question for quiz ${code}:`, question);

  // Emit the question to all users in the quiz room
  io.to(code).emit("send-question", { question });
});


//handling student-response received from StudentQuiz and emitting it (not even needed rn tbh)
socket.on("student-response", ({ code, answer, studentId }) => {
    if (!code || !answer || !studentId) {
        console.error("Invalid data received for student-response:", { code, answer, studentId });
        return;
    }

    console.log(`Student ${studentId} answered quiz ${code}: ${answer}`);

    // Optionally forward the response to the teacher for real-time updates
    io.to(code).emit("student-response", { studentId, answer });
});





  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    //remove players from lobby
    for (const [code, players] of Object.entries(lobbies)) {
      const index = players.findIndex((player) => player.id === socket.id);
      if (index !== -1) {
        players.splice(index, 1); // remove player
        io.to(code).emit('player-left', { id: socket.id, playerCount: lobbies[code].length });
        break;
      }
    }
  });
});

// Start the server
server.listen(3001, () => {
  console.log('Socket server is running on port 3001!');
});