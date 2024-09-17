<template>
    <div v-if="match">
        <h2>Mettre à jour le score</h2>
        <form @submit.prevent="updateScore">
            <div>
                <label>{{ match.player1 }} :</label>
                <input type="number" v-model.number="player1Score" />
            </div>
            <div>
                <label>{{ match.player2 }} :</label>
                <input type="number" v-model.number="player2Score" />
            </div>
            <button type="submit">Mettre à jour</button>
            <button @click="setCurrentMatch(match._id)">Définir comme match en cours</button>
        </form>
    </div>
    <div v-else>
        <p>Chargement du match...</p>
    </div>
</template>

<script>
export default {
    data() {
        return {
            match: {},
            player1Score: 0,
            player2Score: 0,
        };
    },
    props: {
        matchId: {
            type: String,
            required: true,
        },
    },
    watch: {
        matchId(newId) {
            this.fetchMatch(newId);
        },
    },
    created() {
        this.fetchMatch(this.matchId);
    },
    methods: {
        fetchMatch(id) {
            this.$axios.get(`/matches/${id}`).then((response) => {
                this.match = response.data;
                this.player1Score = this.match.player1Score || 0;
                this.player2Score = this.match.player2Score || 0;
            });
        },
        setCurrentMatch(matchId) {
            this.$axios.patch(`/matches/${matchId}/setCurrent`)
                .then(() => {
                    // Mettre à jour la liste des matchs ou afficher un message de confirmation
                })
                .catch((error) => {
                    console.error('Erreur lors de la définition du match en cours :', error);
                });
        },
        updateScore() {
            this.$axios
                .patch(`/matches/${this.matchId}`, {
                    player1Score: this.player1Score,
                    player2Score: this.player2Score,
                })
                .then((response) => {
                    console.log('Score mis à jour', response.data);
                })
                .catch((error) => {
                    console.error('Erreur lors de la mise à jour du score :', error);
                });
        },
    },
};
</script>