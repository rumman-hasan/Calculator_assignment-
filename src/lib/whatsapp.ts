import { site } from "./site-config";

/** Official WhatsApp click-to-chat link with a prefilled message. */
export function whatsappLink(message?: string, number: string = site.whatsappNumber): string {
  const text = message ?? "Hello ThumbStop, I would like to know more about your services.";
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/**
 * Turns a phone number typed by hand into the international digits WhatsApp needs.
 * "01712-345678" -> "8801712345678". Returns "" if it cannot be understood.
 */
export function toWhatsappNumber(raw: string | null | undefined): string {
  const digits = String(raw ?? "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (digits.startsWith("880") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `880${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("1")) return `880${digits}`;
  return digits.length >= 8 ? digits : "";
}

/** WhatsApp link to a specific client (or the WhatsApp contact picker if the number is unknown). */
export function whatsappToClient(phone: string | null | undefined, message: string): string {
  const number = toWhatsappNumber(phone);
  const text = encodeURIComponent(message);
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
}
