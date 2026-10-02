import Image from "next/image";
import QRCode from "qrcode";
import CopyButton from "@/components/CopyButton";

const SITE_URL = "https://www.getonshows.com";

/** Public link + QR code for sharing your profile anywhere. */
export default async function ShareProfile({
  profileId,
  displayName,
}: {
  profileId: string;
  displayName: string;
}) {
  const url = `${SITE_URL}/p/${profileId}`;
  let qr: string | null = null;
  try {
    qr = await QRCode.toDataURL(url, { width: 440, margin: 1 });
  } catch {
    qr = null;
  }

  return (
    <section
      aria-labelledby="share-heading"
      className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"
    >
      <h2 id="share-heading" className="text-lg font-semibold text-navy-900">
        Share your profile
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Anyone who opens this link sees your public profile and can join
        GetOnShows to reach out. Add it to your show notes, YouTube
        description, or newsletter.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-xl bg-slate-100 px-3 py-2 text-xs text-navy-900">
          {url}
        </code>
        <CopyButton text={url} />
      </div>
      {qr && (
        <div className="mt-4 flex items-center gap-4">
          <Image
            src={qr}
            alt={`QR code linking to ${displayName}'s GetOnShows profile`}
            width={132}
            height={132}
            className="rounded-xl ring-1 ring-slate-200"
          />
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              Scan to open {displayName}&rsquo;s profile. Works on posters,
              slides, and video end-screens.
            </p>
            <a
              href={qr}
              download={`${displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-getonshows-qr.png`}
              className="tap-target inline-flex items-center gap-1.5 rounded-xl bg-navy-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-900"
            >
              ⬇ Download QR image
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
