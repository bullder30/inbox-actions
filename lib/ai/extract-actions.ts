/**
 * Service d'extraction d'actions depuis les emails avec IA
 * Utilise Claude (Anthropic) pour analyser le contenu des emails
 */

import Anthropic from "@anthropic-ai/sdk";
import { ActionType } from "@prisma/client";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

/**
 * Type pour une action extraite par l'IA
 */
export type ExtractedAction = {
  title: string;
  type: ActionType;
  sourceSentence: string;
  dueDate: Date | null;
  confidence: number; // 0-1
};

/**
 * Contexte de l'email pour l'analyse
 */
export type EmailContext = {
  from: string;
  subject: string | null;
  body: string;
  receivedAt: Date;
};

/**
 * Prompt système pour l'extraction d'actions
 */
const SYSTEM_PROMPT = `Tu es un assistant expert dans l'analyse d'emails professionnels en français.

Ta mission est d'identifier les actions à effectuer mentionnées dans un email et de les structurer.

Types d'actions disponibles :
- SEND : Envoyer quelque chose (document, email, fichier, rapport)
- CALL : Appeler quelqu'un (téléphone, visio)
- FOLLOW_UP : Relancer quelqu'un (rappel, suivi)
- PAY : Payer quelque chose (facture, achat)
- VALIDATE : Valider quelque chose (document, proposition, choix)

Règles d'extraction :
1. Extraire UNIQUEMENT les actions demandées à l'utilisateur (destinataire de l'email)
2. Ne PAS extraire les actions que l'expéditeur va faire lui-même
3. Identifier la phrase exacte qui mentionne l'action (max 200 caractères)
4. Créer un titre court et actionnable (max 100 caractères)
5. Détecter les dates d'échéance si mentionnées (formats : "avant vendredi", "d'ici lundi", "le 15 janvier", etc.)
6. Attribuer un score de confiance (0-1) selon la clarté de la demande

Répondre UNIQUEMENT avec un JSON valide, sans texte avant ou après.

Format de réponse :
{
  "actions": [
    {
      "title": "Titre court de l'action",
      "type": "SEND|CALL|FOLLOW_UP|PAY|VALIDATE",
      "sourceSentence": "Phrase extraite de l'email",
      "dueDate": "YYYY-MM-DD" | null,
      "confidence": 0.95
    }
  ]
}

Si aucune action n'est détectée, retourner :
{
  "actions": []
}`;

/**
 * Construit le prompt utilisateur pour l'extraction
 */
function buildUserPrompt(context: EmailContext): string {
  const subjectLine = context.subject ? `Sujet : ${context.subject}` : "";
  const receivedDate = context.receivedAt.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `Analyse cet email et extrais toutes les actions demandées au destinataire.

Expéditeur : ${context.from}
${subjectLine}
Date de réception : ${receivedDate}

Corps de l'email :
${context.body}

Rappel : N'extrais QUE les actions demandées au destinataire de l'email, pas celles que l'expéditeur va faire.`;
}

/**
 * Parse la date d'échéance relative (ex: "avant vendredi")
 */
function parseDueDate(dueDateStr: string | null, receivedAt: Date): Date | null {
  if (!dueDateStr) return null;

  try {
    // Si c'est déjà au format ISO (YYYY-MM-DD)
    const isoMatch = dueDateStr.match(/^\d{4}-\d{2}-\d{2}$/);
    if (isoMatch) {
      return new Date(dueDateStr);
    }

    // Sinon, retourner null (l'IA n'a pas pu parser)
    return null;
  } catch {
    return null;
  }
}

/**
 * Extrait les actions d'un email en utilisant Claude
 */
export async function extractActionsFromEmail(
  context: EmailContext
): Promise<ExtractedAction[]> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY not configured");
      return [];
    }

    const userPrompt = buildUserPrompt(context);

    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    // Extraire le contenu de la réponse
    const content = message.content[0];
    if (content.type !== "text") {
      console.error("Unexpected response type from Claude");
      return [];
    }

    // Parser le JSON
    const result = JSON.parse(content.text);

    if (!result.actions || !Array.isArray(result.actions)) {
      console.error("Invalid response format from Claude");
      return [];
    }

    // Mapper les actions extraites
    const extractedActions: ExtractedAction[] = result.actions.map(
      (action: any) => ({
        title: action.title || "Action sans titre",
        type: action.type as ActionType,
        sourceSentence: action.sourceSentence || "",
        dueDate: parseDueDate(action.dueDate, context.receivedAt),
        confidence: action.confidence || 0.5,
      })
    );

    // Filtrer les actions avec faible confiance (< 0.5)
    return extractedActions.filter((action) => action.confidence >= 0.5);
  } catch (error) {
    console.error("Error extracting actions with AI:", error);
    return [];
  }
}

/**
 * Extrait les actions de plusieurs emails en batch
 */
export async function extractActionsFromEmails(
  contexts: EmailContext[]
): Promise<Map<string, ExtractedAction[]>> {
  const results = new Map<string, ExtractedAction[]>();

  // Traiter les emails un par un (pas de batch pour éviter les quotas)
  for (const context of contexts) {
    const actions = await extractActionsFromEmail(context);
    // Utiliser l'email from + subject comme clé
    const key = `${context.from}:${context.subject}`;
    results.set(key, actions);

    // Petit délai pour éviter le rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
}

/**
 * Estime le nombre de tokens pour un email (approximatif)
 */
export function estimateTokenCount(text: string): number {
  // Approximation : 1 token ≈ 4 caractères en français
  return Math.ceil(text.length / 4);
}

/**
 * Vérifie si un email est trop long pour l'analyse
 */
export function isEmailTooLong(body: string): boolean {
  const tokenCount = estimateTokenCount(body);
  // Limite : 8000 tokens (laisse de la marge pour le prompt)
  return tokenCount > 8000;
}
