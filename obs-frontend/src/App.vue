<template>
  <div id="app">
    <h1>NTSC Scoring</h1>
    <!-- Section pour créer un nouveau match -->
    <MatchCreator @matchCreated="onMatchCreated" />

    <!-- Sélection du match -->
    <select v-model="selectedMatchId" @change="onMatchChange">
      <option v-for="match in matches" :key="match._id" :value="match._id">
        {{ match.player1 }} vs {{ match.player2 }}
      </option>
    </select>

    <!-- Composant pour mettre à jour les scores -->
    <ScoreUpdater v-if="selectedMatchId" :matchId="selectedMatchId" />
    <ScoreDisplay v-if="selectedMatchId" :matchId="selectedMatchId" />
  </div>
</template>

<script>

import ScoreUpdater from './components/ScoreUpdater.vue';
import MatchCreator from './components/MatchCreator.vue';
import ScoreDisplay from './components/ScoreDisplay.vue';
import ScoreDisplayOBS from './components/ScoreDisplayOBS.vue';

export default {
  components: {
    ScoreUpdater,
    MatchCreator,
    ScoreDisplay,
    ScoreDisplayOBS,
  },
  data() {
    return {
      matches: [],
      selectedMatchId: null,
    };
  },
  created() {
    this.fetchMatches();
  },
  methods: {
    fetchMatches() {
      this.$axios.get('/matches').then((response) => {
        this.matches = response.data;
        if (!this.selectedMatchId && this.matches.length > 0) {
          this.selectedMatchId = this.matches[0]._id;
        }
      });
    },
    onMatchChange() {
      // Logique si nécessaire lors du changement de match
    },
    onMatchCreated(newMatch) {
      // Ajouter le nouveau match à la liste des matchs
      this.matches.push(newMatch);
      // Sélectionner automatiquement le nouveau match
      this.selectedMatchId = newMatch._id;
    },
  },
};
</script>

<style>
/* Styles globaux */
#app {
  max-width: 800px;
  margin: 0 auto;
}
</style>