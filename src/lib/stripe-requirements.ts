// Turns Stripe's raw requirement keys into something a seller can act on.
// Pure so it's directly testable without touching the Stripe SDK.
//
// The Payouts card used to be binary — connected or not — which left sellers
// staring at a disabled checkout with no idea what was missing. Stripe always
// tells us exactly which fields it's still waiting on; this makes that legible.

export type ConnectState = "not_started" | "in_review" | "needs_info" | "ready";

const REQUIREMENT_LABELS: Record<string, string> = {
  external_account: "Your bank account, for payouts",
  "individual.verification.document": "A photo of your ID",
  "individual.verification.additional_document": "One more ID document",
  "company.verification.document": "A company verification document",
  "individual.id_number": "Your national ID number",
  "individual.ssn_last_4": "The last 4 digits of your SSN",
  "individual.dob.day": "Your date of birth",
  "individual.dob.month": "Your date of birth",
  "individual.dob.year": "Your date of birth",
  "individual.address.line1": "Your address",
  "individual.address.city": "Your address",
  "individual.address.postal_code": "Your address",
  "individual.first_name": "Your name",
  "individual.last_name": "Your name",
  "individual.email": "Your email address",
  "individual.phone": "A phone number",
  phone: "A phone number",
  "business_profile.url": "A website or product link",
  "business_profile.mcc": "What kind of thing you sell",
  "business_profile.product_description": "A short description of what you sell",
  "company.tax_id": "Your company tax ID",
  "company.name": "Your company name",
  "tos_acceptance.date": "Accepting Stripe's terms",
  "tos_acceptance.ip": "Accepting Stripe's terms",
  representative: "Details for a company representative",
};

export function humanizeRequirement(key: string): string {
  const known = REQUIREMENT_LABELS[key];
  if (known) return known;
  // Unknown/new key: make it readable rather than showing raw dotted paths.
  const tail = key.split(".").pop() ?? key;
  const words = tail.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function describeConnectStatus(input: {
  connected: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: string[];
}): { state: ConnectState; headline: string; items: string[] } {
  if (input.chargesEnabled) {
    return { state: "ready", headline: "You're set up to take payments.", items: [] };
  }

  if (!input.connected) {
    return {
      state: "not_started",
      headline: "Connect Stripe when you're ready to take payments.",
      items: [],
    };
  }

  // De-duplicate: Stripe lists dob.day/month/year separately but a seller only
  // needs to be told "your date of birth" once.
  const items = Array.from(new Set(input.requirementsDue.map(humanizeRequirement)));

  if (items.length > 0) {
    return { state: "needs_info", headline: "Stripe still needs a couple of things:", items };
  }

  if (input.detailsSubmitted) {
    return {
      state: "in_review",
      headline: "Stripe is reviewing your details. This usually takes a few minutes.",
      items: [],
    };
  }

  return { state: "needs_info", headline: "Your Stripe setup isn't finished yet.", items: [] };
}
