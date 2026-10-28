import QRCode from "qrcode";

// Server-rendered QR code (inline SVG, crisp at any size, downloadable)
export default async function QrCode({ value, size = 140 }) {
  const svg = await QRCode.toString(value, { type: "svg", margin: 1, width: size, color: { dark: "#1e1240", light: "#ffffff" } });
  const href = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  return (
    <a href={href} download="qr-code.svg" title="Download QR code" className="inline-block rounded-lg bg-white p-1 ring-1 ring-slate-200">
      <img src={href} width={size} height={size} alt="QR code for your link" />
    </a>
  );
}
