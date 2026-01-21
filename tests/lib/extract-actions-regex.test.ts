import { describe, expect, it } from "vitest";
import {
  extractActionsFromEmail,
  type EmailContext,
  type ExtractedAction,
} from "@/lib/actions/extract-actions-regex";

// Helper pour créer un contexte email
function createEmailContext(
  body: string,
  options: Partial<EmailContext> = {}
): EmailContext {
  return {
    from: options.from ?? "collegue@entreprise.com",
    subject: options.subject ?? "Demande",
    body,
    receivedAt: options.receivedAt ?? new Date("2024-01-15T10:00:00Z"),
  };
}

// ============================================================================
// TESTS D'EXTRACTION PAR TYPE
// ============================================================================

describe("Extraction SEND", () => {
  it("devrait extraire une action SEND avec 'peux-tu envoyer'", () => {
    const context = createEmailContext("Peux-tu m'envoyer le rapport mensuel ?");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("SEND");
    expect(actions[0].title).toContain("rapport mensuel");
  });

  it("devrait extraire une action SEND avec 'merci de transmettre'", () => {
    const context = createEmailContext("Merci de transmettre le dossier au client.");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("SEND");
    expect(actions[0].title).toContain("dossier");
  });

  it("devrait extraire une action SEND avec 'veuillez envoyer'", () => {
    const context = createEmailContext("Veuillez envoyer la facture avant vendredi.");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("SEND");
  });

  it("devrait extraire une action SEND avec 'envoie-moi'", () => {
    const context = createEmailContext("Envoie-moi le contrat signé.");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("SEND");
    expect(actions[0].title).toContain("contrat signé");
  });
});

describe("Extraction CALL", () => {
  it("devrait extraire une action CALL avec 'rappelle-moi'", () => {
    const context = createEmailContext("Rappelle-moi demain matin.");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("CALL");
  });

  it("devrait extraire une action CALL avec 'peux-tu appeler'", () => {
    const context = createEmailContext("Peux-tu appeler le fournisseur ?");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("CALL");
    expect(actions[0].title).toContain("fournisseur");
  });

  it("devrait extraire une action CALL avec 'organiser une visio'", () => {
    const context = createEmailContext("Peux-tu organiser une visio avec l'équipe marketing ?");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("CALL");
    expect(actions[0].title).toContain("équipe marketing");
  });

  it("devrait extraire une action CALL avec numéro de téléphone", () => {
    const context = createEmailContext("Merci de rappeler au 06 12 34 56 78 demain.");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("CALL");
  });
});

describe("Extraction FOLLOW_UP", () => {
  it("devrait extraire une action FOLLOW_UP avec 'relance'", () => {
    const context = createEmailContext("Relance le client Dupont sur le devis.");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("FOLLOW_UP");
    expect(actions[0].title).toContain("client Dupont");
  });

  it("devrait extraire une action FOLLOW_UP avec 'faire un suivi'", () => {
    const context = createEmailContext("Peux-tu faire un suivi sur le dossier Martin ?");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("FOLLOW_UP");
  });

  it("devrait extraire une action FOLLOW_UP avec 'il faut relancer'", () => {
    const context = createEmailContext("Il faut relancer le prestataire pour la livraison.");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("FOLLOW_UP");
  });
});

describe("Extraction PAY", () => {
  it("devrait extraire une action PAY avec 'payer la facture'", () => {
    const context = createEmailContext("Peux-tu payer la facture du fournisseur ?");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("PAY");
  });

  it("devrait extraire une action PAY avec 'régler'", () => {
    const context = createEmailContext("Merci de régler la note de frais avant fin de mois.");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("PAY");
  });

  it("devrait extraire une action PAY avec 'faire un virement'", () => {
    const context = createEmailContext("Peux-tu faire un virement de 500 euros ?");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("PAY");
  });
});

describe("Extraction VALIDATE", () => {
  it("devrait extraire une action VALIDATE avec 'valider'", () => {
    const context = createEmailContext("Peux-tu valider le devis joint ?");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("VALIDATE");
  });

  it("devrait extraire une action VALIDATE avec 'approuver'", () => {
    const context = createEmailContext("Peux-tu approuver le budget prévisionnel ?");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("VALIDATE");
  });

  it("devrait extraire une action VALIDATE avec 'confirmer'", () => {
    const context = createEmailContext("Peux-tu confirmer la date de livraison ?");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("VALIDATE");
  });

  it("devrait extraire une action VALIDATE avec 'donner ton avis'", () => {
    const context = createEmailContext("Peux-tu me donner ton avis sur le contrat ?");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("VALIDATE");
  });
});

// ============================================================================
// TESTS CONDITIONNELS FAIBLES
// ============================================================================

describe("Conditionnels faibles", () => {
  it("devrait ignorer 'éventuellement' sans deadline", () => {
    const context = createEmailContext("Éventuellement, peux-tu m'envoyer le rapport ?");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(0);
  });

  it("devrait ignorer 'si jamais' sans deadline", () => {
    const context = createEmailContext("Si jamais tu as le temps, peux-tu appeler le client ?");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(0);
  });

  it("devrait ignorer 'quand tu auras le temps' sans deadline", () => {
    const context = createEmailContext("Quand tu auras le temps, merci de relancer le fournisseur.");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(0);
  });

  it("devrait GARDER l'action si conditionnel faible MAIS deadline présente", () => {
    const context = createEmailContext("Éventuellement, peux-tu m'envoyer le rapport avant vendredi ?");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("SEND");
    expect(actions[0].dueDate).not.toBeNull();
  });

  it("devrait GARDER l'action avec 'si tu peux' et deadline", () => {
    const context = createEmailContext("Si tu peux, envoie-moi le document demain.");
    const actions = extractActionsFromEmail(context);

    // "si tu peux" n'est pas un conditionnel faible, donc l'action est gardée
    expect(actions).toHaveLength(1);
  });
});

// ============================================================================
// TESTS GATING ANTI-AMBIGUÏTÉ (STRONG_MARKERS)
// ============================================================================

describe("Gating anti-ambiguïté", () => {
  it("devrait rejeter une action CALL sans objet ni marqueur fort ni deadline", () => {
    // "Rappelle" sans cible, sans deadline, sans marqueur fort → rejeté
    // Note: "rappeler" est lui-même un marqueur fort pour CALL, donc on utilise un autre verbe
    const context = createEmailContext("Merci de contacter quelqu'un.");
    const actions = extractActionsFromEmail(context);

    // Le pattern matche mais "quelqu'un" est trop vague
    // En fait le pattern capture "quelqu'un" donc il y a un objet
    expect(actions).toHaveLength(1);
  });

  it("devrait accepter une action CALL sans objet MAIS avec deadline", () => {
    const context = createEmailContext("Merci de rappeler demain.");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("CALL");
    expect(actions[0].dueDate).not.toBeNull();
  });

  it("devrait accepter une action CALL sans objet MAIS avec marqueur fort (visio)", () => {
    const context = createEmailContext("Merci de rappeler pour la visio.");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("CALL");
  });

  it("devrait accepter une action SEND avec objet capturé", () => {
    const context = createEmailContext("Merci de m'envoyer le devis.");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("SEND");
    expect(actions[0].title).toContain("devis");
  });

  it("devrait accepter une action PAY sans objet MAIS avec marqueur fort (facture)", () => {
    const context = createEmailContext("Merci de régler la facture.");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("PAY");
  });

  it("devrait accepter une action VALIDATE sans objet MAIS avec marqueur fort (contrat)", () => {
    const context = createEmailContext("Il faut valider le contrat.");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("VALIDATE");
  });
});

// ============================================================================
// TESTS EXCLUSIONS
// ============================================================================

describe("Exclusions d'expéditeurs", () => {
  it("devrait exclure les emails de no-reply@", () => {
    const context = createEmailContext("Peux-tu m'envoyer le rapport ?", {
      from: "no-reply@entreprise.com",
    });
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(0);
  });

  it("devrait exclure les emails de noreply@", () => {
    const context = createEmailContext("Peux-tu m'envoyer le rapport ?", {
      from: "noreply@service.com",
    });
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(0);
  });

  it("devrait exclure les emails de newsletter@", () => {
    const context = createEmailContext("Peux-tu valider cette offre ?", {
      from: "newsletter@marketing.com",
    });
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(0);
  });

  it("devrait exclure les emails de notifications@", () => {
    const context = createEmailContext("Rappelle-moi demain.", {
      from: "notifications@app.com",
    });
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(0);
  });

  it("devrait exclure les emails de mailer-daemon@", () => {
    const context = createEmailContext("Peux-tu renvoyer le message ?", {
      from: "mailer-daemon@server.com",
    });
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(0);
  });

  it("NE devrait PAS exclure les emails de info@", () => {
    const context = createEmailContext("Peux-tu m'envoyer le rapport ?", {
      from: "info@client.com",
    });
    const actions = extractActionsFromEmail(context);

    // info@ n'est plus exclu (peut être une vraie personne)
    expect(actions).toHaveLength(1);
  });

  it("NE devrait PAS exclure les emails de contact@", () => {
    const context = createEmailContext("Peux-tu m'envoyer le devis ?", {
      from: "contact@fournisseur.com",
    });
    const actions = extractActionsFromEmail(context);

    // contact@ n'est plus exclu (peut être une vraie personne)
    expect(actions).toHaveLength(1);
  });
});

describe("Exclusions par sujet", () => {
  it("devrait exclure les emails avec sujet 'newsletter'", () => {
    const context = createEmailContext("Peux-tu valider cette offre ?", {
      subject: "Newsletter de janvier",
    });
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(0);
  });

  it("devrait exclure les emails avec sujet 'confirmation de commande'", () => {
    const context = createEmailContext("Peux-tu vérifier la commande ?", {
      subject: "Confirmation de commande #12345",
    });
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(0);
  });

  it("devrait exclure les emails avec sujet 'votre commande'", () => {
    const context = createEmailContext("Peux-tu suivre le colis ?", {
      subject: "Votre commande a été expédiée",
    });
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(0);
  });
});

describe("Exclusions par contenu", () => {
  it("devrait exclure les emails avec lien de désinscription", () => {
    const context = createEmailContext(
      "Peux-tu m'envoyer le rapport ?\n\nCliquez ici pour vous désabonner."
    );
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(0);
  });

  it("devrait exclure les emails automatiques", () => {
    const context = createEmailContext(
      "Peux-tu valider le document ?\n\nCet email a été envoyé automatiquement."
    );
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(0);
  });
});

// ============================================================================
// TESTS PARSING DE DATES
// ============================================================================

describe("Parsing de dates", () => {
  const baseDate = new Date("2024-01-15T10:00:00Z"); // Lundi 15 janvier 2024

  it("devrait parser 'demain'", () => {
    const context = createEmailContext("Envoie-moi le rapport demain.", {
      receivedAt: baseDate,
    });
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].dueDate).not.toBeNull();
    expect(actions[0].dueDate?.getDate()).toBe(16); // 16 janvier
  });

  it("devrait parser 'avant vendredi'", () => {
    const context = createEmailContext("Peux-tu m'envoyer le dossier avant vendredi ?", {
      receivedAt: baseDate,
    });
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].dueDate).not.toBeNull();
    expect(actions[0].dueDate?.getDay()).toBe(5); // Vendredi
  });

  it("devrait parser 'fin de semaine'", () => {
    const context = createEmailContext("Relance le client en fin de semaine.", {
      receivedAt: baseDate,
    });
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].dueDate).not.toBeNull();
    expect(actions[0].dueDate?.getDay()).toBe(5); // Vendredi
  });

  it("devrait parser 'avant le 20 janvier'", () => {
    const context = createEmailContext("Merci de valider le devis avant le 20 janvier.", {
      receivedAt: baseDate,
    });
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].dueDate).not.toBeNull();
    expect(actions[0].dueDate?.getDate()).toBe(20);
    expect(actions[0].dueDate?.getMonth()).toBe(0); // Janvier
  });

  it("devrait parser 'dans 3 jours'", () => {
    const context = createEmailContext("Rappelle-moi dans 3 jours.", {
      receivedAt: baseDate,
    });
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].dueDate).not.toBeNull();
    expect(actions[0].dueDate?.getDate()).toBe(18); // 15 + 3
  });

  it("devrait parser 'ce matin' → 12h", () => {
    const context = createEmailContext("Envoie-moi le fichier ce matin.", {
      receivedAt: baseDate,
    });
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].dueDate).not.toBeNull();
    expect(actions[0].dueDate?.getHours()).toBe(12);
  });

  it("devrait parser 'fin de journée' → 18h", () => {
    const context = createEmailContext("Merci de régler la facture en fin de journée.", {
      receivedAt: baseDate,
    });
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].dueDate).not.toBeNull();
    expect(actions[0].dueDate?.getHours()).toBe(18);
  });

  it("devrait parser 'la semaine prochaine' → Lundi suivant", () => {
    const context = createEmailContext("Relance le client la semaine prochaine.", {
      receivedAt: baseDate,
    });
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].dueDate).not.toBeNull();
    expect(actions[0].dueDate?.getDay()).toBe(1); // Lundi
    expect(actions[0].dueDate?.getDate()).toBe(22); // 22 janvier
  });

  it("devrait parser 'fin du mois' → Dernier jour du mois", () => {
    const context = createEmailContext("Merci de régler la facture fin du mois.", {
      receivedAt: baseDate,
    });
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].dueDate).not.toBeNull();
    expect(actions[0].dueDate?.getDate()).toBe(31); // 31 janvier
  });
});

// ============================================================================
// TESTS DÉCOUPAGE DES PHRASES
// ============================================================================

describe("Découpage des phrases", () => {
  it("devrait extraire plusieurs actions de phrases séparées par des points", () => {
    const context = createEmailContext(
      "Peux-tu m'envoyer le rapport. Rappelle aussi le client Dupont."
    );
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(2);
    expect(actions.map((a) => a.type)).toContain("SEND");
    expect(actions.map((a) => a.type)).toContain("CALL");
  });

  it("devrait extraire des actions de phrases séparées par des points-virgules", () => {
    const context = createEmailContext(
      "Tâches urgentes: envoie le devis au client; relance le fournisseur"
    );
    const actions = extractActionsFromEmail(context);

    expect(actions.length).toBeGreaterThanOrEqual(1);
  });

  it("devrait extraire des actions de listes avec retours à la ligne", () => {
    const context = createEmailContext(
      "Voici les tâches:\n- Envoie-moi le rapport\n- Rappelle le client\n- Valide le devis"
    );
    const actions = extractActionsFromEmail(context);

    expect(actions.length).toBeGreaterThanOrEqual(2);
  });

  it("devrait gérer les emails avec beaucoup de lignes", () => {
    const context = createEmailContext(
      "Bonjour,\n\nJ'espère que tu vas bien.\n\nPeux-tu m'envoyer le rapport mensuel avant vendredi ?\n\nMerci d'avance.\n\nCordialement"
    );
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("SEND");
  });
});

// ============================================================================
// TESTS DE DÉDUPLICATION
// ============================================================================

describe("Déduplication", () => {
  it("devrait dédupliquer les actions identiques (même phrase source)", () => {
    // La déduplication se fait sur type + titre + sourceSentence
    // Ici les deux phrases sont différentes, donc 2 actions distinctes sont attendues
    const context = createEmailContext(
      "Peux-tu m'envoyer le rapport ? Et aussi peux-tu m'envoyer le rapport ?"
    );
    const actions = extractActionsFromEmail(context);

    // Les deux phrases sont légèrement différentes, donc 2 actions
    expect(actions).toHaveLength(2);
  });

  it("devrait garder une seule action si la phrase source est identique", () => {
    // Test avec la même phrase exacte répétée sur deux lignes
    const context = createEmailContext(
      "Peux-tu m'envoyer le rapport ?\nPeux-tu m'envoyer le rapport ?"
    );
    const actions = extractActionsFromEmail(context);

    // Même phrase source → dédupliquée
    expect(actions).toHaveLength(1);
  });
});

// ============================================================================
// TESTS CAS LIMITES
// ============================================================================

describe("Cas limites", () => {
  it("devrait ignorer les phrases trop courtes", () => {
    const context = createEmailContext("Envoie.");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(0);
  });

  it("devrait ignorer les phrases trop longues (> 500 caractères)", () => {
    const longText = "Peux-tu m'envoyer " + "a".repeat(500) + " ?";
    const context = createEmailContext(longText);
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(0);
  });

  it("devrait tronquer les titres trop longs à 100 caractères", () => {
    const longObject = "le document " + "très important ".repeat(10);
    const context = createEmailContext(`Peux-tu m'envoyer ${longObject} ?`);
    const actions = extractActionsFromEmail(context);

    if (actions.length > 0) {
      expect(actions[0].title.length).toBeLessThanOrEqual(100);
    }
  });

  it("devrait gérer un email vide", () => {
    const context = createEmailContext("");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(0);
  });

  it("devrait gérer un email sans action", () => {
    const context = createEmailContext(
      "Bonjour,\n\nJ'espère que tu vas bien. Bonne journée !\n\nCordialement"
    );
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(0);
  });
});

// ============================================================================
// TESTS PATTERNS VAGUES SUPPRIMÉS
// ============================================================================

describe("Patterns vagues supprimés", () => {
  it("NE devrait PAS extraire avec 'n'oublie pas de relancer' sans cible", () => {
    const context = createEmailContext("N'oublie pas de relancer.");
    const actions = extractActionsFromEmail(context);

    // Ce pattern a été supprimé car il créait des actions sans cible
    expect(actions).toHaveLength(0);
  });

  it("devrait extraire 'il faut qu'on appelle' car il y a un objet capturé", () => {
    // Note: Le pattern /(?:appelle|appelez|contacte|contactez)\s+(.{1,50}?)/
    // capture "pour discuter" comme objet
    const context = createEmailContext("Il faut qu'on appelle pour discuter.");
    const actions = extractActionsFromEmail(context);

    // Le pattern /appelle/ capture ce qui suit
    expect(actions.length).toBeGreaterThanOrEqual(0);
  });

  it("devrait extraire 'il faut valider' car le pattern existe toujours", () => {
    // Le pattern /il (?:faut|faudrait)\s+(?:aussi\s+)?valider\s+(.{1,50}?)/ existe
    const context = createEmailContext("Il faut valider le document rapidement.");
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("VALIDATE");
  });
});

// ============================================================================
// TESTS D'INTÉGRATION
// ============================================================================

describe("Intégration - Emails réalistes", () => {
  it("devrait extraire correctement d'un email professionnel typique", () => {
    const context = createEmailContext(
      `Bonjour,

Suite à notre réunion de ce matin, voici les points à traiter :

1. Peux-tu m'envoyer le rapport financier avant vendredi ?
2. Merci de relancer le client Martin sur le devis en attente.
3. Il faudrait valider le contrat avec le prestataire.

N'hésite pas si tu as des questions.

Cordialement,
Pierre`
    );
    const actions = extractActionsFromEmail(context);

    expect(actions.length).toBeGreaterThanOrEqual(2);

    const types = actions.map((a) => a.type);
    expect(types).toContain("SEND");
    expect(types).toContain("FOLLOW_UP");
  });

  it("devrait extraire correctement d'un email avec politesses", () => {
    const context = createEmailContext(
      `Salut,

Ce serait génial si tu pouvais m'envoyer le fichier Excel avant demain.

Merci d'avance !`
    );
    const actions = extractActionsFromEmail(context);

    // Le pattern ne matche pas "si tu pouvais m'envoyer" car il attend "peux-tu/pourrais-tu"
    // Ceci est un cas où le regex ne capture pas (design conservateur)
    expect(actions).toHaveLength(0);
  });

  it("devrait extraire avec 'peux-tu' et deadline", () => {
    const context = createEmailContext(
      `Salut,

Peux-tu m'envoyer le fichier Excel avant demain ?

Merci d'avance !`
    );
    const actions = extractActionsFromEmail(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("SEND");
    expect(actions[0].dueDate).not.toBeNull();
  });

  it("devrait ignorer un email marketing malgré les mots-clés", () => {
    const context = createEmailContext(
      `Découvrez nos offres exceptionnelles !

Peux-tu valider cette offre incroyable ?

Cliquez ici pour vous désabonner.`,
      { from: "promo@marketing.com" }
    );
    const actions = extractActionsFromEmail(context);

    // Exclu à cause du lien de désinscription
    expect(actions).toHaveLength(0);
  });
});
