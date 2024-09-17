<template>
    <div>
        <h2>
            <span v-if="match.team1">{{ match.team1 }} </span>{{ match.player1 }}
            vs
            <span v-if="match.team2">{{ match.team2 }} </span>{{ match.player2 }}
        </h2>
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
        };
    },
    props: {
        matchId: {
            type: String,
            required: true,
        },
    },
    created() {
        this.fetchMatch();
        this.initializeSocket();
    },
    methods: {
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
            this.socket = io('http://localhost:3000');

            this.socket.on('connect', () => {
                console.log('Connecté au serveur Socket.io avec l\'ID :', this.socket.id);
            });

            this.socket.on('scoreUpdate', (updatedMatch) => {
                if (updatedMatch._id === this.matchId) {
                    this.match = updatedMatch;
                }
            });

            this.socket.on('disconnect', () => {
                console.log('Déconnecté du serveur Socket.io');
            });
        },
    },
    beforeUnmount() {
        if (this.socket) {
            this.socket.disconnect();
        }
    },
};
</script>

<style scoped>
/* Styles spécifiques pour l'affichage dans OBS */
#score-display-obs {
    /* Exemple : fond transparent */
    background-color: transparent;
    color: white;
    /* Autres styles pour correspondre à votre design */
}
</style>