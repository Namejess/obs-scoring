const express = require('express');
const mongoose = require('mongoose');
const app = express();
const http = require('http').createServer(app);

const io = require('socket.io')(http, {
    cors: {
        origin: 'http://localhost:5173', // URL de ton frontend
        methods: ['GET', 'POST', 'PATCH'],
        allowedHeaders: ['Content-Type'],
        credentials: true
    }
});

const cors = require('cors');
app.use(cors({
    origin: 'http://localhost:5173', // URL de ton frontend
    credentials: true
}));


const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');

const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'API de Scoring',
            version: '1.0.0',
            description: 'API pour gérer les scores des matchs',
        },
    },
    apis: ['./routes/*.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

require('dotenv').config();

// Middleware 
app.use(express.json());

app.use(cors({
    origin: 'http://localhost:5173', // URL de ton frontend
}));

// Importation des routes en passant `io` en paramètre
const matchesRoute = require('./routes/matchs')(io);
app.use('/matches', matchesRoute);

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Quelque chose a mal tourné!' });
});

// Connexion à la base de données
mongoose.connect(process.env.DB_CONNECTION, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('Connecté à la base de données'))
    .catch((err) => console.error('Erreur de connexion à la base de données', err));

// Route par défaut
app.get('/', (req, res) => {
    res.send('API de scoring opérationnelle');
});

// Démarrer le serveur avec HTTP et Socket.io
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});

// Gestion des connexions Socket.io
io.on('connection', (socket) => {
    console.log('Un client est connecté');

    socket.on('disconnect', () => {
        console.log('Client déconnecté');
    });
});


