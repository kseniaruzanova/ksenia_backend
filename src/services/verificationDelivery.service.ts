import nodemailer from "nodemailer";

type DeliveryPayload = {
  channel: "email";
  target: string;
  code: string;
};

let cachedTransporter: nodemailer.Transporter | null = null;

function getSmtpTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const host = 'smtp.beget.com';
  const port = Number(2525);
  const user = "noreply@botprorok.ru";
  const pass = "a_wg5SXgLb";

  if (!host || !user || !pass) {
    throw new Error("Email отправка не настроена: отсутствуют SMTP_HOST / SMTP_USER / SMTP_PASS");
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    auth: {
      user,
      pass,
    },
  });

  return cachedTransporter;
}

async function sendEmailVerificationCode(email: string, code: string) {
  const transporter = getSmtpTransporter();
  const from = "noreply@botprorok.ru";

  if (!from) {
    throw new Error("Email отправка не настроена: отсутствует SMTP_FROM");
  }

  await transporter.sendMail({
    from,
    to: email,
    subject: "Код подтверждения регистрации",
    text: `Ваш код подтверждения: ${code}. Код действует 10 минут.`,
    html: `
      <div style="margin:0;padding:32px 16px;background:#f4f1ff;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(88,28,135,0.12);">
          <div style="background:linear-gradient(135deg,#581c87 0%,#7c3aed 50%,#db2777 100%);padding:36px 32px;color:#ffffff;">
            <div style="display:inline-block;padding:8px 14px;border:1px solid rgba(255,255,255,0.18);border-radius:999px;background:rgba(255,255,255,0.08);font-size:12px;line-height:1.2;">
              Подтверждение регистрации
            </div>
            <h1 style="margin:18px 0 0;font-size:28px;line-height:1.2;font-weight:700;">
              Ваш код для входа в платформу
            </h1>
            <p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.86);">
              Используйте код ниже, чтобы завершить регистрацию и подтвердить email.
            </p>
          </div>

          <div style="padding:32px;">
            <div style="margin-bottom:20px;padding:24px;border:1px solid #ede9fe;border-radius:20px;background:linear-gradient(180deg,#faf5ff 0%,#ffffff 100%);text-align:center;">
              <div style="font-size:13px;line-height:1.4;color:#6b7280;margin-bottom:10px;">
                Код подтверждения
              </div>
              <div style="display:inline-block;padding:16px 24px;border-radius:16px;background:#111827;color:#ffffff;font-size:32px;line-height:1;letter-spacing:10px;font-weight:700;">
                ${code}
              </div>
              <div style="margin-top:14px;font-size:13px;line-height:1.5;color:#6b7280;">
                Код действует 10 минут
              </div>
            </div>

            <div style="padding:18px 20px;border-radius:16px;background:#f9fafb;border:1px solid #e5e7eb;">
              <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#374151;">
                Если вы не запрашивали регистрацию, просто проигнорируйте это письмо.
              </p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">
                Никому не передавайте этот код. Он нужен только для подтверждения вашего аккаунта.
              </p>
            </div>
          </div>
        </div>
      </div>
    `,
  });
}

export async function sendRegistrationVerificationCode({ channel, target, code }: DeliveryPayload) {
  if (channel !== "email") {
    throw new Error("Поддерживается только отправка кода на email");
  }

  await sendEmailVerificationCode(target, code);
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function roughStripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Письмо с тем же SMTP, что и коды регистрации (админская рассылка). */
export async function sendAdminTransactionalMail(params: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}): Promise<void> {
  const transporter = getSmtpTransporter();
  const from = "noreply@botprorok.ru";

  const plain =
    params.text?.trim() ||
    roughStripHtml(params.html || "") ||
    "Сообщение в HTML-формате.";

  const htmlPart =
    params.html?.trim() ||
    `<div style="font-family:Arial,Helvetica,sans-serif;white-space:pre-wrap;">${escapeHtml(params.text || "")}</div>`;

  await transporter.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    text: plain,
    html: htmlPart,
  });
}
