const http = require('http');
const express = require('express');
const {Server: socketServer} = require('socket.io');
const pty = require('node-pty');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');
const chokidar = require('chokidar');
const mongoose = require('mongoose');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const JWT_SECRET = process.env.JWT_SECRET || "secret";
const Docker = require('dockerode');

const DockerClient = new Docker();

const PORT_TO_CONTAINER = {};
const CONTAINER_TO_PORT = {};


const ContainerUser = {} // TO map the conatiner to the user 


const CreateContainer = async (userId) => {  // to create a docker container main function
    if (ContainerUser[userId]) {
        return ContainerUser[userId];
    }

    try {
        await DockerClient.pull('ubuntu', (err, stream) => {
            if (err) {
                console.error('Error pulling image:', err);
                return;
            }

            if (stream) {
                DockerClient.modem.followProgress(stream, onFinished, onProgress);
            } else {
                console.error('No stream received while pulling the image.');
                return;
            }

            function onFinished(err, output) {
                if (err) {
                    console.error('Error completing image pull:', err);
                } else {
                    console.log('Image pull complete.');
                }
            }

            function onProgress(event) {
                console.log(event);
            }
        });
    } catch (error) {
        console.error('Unexpected error while pulling image:', error);
        return null;
    }

    // Getting an available port
    const AvailablePort = (() => {
        for (let i = 8000; i < 9889; i++) {
            if (PORT_TO_CONTAINER[i]) continue;
            return `${i}`;
        }
    })();

    // Create Docker container
    try {
        const container = await DockerClient.createContainer({
            Image: 'ubuntu',
            Tty: true,
            Cmd: ['sh'],
            Volumes: {
                '/workspace': {}
            },
            HostConfig: {
                PortBindings: {
                    '80/tcp': [{ HostPort: AvailablePort }]
                }
            }
        });

        await container.start();
        ContainerUser[userId] = container;
        CONTAINER_TO_PORT[container.id] = AvailablePort;
        PORT_TO_CONTAINER[AvailablePort] = container.id;
        return ContainerUser[userId];
    } catch (error) {
        console.error('Error creating or starting the container:', error);
        return null;
    }
};



// delete docker container 
const removeDockerContainer = async (userId) => {
    // Stop and remove Docker container when user disconnects
    const container = ContainerUser[userId];
    if (container) {
        await container.stop();
        await container.remove();
        delete ContainerUser[userId];
    }
};




mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    connectTimeoutMS: 30000, // 30 seconds
    socketTimeoutMS: 45000,  // 45 seconds
  })
  .then(() => console.log('MongoDB connected 🎀'))
  .catch((error) => console.error('MongoDB connection error:', error))


const app = express();
const server = http.createServer(app);
const io = new socketServer({
    cors: {
        origin: '*'
    }
});

app.use(express.json());

app.use(cors());


// pty terminal
const shell = 'cmd.exe'; 
const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: path.join(__dirname, '__users__'),
    env: process.env
  });


  ptyProcess.onData((data) => {
    io.emit('terminal:data', data);
  });


io.attach(server);

// chokidar.watch('__users__').on('all', (event, filePath) => { 
//     io.emit('files:refresh', filePath);
// }); 

const directoryToWatch = path.join(__dirname, '__users__');


const watcher = chokidar.watch(directoryToWatch, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    usePolling: true, // Try using polling to avoid platform-specific issues
    interval: 100 // Polling interval in ms
});

watcher.on('all', (filePath) => {
    io.emit('file:refresh', filePath);
});

watcher.on('error', error => console.error(`Watcher error: ${error}`));



io.on('connection', (socket) => {
    console.log('🚀 New client connected');

    socket.on('authenticate', async (token) => {
        try {
            const user = jwt.verify(token, process.env.JWT_SECRET);

              // Create Docker container for the user
            //   await CreateContainer(user.id);

            socket.user = user; // Attach user info to socket
            socket.emit('authenticated', { success: true });
        } catch (error) {
            socket.emit('authenticated', { success: false, message: 'Invalid token' });
        }
    });


    socket.on('file:write', async ({ dir, content }) => {
        try {
            await fs.writeFile(path.join(__dirname, '__users__', dir), content);
            io.emit('file:refresh', dir);
        } catch (error) {
            console.error(`Error writing file: ${error}`);
        }
    })

    socket.on('terminal:write', (data) => {
        ptyProcess.write(data);
    })


})


// middleware 
const authenticateJWT = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized - No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) { 
            return res.status(403).json({ message: 'Forbidden - Invalid token' });
        }
        req.user = user;
        next();
    });
};

app.get('/files', async (req, res) => {
    const tree = await GenerateFileTree(path.join(__dirname, '__users__'));
    return res.json({ tree: tree });
});

// Apply authenticateJWT middleware to all routes except /files
// app.use(authenticateJWT);

// register route
app.post('/signup', async (req, res) => {
    const { email, password } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });

        const user = new User({ email, password });  // Store plain text password (not recommended)
        await user.save();

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).json({ message: 'Error registering user', error: error.message });
    }
});

app.get('/user/email', async (req, res) => {
    const token = req.query.token;
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized - No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ email: user.email });
    } catch (error) {
        console.error('Error fetching user email:', error);
        res.status(500).json({ message: 'Error fetching user email', error: error.message });
    }
});
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            console.error('User not found');
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Compare plain-text passwords directly (not secure)
        if (password !== user.password) {  // Directly comparing plain text passwords
            console.error('Password mismatch');
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ message: 'Error logging in', error });
    }
});




app.get('/files/content', async (req,res) => {
    const dir = req.query.path;
    const content = await fs.readFile(path.join(__dirname, '__users__', dir), 'utf-8');
    return res.json({ content: content });

})

server.listen(process.env.PORT, () => {
    console.log('🐋 Server listening on port ', process.env.PORT);
})

async function GenerateFileTree (directory) {
    const tree = {};

    async function BuildTree  (currDir, CurrTree) {

        const files = await fs.readdir(currDir);
        for (const file of files) {
            const filepath = path.join(currDir,file);
            const stat = await fs.stat(filepath);

            if (stat.isDirectory()){

                CurrTree[file] = {};
                await BuildTree(filepath, CurrTree[file]);

            } else {
                CurrTree[file] = null;
            }
        }

    }

    await BuildTree(directory, tree);
    return tree;
}


