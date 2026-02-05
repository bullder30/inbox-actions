/**
 * Types for Microsoft Graph API
 * https://learn.microsoft.com/en-us/graph/api/resources/message
 */

/**
 * Graph API message body
 */
export interface GraphMessageBody {
  contentType: "text" | "html";
  content: string;
}

/**
 * Graph API email address
 */
export interface GraphEmailAddress {
  name?: string;
  address: string;
}

/**
 * Graph API recipient
 */
export interface GraphRecipient {
  emailAddress: GraphEmailAddress;
}

/**
 * Graph API message (email)
 * Partial type - only fields we need
 */
export interface GraphMessage {
  id: string;
  conversationId?: string;
  subject?: string;
  bodyPreview?: string;
  body?: GraphMessageBody;
  from?: GraphRecipient;
  receivedDateTime: string;
  parentFolderId?: string;
  isRead?: boolean;
  categories?: string[];
  // For tracking changes in delta query
  "@removed"?: {
    reason: "changed" | "deleted";
  };
}

/**
 * Graph API delta response
 * https://learn.microsoft.com/en-us/graph/delta-query-messages
 */
export interface GraphDeltaResponse {
  "@odata.context"?: string;
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
  value: GraphMessage[];
}

/**
 * Graph API messages list response
 */
export interface GraphMessagesResponse {
  "@odata.context"?: string;
  "@odata.nextLink"?: string;
  value: GraphMessage[];
}

/**
 * Graph API error response
 */
export interface GraphError {
  error: {
    code: string;
    message: string;
    innerError?: {
      "request-id"?: string;
      date?: string;
      "client-request-id"?: string;
    };
  };
}

/**
 * Options for fetching emails
 */
export interface GraphFetchOptions {
  maxResults?: number;
  folder?: string; // folder ID or "inbox", "sentItems", etc.
}

/**
 * Email metadata (internal representation)
 */
export interface GraphEmailMetadata {
  graphMessageId: string;
  conversationId: string | null;
  from: string;
  subject: string | null;
  snippet: string;
  receivedAt: Date;
  labels: string[];
}
