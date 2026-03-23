# CeWLeR – Extension Chrome

Extension Chrome qui reprend la logique de [CeWLeR](https://github.com/roys/cewler) : génération de listes de mots (wordlist) à partir du contenu des pages. **Aucune requête HTTP** : l’extension utilise uniquement les pages que vous ouvrez dans le navigateur (périmètre défini par une URL de départ).

## Installation

1. Ouvrir `chrome://extensions/`
2. Activer **Mode développeur**
3. Cliquer sur **Charger l’extension non empaquetée**
4. Sélectionner le dossier `extension` de ce dépôt

## Utilisation

1. Cliquer sur l’icône de l’extension.
2. **Périmètre** : saisir l’URL de départ (ex. `https://example.com`). Seules les pages dont l’URL est dans ce périmètre seront analysées.
3. **Activer la collecte** : cocher pour activer. Dès que vous naviguez sur des pages du périmètre, le contenu (texte, e-mails) est extrait et ajouté au dictionnaire.
4. **Options** (équivalent des options cewler) :
   - **Profondeur** : profondeur de chemin max (0 = illimitée)
   - **Stratégie sous-domaines** : `exact` / `children` / `all`
   - **Longueur min. des mots**, **Inclure CSS**, **Inclure JS**, **Minuscules**, **Sans chiffres**, **Exporter e-mails**, **Exporter URLs**
5. **Exporter** : télécharge les fichiers wordlist, e-mails et URLs (selon les options).
6. **Vider les données** : remet à zéro les mots/e-mails/URLs collectés.

Les paramètres sont conservés dans `chrome.storage.local` et réutilisés à chaque chargement de page dans le périmètre.

## Fichiers

- `manifest.json` – Manifest V3
- `background.js` – Agrégation des données, export (téléchargement)
- `content.js` – Injection sur toutes les URLs ; vérification du périmètre et envoi des mots/emails à la background
- `lib/constants.js` – Constantes (regex, caractères à filtrer)
- `lib/scope.js` – Vérification scope (sous-domaines, profondeur)
- `lib/extractor.js` – Extraction mots/emails depuis le texte (port de la logique cewler)
- `popup/` – Interface (champ périmètre, options, stats, export)

## Différences avec la CLI cewler

- Pas de crawl actif : seules les pages que vous visitez sont prises en compte.
- Pas de proxy / User-Agent personnalisé (contexte navigateur).
- Pas de PDF pour l’instant (possible d’ajouter PDF.js plus tard).
- Les fichiers exportés sont au format texte (un mot/e-mail/URL par ligne), comme la CLI.
# cewler-chrome
