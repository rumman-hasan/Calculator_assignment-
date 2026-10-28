import { isLoginLink } from "@/lib/accounts";
import { whatsappToClient } from "@/lib/whatsapp";

/** Shows a one-time login link right after the owner creates or renews an account. */
export function LoginLinkBox({ link, name, phone }: { link?: string; name?: string; phone?: string | null }) {
  if (!isLoginLink(link)) return null;
  const message = `Hello${name ? ` ${name}` : ""}, your ThumbStop account is ready. Open this link once to choose your password:\n${link}`;
  return (
    <div role="status" className="mb-6 rounded-lg border border-blue-300 bg-blue-50 p-4 text-sm text-slate-800">
      <p className="font-semibold text-slate-900">Login link ready{name ? ` for ${name}` : ""}</p>
      <p className="mt-1 text-slate-600">
        Send this link to the person. They open it once and choose their own password. It stops working after a while, and you can create a new one any time.
        Copy it now: it is not saved anywhere on this page after you leave.
      </p>
      <textarea readOnly rows={3} value={link} aria-label="One-time login link" className="input mt-3 font-mono text-xs" />
      <div className="mt-3 flex flex-wrap gap-3">
        <a href={whatsappToClient(phone, message)} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm">Send on WhatsApp</a>
      </div>
    </div>
  );
}
