<template>
    <div>
        <h2>Créer un nouveau match</h2>
        <form @submit.prevent="createMatch">
            <div>
                <label>Joueur 1 :</label>
                <input type="text" v-model="player1" required />
            </div>
            <div>
                <label>Équipe du Joueur 1 :</label>
                <input type="text" v-model="team1" />
            </div>
            <div>
                <label>Joueur 2 :</label>
                <input type="text" v-model="player2" required />
            </div>
            <div>
                <label>Équipe du Joueur 2 :</label>
                <input type="text" v-model="team2" />
            </div>
            <button type="submit">Créer le match</button>
        </form>
    </div>
</template>

<script>
export default {
    data() {
        return {
            player1: '',
            player2: '',
            team1: '',
            team2: '',
        };
    },
    methods: {
        createMatch() {
            const newMatch = {
                player1: this.player1,
                player2: this.player2,
                team1: this.team1,
                team2: this.team2,
            };
            this.$axios
                .post('/matches', newMatch)
                .then((response) => {
                    console.log('Match créé avec succès', response.data);
                    // Réinitialiser les champs du formulaire
                    this.player1 = '';
                    this.player2 = '';
                    this.team1 = '';
                    this.team2 = '';
                    // Émettre un événement au parent pour mettre à jour la liste des matchs
                    this.$emit('matchCreated', response.data);
                })
                .catch((error) => {
                    console.error('Erreur lors de la création du match :', error);
                });
        },
    },
};
</script>

<style scoped>
/* Styles pour le composant */
form {
    display: flex;
    flex-direction: column;
    max-width: 300px;
}

div {
    margin-bottom: 10px;
}

label {
    font-weight: bold;
}

button {
    width: 100px;
}
</style>