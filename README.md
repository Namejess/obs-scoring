# OBS Scoring App

## Description
L'OBS Scoring App est une application web conçue pour gérer les scores des matchs en temps réel et afficher ces scores dans OBS. L'application est composée de deux parties :
- **Backend (obs-backend)** : Gère les API, la logique serveur, la base de données MongoDB pour les matchs et les scores.
- **Frontend (obs-frontend)** : Interface utilisateur pour créer, mettre à jour et gérer les matchs.

Les données des scores sont récupérées en temps réel via une API et peuvent être affichées dans OBS à l'aide du plugin **URL/API Source: Live Data, Media and AI**.

## Structure du projet
```
.
├── obs-backend      # Serveur Node.js avec Express et MongoDB pour gérer les API et la logique des scores
├── obs-frontend     # Application Vue.js pour gérer les matchs et scores via une interface utilisateur
└── README.md        # Ce fichier README
```

## Prérequis

- [Node.js](https://nodejs.org/)
- [MongoDB](https://www.mongodb.com/)
- [OBS Studio](https://obsproject.com/)
- Plugin OBS : [URL/API Source: Live Data, Media and AI](https://obsproject.com/forum/resources/url-api-source-live-data-media-and-ai-on-obs-made-simple.1438/)

## Installation

### 1. Cloner le dépôt

```bash
git clone <votre-repo-url>
cd <votre-repo>
```

### 2. Installation du backend

```bash
cd obs-backend
npm install
```

### 3. Installation du frontend

```bash
cd ../obs-frontend
npm install
```

## Configuration

### Backend (obs-backend)

1. Créez un fichier `.env` dans le dossier `obs-backend` pour les variables d'environnement, en spécifiant votre connexion MongoDB.

Exemple de fichier `.env` :
```
DB_CONNECTION=mongodb://localhost:27017/obs
PORT=3000
```

2. Lancez le serveur backend :

```bash
cd obs-backend
npm start
```

### Frontend (obs-frontend)

1. Lancez l'application frontend :

```bash
cd obs-frontend
npm run serve
```

### OBS

1. Installez le plugin **URL/API Source** dans OBS Studio.
2. Ajoutez une nouvelle **Source de navigateur** dans OBS en spécifiant l'URL de l'API (par exemple, `http://localhost:3000/matches/current`).
3. Configurez les templates pour afficher les scores et noms des joueurs en utilisant Inja templating.

## Utilisation

1. Accédez à l'interface frontend à l'adresse `http://localhost:5173` pour créer et gérer les matchs.
2. Les scores sont mis à jour en temps réel et peuvent être récupérés dans OBS via l'API.

## Exemples de commandes

### Pour démarrer le serveur backend :
```bash
cd obs-backend
npm start
```

### Pour démarrer le frontend :
```bash
cd obs-frontend
npm run serve
```

## Auteur

Jess

## Licence

Ce projet est sous licence MIT.

---

Ceci est une version simple du README, vous pouvez l'étoffer en ajoutant plus de détails spécifiques à votre projet ou des instructions supplémentaires selon vos besoins.
