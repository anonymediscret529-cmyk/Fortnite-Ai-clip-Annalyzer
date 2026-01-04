import { GoogleGenAI, Type } from "@google/genai";
import { FrameAnalysis, BoundingBox, TimelineEvent } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Aggressive safety settings: BLOCK_NONE is required for FPS games (guns/combat)
// Otherwise Gemini often refuses to analyze "Dangerous Content".
const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
];

// Helper to clean JSON if model adds markdown
const cleanJson = (text: string) => {
  if (!text) return "{}";
  let clean = text.trim();
  // Remove markdown code blocks (start)
  clean = clean.replace(/^```json\s*/, '').replace(/^```\s*/, '');
  // Remove markdown code blocks (end)
  clean = clean.replace(/\s*```$/, '');
  return clean;
};

// Prompt to simulate YOLO-style object detection and game state analysis
const ANALYSIS_SYSTEM_PROMPT = `
Vous êtes un Coach et Analyste Fortnite d'élite (Rang Unreal). Votre travail consiste à analyser des images de gameplay pour fournir des conseils tactiques de niveau professionnel et une détection d'objets précise. RÉPONDEZ TOUJOURS EN FRANÇAIS.

**DÉTECTION D'OBJETS (SIMULATION YOLO) :**
Détectez les objets avec une haute précision. Retournez des boîtes englobantes pour :
- Ennemis (Modèles de joueurs)
- Armes (Noms spécifiques : 'Pompe Havoc', 'AR Double Chargeur', 'Sniper')
- Constructions (Mur en bois, Rampe en brique, Cône en métal, Fenêtre éditée)
- Utilitaire (Répulseurs, Grosses Potions, Kits de soin)
- Véhicules
- Fournissez un score de confiance (confidence) entre 0.0 et 1.0 pour chaque objet.

**DIRECTIVES DE COACHING (NIVEAU PRO) :**
1. **Conseil Tactique (Positif/Action)** : Ce que le joueur DOIT faire maintenant.
2. **Erreurs Critiques (Négatif)** : Listez précisément ce que le joueur a FAIT DE MAL dans cette image.
   - Exemples : "Trop exposé angle gauche", "Mauvais crosshair placement (vise les pieds)", "Pas de cône de protection", "Saut de fatigue inutile".

Système de coordonnées : [ymin, xmin, ymax, xmax] normalisé de 0 à 1000.
Estimation de la santé : 0-100 basé sur le HUD.
Mode Construction : true si les plans/constructions sont actifs.
`;

export const analyzeFrame = async (base64Image: string, timestamp: number): Promise<FrameAnalysis> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image
            }
          },
          {
            text: `Analysez cette image Fortnite au timestamp ${timestamp}s. Détectez les objets, les erreurs du joueur et donnez un conseil pro.`
          }
        ]
      },
      config: {
        systemInstruction: ANALYSIS_SYSTEM_PROMPT,
        safetySettings: SAFETY_SETTINGS,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            tacticalAdvice: { type: Type.STRING },
            mistakes: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of specific mistakes or bad habits detected in the frame."
            },
            healthEstimate: { type: Type.NUMBER },
            buildMode: { type: Type.BOOLEAN },
            youtubeSearchQueries: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            objects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  ymin: { type: Type.NUMBER },
                  xmin: { type: Type.NUMBER },
                  ymax: { type: Type.NUMBER },
                  xmax: { type: Type.NUMBER },
                }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("L'IA a retourné une réponse vide. C'est souvent dû à un blocage de sécurité sur les images d'armes.");
    }
    
    let result;
    try {
      result = JSON.parse(cleanJson(text));
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, "Raw Text:", text);
      throw new Error("Erreur de formatage de la réponse IA.");
    }
    
    return {
      timestamp,
      summary: result.summary || "Analyse complétée.",
      tacticalAdvice: result.tacticalAdvice || "Maintenez la pression.",
      mistakes: result.mistakes || [], // Default to empty array if none
      healthEstimate: result.healthEstimate ?? 100,
      buildMode: result.buildMode ?? false,
      objects: result.objects || [],
      youtubeSearchQueries: result.youtubeSearchQueries || []
    };

  } catch (error: any) {
    console.error("Gemini analysis failed:", error);
    // Propagate error to UI
    throw error;
  }
};

export const generateClipSummary = async (frames: {data: string, timestamp: number}[]): Promise<string> => {
  try {
    const parts: any[] = frames.map(f => ({
      inlineData: {
        mimeType: 'image/jpeg',
        data: f.data
      }
    }));

    parts.push({
      text: `Analysez cette séquence de ${frames.length} images d'un clip Fortnite.
             
             Fournissez un résumé professionnel "VOD Review" en FRANÇAIS :
             1. **Rythme du combat** : Box fight, build battle ou tirs à distance ?
             2. **Mécaniques Clés** : Commentez la vitesse d'édition et le tracking (aim).
             3. **Erreurs Majeures** : Identifiez ce qui a été mal fait (ex : "Côté gauche exposé", "Tir de pompe raté").
             4. **Verdict** : Analyse Victoire/Défaite.`
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        systemInstruction: "Vous êtes un analyste esports Fortnite professionnel. Répondez en Français.",
        safetySettings: SAFETY_SETTINGS,
      }
    });

    return response.text || "Impossible de générer le résumé.";
  } catch (error) {
    console.error("Clip summary failed:", error);
    return "Erreur lors de l'analyse de la séquence.";
  }
};

export const scanVideoKeyframes = async (frames: {data: string, timestamp: number}[]): Promise<TimelineEvent[]> => {
  try {
     const parts: any[] = frames.map(f => ({
      inlineData: {
        mimeType: 'image/jpeg',
        data: f.data
      }
    }));
    
    const timestampMap = frames.map((f, i) => `Image ${i}: ${f.timestamp.toFixed(1)}s`).join('\n');

    parts.push({
      text: `Analysez ces ${frames.length} images.
             Timestamps :
             ${timestampMap}

             Identifiez l'événement PRINCIPAL dans chaque image.
             Retournez un tableau JSON.
             
             Types d'événements standard (utilisez ces IDs) : 'combat', 'build', 'loot', 'movement', 'heal', 'drive'.
             Label : Courte description en FRANÇAIS (ex : "Début Box Fight", "Prise de Mini Pot").`
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        safetySettings: SAFETY_SETTINGS,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              timestamp: { type: Type.NUMBER },
              type: { type: Type.STRING },
              label: { type: Type.STRING },
              confidence: { type: Type.NUMBER }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    try {
      return JSON.parse(cleanJson(text));
    } catch (e) {
      console.error("Timeline JSON parse error", e);
      return [];
    }

  } catch (error) {
    console.error("Timeline scan failed:", error);
    return [];
  }
}