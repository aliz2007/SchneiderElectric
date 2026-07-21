// Single control point for the Schneider brand logo.
//
// The logo assets stay versioned in the repo under public/brand/ (mark.png = the
// small "S" mark, icon.png = the favicon built from it) even while the logo is
// hidden, so turning it back on is a one-line change.
//
// TO SHOW THE LOGO AGAIN everywhere (sidebar, login screen, PDF cover + PDF
// header): set SHOW_LOGO to true below. To also restore the browser-tab icon,
// copy public/brand/icon.png back to src/app/icon.png. That's it.

export const SHOW_LOGO = false;

/** Public URL of the brand mark, for <img> tags. */
export const LOGO_MARK_URL = "/brand/mark.png";
/** Path under public/ for the server-side read in the PDF route. */
export const LOGO_MARK_PUBLIC_PATH = "brand/mark.png";

/**
 * The brand tile shown in the sidebar and on the login screen. Renders the real
 * Schneider mark when SHOW_LOGO is on, and a neutral green "SE" monogram
 * otherwise (styled by the existing .brand-mark rule).
 */
export function BrandMark() {
  if (SHOW_LOGO) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="brand-logo" src={LOGO_MARK_URL} alt="Schneider Electric" width={42} height={42} />;
  }
  return <div className="brand-mark">SE</div>;
}
