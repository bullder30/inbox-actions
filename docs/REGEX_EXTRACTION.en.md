# Action Extraction by Regex - Documentation

Complete guide of the deterministic action extraction system based on regex.

---

## Overview

### Objective

Automatically detect explicit actions in professional emails in French, in a **deterministic and transparent** manner.

### Method

- **Regex only**: No opaque AI, explicit patterns
- **Golden rule**: If ambiguous -> no action detected
- **GDPR-compliant**: Email body is NEVER stored

### Detected Actions

| Type | Description | Examples |
|------|-------------|----------|
| `SEND` | Send something | "can you send me the report" |
| `CALL` | Call/Callback someone | "call the client tomorrow" |
| `FOLLOW_UP` | Follow up with someone | "please follow up with the team" |
| `PAY` | Pay an invoice | "can you pay the invoice" |
| `VALIDATE` | Validate a document | "need to validate the contract" |

---

## System Architecture

### Files

```
lib/actions/
├── extract-actions-regex.ts      # Extraction engine
└── extract-actions-examples.ts   # Tests and examples

app/api/email/analyze/route.ts    # API endpoint
```

### Processing Flow

```
Email received
    ↓
Check exclusions (newsletters, no-reply)
    ↓
Split into sentences
    ↓
For each sentence:
    - Detect conditionals → Skip if found
    - Apply regex by type
    - Extract action object
    - Extract due date
    - Create action
    ↓
Deduplication
    ↓
Return actions
```

---

## Detailed Regex Patterns

### 1. SEND (Send)

**Objective**: Detect requests to send documents, files, reports.

**Patterns**:

```typescript
// Pattern 1: Polite forms
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de|veuillez)\s+(?:m[''])?envoyer\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Examples:
// ✅ "Peux-tu m'envoyer le rapport Q4"
// ✅ "Merci de m'envoyer la présentation"
// ✅ "Pourriez-vous envoyer le fichier Excel"

// Pattern 2: Imperative
/(?:envoie|envoyez)(?:-moi)?\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Examples:
// ✅ "Envoie-moi le document"
// ✅ "Envoyez la facture"

// Pattern 3: "Need to"
/il (?:faut|faudrait)\s+(?:m[''])?envoyer\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Examples:
// ✅ "Il faut m'envoyer le contrat"
// ✅ "Il faudrait envoyer la proposition"

// Pattern 4: Forward
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+(?:me\s+)?(?:transmettre|faire parvenir)\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Examples:
// ✅ "Peux-tu me transmettre le dossier"
// ✅ "Merci de faire parvenir les documents"

// Pattern 5: Send by email
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+(?:m[''])?envoyer\s+(?:par\s+)?(?:email|mail)\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Examples:
// ✅ "Peux-tu m'envoyer par email le fichier"
// ✅ "Merci de m'envoyer par mail la présentation"

// Pattern 6: Share
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+(?:me\s+)?partager\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Examples:
// ✅ "Peux-tu me partager le lien"
// ✅ "Merci de partager le document"
```

**Capture**: The capture group `(.{1,100}?)` extracts the object to send (e.g., "the Q4 report", "the presentation", "the Excel file").

---

### 2. CALL (Call/Callback)

**Objective**: Detect phone call or video call requests.

**Patterns**:

```typescript
// Pattern 1: Callback (polite forms)
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+(?:me\s+)?rappeler\s*(.{0,100}?)(?:\.|$|avant|d'ici|pour|demain|lundi|mardi)/i

// Examples:
// ✅ "Peux-tu me rappeler demain"
// ✅ "Merci de rappeler le client"
// ✅ "Pourriez-vous me rappeler avant vendredi"

// Pattern 2: Callback imperative
/(?:rappelle|rappelez)(?:-moi)?\s*(.{0,100}?)(?:\.|$|avant|d'ici|pour|demain|lundi|mardi)/i

// Examples:
// ✅ "Rappelle-moi demain"
// ✅ "Rappelez le fournisseur"

// Pattern 3: Need to callback
/il (?:faut|faudrait)\s+rappeler\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Examples:
// ✅ "Il faut rappeler Marie"
// ✅ "Il faudrait rappeler le client"

// Pattern 4: Call
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+appeler\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Examples:
// ✅ "Peux-tu appeler Jean"
// ✅ "Merci d'appeler le fournisseur"

// Pattern 5: Contact
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+contacter\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Examples:
// ✅ "Peux-tu contacter le client"
// ✅ "Merci de contacter Marie"
```

**Capture**: The capture group extracts the person to call or a time complement.

---

### 3. FOLLOW_UP (Follow up)

**Objective**: Detect follow-up or reminder requests.

**Patterns**:

```typescript
// Pattern 1: Follow up (polite forms)
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+relancer\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Examples:
// ✅ "Peux-tu relancer l'équipe technique"
// ✅ "Merci de relancer le fournisseur"

// Pattern 2: Imperative follow up
/(?:relance|relancez)\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Examples:
// ✅ "Relance le client"
// ✅ "Relancez l'équipe"

// Pattern 3: Need to follow up
/il (?:faut|faudrait)\s+relancer\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Examples:
// ✅ "Il faut relancer le prestataire"
// ✅ "Il faudrait relancer Marie"

// Pattern 4: Make a follow-up
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+faire\s+(?:un\s+)?(?:suivi|le suivi)\s*(.{0,100}?)(?:\.|$|avant|d'ici|pour)/i

// Examples:
// ✅ "Peux-tu faire un suivi du dossier"
// ✅ "Merci de faire le suivi"

// Pattern 5: Make a reminder
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+faire\s+un\s+rappel\s*(.{0,100}?)(?:\.|$|avant|d'ici|pour)/i

// Examples:
// ✅ "Peux-tu faire un rappel au client"
// ✅ "Merci de faire un rappel"
```

---

### 4. PAY (Pay)

**Objective**: Detect invoice payment requests.

**Patterns**:

```typescript
// Pattern 1: Settle (polite forms)
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+régler\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Examples:
// ✅ "Peux-tu régler la facture"
// ✅ "Merci de régler le prestataire"

// Pattern 2: Imperative settle
/(?:règle|réglez)\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Examples:
// ✅ "Règle la facture avant vendredi"
// ✅ "Réglez le fournisseur"

// Pattern 3: Need to settle/pay
/il (?:faut|faudrait)\s+(?:régler|payer)\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Examples:
// ✅ "Il faut régler la facture"
// ✅ "Il faudrait payer le prestataire"

// Pattern 4: Pay
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+payer\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Examples:
// ✅ "Peux-tu payer la facture"
// ✅ "Merci de payer le consultant"

// Pattern 5: Make a transfer
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+faire\s+(?:un\s+)?virement\s*(.{0,100}?)(?:\.|$|avant|d'ici|pour)/i

// Examples:
// ✅ "Peux-tu faire un virement au fournisseur"
// ✅ "Merci de faire un virement"
```

---

### 5. VALIDATE (Validate)

**Objective**: Detect document validation requests.

**Patterns**:

```typescript
// Pattern 1: Validate (polite forms)
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+valider\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Examples:
// ✅ "Peux-tu valider le contrat"
// ✅ "Merci de valider la proposition"

// Pattern 2: Imperative validate
/(?:valide|validez)\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Examples:
// ✅ "Valide le document"
// ✅ "Validez le devis"

// Pattern 3: Need to validate
/il (?:faut|faudrait)\s+valider\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Examples:
// ✅ "Il faut valider le budget"
// ✅ "Il faudrait valider le planning"

// Pattern 4: Approve
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+approuver\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Examples:
// ✅ "Peux-tu approuver la demande"
// ✅ "Merci d'approuver le projet"

// Pattern 5: Confirm
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+confirmer\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Examples:
// ✅ "Peux-tu confirmer la réservation"
// ✅ "Merci de confirmer le rendez-vous"
```

---

## Exclusion Rules

### Excluded Senders

Automatic or marketing emails to ignore:

```typescript
const FROM_EXCLUSIONS = [
  /no-?reply@/i,
  /noreply@/i,
  /newsletter@/i,
  /notifications?@/i,
  /automated?@/i,
  /do-not-reply@/i,
];
```

**Excluded examples**:
- `no-reply@service.com`
- `noreply@bank.com`
- `newsletter@company.com`
- `notifications@app.com`

---

### Excluded Subjects

Typical marketing or automated email subjects:

```typescript
const SUBJECT_EXCLUSIONS = [
  /newsletter/i,
  /unsubscribe/i,
  /désabonnement/i,
  /confirmation\s+de\s+commande/i,
  /votre\s+facture/i,
  /reçu\s+de\s+paiement/i,
  /ticket\s+#?\d+/i,
];
```

**Excluded examples**:
- "Newsletter January 2026"
- "Order Confirmation"
- "Your monthly invoice"
- "Ticket #12345"

---

### Excluded Email Body

Typical marketing email phrases:

```typescript
const BODY_EXCLUSIONS = [
  /cliquez\s+ici\s+pour\s+vous\s+désabonner/i,
  /ne\s+pas\s+répondre\s+à\s+cet\s+email/i,
  /do\s+not\s+reply/i,
  /this\s+is\s+an\s+automated\s+message/i,
  /pour\s+vous\s+désinscrire/i,
];
```

**Excluded examples**:
- Email containing "Click here to unsubscribe"
- Email containing "Do not reply to this email"

---

### Conditionals (ambiguity)

**Principle**: If a sentence contains a conditional, it is **ignored** as ambiguous.

```typescript
const CONDITIONAL_PATTERNS = [
  /si\s+(?:tu\s+)?(?:peux|as le temps|c['']est possible)/i,
  /(?:quand|lorsque)\s+tu\s+(?:auras|as)\s+(?:le\s+)?temps/i,
  /si\s+jamais/i,
  /éventuellement/i,
  /si\s+(?:cela|ça)\s+(?:te|vous)\s+(?:convient|arrange)/i,
];
```

**Excluded examples**:
- "**If you can**, send me the report" -> No action detected
- "**When you have time**, call the client" -> No action
- "**Eventually**, validate the document" -> No action
- "**If it suits you**, send the file" -> No action

---

## Due Date Extraction

### Relative Dates (days of the week)

```typescript
// Pattern: "before Monday", "by Friday"
/avant\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i
/d['']ici\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i

// Logic:
// If mentioned day is in the future this week -> this week
// Otherwise -> next week
```

**Examples** (received Monday January 6, 2026):
- "before Friday" -> Friday January 10, 2026
- "by Monday" -> Monday January 13, 2026 (next week)

---

### Absolute Dates (day + month)

```typescript
// Pattern: "before January 15", "for December 30"
/avant\s+(?:le\s+)?(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i
/pour\s+(?:le\s+)?(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i

// Logic:
// If month is in the future this year -> this year
// Otherwise -> next year
```

**Examples** (received January 6, 2026):
- "before January 15" -> January 15, 2026
- "before December 30" -> December 30, 2026

---

### Relative Dates (days)

```typescript
// Pattern: "in 3 days", "within 5 days"
/(?:d['']ici|dans)\s+(\d+)\s+jours?/i

// Logic:
// Add N days to received date
```

**Examples** (received January 6, 2026):
- "in 3 days" -> January 9, 2026
- "within 5 days" -> January 11, 2026

---

### Special Dates

```typescript
// "tomorrow"
/demain/i
// -> Received date + 1 day

// "this week" / "end of week"
/(?:cette\s+semaine|fin\s+de\s+(?:la\s+)?semaine)/i
// -> Friday of current week

// "end of month"
/fin\s+de\s+mois/i
// -> Last day of current month
```

**Examples** (received Monday January 6, 2026):
- "tomorrow" -> January 7, 2026
- "this week" -> Friday January 10, 2026
- "end of month" -> January 31, 2026

---

### Specific Hours for Deadlines

**New**: All deadlines now include specific hours for better urgency management.

| Expression | Assigned Hour | Example |
|------------|---------------|---------|
| **"before noon"** / **"this morning"** | 12:00 | Email received 10am -> deadline 12pm same day |
| **"this afternoon"** | 6:00 PM | Email received 10am -> deadline 6pm same day |
| **"tonight"** | 8:00 PM | Email received 10am -> deadline 8pm same day |
| **"end of day"** | 6:00 PM | Email received 10am -> deadline 6pm same day |
| **"today"** | 6:00 PM | Email received 10am -> deadline 6pm same day |
| **"tomorrow"** | 6:00 PM | Email received 10am -> deadline 6pm next day |
| **"this week"** / **"end of week"** | Friday 6:00 PM | Email received Monday -> deadline Friday 6pm |
| **"in X days"** | 6:00 PM | "in 3 days" -> deadline 6pm in 3 days |
| **Absolute dates** (e.g., "March 15") | 6:00 PM | "before March 15" -> March 15 at 6pm |

**Benefits**:
- Precise detection of urgent actions (today before 6pm)
- Better prioritization in the interface
- Consistent and predictable hours

---

### Sentence Cleaning and Normalization

The system automatically cleans sentences before analysis to support different formats:

```typescript
function cleanSentence(sentence: string): string {
  return sentence
    .trim()
    // Remove dashes at the beginning (lists)
    .replace(/^[-•*]\s*/, "")
    // Remove quotes at the beginning and end
    .replace(/^["'"«»]\s*/, "")
    .replace(/\s*["'"«»]$/, "")
    .trim();
}
```

**Supported formats**:
```
✅ - "can you send me the report"
✅ • "send me the presentation"
✅ * please forward the document
✅ "could you send the file"
✅ can you validate the quote?
```

**Improved splitting**:
- Split by line breaks (`\n`)
- AND by punctuation (`.!?`)
- Allows processing of bullet lists and formatted emails

---

## Processing Workflow

### 1. Sentence Splitting

The email body is split into sentences using **line breaks** AND **punctuation**:

```typescript
// Split into sentences: by punctuation AND by line breaks
const lines = context.body.split(/\n/);
const sentences: string[] = [];

for (const line of lines) {
  // Split each line by punctuation too
  const lineSentences = line.split(/[.!?]\s+/);
  sentences.push(...lineSentences);
}

// Clean each sentence
for (let sentence of sentences) {
  sentence = cleanSentence(sentence); // Removes dashes and quotes

  // Ignore sentences too short or too long
  if (sentence.length < 10 || sentence.length > 500) continue;

  // Process the sentence...
}
```

**Improvements**:
- Support for bullet lists (dashes `-`, `•`, `*`)
- Support for quotes (`"`, `'`, `«`, `»`)
- Line splitting for formatted emails
- Sentences from 10 to 500 characters

---

### 2. Conditional Check

For each sentence, we check if it contains a conditional:

```typescript
function hasConditional(sentence: string): boolean {
  return CONDITIONAL_PATTERNS.some(pattern => pattern.test(sentence));
}
```

**If conditional detected** -> The sentence is ignored (golden rule: if ambiguous -> no action).

---

### 3. Regex Application

For each action type, we apply all patterns to the sentence:

```typescript
for (const pattern of SEND_PATTERNS) {
  const match = sentence.match(pattern);
  if (match) {
    // Extract the action object
    const actionObject = match[1]?.trim() || "";

    // Create a title
    const title = `Send ${actionObject}`.substring(0, 100);

    // Create the action
    actions.push({
      title,
      type: "SEND",
      sourceSentence: sentence.substring(0, 200),
      dueDate: extractDeadline(sentence, context.receivedAt),
    });

    break; // Only one action per sentence
  }
}
```

---

### 4. Deduplication

After extraction, we deduplicate identical actions:

```typescript
function deduplicateActions(actions: ExtractedAction[]): ExtractedAction[] {
  const seen = new Set<string>();
  return actions.filter(action => {
    const key = `${action.type}:${action.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
```

---

## Tests and Examples

### Test File

See `lib/actions/extract-actions-examples.ts` for 11 complete examples.

### Run Tests

```typescript
import { runExamples } from "@/lib/actions/extract-actions-examples";

runExamples();
```

**Expected output**:
```
========================================
REGEX ACTION EXTRACTION TESTS
========================================

✅ Example 1: Simple SEND
   Sender: boss@company.com
   Subject: Q4 Report
   Actions detected: 1 (expected: 1)
   1. [SEND] Send the Q4 report
      Source: "Can you send me the Q4 report before Friday?"
      Due date: 01/10/2026

...

========================================
Results: 11 passed, 0 failed
========================================
```

---

## Concrete Examples

### Positive Example 1: Simple SEND

**Email**:
```
From: boss@company.com
Subject: Q4 Report
Body:
Hello,

Can you send me the Q4 report before Friday?

Thanks,
John
```

**Extracted action**:
```json
{
  "title": "Send the Q4 report",
  "type": "SEND",
  "sourceSentence": "Can you send me the Q4 report before Friday?",
  "dueDate": "2026-01-10T00:00:00.000Z"
}
```

---

### Positive Example 2: CALL callback

**Email**:
```
From: client@example.com
Subject: Urgent quote
Body:
Hello,

I received your quote.

Could you call me back tomorrow to discuss the details?

Best regards,
Marie Dupont
```

**Extracted action**:
```json
{
  "title": "Call back tomorrow to discuss the details",
  "type": "CALL",
  "sourceSentence": "Could you call me back tomorrow to discuss the details?",
  "dueDate": "2026-01-07T00:00:00.000Z"
}
```

---

### Positive Example 3: Multiple actions

**Email**:
```
From: director@company.com
Subject: Client meeting preparation
Body:
Hello,

To prepare for Thursday's client meeting:

1. Can you send me the PowerPoint presentation before Wednesday?
2. Please call the client to confirm the time.
3. We also need to validate the budget with accounting.

Thanks,
Director
```

**Extracted actions**:
```json
[
  {
    "title": "Send the PowerPoint presentation",
    "type": "SEND",
    "sourceSentence": "Can you send me the PowerPoint presentation before Wednesday?",
    "dueDate": "2026-01-08T00:00:00.000Z"
  },
  {
    "title": "Call the client to confirm the time",
    "type": "CALL",
    "sourceSentence": "Please call the client to confirm the time",
    "dueDate": null
  },
  {
    "title": "Validate the budget with accounting",
    "type": "VALIDATE",
    "sourceSentence": "We also need to validate the budget with accounting",
    "dueDate": null
  }
]
```

---

### Negative Example 1: Newsletter (excluded)

**Email**:
```
From: newsletter@techcompany.com
Subject: January 2026 Newsletter
Body:
Hello,

Discover our news this month!

To unsubscribe, click here.
```

**Extracted actions**: `[]` (none)

**Reason**: Sender `newsletter@` excluded.

---

### Negative Example 2: Conditional (ambiguous)

**Email**:
```
From: colleague@company.com
Subject: Quick question
Body:
Hi,

If you have time, could you send me the Excel file?

Not urgent.
```

**Extracted actions**: `[]` (none)

**Reason**: Sentence contains "**If you have time**" -> conditional detected -> ambiguity -> no action.

---

### Negative Example 3: Sender's own action (not a request)

**Email**:
```
From: sender@company.com
Subject: Meeting summary
Body:
Hello,

I will send the summary to the team.
I will call the client tomorrow.

Have a nice day,
Paul
```

**Extracted actions**: `[]` (none)

**Reason**: The sender says what **they will do**, not what they **ask the recipient** to do.

---

## Adding New Patterns

### Procedure

1. **Identify the need**: What type of action is not being detected?
2. **Create the pattern**: Use French imperative forms
3. **Test**: Add an example in `extract-actions-examples.ts`
4. **Validate**: Run `runExamples()`

### Example: Adding "BOOK" (Reserve)

```typescript
// 1. Add the type in Prisma schema
enum ActionType {
  SEND
  CALL
  FOLLOW_UP
  PAY
  VALIDATE
  BOOK  // New
}

// 2. Create patterns
const BOOK_PATTERNS = [
  /(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+réserver\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i,
  /(?:réserve|réservez)\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i,
  /il (?:faut|faudrait)\s+réserver\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i,
];

// 3. Add in extractActionsFromEmail
actions.push(...extractActionsByType("BOOK", BOOK_PATTERNS, context));

// 4. Add a test
const exampleBook: EmailContext = {
  from: "manager@company.com",
  subject: "Client meeting",
  body: "Can you book the meeting room for Thursday?",
  receivedAt: new Date("2026-01-06T10:00:00"),
};
```

---

## Known Limitations

### 1. Complex Emails

Very long emails (> 500 characters per sentence) may not be analyzed correctly.

**Solution**: Improve sentence splitting to handle numbered lists and paragraphs.

---

### 2. Negations

The system does not handle negations well:

"**Don't** send the document before validation" -> Detected as SEND (error)

**Future solution**: Add a negation pattern:
```typescript
const NEGATION_PATTERNS = [
  /ne\s+(?:pas|jamais|plus)\s+(?:envoyer|rappeler|valider|payer|relancer)/i,
];
```

---

### 3. Implicit Actions

The system detects ONLY explicit actions:

"The client is waiting for your response" -> No action detected (implicit: respond to client)

**Decision**: This is intentional. The golden rule is "if ambiguous -> no action". Implicit actions are ambiguous.

---

### 4. Multi-email Context

The system processes each email in isolation, without thread context.

Email 1: "Can you send the report?"
Email 2 (reply): "Yes, I'll take care of it" -> No detection that the action was taken

**Decision**: Out of scope for MVP. User manually marks actions as "DONE".

---

## Performance

### Metrics

- **Average time**: ~1-5ms per email
- **No network calls**: 100% local processing
- **No quota**: Unlike AI
- **Deterministic**: Same email -> always same actions

### Scalability

The system can process thousands of emails per second. The limit is the database, not extraction.

---

## GDPR Compliance

### Principle

- Email body is analyzed **in memory only**
- NEVER stored in database
- Only metadata is kept:
  - Sender (`from`)
  - Subject (`subject`)
  - Received date (`receivedAt`)
  - Action source sentence (`sourceSentence` - max 200 characters)

### API Code

```typescript
// app/api/email/analyze/route.ts

const body = await emailProvider.getEmailBodyForAnalysis(messageId);
// ⚠️ Used ONLY in memory

const extractedActions = extractActionsFromEmail({
  from: emailMetadata.from,
  subject: emailMetadata.subject,
  body, // In memory only
  receivedAt: emailMetadata.receivedAt,
});

// ✅ Only actions (without body) are stored
await prisma.action.create({
  data: {
    title: action.title,
    type: action.type,
    sourceSentence: action.sourceSentence, // Max 200 chars
    // Full body is NEVER stored
  },
});
```

---

## Regex vs AI Comparison

| Criteria | Regex (current) | AI (Claude) |
|----------|-----------------|-------------|
| **Transparency** | 100% deterministic | Black box |
| **Cost** | Free | ~$0.003/email |
| **Latency** | 1-5ms | 200-500ms |
| **Quota** | Unlimited | Limited (rate limits) |
| **Accuracy** | ~80-85% | 90-95% |
| **False positives** | Some | Very few |
| **Language** | FR only | Multilingual |
| **Maintenance** | Manual addition | Self-learning |
| **GDPR** | Clear | Complex |

**Decision for MVP**: Regex (deterministic, free, fast).

**Future evolution**: Hybrid (regex for 80% + AI for complex cases).

---

## FAQ

### Why no AI for MVP?

1. **Cost**: ~$0.003 per email with Claude = $30 for 10,000 emails
2. **Latency**: 200-500ms per email vs 1-5ms with regex
3. **Transparency**: Regex is 100% explicit and auditable
4. **GDPR**: Easier to justify regex processing

---

### How to add a new action verb?

Add a pattern in the corresponding action type:

```typescript
// Example: add "forward" to SEND
const SEND_PATTERNS = [
  // ... existing patterns
  /(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+(?:me\s+)?transférer\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i,
];
```

---

### How to handle multiple languages?

To add English:

```typescript
// Create EN patterns
const SEND_PATTERNS_EN = [
  /(?:can you|could you|please)\s+send\s+(.{1,100}?)(?:\.|$|before|by)/i,
  /send\s+(?:me\s+)?(.{1,100}?)(?:\.|$|before|by)/i,
];

// Detect email language
const lang = detectLanguage(context.body); // "fr" or "en"

// Use the right patterns
const patterns = lang === "en" ? SEND_PATTERNS_EN : SEND_PATTERNS;
```

---

### What to do if too many false positives?

1. Add stricter exclusions
2. Make patterns more specific
3. Increase minimum sentence length threshold

---

### Can we combine regex + AI?

Yes, hybrid approach possible:

```typescript
// 1. Try regex first (fast, free)
const regexActions = extractActionsFromEmail(context);

// 2. If no actions AND important email -> use AI
if (regexActions.length === 0 && isImportantSender(context.from)) {
  const aiActions = await extractActionsWithAI(context);
  return aiActions;
}

return regexActions;
```

---

## Link to Source Email

Each extracted action keeps the webmail URL to allow direct access to the source email.

### Storing the Webmail URL

```typescript
// When creating the action
await prisma.action.create({
  data: {
    userId: session.user.id,
    title: action.title,
    type: action.type,
    sourceSentence: action.sourceSentence,
    emailFrom: emailMetadata.from,
    emailReceivedAt: emailMetadata.receivedAt,
    emailWebUrl: emailMetadata.webUrl, // <- Webmail URL
    dueDate: action.dueDate,
    status: "TODO",
  },
});
```

### URLs by Provider

| Provider | Generated URL |
|----------|---------------|
| Microsoft Graph | `https://outlook.office365.com/...` (webLink from API) |
| IMAP Gmail | `https://mail.google.com/mail/u/0/#search/...` (Message-ID search) |
| Other IMAP | Not available |

```typescript
// In the user interface
{action.emailWebUrl && (
  <a
    href={action.emailWebUrl}
    target="_blank"
    rel="noopener noreferrer"
  >
    <Button variant="ghost" size="sm">
      <MailOpen className="h-4 w-4" />
      View email
    </Button>
  </a>
)}
```

### Benefits

- Direct access to full email context
- Easy verification of action interpretation
- View attachments and thread
- Compatible with Microsoft Graph and Gmail IMAP

---

## Resources

- **Source code**: `lib/actions/extract-actions-regex.ts`
- **Tests**: `lib/actions/extract-actions-examples.ts`
- **API**: `app/api/email/analyze/route.ts`
- **Regex tester**: https://regex101.com/

---

## Contribution

To improve the extraction system:

1. Identify an uncovered case
2. Create a test in `extract-actions-examples.ts`
3. Add the appropriate pattern
4. Verify all tests pass
5. Document the new pattern here

---

Last updated: January 9, 2026
