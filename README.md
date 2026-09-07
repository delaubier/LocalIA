# Qwen Web Extension 🚀

Une extension Chrome puissante permettant de télécharger et d'exécuter des modèles de langage locaux (LLM) comme **Qwen 3.5 4B** directement dans votre navigateur, avec une interface élégante inspirée de ChatGPT.

## 🌟 Fonctionnalités Principales

*   **100% Local & Privé** : Le modèle tourne entièrement dans votre navigateur grâce à WebGPU et WebLLM. Aucune donnée ne quitte votre ordinateur.
*   **Interface Premium (Type ChatGPT)** : Une interface de discussion fluide, moderne et esthétique (animations subtiles, mode sombre, syntax highlighting).
*   **Intégration Transparente** : Accessible via un panneau latéral (Side Panel) dans Chrome pour vous assister pendant votre navigation sur n'importe quel site web.
*   **Gestion des Modèles** : Interface pour télécharger, mettre en cache et gérer différents modèles (Qwen 3.5, Llama 3, Phi-3, etc.) directement dans le navigateur.

## 🏗️ Architecture de l'Extension

L'extension est divisée en plusieurs parties clés :

1.  **Side Panel (L'Interface Utilisateur)**
    *   **Technologie** : React.js (ou Vanilla JS) + Tailwind CSS (ou CSS moderne avec Glassmorphism).
    *   **Rôle** : Affiche le chat, gère les entrées utilisateur, affiche les réponses en streaming.
2.  **Service Worker (Background Script)**
    *   **Technologie** : API Chrome Extension (Manifest V3).
    *   **Rôle** : Gère le cycle de vie de l'extension, intercepte les clics sur l'icône pour ouvrir le panneau.
3.  **Moteur WebLLM (Offscreen Document / Web Worker)**
    *   **Technologie** : [WebLLM](https://webllm.mlc.ai/) (basé sur Apache TVM) + WebGPU.
    *   **Rôle** : Télécharge les poids du modèle Qwen 3.5 4B, les stocke dans le cache du navigateur (Cache API / IndexedDB) et exécute l'inférence localement pour générer les réponses.

## 🛠️ Stack Technique Recommandée

*   **Modèle** : Qwen-1.5-4B-Chat-q4f16_1 (via WebLLM MLC)
*   **Moteur d'inférence** : `@mlc-ai/web-llm` (Nécessite un navigateur compatible WebGPU)
*   **UI/UX** : React, Framer Motion (pour les animations), CSS personnalisé pour un effet "Premium".
*   **Bundler** : Vite.js pour compiler l'extension.

## 🚀 Guide de Démarrage (Roadmap)

### 1. Initialisation
*   Créer le `manifest.json` (Manifest V3) avec les permissions nécessaires (`sidePanel`, `storage`, `unlimitedStorage` pour les poids du modèle).
*   Configurer Vite pour build l'extension.

### 2. Implémentation du WebLLM
*   Intégrer la bibliothèque `@mlc-ai/web-llm` dans un Web Worker.
*   Créer un gestionnaire de téléchargement avec une barre de progression pour le modèle (les modèles font plusieurs Go).

### 3. Développement de l'Interface (UI)
*   Créer une interface de chat responsive.
*   Implémenter le rendu Markdown pour les réponses de l'IA (avec coloration syntaxique pour le code).
*   Ajouter des indicateurs de génération (typing effect).

### 4. Intégration
*   Connecter l'interface React au Web Worker via l'API de messagerie de Chrome (`chrome.runtime.sendMessage`).

## 💡 Notes sur WebGPU

L'exécution de modèles comme Qwen 3.5 4B requiert **WebGPU**. L'utilisateur doit s'assurer d'utiliser une version récente de Google Chrome sur une machine disposant d'un GPU dédié ou d'un bon GPU intégré (Apple Silicon M1/M2/M3 ou équivalent PC).
