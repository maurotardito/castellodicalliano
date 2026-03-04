# 🏡 Check-In Manager

Gestione check-in per affittacamere in Piemonte.  
Scansione documenti con AI · Export Questura (Alloggiati Web) · Export ISTAT (ROSS 1000)

## Stack
- React 18 + Vite
- Storage: localStorage (dati salvati nel browser)
- AI: Claude API (Anthropic) per OCR documenti

## Sviluppo locale

```bash
npm install
npm run dev
```

## Deploy su Vercel

1. Carica questo progetto su GitHub
2. Vai su [vercel.com](https://vercel.com) → "Add New Project"
3. Importa il repository GitHub
4. Vercel rileva Vite automaticamente → clicca **Deploy**

## ⚠️ Variabile d'ambiente

L'app usa l'API Anthropic per leggere i documenti.  
Su Vercel aggiungi la variabile d'ambiente:

```
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

Poi in `src/App.jsx` sostituisci l'header della fetch con:
```js
"x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
```

## Note privacy
I dati degli ospiti sono salvati **solo nel browser locale** (localStorage).  
Nessun dato viene inviato a server terzi ad eccezione dell'immagine del documento  
inviata ad Anthropic per l'estrazione OCR.
