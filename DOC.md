# XtreamFlow Pro : Spécifications Techniques & Guide Architectural

Bienvenue dans la documentation technique officielle de **XtreamFlow Pro**. Ce document détaille l'ensemble des mécanismes internes, des intégrations d'API, de la gestion interactive de l'interface utilisateur, et de l'architecture fluide calquée sur le style Windows 11.

---

## 🚀 1. Intégration Générale de l'API Xtream Codes

XtreamFlow interagit de manière dynamique avec l'API standard Xtream Codes des serveurs IPTV. L'API utilise des requêtes HTTP GET renvoyant des réponses JSON.

### Authentification & Point d'entrée
Toutes les actions requièrent un hôte, un port, un nom d'utilisateur et un mot de passe.
```
http://<host>:<port>/player_api.php?username=<user>&password=<pass>
```

### Récupération et Structure du Flux
1. **Live TV (Lives) :** Récupérés via le paramètre de requête `action=get_live_streams`. Cette requête renvoie une liste d'objets contenant les identifiants de flux, noms, logos, catégories et informations d'EPG.
2. **Movies (Films/VOD) :** Récupérés via le paramètre `action=get_vod_streams`. Les métadonnées de base (nom, poster, ID, catégorie) y sont présentes.
3. **Series (Séries) :** Récupérées via `action=get_series`. Cette liste contient les informations sur les séries globales (titre, image introductive, note).

### Rendement de l'UI (Render Logic)
Pour garantir une expérience fluide, XtreamFlow :
- Initialise une synchronisation en arrière-plan et stocke la structure de données dans **IndexedDB** à l'aide de **Dexie.js**.
- Utilise un système de pagination ou de virtualisation pour charger uniquement les éléments visibles à l'écran.
- Répartit les flux dans des tableaux triés par catégories avant de les envoyer aux composants de vue.

---

## 📺 2. Pages de Détails & Système de Recommandation

### Récupération des informations structurées
Pour obtenir des métadonnées complètes pour un élément, XtreamFlow utilise les actions avancées de l'API Xtream Codes :

*   **VOD (Movies) :** Requête vers `action=get_vod_info&vod_id=<id>`.
    *   **Réponse :** L'API fournit un ensemble contenant deux objets principaux : `info` (contient la jaquette, le synopsis, le réalisateur, les acteurs, la note, les genres, etc.) et `movie_data` (le format, le codec, le conteneur).
*   **Series (Séries) :** Requête vers `action=get_series_info&series_id=<id>`.
    *   **Réponse :** Renvoie les informations globales de la série dans `info`, ainsi qu'un dictionnaire d'épisodes classés par saisons (`episodes`) avec les URL de streaming individuelles.
*   **Live (Directs) :** Récupérés en corrélant les données de base de `get_live_streams` avec l'EPG à court/moyen terme via `action=get_short_epg&stream_id=<id>`.

### Système de Recommandation (Smart Match)
Le système de recommandation de XtreamFlow est géré côté client :
1. **Corrélation par Catégories :** Pour le contenu sélectionné, l'algorithme extrait son identifiant de catégorie locale.
2. **Filtrage Intelligent :** Il recherche au sein d'IndexedDB d'autres films ou séries de la même catégorie.
3. **Pondération & Tri :** Les recommandations sont triées sur la base de critères ordonnés :
    - La note du contenu (ex: score IMDb).
    - L'année de sortie (similaire pour préserver une cohérence générationnelle).
    - Des coefficients d'aléas restreints pour s'assurer que la grille de suggestions de 6 à 10 éléments affiche toujours de nouveaux contenus pertinents sans être parfaitement statique.

---

## 🎬 3. Stratégie de Récupération des Trailers

L'API Xtream Codes d'IPTV classique ne fournit que rarement des URL directes de bande-annonce. XtreamFlow adopte une stratégie d'imbrication dynamique en deux niveaux :

1. **Extraction de Métadonnées Natifs :**
   Lors de l'appel à `get_vod_info`, l'API renvoie parfois une clé `youtube_trailer` dans l'objet `info`. Sa valeur est soit un ID vidéo direct YouTube (`dQw4w9WgXcQ`), soit une URL complète. XtreamFlow extrait l'ID unique via une expression rationnelle.
2. **Recherches de Secours & Moteur de Scraping Inverse (Fallback) :**
   Si la clé est vide, absente, ou indique une erreur, XtreamFlow interroge en interne un micro-service de recherche ou utilise des APIs d'agrégation d'images et données (par exemple TMDb si une clé est configurée, ou une requête de recherche YouTube anonymisée via proxy) en combinant le nom du flux + l'année + le mot-clé `"trailer"` pour isoler automatiquement la vidéo de bande-annonce la plus pertinente.

---

## 🖼️ 4. Récupération des Posters et Images de Fond (Backdrop)

La qualité visuelle de type clone Netflix de l'application repose sur deux éléments graphiques : le **Poster** (format portrait `2:3`) et le **Backdrop** (format paysage `16:9`).

```
+----------------------------------------+
|                                        |
|               BACKDROP                 |
|                (16:9)                  |
|                                        |
|   +-------+                            |
|   |POSTER |                            |
|   | (2:3) |                            |
|   +-------+                            |
+----------------------------------------+
```

### Mécanique de récupération
- **Posters de la grille :** Ils sont fournis directement par l'API Xtream Codes via le champ `stream_icon` ou `cover`.
- **Récupération de Backdrops haute résolution :** Les serveurs IPTV fournissent rarement des backdrops paysages. XtreamFlow utilise une liaison intelligente :
  - Si un film à une référence IMDb (`rating_5star_id` ou autre identifiant stocké), une requête est passée vers des dépôts CDN ouverts ou le service TMDB (`https://image.tmdb.org/t/p/original/<backdrop_path>`).
  - Si aucune image n'est disponible, XtreamFlow applique un filtre de flou cinétique gaussien (CSS `backdrop-filter` avec `blur(60px)`) sur l'image du poster étirée au ratio `16:9`. Cela génère instantanément un arrière-plan d'ambiance ultra-moderne synchronisé avec les couleurs dominantes du film.

---

## 🔮 5. Librairie du Player YouTube

Pour éviter d'alourdir l'application avec d'épaisses dépendances, XtreamFlow implémente le chargement du lecteur YouTube à l'aide de :

*   **Librairie de Base :** **[`YouTube Player API`](https://developers.google.com/youtube/iframe_api)** native, chargée de manière asynchrone par injection de script dynamique.
*   Cette technique évite d'utiliser de lourdes couches d'abstraction tierces, réduisant la consommation de mémoire et permettant un contrôle bas niveau absolu sur l'instance du lecteur multimédia (Iframe).

---

## ⚙️ 6. Instanciation et Contrôle Fin du Player YouTube

### Code d'instanciation de l'API
Le chargement de l'API Iframe YouTube se fait asynchronement. Dès que l'API HTML5 est prête, elle appelle la fonction globale `window.onYouTubeIframeAPIReady`.

```typescript
// Exemple de fonction d'initialisation dans l'application
export function createYouTubePlayer(
  elementId: string, 
  videoId: string, 
  options: YT.PlayerOptions
): Promise<YT.Player> {
  return new Promise((resolve, reject) => {
    // Si l'API n'est pas chargée, on injecte le script
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const checkReady = () => {
      if (window.YT && window.YT.Player) {
        try {
          const player = new window.YT.Player(elementId, {
            videoId,
            ...options,
            events: {
              onReady: () => resolve(player),
              onError: (err) => reject(err),
              ...options.events
            }
          });
        } catch (e) {
          reject(e);
        }
      } else {
        setTimeout(checkReady, 100);
      }
    };
    checkReady();
  });
}
```

---

## 🌟 7. Logique Interactive Complex de la Section Hero

Le composant `HeroSection` gère de façon entièrement automatisée l'affichage, la mise en sourdine, l'analyse du positionnement de l'utilisateur, et la gestion des cas d'erreur.

### A. Affichage du Backdrop & Transition vers le Trailer
1. **Phase 1 : L'Image d'ambiance d'abord.**
   Au chargement du flux dans le Hero, le backdrop (ou son fallback flouté) est affiché à 100% d'opacité.
2. **Phase 2 : Temporisation stratégique.**
   Un délai d'attente de **3 à 5 secondes** est initié (via un `setTimeout` React). Ce laps de temps permet à l'utilisateur de lire le titre, d'apprécier la mise en page, et s'assure d'une transition non intrusive.
3. **Phase 3 : Transition en douceur.**
   À la fin du timer, l'iframe YouTube invisible est instanciée en arrière-plan. Une fois l'événement `onStateChange` repérant l'état de lecture active (`PLAYING`), l'iframe transitionne en fondu enchaîné (opacité de 0% à 70% ou 100% via Tailwind/Framer Motion) tandis que l'image de fond s'estompe légèrement.

### B. Mute/Unmute automatique au Scroll (Intersection Observer)
Pour maximiser l'attention de l'utilisateur sans générer de nuisance sonore incontrôlable, la section Hero intègre une détection fine du positionnement :

1. **Intersection Observer / Scroll Listener :**
   Un auditeur d'intersection ou un déclencheur lié au scroll est attaché de la manière suivante :
   ```typescript
   useEffect(() => {
     const handleScroll = () => {
       if (!playerRef.current) return;
       const heroHeight = heroElementRef.current?.offsetHeight || 400;
       const scrollPosition = window.scrollY;

       // Si la moitié supérieure de la section Hero est hors écran
       if (scrollPosition > heroHeight * 0.4) {
         if (!isMutedByScroll) {
           playerRef.current.mute(); // Coupe automatiquement le son du trailer
           setIsMutedByScroll(true);
         }
       } else {
         // Si l'utilisateur remonte, on restaure l'état sonore de son choix originel
         if (isMutedByScroll) {
           if (!userMutePreference) {
             playerRef.current.unMute();
           }
           setIsMutedByScroll(false);
         }
       }
     };

     window.addEventListener('scroll', handleScroll);
     return () => window.removeEventListener('scroll', handleScroll);
   }, [userMutePreference, isMutedByScroll]);
   ```
2. **Bouton Mute/Unmute interactif :**
   Un bouton affiché de manière élégante sur la section Hero permet de forcer la mise en sourdine manuelle. Ce choix définit la variable `userMutePreference` qui écrase la restauration automatique du son lors de la remontée de la page.

### C. Cascade Automatique (Fallback Random Loop)
Dans le cas où une vidéo de trailer n'est pas lisible (vidéo suppriméeux, blocage des droits de diffusion dans l'iframe, restriction d'âge ou erreur réseau) :

1. **Interception d'erreur :**
   L'API YouTube déclenche l'événement `onError`.
2. **Passage au contenu suivant :**
   Dès qu'une erreur de lecture est détectée dans les 5 secondes du chargement ou interceptée par l'événement d'erreur :
   - Un fondu de fermeture rétablit instantanément le Backdrop d'ambiance.
   - Le système sélectionne un nouveau contenu aléatoire (random stream) adapté.
   - Il initialise une transition douce vers ce nouveau contenu, respectant à nouveau la charte logique (image d'abord pendant un certain temps, puis tentative de chargement de la nouvelle bande-annonce).

---

## 💀 8. Style UI/UX & Recette de l'effet Skeleton

L'effet Skeletal (ou écran de chargement mimetique) de XtreamFlow Pro procure un sentiment de réactivité instantanée.

### L'approche de Mimétisme Absolu
Pour éviter les saccades visuelles (Jank), le Skeleton n'utilise pas de formes génériques de chargement circulaire. Il possède **exactement** la même structure structurelle que les conteneurs réels qui vont prendre sa place (Bento structure grid ou colonnes de détails).

### Guide de Reproduction (Pour un Agent IA ou Module CSS)

1. **Le Shimmer (L'effet de balayage lumineux) :**
   Définir une animation CSS linéaire infinie de 1.5s traduisant un dégradé translucide oblique de gauche à droite.
   ```css
   @keyframes shimmer {
     0% { transform: translateX(-100%); }
     100% { transform: translateX(100%); }
   }
   ```
2. **Structure du cache visuel (Le bloc opaque) :**
   Appliquer une couleur de base semi-transparente sombre aux éléments factices : `bg-white/5` (ou `rgba(255,255,255,0.05)`).
3. **Le masque à coins arrondis :**
   S'assurer que chaque bloc possède la propriété `overflow-hidden` et les mêmes arrondis de coins que l'élément d'interface final : `rounded-window` (ou `rounded-xl`).
4. **Le gabarit correspondant :**
   - **Mode Détail (Detail View) :** Divisé en deux colonnes principales sur grand écran — une colonne gauche portrait fixe de ratio `2:3` pour l'affiche avec une grille de boutons, et une colonne de détails droite avec des lignes horizontales de largeurs asymétriques pour imiter des paragraphes de texte réels.
   - **Mode Grille (Grid View) :** Une entête de Hero paysagère géante de ratio `16:9` ou hauteur fixe `420px` suivie d'une grille réactive (`grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6`) affichant des fiches uniformes pré-dimensionnées selon le type de contenu (aspect `16:9` pour le Live TV, aspect `2:3` pour les VOD et Séries).

---

### Résumé des Bonnes Pratiques UI d'Architecture
En respectant ce triptyque (Intégration d'API persistée locale + player asynchrone non perturbant + Skeletons de transition mimétiques), vous reproduirez l'expérience ultra-fluide et sans latence caractéristique de **XtreamFlow Pro**.
