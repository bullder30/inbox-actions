# Inbox Actions Documentation

Welcome to the complete Inbox Actions documentation.

---

## Documentation Index

### Architecture and Models

- **[DATABASE_MODEL.en.md](./DATABASE_MODEL.en.md)** - Complete Prisma data model
  - Action schema
  - User relationships
  - Performance indexes
  - Email provider support (IMAP, Microsoft Graph)

### Extraction and Analysis

- **[REGEX_EXTRACTION.en.md](./REGEX_EXTRACTION.en.md)** - Regex-based action extraction system
  - Detailed patterns by action type (SEND, CALL, FOLLOW_UP, PAY, VALIDATE)
  - Specific hours for deadlines (12pm, 6pm, 8pm)
  - Sentence cleaning (dashes, quotes, bullet lists)
  - Exclusion rules and conditionals
  - Email webmail links

### Email Provider Integration

- **[IMAP_INTEGRATION.md](./IMAP_INTEGRATION.md)** - IMAP integration for all providers
  - Gmail, Yahoo, iCloud, Fastmail, ProtonMail support
  - App Password configuration
  - ImapFlow library usage

- **[MICROSOFT_GRAPH.md](./MICROSOFT_GRAPH.md)** - Microsoft Graph API integration
  - Outlook.com, Hotmail, Live.com support
  - Microsoft 365 corporate accounts
  - OAuth 2.0 with Mail.Read scope
  - Delta queries for incremental sync

- **[AUTH_SETUP.md](./AUTH_SETUP.md)** - Authentication configuration
  - NextAuth.js setup
  - Google OAuth (for login)
  - Microsoft OAuth (for login + email access)
  - IMAP credentials management

### Automation

- **[CRON.en.md](./CRON.en.md)** - Scheduled task system (node-cron)
  - Count new emails (every 2 min)
  - Daily sync (8:00 AM)
  - Cleanup (11:00 PM)
  - SSE system reference

- **[REALTIME_UPDATES.en.md](./REALTIME_UPDATES.en.md)** - Real-time updates
  - SSE + Zustand architecture
  - Real-time updates without polling
  - Complete client/server flow
  - Comparison with polling

- **[cron-setup.en.md](./cron-setup.en.md)** - Detailed cron configuration
  - node-cron setup
  - Next.js instrumentation

- **[EMAIL_STATUS_MIGRATION.en.md](./EMAIL_STATUS_MIGRATION.en.md)** - Email status migration
  - EXTRACTED -> ANALYZED
  - Migration scripts

### API and Development

- **[API_ACTIONS.en.md](./API_ACTIONS.en.md)** - Actions API
  - CRUD endpoints
  - Types and schemas

- **[API_USAGE_EXAMPLES.en.md](./API_USAGE_EXAMPLES.en.md)** - API usage examples
  - Common requests
  - Code samples

### User Interface

- **[UX_DESIGN.en.md](./UX_DESIGN.en.md)** - Design and user experience
  - UI components
  - "View email" button for direct webmail access
  - "Email date" and "Processed on" display
  - Visual urgency indicators (red/orange)
  - User flows

### Tests

- **[TESTS.en.md](./TESTS.en.md)** - Tests and quality
  - Unit tests
  - Integration tests
  - Test strategy

---

## Quick Start

### For Developers

1. **Architecture**: Start with [DATABASE_MODEL.en.md](./DATABASE_MODEL.en.md)
2. **Email Providers**: Read [IMAP_INTEGRATION.md](./IMAP_INTEGRATION.md) or [MICROSOFT_GRAPH.md](./MICROSOFT_GRAPH.md)
3. **Extraction**: Explore [REGEX_EXTRACTION.en.md](./REGEX_EXTRACTION.en.md)
4. **Real-time**: Discover [REALTIME_UPDATES.en.md](./REALTIME_UPDATES.en.md)

### For Configuration

1. **Authentication**: [AUTH_SETUP.md](./AUTH_SETUP.md)
2. **Crons**: [CRON.en.md](./CRON.en.md)
3. **Email Providers**: Configure IMAP or Microsoft Graph

### For Users

1. **UX**: [UX_DESIGN.en.md](./UX_DESIGN.en.md)
2. **Email Setup**: Configure your email provider in Settings

---

## Email Provider Support

### Microsoft Graph (Recommended for Microsoft accounts)

| Provider | Support |
|----------|---------|
| Outlook.com | Full |
| Hotmail.com | Full |
| Live.com | Full |
| Microsoft 365 | Full |

**Features**:
- OAuth 2.0 authentication
- Direct webmail links
- Delta queries for efficient sync
- No IMAP configuration required

### IMAP (Universal)

| Provider | Support |
|----------|---------|
| Gmail | Via App Password |
| Yahoo | Via App Password |
| iCloud | Via App Password |
| Fastmail | Via App Password |
| ProtonMail | Via ProtonMail Bridge |

**Features**:
- Works with any IMAP-compatible provider
- Gmail webmail links supported
- Requires App Password generation

---

## New Features (February 2026)

### Multi-Provider Support

- **Microsoft Graph API** for Outlook/Hotmail/Microsoft 365
- **IMAP** for Gmail, Yahoo, iCloud, and other providers
- **Automatic provider detection** based on email domain
- **Seamless migration** from Gmail API to IMAP

### Improved Extraction

- **Specific hours** for all deadlines (12pm, 6pm, 8pm)
- **Automatic cleaning** of sentences (dashes, quotes, lists)
- **Improved splitting** by lines AND punctuation
- **New patterns**: "before noon", "this morning", "this afternoon", "tonight"

### Real-time Updates

- **SSE (Server-Sent Events)** for server -> client push
- **Zustand** for reactive global state management
- **No more polling** on client side
- **Always up-to-date counter** (max 30s latency)

### Email Webmail Links

- **emailWebUrl** field in actions
- **"View email" button** in UI
- **Direct access** to source email in webmail
- **Support for** Microsoft Graph (webLink) and Gmail IMAP (search URL)

### Improved UI

- **"Email date"** in action details
- **"Processed on"** visible only for completed actions
- **Email button** integrated in source sentence
- **Visual urgency indicators**: red (overdue), orange (< 24h)
- **Colored badges** by action type (blue, green, yellow, purple, orange)
- **Consistency** between list and action details

---

## Conventions

### Documentation Files

- All files are in **Markdown** (`.md`)
- Use **hierarchical titles** (`#`, `##`, `###`)
- **Code blocks** with specified language (` ```typescript`)
- Clear and commented **examples**

### Typical Structure

```markdown
# Main Title

Short description

---

## Section 1

Content...

### Subsection

Details...

---

## Resources

- Links
- References
```

---

## Useful External Links

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js](https://next-auth.js.org/)
- [Microsoft Graph API Reference](https://learn.microsoft.com/en-us/graph/api/overview)
- [Server-Sent Events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [node-cron](https://www.npmjs.com/package/node-cron)
- [ImapFlow](https://imapflow.com/)

---

## Support

For any questions or suggestions about the documentation, feel free to create an issue or contribute directly.

---

Last updated: February 6, 2026
