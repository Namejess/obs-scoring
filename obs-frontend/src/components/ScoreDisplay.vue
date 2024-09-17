<template>
    <div>
        <h2>{{ match.player1 }} vs {{ match.player2 }}</h2>
        <p>{{ match.player1 }} : {{ match.player1Score }}</p>
        <p>{{ match.player2 }} : {{ match.player2Score }}</p>
    </div>
</template>

<script>
import { io } from 'socket.io-client';

export default {
    data() {
        return {
            match: {},
            socket: null,
            handleScoreUpdate: null, // Pour gérer l'écouteur
        };
    },
    props: {
        matchId: {
            type: String,
            required: true,
        },
    },
    watch: {
        matchId(newMatchId, oldMatchId) {
            if (newMatchId !== oldMatchId) {
                this.updateMatch();
            }
        },
    },
    created() {
        this.updateMatch();
    },
    methods: {
        updateMatch() {
            // Déconnecter l'ancien socket
            if (this.socket) {
                this.socket.off('scoreUpdate', this.handleScoreUpdate);
            }

            // Récupérer les données du nouveau match
            this.fetchMatch();

            // Réinitialiser la connexion Socket.io
            this.initializeSocket();
        },
        fetchMatch() {
            this.$axios
                .get(`/matches/${this.matchId}`)
                .then((response) => {
                    this.match = response.data;
                })
                .catch((error) => {
                    console.error('Erreur lors de la récupération du match :', error);
                });
        },
        initializeSocket() {
            if (!this.socket) {
                this.socket = io('http://localhost:3000');

                this.socket.on('connect', () => {
                    console.log('Connecté au serveur Socket.io avec l\'ID :', this.socket.id);
                });

                this.socket.on('disconnect', () => {
                    console.log('Déconnecté du serveur Socket.io');
                });
            }

            // Définir l'écouteur pour les mises à jour
            this.handleScoreUpdate = (updatedMatch) => {
                if (updatedMatch._id === this.matchId) {
                    this.match = updatedMatch;
                }
            };

            // Écouter les mises à jour du score
            this.socket.on('scoreUpdate', this.handleScoreUpdate);
        },
    },
    beforeUnmount() {
        if (this.socket) {
            this.socket.off('scoreUpdate', this.handleScoreUpdate);
            this.socket.disconnect();
        }
    },
};
</script>

<style scoped>
/* Styles pour le composant */
</style>