"use client";
import { useState } from "react";

export default function CopyField({ value, qr = false }) {
  const [copied, setCopied] = useState(false);
  const [qrSrc, setQrSrc] = useState(null);
  return (
    <div>
      <div className="flex gap-2">
        <input readOnly value={value} className="input font-mono text-xs" onFocus={(e) => e.target.select()} />
        <button
          type="button"
          className="btn-secondary shrink-0"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        {qr && (
          <button
            type="button"
            className="btn-secondary shrink-0"
            title="QR code"
            onClick={async () => {
              if (qrSrc) return setQrSrc(null);
              const QRCode = (await import("qrcode")).default;
              setQrSrc(await QRCode.toDataURL(value, { margin: 1, width: 220, color: { dark: "#1e1240" } }));
            }}
          >
            QR
          </button>
        )}
      </div>
      {qrSrc && (
        <a href={qrSrc} download="qr-code.png" className="mt-2 inline-block rounded-lg ring-1 ring-slate-200" title="Download">
          <img src={qrSrc} width={140} height={140} alt="QR code" />
        </a>
      )}
    </div>
  );
}
