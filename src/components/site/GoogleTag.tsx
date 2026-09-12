/**
 * The Google tag (GA4), in Consent Mode.
 *
 * Why the tag is in the page for everyone rather than loaded after "Allow" like
 * the Meta Pixel: Google checks that a site is set up by looking for this tag
 * in the page, and a tag that only appears after a click is a tag its check
 * never finds. So it is rendered on the server, in the HTML of every public
 * page.
 *
 * What keeps that consistent with the privacy page is the first command below.
 * Before any configuration, the tag is told that analytics storage is denied,
 * so it sets no cookies and cannot recognise a visitor from one page load to
 * the next. It still sends Google an anonymous page view, which is what lets
 * the reports estimate visitors who never answer the banner. Choosing Allow
 * updates that to granted (src/components/site/TrackingConsent.tsx), and from
 * then on it behaves as ordinary Google Analytics.
 *
 * Advertising storage and signals stay denied either way: nothing here is
 * connected to Google Ads, and the banner does not ask about it.
 *
 * A returning visitor who already allowed it is read from localStorage in the
 * same inline script, before the configuration, so their first hit is counted
 * with cookies rather than as a stranger. The parser is a copy of readConsent
 * in src/lib/consent.ts.
 *
 * Page changes inside the app are counted by GA4 itself, from browser history,
 * which "enhanced measurement" does by default. Sending page views by hand as
 * well would count every navigation twice.
 *
 * The id reaching this component has been checked against G-XXXXXXXXXX twice,
 * on save and on read, which is what makes writing it into a script safe.
 */
export function GoogleTag({ id }: { id: string }) {
  const boot = [
    "window.dataLayer=window.dataLayer||[];",
    "function gtag(){dataLayer.push(arguments);}",
    "var dlGranted=false;",
    "try{",
    "var dlRaw=localStorage.getItem('dl_ads_consent')||'';",
    "var dlParts=dlRaw.split(':');",
    "dlGranted=dlParts[0]==='granted'&&dlParts.length>1&&dlParts[1].split(',').indexOf('ga')>-1;",
    "}catch(e){}",
    "gtag('consent','default',{analytics_storage:dlGranted?'granted':'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});",
    "gtag('js',new Date());",
    `gtag('config',${JSON.stringify(id)});`,
  ].join("");

  return (
    <>
      {/* React hoists an async script with a src into <head>. */}
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`} />
      <script id="google-tag" dangerouslySetInnerHTML={{ __html: boot }} />
    </>
  );
}
