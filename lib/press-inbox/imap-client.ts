// IMAP client — pulls unread emails from raj@news.investwithraj.com and
// converts them to PressEmail records.
//
// Implementation note: instead of pulling in a heavyweight IMAP library
// (node-imap, imapflow), we use the IMAP4 protocol directly over a TLS
// socket. The official Node.js `tls` module is built-in. ~200 LOC suffices
// for our narrow use case: LIST UNSEEN → FETCH → parse → MARK SEEN.
//
// Required env vars on Vercel:
//   IMAP_HOST          — e.g. imap.gmail.com (if forwarded to Google) or
//                         your custom mail provider
//   IMAP_PORT          — usually 993
//   IMAP_USERNAME      — raj@news.investwithraj.com
//   IMAP_PASSWORD      — app password (NOT regular login)
//   IMAP_MAILBOX       — INBOX (default)
//
// No-ops gracefully when env vars not set.

import tls from "node:tls";
import {
  classifySender,
  extractTags,
  type PressEmail,
  type PressSenderTier,
} from "./types";

const IMAP_HOST = process.env.IMAP_HOST || "";
const IMAP_PORT = parseInt(process.env.IMAP_PORT || "993", 10);
const IMAP_USERNAME = process.env.IMAP_USERNAME || "";
const IMAP_PASSWORD = process.env.IMAP_PASSWORD || "";
const IMAP_MAILBOX = process.env.IMAP_MAILBOX || "INBOX";

export function isImapConfigured(): boolean {
  return Boolean(IMAP_HOST && IMAP_USERNAME && IMAP_PASSWORD);
}

interface ImapSession {
  socket: tls.TLSSocket;
  buffer: string;
  tag: number;
  pendingResolvers: Array<(text: string) => void>;
}

function createSession(): Promise<ImapSession> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(IMAP_PORT, IMAP_HOST, { servername: IMAP_HOST }, () => {
      // Wait for greeting before resolving
    });
    const session: ImapSession = { socket, buffer: "", tag: 0, pendingResolvers: [] };
    let greetingReceived = false;
    socket.setEncoding("utf-8");
    socket.on("data", (data: string) => {
      session.buffer += data;
      if (!greetingReceived && session.buffer.includes("* OK")) {
        greetingReceived = true;
        session.buffer = "";
        resolve(session);
      } else {
        flushPending(session);
      }
    });
    socket.on("error", reject);
    socket.setTimeout(20000, () => {
      socket.destroy();
      reject(new Error("IMAP timeout"));
    });
  });
}

function flushPending(session: ImapSession) {
  // Any complete tagged response — resolve next pending
  while (session.pendingResolvers.length > 0) {
    const idx = session.buffer.search(/^A\d+ (OK|NO|BAD).*\r\n/m);
    if (idx === -1) break;
    const endOfLine = session.buffer.indexOf("\r\n", idx);
    if (endOfLine === -1) break;
    const chunk = session.buffer.slice(0, endOfLine + 2);
    session.buffer = session.buffer.slice(endOfLine + 2);
    const resolver = session.pendingResolvers.shift();
    if (resolver) resolver(chunk);
  }
}

function sendCmd(session: ImapSession, cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    session.tag++;
    const tag = `A${session.tag}`;
    session.pendingResolvers.push(resolve);
    session.socket.write(`${tag} ${cmd}\r\n`, (err) => {
      if (err) {
        session.pendingResolvers.pop();
        reject(err);
      }
    });
    setTimeout(() => {
      const idx = session.pendingResolvers.indexOf(resolve);
      if (idx >= 0) {
        session.pendingResolvers.splice(idx, 1);
        reject(new Error(`IMAP command timeout: ${cmd}`));
      }
    }, 20000);
  });
}

/** Parse a FETCH response to extract headers + body. Very basic — enough for our use case. */
function parseFetchResponse(raw: string): {
  fromRaw: string;
  subject: string;
  date: string;
  textBody: string;
  htmlBody: string;
  attachments: Array<{ filename: string; contentType: string; size: number }>;
} {
  const fromMatch = raw.match(/From: (.+)/i);
  const subjectMatch = raw.match(/Subject: (.+)/i);
  const dateMatch = raw.match(/Date: (.+)/i);

  // Detect Content-Type boundary for multipart
  const boundaryMatch = raw.match(/boundary="?([^";\r\n]+)"?/i);
  let textBody = "";
  let htmlBody = "";
  const attachments: Array<{ filename: string; contentType: string; size: number }> = [];

  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = raw.split(`--${boundary}`);
    for (const part of parts) {
      if (/Content-Type: text\/plain/i.test(part)) {
        const bodyStart = part.indexOf("\r\n\r\n");
        if (bodyStart > 0) textBody = part.slice(bodyStart + 4).trim();
      } else if (/Content-Type: text\/html/i.test(part)) {
        const bodyStart = part.indexOf("\r\n\r\n");
        if (bodyStart > 0) htmlBody = part.slice(bodyStart + 4).trim();
      } else if (/Content-Disposition: attachment/i.test(part)) {
        const filenameMatch = part.match(/filename="?([^";\r\n]+)"?/i);
        const ctypeMatch = part.match(/Content-Type: ([^;\r\n]+)/i);
        if (filenameMatch) {
          attachments.push({
            filename: filenameMatch[1],
            contentType: ctypeMatch?.[1] || "application/octet-stream",
            size: part.length,
          });
        }
      }
    }
  } else {
    // Plain text only
    const bodyStart = raw.indexOf("\r\n\r\n");
    if (bodyStart > 0) textBody = raw.slice(bodyStart + 4).trim();
  }

  // If no plain-text but have HTML, strip HTML to derive plain
  if (!textBody && htmlBody) {
    textBody = htmlBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  return {
    fromRaw: fromMatch?.[1]?.trim() || "",
    subject: subjectMatch?.[1]?.trim() || "",
    date: dateMatch?.[1]?.trim() || "",
    textBody,
    htmlBody,
    attachments,
  };
}

/** Parse "Display Name <email@example.com>" → { name, email } */
function parseAddressLine(line: string): { name: string; email: string } {
  const angleMatch = line.match(/^(.*?)<([^>]+)>$/);
  if (angleMatch) {
    return {
      name: angleMatch[1].trim().replace(/^"|"$/g, ""),
      email: angleMatch[2].trim().toLowerCase(),
    };
  }
  return { name: "", email: line.trim().toLowerCase() };
}

/** Extract URLs from email body. */
function extractLinks(text: string, html: string): string[] {
  const urls = new Set<string>();
  // Plain-text URLs
  const plainMatches = (text + " " + html).matchAll(/https?:\/\/[^\s"'<>)]+/gi);
  for (const m of plainMatches) urls.add(m[0]);
  // <a href="..."> URLs
  const hrefMatches = html.matchAll(/href="([^"]+)"/gi);
  for (const m of hrefMatches) urls.add(m[1]);
  return Array.from(urls).slice(0, 50); // cap to prevent blowups
}

/** Main entry point — fetch all unread press emails. */
export async function fetchUnreadPressEmails(): Promise<PressEmail[]> {
  if (!isImapConfigured()) {
    return [];
  }

  let session: ImapSession | null = null;
  try {
    session = await createSession();
    await sendCmd(session, `LOGIN "${IMAP_USERNAME}" "${IMAP_PASSWORD}"`);
    await sendCmd(session, `SELECT "${IMAP_MAILBOX}"`);

    // SEARCH UNSEEN — returns "* SEARCH 1 2 5 8" etc
    const searchResp = await sendCmd(session, "SEARCH UNSEEN");
    const searchLine = searchResp.split(/\r?\n/).find((l) => l.startsWith("* SEARCH"));
    const uids = searchLine ? searchLine.replace("* SEARCH", "").trim().split(/\s+/).filter(Boolean) : [];

    const emails: PressEmail[] = [];
    for (const uid of uids.slice(0, 50)) {
      // Cap at 50/day to bound execution time
      const fetchResp = await sendCmd(session, `FETCH ${uid} BODY[]`);
      const parsed = parseFetchResponse(fetchResp);
      const { name, email } = parseAddressLine(parsed.fromRaw);
      const fromDomain = email.split("@")[1] || "";
      const tier: PressSenderTier = classifySender(email);
      const tags = extractTags(parsed.subject, parsed.textBody);
      const links = extractLinks(parsed.textBody, parsed.htmlBody);
      emails.push({
        uid,
        receivedAt: parsed.date || new Date().toISOString(),
        fromRaw: parsed.fromRaw,
        fromName: name,
        fromEmail: email,
        fromDomain,
        subject: parsed.subject,
        textBody: parsed.textBody,
        htmlBody: parsed.htmlBody,
        links,
        attachments: parsed.attachments,
        tier,
        tags,
      });
      // Do NOT mark seen yet — pipeline writes drafts first, then marks seen
    }

    await sendCmd(session, "LOGOUT");
    return emails;
  } catch (e) {
    console.error("IMAP fetch error:", e);
    return [];
  } finally {
    if (session) session.socket.destroy();
  }
}

/** Mark a list of UIDs as seen (call AFTER drafts are persisted). */
export async function markSeen(uids: string[]): Promise<void> {
  if (!isImapConfigured() || uids.length === 0) return;
  let session: ImapSession | null = null;
  try {
    session = await createSession();
    await sendCmd(session, `LOGIN "${IMAP_USERNAME}" "${IMAP_PASSWORD}"`);
    await sendCmd(session, `SELECT "${IMAP_MAILBOX}"`);
    await sendCmd(session, `STORE ${uids.join(",")} +FLAGS (\\Seen)`);
    await sendCmd(session, "LOGOUT");
  } catch (e) {
    console.error("IMAP mark-seen error:", e);
  } finally {
    if (session) session.socket.destroy();
  }
}
