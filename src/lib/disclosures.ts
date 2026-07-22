/**
 * Shared disclosures/disclaimer boilerplate, added after a user compliance
 * review flagged that neither the full-note PDF, the client-summary PDF, nor
 * the Word export had a disclosures section at all (see rebuild/ROADMAP.md).
 *
 * IMPORTANT: this default text is a DRAFT written for structural coverage
 * (so the section exists rather than being silently absent) -- it has NOT
 * been reviewed by compliance/legal counsel and must not be treated as
 * final, SEBI-compliant disclosure language. It deliberately avoids
 * asserting a real registration status or number. Products should set their
 * own `data.disclosures` (editable in ProductEditor.tsx's Disclosures field)
 * with the firm's actual, reviewed text once available; this constant is
 * only the fallback shown until that happens, and every place it's used
 * keeps the "[DRAFT]" marker so it can never be mistaken for reviewed copy.
 */
export const DEFAULT_DISCLOSURES_TEXT =
  '[DRAFT -- pending compliance/legal review before this note is investor-facing.] ' +
  'This document is prepared for informational and internal product-development purposes only and does not ' +
  'constitute investment advice, a research report, or an offer or solicitation to buy or sell any security. ' +
  'No claim of SEBI Investment Adviser or Research Analyst registration is made by or on behalf of the preparer ' +
  'in this document; registration status and number, if applicable, should be confirmed and inserted before ' +
  'external distribution. Past performance, back-tested or simulated returns, and any benchmark comparison shown ' +
  'are not indicative of future results. Investments in equity and equity-related instruments are subject to ' +
  'market risk, including possible loss of principal, and there is no assurance the stated investment objective ' +
  'will be achieved. Portfolio construction rules, sleeve weights, factor parameters, and rebalancing triggers ' +
  'described herein are indicative and subject to change at the manager’s discretion without prior notice. ' +
  'This document may reflect a conflict of interest to the extent the preparer, its affiliates, or associated ' +
  'persons hold positions in, or provide services to issuers of, the securities discussed. Recipients should ' +
  'independently assess suitability against their own objectives, financial situation, and risk tolerance, and ' +
  'consult a qualified, registered investment adviser before acting. Tax treatment depends on individual ' +
  'circumstances and is subject to change; consult a tax professional. This document must not be reproduced, ' +
  'redistributed, or forwarded without prior written consent.'
