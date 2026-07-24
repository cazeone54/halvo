import type { ContentBlock } from "@/content/blocks";
import { BRAND_NAME } from "@/lib/site";

// Blog posts target people who don't know Halvo yet — they answer the question
// someone actually types into a search box. Guides (src/content/guides.ts) are
// the opposite: documentation for people already using the product.
export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  minutes: number;
  date: string; // ISO, used for display + article metadata
  body: ContentBlock[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "how-to-sell-digital-products",
    title: "How to sell digital products online (without building a store)",
    description:
      "A practical walkthrough of selling your first digital product — what to sell, how to take payment, and how buyers get their file.",
    minutes: 7,
    date: "2026-07-20",
    body: [
      {
        type: "p",
        text: "Selling a digital product sounds like it needs a website, a shop, and a company. It doesn't. What it actually needs is a file, a price, and a way for someone to pay you and receive it. Everything else is optional.",
      },
      { type: "h2", text: "1. Start with something you've already made" },
      {
        type: "p",
        text: "The best first product is usually something that already exists — a template you built for yourself, notes you keep re-sending to people, a checklist you rely on. If someone has ever asked you for it, that's your product.",
      },
      {
        type: "ul",
        items: [
          "Templates: spreadsheets, Notion setups, design files, contracts",
          "Knowledge: guides, ebooks, cheat sheets, courses",
          "Assets: presets, fonts, icons, sound packs, code",
        ],
      },
      { type: "h2", text: "2. Price it like a product, not an hourly rate" },
      {
        type: "p",
        text: "Digital products have no marginal cost, so price on the value of the outcome, not the hours you spent. Most first products land between $9 and $49. Start near the middle — pricing too low signals low quality and makes the maths miserable.",
      },
      { type: "h2", text: "3. Take payment properly" },
      {
        type: "p",
        text: "This is the part people overthink. You don't need a storefront. You need a checkout that accepts cards and wallets, delivers the file the second payment clears, and pays you out to your own bank account.",
      },
      {
        type: "note",
        text: `That's exactly what ${BRAND_NAME} does: upload the file, set a price, share one link. Payments run on Stripe and your share goes to your own Stripe account.`,
      },
      { type: "h2", text: "4. Put the link where your audience already is" },
      {
        type: "p",
        text: "A product with no traffic doesn't sell, no matter how good the checkout is. Put the link in your social bio, at the end of your newsletter, in the description of anything you publish, and in your reply to anyone who asks about your work.",
      },
      { type: "h2", text: "5. Expect the first sale to be small" },
      {
        type: "p",
        text: "The first sale is a proof point, not a business. What matters is that the loop works end to end: someone paid, they got the file, the money reached you. Once that's true, everything after it is repetition and improvement.",
      },
    ],
  },
  {
    slug: "sell-notion-templates",
    title: "How to sell Notion templates and actually get paid",
    description:
      "Notion templates are one of the easiest digital products to start with. Here's how to package, price and deliver one.",
    minutes: 6,
    date: "2026-07-21",
    body: [
      {
        type: "p",
        text: "Notion templates sell well because the buyer sees the value instantly — they're buying a finished system instead of a blank page. The tricky part isn't building one, it's delivering and charging for it cleanly.",
      },
      { type: "h2", text: "Package it so it's obvious what they get" },
      {
        type: "ul",
        items: [
          "One clear outcome: 'a client CRM', not 'a productivity system'",
          "A cover image showing the actual template, not an abstract graphic",
          "A short list of what's inside — databases, views, automations",
        ],
      },
      { type: "h2", text: "Deliver it as a duplicate link, in a file" },
      {
        type: "p",
        text: "The usual approach is to share your template's public duplicate link. Put that link inside a small PDF or text file along with a short setup note, and sell that file. The buyer downloads it, clicks through, and duplicates the template into their own workspace.",
      },
      {
        type: "note",
        text: "Keep a setup note in the file. Most refund requests on templates are people who couldn't figure out the first step, not people who disliked the template.",
      },
      { type: "h2", text: "Price it between $15 and $49" },
      {
        type: "p",
        text: "Simple single-purpose templates sit around $15–25. Larger systems with multiple linked databases go $39–49. Below $10 you'll spend more effort on support than you earn.",
      },
      { type: "h2", text: "Where template buyers actually come from" },
      {
        type: "ul",
        items: [
          "Short video showing the template being used, not described",
          "A free cut-down version that links to the paid one",
          "Answering questions in communities where people describe the problem your template solves",
        ],
      },
      {
        type: "note",
        text: `With ${BRAND_NAME} you can have the template listed and taking payments in a few minutes — upload the file, set the price, share the link.`,
      },
    ],
  },
  {
    slug: "how-to-price-a-digital-product",
    title: "How to price a digital product",
    description:
      "Why cheap doesn't mean more sales, how to pick a first number, and when to raise it.",
    minutes: 5,
    date: "2026-07-22",
    body: [
      {
        type: "p",
        text: "Pricing is the single easiest thing to change and the thing most people get wrong in the same direction: too low.",
      },
      { type: "h2", text: "Cheap does not mean more sales" },
      {
        type: "p",
        text: "Dropping from $29 to $9 rarely triples your sales — it usually just cuts your revenue per buyer by two thirds while attracting the buyers most likely to ask for refunds. Price signals quality, especially when nobody has heard of you yet.",
      },
      { type: "h2", text: "Pick your first number like this" },
      {
        type: "steps",
        items: [
          "Ask what problem the buyer avoids by having this.",
          "Estimate what that's worth to them in time or money.",
          "Charge roughly a tenth of that, rounded to a clean number.",
        ],
      },
      {
        type: "p",
        text: "A template that saves someone a weekend of work is worth far more than $7. Something that saves an afternoon might be $19. Something that replaces a paid tool can be $49 and up.",
      },
      { type: "h2", text: "Watch out for the small-sale trap" },
      {
        type: "p",
        text: "Every payment carries a fixed processing cost, so very cheap products lose a disproportionate share to fees. A $3 sale can lose a third of its value before anyone touches it. If you want a cheap entry point, make it free and use it to sell something real.",
      },
      { type: "h2", text: "Raise it once you have proof" },
      {
        type: "p",
        text: "After a handful of sales and no complaints, raise the price and watch what happens. If sales hold, you were underpriced. Almost everyone is, at the start.",
      },
    ],
  },
  {
    slug: "digital-products-to-sell-this-weekend",
    title: "9 digital products you can make and sell this weekend",
    description:
      "Concrete, genuinely finishable ideas — with a note on who buys each one and what it's worth.",
    minutes: 5,
    date: "2026-07-23",
    body: [
      {
        type: "p",
        text: "The hardest part of a first product is picking something small enough to finish. Every idea below is realistically a weekend of work.",
      },
      { type: "h2", text: "If you already work in a spreadsheet or Notion" },
      {
        type: "ul",
        items: [
          "A budgeting or invoicing template for freelancers ($19–29)",
          "A content calendar with a real posting workflow ($15–25)",
          "A client onboarding checklist and email scripts ($19–39)",
        ],
      },
      { type: "h2", text: "If you make things visually" },
      {
        type: "ul",
        items: [
          "A pack of photo presets in one consistent style ($12–29)",
          "Social post templates sized for every platform ($19–39)",
          "An icon or illustration set around one theme ($15–35)",
        ],
      },
      { type: "h2", text: "If you know something well" },
      {
        type: "ul",
        items: [
          "A short, blunt guide that solves one specific problem ($9–29)",
          "A swipe file of real examples with commentary ($19–49)",
          "A one-hour recorded walkthrough of a process you use ($29–79)",
        ],
      },
      {
        type: "note",
        text: "Pick the one you could finish tonight if you had to. Momentum matters more than picking the theoretically best idea — you can always make the second one better.",
      },
      { type: "h2", text: "Then get it in front of people" },
      {
        type: "p",
        text: "Finish it, price it, put it behind a link, and share the link. The product isn't real until someone can buy it.",
      },
    ],
  },
  {
    slug: "connect-stripe-to-halvo",
    title: `How to connect Stripe to ${BRAND_NAME} (step-by-step)`,
    description:
      "A complete walkthrough of connecting your Stripe account so you can take payments — what you'll need, how long it takes, and how to fix it when it stalls.",
    minutes: 8,
    date: "2026-07-24",
    body: [
      {
        type: "p",
        text: `Until Stripe is connected, your product page shows a polite "not available yet" notice instead of a checkout. Connecting is the step that turns your product into something people can actually buy. Here's the whole process, including what to do when it doesn't go smoothly.`,
      },
      { type: "h2", text: "Why Stripe, and where your money goes" },
      {
        type: "p",
        text: `${BRAND_NAME} never holds your money. Payments run through Stripe Connect, and your share is routed into your own Stripe account as part of the payment itself — not swept into a platform balance and paid out later. If you ever stopped using us, that Stripe account and its history remain yours.`,
      },
      { type: "h2", text: "Before you start, have these ready" },
      {
        type: "ul",
        items: [
          "A government-issued photo ID — passport or driving licence",
          "Your bank account details for payouts (account and routing/sort code)",
          "Your home or business address",
          "A tax ID or company number, if you're registered as a business",
          "Roughly ten minutes without interruption",
        ],
      },
      {
        type: "note",
        text: "This identity check is Stripe's legal obligation as a regulated payment processor, not a hurdle we invented. We never see your ID or bank details at any point.",
      },
      { type: "h2", text: "The steps" },
      {
        type: "steps",
        items: [
          "Sign in and open your dashboard.",
          "Find the Payouts card and click Connect Stripe.",
          "You'll be handed to Stripe's own secure onboarding form — the address bar will show stripe.com.",
          "Choose whether you're an individual or a business, then enter your details.",
          "Upload your ID when prompted and enter your bank details for payouts.",
          "Submit. Stripe returns you to your dashboard automatically.",
          "The Payouts card should now show as connected.",
        ],
      },
      { type: "h2", text: "What “charges enabled” means" },
      {
        type: "p",
        text: "Connecting and being *able to charge* are two different things. Stripe sometimes marks an account as connected while still reviewing your details in the background. Your checkout only goes live once Stripe has enabled charges — usually within minutes, occasionally a day or two if something needs manual review.",
      },
      { type: "h2", text: "When it stalls: the usual causes" },
      {
        type: "ul",
        items: [
          "Something was left blank — reopen the Payouts card and Stripe will tell you exactly which field it still needs.",
          "The ID photo was blurry, cropped, or expired. Retake it flat, in good light, with all four corners visible.",
          "Your name or address doesn't match your ID or bank account. They have to match exactly.",
          "You're in a country Stripe doesn't yet support — check Stripe's supported countries list before troubleshooting anything else.",
        ],
      },
      { type: "h2", text: "How soon do you get paid?" },
      {
        type: "p",
        text: "Your share lands in your Stripe balance at the moment of the sale. Stripe then pays it out to your bank on a rolling schedule — typically every couple of days once your account is fully verified, though your very first payout usually takes about a week while Stripe establishes the account.",
      },
      { type: "h2", text: "Test it before you share the link" },
      {
        type: "steps",
        items: [
          "Open your own product page in a private browsing window.",
          "Confirm you see a real checkout form rather than an unavailable notice.",
          "Check that your product name, price and cover image all look right.",
          "Only then start sharing the link.",
        ],
      },
      {
        type: "note",
        text: "A product also needs a file attached before it can go live at all. If your product still says Draft, upload the file you're delivering — that's what publishes it.",
      },
    ],
  },
  {
    slug: "how-to-sell-an-ebook",
    title: "How to sell an ebook online",
    description:
      "From finished manuscript to a link people can buy — formats, pricing, delivery and the mistakes that cost sales.",
    minutes: 6,
    date: "2026-07-18",
    body: [
      {
        type: "p",
        text: "An ebook is the most forgiving first digital product: no inventory, no shipping, and you almost certainly already have the raw material.",
      },
      { type: "h2", text: "Export as PDF, and consider EPUB" },
      {
        type: "p",
        text: "PDF is the safe default — it opens everywhere and looks exactly as you designed it. EPUB reflows nicely on phones and e-readers, so offering both is a small effort that removes a common complaint. Bundle them in one zip and sell that.",
      },
      { type: "h2", text: "Make the cover do the selling" },
      {
        type: "p",
        text: "Your cover image is the single most-viewed asset you own. It appears on the product page, in link previews when anyone shares it, and in search results. A plain, readable title on a clean background beats an elaborate illustration nobody can parse at thumbnail size.",
      },
      { type: "h2", text: "Price by outcome, not page count" },
      {
        type: "ul",
        items: [
          "A short, sharp guide that solves one specific problem: $9–19",
          "A substantial book with frameworks and examples: $19–39",
          "A book bundled with templates or worksheets: $39+",
        ],
      },
      {
        type: "note",
        text: "Length is not value. A 20-page book that solves a real problem outsells a 200-page book that rambles, every time.",
      },
      { type: "h2", text: "The mistakes that cost sales" },
      {
        type: "ul",
        items: [
          "No table of contents in the description — buyers want to know what's inside before paying",
          "No sample. A free first chapter converts far better than more adjectives.",
          "Burying the outcome. Say what changes for the reader, in the first line.",
        ],
      },
    ],
  },
  {
    slug: "sell-digital-products-on-instagram",
    title: "How to sell digital products on Instagram",
    description:
      "Instagram won't let you link from a post — here's how creators actually route attention to a checkout.",
    minutes: 6,
    date: "2026-07-16",
    body: [
      {
        type: "p",
        text: "Instagram is excellent at attention and hostile to links. Everything below is about closing that gap without annoying your audience.",
      },
      { type: "h2", text: "Your bio link is the whole funnel" },
      {
        type: "p",
        text: "One link, and it should point somewhere that converts. If you sell a single product, link straight to its checkout — every extra click loses people. If you sell several, link to your storefront so they see everything in one place.",
      },
      { type: "h2", text: "Show the product working, don't describe it" },
      {
        type: "ul",
        items: [
          "Screen-record yourself actually using the template or preset",
          "Show the before and after in the first second, not after an intro",
          "Caption everything — most people watch on mute",
        ],
      },
      { type: "h2", text: "Talk about the problem more than the product" },
      {
        type: "p",
        text: "Posts about the problem your product solves reach people who don't know your product exists. Posts about your product mostly reach people who already follow you. You need both, but the first one is what grows.",
      },
      { type: "h2", text: "Make it trivially easy to ask" },
      {
        type: "p",
        text: "Tell people to comment a keyword and send them the link by DM. It feels personal, it beats the algorithm's dislike of links, and it gives you a conversation instead of a click.",
      },
      {
        type: "note",
        text: "Keep the link handy in your notes app. The moment someone asks for it and you take four hours to reply, you've lost the sale.",
      },
    ],
  },
  {
    slug: "get-your-first-10-sales",
    title: "How to get your first 10 sales",
    description:
      "The unglamorous, effective way to go from zero — no ad budget and no audience required.",
    minutes: 6,
    date: "2026-07-14",
    body: [
      {
        type: "p",
        text: "The first ten sales almost never come from marketing. They come from telling specific people, individually, that a thing you made exists.",
      },
      { type: "h2", text: "1. Tell the people who already asked" },
      {
        type: "p",
        text: "Anyone who has ever asked how you did something is a warm lead. Go back through your DMs, comments and email and message them personally. Not a broadcast — a sentence that references what they asked about.",
      },
      { type: "h2", text: "2. Post the thing you made, not an advert" },
      {
        type: "p",
        text: "Show the work. A screenshot of the actual template with a caption explaining what problem it solved for you outperforms any launch announcement.",
      },
      { type: "h2", text: "3. Answer questions where they're being asked" },
      {
        type: "ul",
        items: [
          "Find communities where people describe the problem your product solves",
          "Answer properly and completely, for free",
          "Mention your product only where it's genuinely the answer",
        ],
      },
      { type: "h2", text: "4. Give it away a few times" },
      {
        type: "p",
        text: "Hand free copies to five people whose opinion you trust, and ask what confused them. You'll get your first testimonials and a list of fixes, which is worth more than five sales at this stage.",
      },
      {
        type: "note",
        text: "Ten sales is a signal, not a milestone. It tells you the offer works well enough to repeat — which is the only thing you needed to learn.",
      },
    ],
  },
  {
    slug: "write-a-product-description-that-sells",
    title: "How to write a product description that sells",
    description:
      "A simple structure that beats clever copywriting — plus the one line most sellers leave out.",
    minutes: 5,
    date: "2026-07-11",
    body: [
      {
        type: "p",
        text: "Most product descriptions fail the same way: they describe the object instead of the change. Buyers don't want a spreadsheet, they want to stop losing track of invoices.",
      },
      { type: "h2", text: "The structure" },
      {
        type: "steps",
        items: [
          "One sentence on who it's for and what changes for them.",
          "Three to five bullets on what's actually inside.",
          "One line on the format — file type, length, what they'll be able to open it with.",
          "One line removing the last doubt — support, updates, or a refund policy.",
        ],
      },
      { type: "h2", text: "Lead with the outcome" },
      {
        type: "p",
        text: `Not "a Notion dashboard with linked databases" but "know exactly which clients owe you money, without opening a spreadsheet." Say what the buyer's life looks like afterwards, then explain how it works.`,
      },
      { type: "h2", text: "Be specific enough to be believable" },
      {
        type: "p",
        text: "Vague claims read as marketing and get ignored. Numbers, file names and concrete nouns read as truth. “12 pre-built views” beats “fully featured”.",
      },
      { type: "h2", text: "The line most people leave out" },
      {
        type: "p",
        text: "Say what it is NOT. Naming who it isn't for costs you a few wrong-fit buyers and earns trust from everyone else — and wrong-fit buyers are exactly the ones who ask for refunds.",
      },
    ],
  },
  {
    slug: "course-or-ebook",
    title: "Should you sell a course or an ebook?",
    description:
      "Same knowledge, very different products. How to pick based on effort, price and what your audience actually wants.",
    minutes: 5,
    date: "2026-07-09",
    body: [
      {
        type: "p",
        text: "If you know something worth teaching, you can package it either way. The right answer depends less on the subject than on the outcome your buyer needs.",
      },
      { type: "h2", text: "Choose an ebook when" },
      {
        type: "ul",
        items: [
          "The subject is reference material people will return to",
          "Readers need to skim and search rather than follow along",
          "You want it finished in days, not months",
        ],
      },
      { type: "h2", text: "Choose a course when" },
      {
        type: "ul",
        items: [
          "The skill has to be watched to be understood",
          "Order matters — step three is meaningless before step two",
          "You're comfortable charging several times more",
        ],
      },
      { type: "h2", text: "The honest comparison" },
      {
        type: "p",
        text: "Ebooks sell for $9–39 and take days. Courses sell for $49–299 and take weeks, with far more support afterwards. Courses earn more per buyer; ebooks earn more per hour of your time.",
      },
      {
        type: "note",
        text: "Start with the ebook even if you want to build the course. It validates the demand cheaply, and it becomes the course outline.",
      },
    ],
  },
  {
    slug: "launch-with-discount-codes",
    title: "How to use discount codes to launch a product",
    description:
      "Discounts can create urgency or quietly train people to wait. Here's how to use them well.",
    minutes: 5,
    date: "2026-07-07",
    body: [
      {
        type: "p",
        text: "A discount code is a deadline with a number attached. Used deliberately it concentrates sales into a window; used lazily it teaches your audience never to pay full price.",
      },
      { type: "h2", text: "Launch pricing that expires" },
      {
        type: "p",
        text: "The cleanest use is a launch code at 20–30% off for the first week. It rewards the people who move early, gives you a reason to post more than once, and it ends.",
      },
      { type: "h2", text: "Setting one up" },
      {
        type: "steps",
          items: [
          "Open Discounts from your dashboard menu.",
          "Pick a short, memorable code like LAUNCH20.",
          "Set the percentage off and create it.",
          "Announce the code and the date it ends, together — a discount with no deadline does nothing.",
        ],
      },
      { type: "h2", text: "When the promotion ends" },
      {
        type: "p",
        text: "Deactivate the code rather than deleting it. You keep the record of how many times it was used, which tells you whether the discount actually drove the sales or just discounted people who'd have bought anyway.",
      },
      { type: "h2", text: "Discounts that are worth it" },
      {
        type: "ul",
        items: [
          "A launch window that genuinely closes",
          "A code for a specific community or newsletter you appeared in",
          "A bundle price when someone buys two things at once",
        ],
      },
      {
        type: "note",
        text: "If you discount every month, you don't have a discount — you have a lower price with extra steps.",
      },
    ],
  },
  {
    slug: "affiliate-marketing-for-digital-products",
    title: "How affiliate marketing works for digital products",
    description:
      "Paying other people to sell for you — how the economics work, and when it's actually worth it.",
    minutes: 5,
    date: "2026-07-04",
    body: [
      {
        type: "p",
        text: "An affiliate promotes your product with a tracked link, and earns a cut of any sale that comes through it. You only pay when it works, which makes it one of the few marketing channels with no downside risk.",
      },
      { type: "h2", text: "How the money moves" },
      {
        type: "p",
        text: `On ${BRAND_NAME} the commission is taken out of the sale itself at checkout, exactly as any affiliate program works. So it comes out of the seller's payout — the person who got the sale funds the person who brought it.`,
      },
      {
        type: "note",
        text: "Any sale that came through an affiliate link is marked in your dashboard with the exact amount deducted, so a payout is never a surprise.",
      },
      { type: "h2", text: "Who makes a good affiliate" },
      {
        type: "ul",
        items: [
          "People who already recommend you unprompted",
          "Creators serving the same audience with something that isn't competing",
          "Buyers who loved it — often your best sellers",
        ],
      },
      { type: "h2", text: "When it's not worth it" },
      {
        type: "p",
        text: "Affiliates work when your margin can absorb the commission and the product converts on its own. If people aren't buying when you send them, affiliates won't fix that — they'll just send more traffic to a page that doesn't work.",
      },
    ],
  },
  {
    slug: "handling-refund-requests",
    title: "What to do when a customer asks for a refund",
    description:
      "Digital goods can't be returned. How to handle the request well — and how to get fewer of them.",
    minutes: 6,
    date: "2026-07-02",
    body: [
      {
        type: "p",
        text: "A refund request feels personal. It usually isn't. Handled quickly it costs you one sale; handled badly it costs you a chargeback, a bad review, and a fee on top.",
      },
      { type: "h2", text: "Answer fast, even if the answer is no" },
      {
        type: "p",
        text: "Most people who go to their bank do it because the seller went quiet. A reply within a day, even a declining one, prevents the majority of chargebacks.",
      },
      { type: "h2", text: "Work out which kind it is" },
      {
        type: "ul",
        items: [
          "Confusion — they couldn't open or use it. Help them; most withdraw the request.",
          "Mismatch — it wasn't what they expected. Refund it, then fix your description.",
          "Regret — they simply changed their mind. Your policy decides.",
        ],
      },
      { type: "h2", text: "How refunds work here" },
      {
        type: "p",
        text: "Buyers can't refund themselves — you issue it from your dashboard. When you do, the money returns to the buyer and their download access is revoked immediately. The refund comes out of your payout for that sale, since it's your sale being reversed.",
      },
      {
        type: "note",
        text: "Every buyer ticks a box before paying confirming the product is delivered instantly and the sale is final once downloaded. That agreement is recorded with a timestamp, alongside a log of every download — which is exactly the evidence that wins a dispute.",
      },
      { type: "h2", text: "Getting fewer requests" },
      {
        type: "ul",
        items: [
          "Describe precisely what's included, and what isn't",
          "Show real screenshots rather than mockups",
          "Add a support email in Settings so people ask you before their bank",
          "Include setup instructions — confusion is the most common cause",
        ],
      },
    ],
  },
  {
    slug: "digital-product-ideas-for-designers",
    title: "Digital product ideas for designers",
    description:
      "Turn the assets you've already built for client work into products that sell while you sleep.",
    minutes: 5,
    date: "2026-06-30",
    body: [
      {
        type: "p",
        text: "Designers are sitting on more sellable material than almost anyone — it's just currently buried in client folders.",
      },
      { type: "h2", text: "Things you've probably already made" },
      {
        type: "ul",
        items: [
          "A UI kit or component library from a past project ($29–79)",
          "Social templates sized for every platform ($19–39)",
          "Presentation decks that don't look like defaults ($19–49)",
          "An icon set around a single coherent theme ($15–35)",
          "Mockup scenes for showing off work ($19–39)",
        ],
      },
      {
        type: "note",
        text: "Check your client contracts before selling anything made under one. Rebuild it from scratch if there's any doubt — it's usually faster than the conversation.",
      },
      { type: "h2", text: "Package it for someone less skilled than you" },
      {
        type: "p",
        text: "Your buyer is often not a designer. Name layers sensibly, include a one-page how-to, and export in the formats non-designers actually own. Most refund requests on design assets are people who couldn't open the file.",
      },
      { type: "h2", text: "Sell the outcome, show the file" },
      {
        type: "p",
        text: "Lead with what they'll be able to make, then prove it with a screenshot of the actual layers and artboards. Designers buy on craft; everyone else buys on result.",
      },
    ],
  },
];

export function findPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
