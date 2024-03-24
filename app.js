import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server);

const __dirname = dirname(fileURLToPath(import.meta.url));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

const jobQueue = [
    { t: 8, data: "Eight second event complete" }, 
    { t: 20, data: "Twenty second event complete" }, 
    { t: 6, data: "Six second event complete" }, 
    { t: 33, data: "Thirty three second event complete" }
];

const inProgress = [];
const idleWorkers = [];

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.emit("queue", jobQueue);
    socket.emit("progress", inProgress);

    socket.on("request", (msg) => {
        jobQueue.push(msg);

        // If we have idle workers, kick off a worker
        if (idleWorkers.length) {
            // Removing an idle worker
            const idleWorkerId = idleWorkers.shift();
            io.to(idleWorkerId).emit("kickoff");
        }

        io.emit("queue", jobQueue);
        io.emit("progress", inProgress);
    });

    socket.on('disconnect', () => {
        // Remove the worker from the idle workers array
        if (idleWorkers.includes(socket.id)) {
            idleWorkers.splice(idleWorkers.findIndex(workerId => workerId === socket.id));
        }
        // See if we have an in progress job by the disconnected worker
        const inProgressJobIndex = inProgress.findIndex(job => job.workerId === socket.id)
        if (inProgressJobIndex >= 0) {
            // Put the in progress job back to the beginning
            jobQueue.unshift(inProgress[inProgressJobIndex]);
            inProgress.splice(inProgressJobIndex, 1);
        }
        io.emit("queue", jobQueue);
        io.emit("progress", inProgress);
    });

    socket.on('complete', (msg) => {
        // If the worker sends data, it is data about a finished job
        // which should be removed from the inProgress array
        if (msg) {
            const jobIndex = inProgress.findIndex(job => job.workerId === socket.id);
            inProgress.splice(jobIndex, 1);
        }
        
        // Pull the next job
        const job = jobQueue.shift();
        if (job) {
            const jobWithId = { ...job, workerId: socket.id };
            inProgress.push(jobWithId);
            socket.emit("job", jobWithId);

        } else {
            // Job queue is empty so we add workers to idle list
            console.log(`adding ${socket.id} to the idle list`);
            idleWorkers.push(socket.id);
        }
        // Emit events to let the watchers know where the queue is
        io.emit("queue", jobQueue);
        io.emit("progress", inProgress);
    });
  });

server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});