const express = require('express');
const router = express.Router();
const Match = require('../models/matchModel');
const Joi = require('joi');

// Schéma de validation pour un match
const matchSchema = Joi.object({
    player1: Joi.string().required(),
    player2: Joi.string().required(),
    player1Score: Joi.number().integer(),
    player2Score: Joi.number().integer(),
});

// Exporter une fonction qui prend `io` en paramètre
module.exports = function (io) {
    console.log('io est défini dans matchs.js ?', !!io);

    /**
     * @swagger
     * /matches:
     *   post:
     *     summary: Créer un nouveau match
     *     tags: [Matches]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/Match'
     *     responses:
     *       201:
     *         description: Match créé avec succès.
     *       400:
     *         description: Erreur de validation.
     */
    const express = require('express');
    const router = express.Router();
    const Match = require('../models/matchModel');
    const Joi = require('joi');

    // Schéma de validation pour un match
    const matchSchema = Joi.object({
        player1: Joi.string().required(),
        player2: Joi.string().required(),
        team1: Joi.string().allow(''), // Autoriser une chaîne vide si l'équipe n'est pas renseignée
        team2: Joi.string().allow(''),
        player1Score: Joi.number().integer(),
        player2Score: Joi.number().integer(),
    });

    // Route pour créer un nouveau match
    router.post('/', async (req, res) => {
        const { error } = matchSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0].message });

        const match = new Match({
            player1: req.body.player1,
            player2: req.body.player2,
            team1: req.body.team1,
            team2: req.body.team2,
        });
        try {
            const savedMatch = await match.save();
            res.status(201).json(savedMatch);
        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    });

    module.exports = router;

    // Endpoint pour obtenir les données pour OBS
    router.get('/obsData', async (req, res) => {
        try {
            // Récupérer le match en cours
            const currentMatch = await Match.findOne({ isCurrent: true });
            if (!currentMatch) {
                return res.status(404).json({ message: 'Aucun match en cours' });
            }

            // Construire les données pour OBS
            const obsData = {
                players: [
                    {
                        name: currentMatch.player1,
                        team: currentMatch.team1 || '', // Si l'équipe n'existe pas, chaîne vide
                        score: currentMatch.player1Score || 0
                    },
                    {
                        name: currentMatch.player2,
                        team: currentMatch.team2 || '',
                        score: currentMatch.player2Score || 0
                    }
                ]
            };

            res.json(obsData);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // Récupérer tous les matchs
    router.get('/', async (req, res) => {
        try {
            const matches = await Match.find();
            res.json(matches);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // Récupérer le match en cours
    router.get('/current', async (req, res) => {
        try {
            // Logique pour déterminer le match en cours
            // Par exemple, un champ 'isCurrent' dans le modèle Match
            const currentMatch = await Match.findOne({ isCurrent: true });
            if (!currentMatch) {
                return res.status(404).json({ message: 'Aucun match en cours' });
            }
            res.json(currentMatch);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // Définir un match comme match en cours
    router.patch('/:id/setCurrent', async (req, res) => {
        try {
            // Réinitialiser le champ isCurrent pour tous les matchs
            await Match.updateMany({}, { isCurrent: false });
            // Définir le match sélectionné comme match en cours
            await Match.findByIdAndUpdate(req.params.id, { isCurrent: true });
            res.json({ message: 'Match défini comme match en cours' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.patch('/:id', async (req, res) => {
        try {
            console.log('Données reçues pour la mise à jour du match :', req.body);
            const match = await Match.findById(req.params.id);
            if (!match) {
                return res.status(404).json({ message: 'Match non trouvé' });
            }
            if (req.body.player1Score != null) {
                match.player1Score = req.body.player1Score;
                console.log('Score du joueur 1 mis à jour', match.player1Score);
            }
            if (req.body.player2Score != null) {
                match.player2Score = req.body.player2Score;
                console.log('Score du joueur 2 mis à jour', match.player2Score);
            }
            const updatedMatch = await match.save();

            // Émettre l'événement de mise à jour
            io.emit('scoreUpdate', updatedMatch);
            console.log('Émission de l\'événement scoreUpdate pour le match ID :', updatedMatch._id);

            // Envoyer la réponse au client
            res.json(updatedMatch);
            console.log('Match mis à jour avec succès', updatedMatch);

        } catch (err) {
            console.error('Erreur lors de la mise à jour du match :', err);
            res.status(400).json({ message: err.message });
        }
    });

    // Récupérer un match par son ID
    router.get('/:id', async (req, res) => {
        try {
            const match = await Match.findById(req.params.id);
            if (match == null) {
                return res.status(404).json({ message: 'Match non trouvé' });
            }
            res.json(match);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });


    // Supprimer un match
    router.delete('/:id', async (req, res) => {
        try {
            await Match.findByIdAndDelete(req.params.id);
            res.json({ message: 'Match supprimé' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    return router;
};