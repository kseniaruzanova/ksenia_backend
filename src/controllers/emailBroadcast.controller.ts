import { Response } from "express";
import Customer from "../models/customer.model";
import ClubMember from "../models/clubMember.model";
import { AuthRequest } from "../interfaces/authRequest";
import { sendAdminTransactionalMail } from "../services/verificationDelivery.service";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const MAX_RECIPIENTS = 1000;

type Source = "platform" | "club";

function normalizeEmail(raw: string): string | null {
  const e = String(raw || "").trim().toLowerCase();
  return EMAIL_RE.test(e) ? e : null;
}

/** Email → откуда встречается (платформа и/или клуб). */
async function buildEmailSourceMap(): Promise<Map<string, Set<Source>>> {
  const map = new Map<string, Set<Source>>();

  const add = (username: string, source: Source) => {
    const email = normalizeEmail(username);
    if (!email) return;
    if (!map.has(email)) map.set(email, new Set());
    map.get(email)!.add(source);
  };

  const customers = await Customer.find({}).select("username").lean();
  for (const c of customers) {
    add(String(c.username || ""), "platform");
  }

  const members = await ClubMember.find({}).select("username").lean();
  for (const m of members) {
    add(String(m.username || ""), "club");
  }

  return map;
}

/** Все пользователи с email: платформа + клуб (без дублей по адресу). */
export const getEmailBroadcastRecipientsPreview = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const map = await buildEmailSourceMap();
  const recipients = [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([email, sources]) => ({
      email,
      sources: [...sources].sort() as Source[],
    }));

  res.json({
    total: recipients.length,
    recipients,
  });
};

export const postEmailBroadcast = async (req: AuthRequest, res: Response): Promise<void> => {
  const body = req.body ?? {};
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const text = typeof body.text === "string" ? body.text : "";
  const html = typeof body.html === "string" ? body.html : "";

  if (!subject) {
    res.status(400).json({ message: "Укажите тему письма" });
    return;
  }
  if (!text.trim() && !html.trim()) {
    res.status(400).json({ message: "Укажите текст письма или HTML" });
    return;
  }

  const rawList = body.recipients;
  if (!Array.isArray(rawList) || rawList.length === 0) {
    res.status(400).json({ message: "Выберите хотя бы одного получателя (массив recipients)" });
    return;
  }

  const recipients = [
    ...new Set(
      rawList
        .map((e: unknown) => normalizeEmail(String(e)))
        .filter((e): e is string => e !== null)
    ),
  ];

  if (recipients.length === 0) {
    res.status(400).json({ message: "Нет валидных email в recipients" });
    return;
  }

  const allowed = await buildEmailSourceMap();
  const notAllowed = recipients.filter((e) => !allowed.has(e));
  if (notAllowed.length > 0) {
    res.status(400).json({
      message: "Можно отправлять только на адреса из списка пользователей платформы и клуба",
      notAllowed: notAllowed.slice(0, 20),
    });
    return;
  }

  if (recipients.length > MAX_RECIPIENTS) {
    res.status(400).json({
      message: `За один запрос не больше ${MAX_RECIPIENTS} адресов. Сейчас: ${recipients.length}`,
    });
    return;
  }

  const wantsStream = String(req.get("x-stream-progress") || "").trim() === "1";

  if (wantsStream) {
    res.status(200);
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
  }

  const failed: { email: string; error: string }[] = [];
  let sent = 0;
  const total = recipients.length;

  for (let i = 0; i < recipients.length; i++) {
    const to = recipients[i];
    try {
      await sendAdminTransactionalMail({
        to,
        subject,
        text: text.trim() || undefined,
        html: html.trim() || undefined,
      });
      sent += 1;
      await new Promise((r) => setTimeout(r, 120));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown";
      failed.push({ email: to, error: msg });
    }

    if (wantsStream) {
      res.write(
        JSON.stringify({
          type: "progress",
          processed: i + 1,
          total,
          sent,
          failedCount: failed.length,
        }) + "\n"
      );
    }
  }

  const payload = {
    total,
    sent,
    failedCount: failed.length,
    failed,
  };

  if (wantsStream) {
    res.write(JSON.stringify({ type: "complete", ...payload }) + "\n");
    res.end();
  } else {
    res.json(payload);
  }
};
