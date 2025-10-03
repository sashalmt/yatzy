# Yatzy Online (GitHub Pages + Firebase)

Two-player Yatzy with realtime play and *persistent player stats* (wins, games, average score). Stats live in Firebase Realtime Database under /profiles/<uid>.

## Quick Start
1. Create a Firebase project → enable *Realtime Database*.
2. In Project settings, create a *Web App* and copy the config.
3. Paste config into firebase.js.
4. (Test rules)
   {
     "rules": { ".read": true, ".write": true }
   }
5. Deploy to *GitHub Pages* (repo root).

## How Stats Work
- Each browser gets a stable uid. On game over, each client uses a *transaction* to increment:
  - games += 1
  - wins += 1 (only the winner)
  - totalScore += <your final score>
- Average shown = totalScore / games (rounded to 0.1).

## Security
For production, add anonymous auth and rules to restrict writes to the player's own profile and their active room.
