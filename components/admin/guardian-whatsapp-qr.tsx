import { QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export function GuardianWhatsAppQr({
  url,
  role,
}: {
  url: string;
  role: "ayah" | "bunda";
}) {
  const label = role === "ayah" ? "Ayah" : "Bunda";

  return (
    <details className="mt-3 border-t border-slate-200 pt-3">
      <summary className="inline-flex cursor-pointer items-center gap-2 rounded-lg text-xs font-bold text-emerald-800 hover:text-emerald-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800">
        <QrCode aria-hidden="true" className="size-4" />
        Tampilkan QR chat WhatsApp {label}
      </summary>
      <div className="mt-3 inline-flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <QRCodeSVG
          value={url}
          size={240}
          level="M"
          marginSize={4}
          title={`QR chat WhatsApp ${label}`}
          className="max-w-full"
        />
        <p className="text-center text-xs text-slate-600">
          Pindai dengan Scan QR WhatsApp untuk membuka chat {label}.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-emerald-800 hover:underline"
        >
          Buka chat WhatsApp
        </a>
      </div>
    </details>
  );
}
