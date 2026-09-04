import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

/**
 * robots.txt
 *
 * Everything public is crawlable. Two trees are not:
 *
 *   /admin  the dashboard. It is already behind a session check in every server
 *           action and route handler — robots.txt is a request, not a control,
 *           and anyone can ignore it. This is here so the login page and lead
 *           URLs stay out of search results, not as a security boundary.
 *   /api    JSON endpoints. Nothing under it is a document a person should land
 *           on from a search result, and the lead and subscribe routes are POST
 *           only in any case.
 *
 * Deliberately NOT disallowed:
 *
 *   /rules, /terms, /thank-you  carry `robots: { index: false }` in their own
 *     metadata. A crawler has to fetch a page to see that directive, so blocking
 *     the path here would preserve them in the index rather than remove them —
 *     the classic noindex/disallow conflict. Their own metadata is the right
 *     mechanism and this file leaves it alone.
 *
 *   /_next  blocking it hides the CSS and JavaScript, and Google renders pages
 *     before ranking them. A site that blocks its own assets gets judged on a
 *     stylesheet-less version of itself.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
