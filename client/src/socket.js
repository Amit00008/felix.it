import { io } from "socket.io-client";

const socket = io('ws://localhost:4001');

export default socket;