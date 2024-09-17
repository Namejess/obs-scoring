const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
    player1: { type: String, required: true },
    player2: { type: String, required: true },
    player1Score: { type: Number, default: 0 },
    player2Score: { type: Number, default: 0 },
    team1: { type: String }, // Champ pour l'équipe du joueur 1
    team2: { type: String }, // Champ pour l'équipe du joueur 2
    isCurrent: { type: Boolean, default: false },
    date: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Match', MatchSchema);