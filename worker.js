import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

// Emit a complete event after connection to let the main application
// know we are ready for work
socket.emit("complete");

socket.on('job', async (msg) => {
    console.log(`Starting job for ${msg.t} seconds`);
    await timeout(msg.t * 1000);
    console.log(`Job complete for ${msg.t} seconds`);
    socket.emit("complete", { workerId: socket.id });
});

socket.on('kickoff', () => {
    socket.emit("complete");
});

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}