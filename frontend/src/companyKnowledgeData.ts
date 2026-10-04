// Background knowledge for PM/TPM/AI PM interview prep — company mission,
// business lines, working norms, and recent news. Update roughly monthly
// (see docs/tasks.md Phase 5); the "Recent news" section is the part that
// goes stale fastest.
export const AMAZON_LAST_UPDATED = "2026-07-18";

export const AMAZON_MISSION =
	"Be Earth's most customer-centric company: the place people can find and discover virtually anything they want to buy online, at the lowest possible price.";

export const AMAZON_FLYWHEEL =
	"Lower cost structure -> lower prices -> more customer traffic -> more sellers want to list -> greater selection -> better customer experience -> repeat. Growth on one side of the flywheel (e.g. AWS margins, ad revenue) funds investment on another (e.g. faster delivery, lower retail prices) rather than each business needing to be independently profitable in the short term.";

export interface SampleAnswerStep {
	label: string;
	content: string;
}

export interface SampleQA {
	question: string;
	// Structured as labeled steps (clarify -> confirm goal/mission -> structured
	// body -> recommendation -> success metric) instead of one flowing
	// paragraph, because this is reference material meant to be scanned and
	// studied at a glance. Deliberately different from the AI-generated
	// exampleAnswer in worker/src/prompts.ts's EXAMPLE_ANSWER_FRAMEWORKS, which
	// is written as one continuous paragraph on purpose (it models what a
	// candidate would actually say out loud). Content here is original,
	// paraphrased material — not copied from Exponent/IGotAnOffer or any other
	// source (see docs/ai-rules.md).
	answerSteps: SampleAnswerStep[];
}

export interface BusinessLine {
	name: string;
	description: string;
	pmGoal: string;
	keyMetrics: string[];
	competitors: string[];
	// At least 3 per business line (2026-07-18, per user request) so this
	// reads as "the range of things you could be asked here," not just one
	// example.
	sampleQuestions: SampleQA[];
}

export const AMAZON_BUSINESS_LINES: BusinessLine[] = [
	{
		name: "Core Retail (Amazon.com)",
		description: "First-party and third-party marketplace selling nearly every product category.",
		pmGoal: "Maximize selection, low prices, and fast delivery while keeping the shopping experience trustworthy (reviews, counterfeit protection).",
		keyMetrics: ["Conversion rate", "Units per order", "Repeat purchase rate", "Return / defect rate"],
		competitors: ["Walmart", "Target", "Temu / Shein (low-price entrants)", "Shopify-powered DTC brands"],
		sampleQuestions: [
			{
				question: "How would you reduce the return rate for apparel purchases on Amazon.com?",
				answerSteps: [
					{
						label: "Clarify",
						content:
							"A specific apparel subcategory or the whole vertical? Is a return costly mainly for shipping/restocking, or because it signals a bad match that erodes trust?",
					},
					{
						label: "Confirm goal",
						content:
							"Ties back to the flywheel: high returns raise fulfillment cost and can push sellers to raise prices, working against \"lowest possible price.\"",
					},
					{
						label: "Structure",
						content:
							"Segment why returns happen — wrong size/fit, not-as-described, changed mind, or damaged in transit. For apparel specifically, size/fit is usually the dominant driver.",
					},
					{
						label: "Recommend",
						content:
							"Launch a fit-confidence score using return history and optional body measurements, plus brand-calibrated size charts and fit videos/reviews filtered by body type. Start with the highest-return subcategories (e.g. women's dresses) before scaling sitewide.",
					},
					{
						label: "Metric",
						content:
							"Apparel return rate in treatment vs. control, with conversion rate as a guardrail — an overly aggressive fit warning could suppress purchases entirely, which is worse than the return.",
					},
				],
			},
			{
				question: "How would you design a feature to help customers find products faster on Amazon.com?",
				answerSteps: [
					{
						label: "Clarify",
						content:
							"\"Faster\" — fewer clicks to purchase, or faster to the right product (lower regret/return rate)? Which surface — search, browse, or a specific vertical?",
					},
					{
						label: "Confirm goal",
						content:
							"Discovery speed drives conversion and repeat visits, core to the flywheel's selection-to-experience loop — but speed without relevance just trades one friction for another.",
					},
					{
						label: "Structure",
						content:
							"Segment by intent: a precise query (e.g. a model number) needs fast exact-match; broad browsing (e.g. \"gift for dad\") needs guided discovery. One ranking tweak won't serve both.",
					},
					{
						label: "Recommend",
						content:
							"For high-intent queries, invest in query understanding and instant redirect to a single best match. For exploratory intent, invest in structured filters and AI-assisted comparison rather than more results. Prioritize whichever segment has the largest volume and lowest current conversion.",
					},
					{
						label: "Metric",
						content:
							"Time-to-first-add-to-cart and search-to-purchase conversion, segmented by intent type, with return rate as a guardrail against faster-but-wrong purchases.",
					},
				],
			},
			{
				question: "Counterfeit products are appearing in a specific category. How would you address this?",
				answerSteps: [
					{
						label: "Clarify",
						content:
							"Newly detected or a rising trend? Confirmed counterfeit (verified reports/testing), or a spike in complaints that could actually be a quality issue from a legitimate seller?",
					},
					{
						label: "Confirm goal",
						content:
							"Counterfeits directly damage customer trust — Amazon's most valuable long-term asset, and the mission explicitly depends on customers trusting they'll get what they ordered.",
					},
					{
						label: "Structure",
						content:
							"Identify the entry point: a specific seller (or small cluster), a hijacked listing (variation abuse), or a systemic gap in the category's verification requirements. Each needs a different fix.",
					},
					{
						label: "Recommend",
						content:
							"Short-term: suspend the specific listings/sellers pending verification and give affected customers an easy refund path. Medium-term: tighten category-specific gating (e.g. required brand registry or lab certification) and increase review sampling for that category.",
					},
					{
						label: "Metric",
						content:
							"Counterfeit report rate per category (leading) and A-to-Z claim rate (lagging, customer-harm indicator), with false-positive supplier suspensions tracked as a guardrail against over-blocking legitimate sellers.",
					},
				],
			},
		],
	},
	{
		name: "Prime",
		description: "Membership program bundling fast shipping, video, music, and other perks.",
		pmGoal: "Increase customer lifetime value and retention by making Prime feel indispensable across many touchpoints, not just shipping speed.",
		keyMetrics: ["Prime penetration (% of customers)", "Renewal / retention rate", "Cross-benefit engagement (% using 2+ perks)", "Customer lifetime value"],
		competitors: ["Walmart+", "Costco membership", "Individual streaming subscriptions (wallet-share substitute)"],
		sampleQuestions: [
			{
				question: "Prime membership growth has slowed in a mature market. How would you re-accelerate it?",
				answerSteps: [
					{
						label: "Clarify",
						content: "Which market, and does \"slowed\" mean new sign-ups or renewals — the fix differs significantly.",
					},
					{
						label: "Confirm goal",
						content:
							"Prime's core goal is deepening the customer relationship so Amazon becomes the default for as much of a household's spend as possible.",
					},
					{
						label: "Structure",
						content:
							"Segment the addressable population: price-sensitive non-members, existing members with low awareness of the full benefit bundle, and members who tried and churned.",
					},
					{
						label: "Recommend",
						content:
							"Prioritize low-awareness existing members first — a retention lever, usually cheaper to move than acquisition. Improve onboarding to surface underused benefits (Prime Video, same-day grocery) within the first 30 days.",
					},
					{
						label: "Metric",
						content: "90-day renewal rate for the treatment cohort, with engagement across 2+ benefit categories as a leading indicator.",
					},
				],
			},
			{
				question: "How would you decide which new benefit to add to Prime next?",
				answerSteps: [
					{
						label: "Clarify",
						content: "A global benefit or targeted to a segment (e.g. families, students)? Is this a \"pick one\" decision or a portfolio call?",
					},
					{
						label: "Confirm goal",
						content:
							"A new benefit should widen the perceived value gap versus the fee, specifically for segments most at risk of not renewing or not signing up.",
					},
					{
						label: "Structure",
						content:
							"Score candidates on reach (how many members would use it), differentiation (can a competitor easily copy it — Walmart+ already offers fuel discounts), and marginal cost versus marginal retention lift.",
					},
					{
						label: "Recommend",
						content:
							"Favor benefits that compound with Amazon's existing infrastructure (e.g. faster grocery delivery via the fulfillment network) over generic perks Amazon has no structural advantage in, since those are easiest for a competitor to match.",
					},
					{
						label: "Metric",
						content: "Pilot with a member subset; measure adoption rate and lift in renewal (actual, or renewal-intent survey) for exposed vs. unexposed members.",
					},
				],
			},
			{
				question: "A cohort of Prime members is using only free shipping and nothing else. How would you think about this?",
				answerSteps: [
					{
						label: "Clarify",
						content:
							"What share of the base, and is it stable or growing? Is \"only shipping\" based on actual usage data, or just lack of clicks on other services (which could undercount, e.g. Prime Video watched via a TV app not tied to the account)?",
					},
					{
						label: "Confirm goal",
						content: "A single-benefit member is the highest churn risk — the segment where Prime's value proposition is weakest today.",
					},
					{
						label: "Structure",
						content:
							"Distinguish three causes: awareness (they don't know what's included), relevance (the other benefits genuinely don't fit their household), or friction (they know but the benefits are hard to access).",
					},
					{
						label: "Recommend",
						content:
							"Run cheap tests to isolate the cause before building anything big: a benefit-awareness notification (tests awareness), a short survey (tests relevance), and drop-off instrumentation if they do click into a benefit (tests friction) — each cause needs a different, non-overlapping fix.",
					},
					{
						label: "Metric",
						content: "Cross-benefit engagement rate after intervention, with this cohort's renewal rate as the ultimate success measure since the real risk is churn.",
					},
				],
			},
		],
	},
	{
		name: "AWS",
		description: "Cloud infrastructure and platform services; historically Amazon's largest profit contributor.",
		pmGoal: "Ship infrastructure primitives (compute, storage, AI/ML) that any workload can build on, and increasingly, higher-level AI agent products on top of that infrastructure.",
		keyMetrics: ["Revenue growth rate", "Operating margin", "Net revenue retention", "Compute/storage unit cost trend"],
		competitors: ["Microsoft Azure", "Google Cloud Platform", "Oracle Cloud"],
		sampleQuestions: [
			{
				question: "How would you decide whether to build a new managed AI service on top of Bedrock?",
				answerSteps: [
					{
						label: "Clarify",
						content:
							"What specific customer need is driving this — are enterprise customers repeatedly building the same capability themselves on raw Bedrock APIs?",
					},
					{
						label: "Confirm goal",
						content:
							"AWS ships primitives and moves up the stack only with clear, recurring customer pull — not because a capability seems technically interesting.",
					},
					{
						label: "Structure",
						content:
							"Look for evidence (support tickets, SA anecdotes) of repeated custom builds; size the market (broad horizontal vs. narrow vertical); weigh build vs. partner based on how tightly the need couples to core primitives (storage, IAM).",
					},
					{
						label: "Recommend",
						content:
							"Build only if it needs tight integration with core infrastructure; otherwise lean toward partner/marketplace. Scope v1 to the single highest-value use case, not a general-purpose service.",
					},
					{
						label: "Metric",
						content: "Adoption and support-ticket reduction post-launch, with a guardrail against cannibalizing partner ecosystem revenue.",
					},
				],
			},
			{
				question: "How would you prioritize which AWS service gets more GPU capacity during a shortage?",
				answerSteps: [
					{
						label: "Clarify",
						content:
							"A short-term allocation decision (this quarter's supply) or longer-term capacity planning? Cross-service (e.g. Bedrock vs. SageMaker vs. EC2 GPU instances) or within one?",
					},
					{
						label: "Confirm goal",
						content:
							"AWS's goal is durable customer trust and retention (net revenue retention) — mismanaging a shortage badly does more long-term damage than optimizing raw utilization this quarter.",
					},
					{
						label: "Structure",
						content:
							"Segment demand by commitment type (reserved/committed-spend vs. on-demand), criticality (production vs. experimentation), and strategic value (a large enterprise's flagship initiative vs. a workload that can tolerate throttling).",
					},
					{
						label: "Recommend",
						content:
							"Protect committed and production-critical workloads as a hard floor. Allocate remaining capacity with a transparent, pre-communicated priority framework rather than silent throttling, which erodes trust — and consider a temporary premium-priority tier for guaranteed access.",
					},
					{
						label: "Metric",
						content: "SLA adherence for committed customers (should stay near 100%), and churn/satisfaction signal for the segment that was throttled.",
					},
				],
			},
			{
				question: "An enterprise customer says AWS's AI tools are harder to use than a competitor's. How do you respond as the PM?",
				answerSteps: [
					{
						label: "Clarify",
						content:
							"Harder in what specific way — more setup steps, unclear docs, or the capability genuinely requiring more configuration? One customer's experience or a pattern across accounts?",
					},
					{
						label: "Confirm goal",
						content:
							"Ease of adoption directly drives usage and revenue — a technically superior but hard-to-use product loses to an easier, \"good enough\" competitor.",
					},
					{
						label: "Structure",
						content:
							"Distinguish a UX/onboarding problem (fixable without touching the underlying service) from a genuine trade-off (AWS primitives are often more composable but need more assembly than a competitor's packaged product).",
					},
					{
						label: "Recommend",
						content:
							"If UX/onboarding: invest in guided setup, better defaults, and quickstart templates for common use cases. If it's a real trade-off: don't chase feature parity blindly — segment which customers value flexibility versus speed-to-first-result, and consider a higher-level managed offering for the latter.",
					},
					{
						label: "Metric",
						content: "Time-to-first-successful-call for new accounts, plus qualitative win/loss interviews against the named competitor.",
					},
				],
			},
		],
	},
	{
		name: "Advertising",
		description: "Sponsored product placements, display ads, and Prime Video ads.",
		pmGoal: "Grow one of Amazon's fastest-growing, highest-margin businesses without degrading the customer shopping/viewing experience.",
		keyMetrics: ["Ad revenue as % of GMV", "Click-through rate", "Seller return on ad spend (ROAS)", "Ad load / experience impact"],
		competitors: ["Google Ads", "Meta Ads", "Walmart Connect", "TikTok Ads"],
		sampleQuestions: [
			{
				question: "How would you decide how many sponsored product slots to show on a single search results page?",
				answerSteps: [
					{
						label: "Clarify",
						content: "Which page type — ad density tolerance differs between a head-term search and a long-tail one.",
					},
					{
						label: "Confirm goal",
						content: "Grow ad revenue without measurably hurting the organic shopping experience customers trust.",
					},
					{
						label: "Structure",
						content:
							"Frame as constrained optimization: more slots raise near-term ad revenue but risk organic click-through and long-term retention. Segment by query type — branded/specific (ads more tolerable) vs. exploratory/broad (cap density lower).",
					},
					{
						label: "Recommend",
						content:
							"Start conservative; use organic click-through and retention floors as guardrails before testing increases. Build a per-query-type policy rather than one fixed number sitewide.",
					},
					{
						label: "Metric",
						content: "Organic click-through rate and a longer-horizon retention metric, not just immediate ad revenue.",
					},
				],
			},
			{
				question: "How would you help a small seller who can't afford much ad spend still get visibility?",
				answerSteps: [
					{
						label: "Clarify",
						content: "Is the goal fair access to advertising specifically, or discoverability more broadly? Is a spend floor even the right mechanism?",
					},
					{
						label: "Confirm goal",
						content:
							"A healthy long tail of sellers is core to selection, which drives the flywheel — if only big-budget sellers get visibility, selection effectively narrows for customers.",
					},
					{
						label: "Structure",
						content:
							"Small sellers lose mainly through auction dynamics (outbid) and weak historical performance data (harder to earn a good relevance score with limited impression history) — these compound.",
					},
					{
						label: "Recommend",
						content:
							"Consider a bounded emerging-seller ad credit or reduced minimum bid for a limited window, paired with a quality bar (return rate, response time) so it doesn't just surface low-quality sellers — this breaks the cold-start problem without permanently distorting the auction.",
					},
					{
						label: "Metric",
						content:
							"Small-seller ad-driven GMV growth and graduation rate off the program — whether sellers earn organic traction after the credit period, not permanent dependence.",
					},
				],
			},
			{
				question: "Ad revenue growth is strong, but seller satisfaction with ROAS is declining. How would you think about this?",
				answerSteps: [
					{
						label: "Clarify",
						content:
							"Is measured ROAS actually declining, or is reported satisfaction declining while ROAS is flat? Broad-based or concentrated in specific categories or seller sizes?",
					},
					{
						label: "Confirm goal",
						content:
							"Advertising's health depends on sellers seeing real return, not just Amazon's revenue growing — declining perceived ROAS is a leading indicator that sellers will cut spend, eventually capping ad growth.",
					},
					{
						label: "Structure",
						content:
							"Rising ad revenue with flat seller counts and conversion suggests rising CPCs from competitive bidding, not more value delivered. Check whether this is driven by increased slot density or genuine demand growth from more advertisers.",
					},
					{
						label: "Recommend",
						content:
							"If density-driven, revisit the slot-count guardrails. If it's competitive bidding growth, give sellers better bid-efficiency tools and clearer attribution reporting so perceived ROAS reflects reality, rather than just adjusting prices.",
					},
					{
						label: "Metric",
						content: "ROAS trend segmented by seller cohort (new vs. established, by category) to isolate where the decline concentrates.",
					},
				],
			},
		],
	},
	{
		name: "Devices & Alexa",
		description: "Echo, Kindle, Fire TV, and the Alexa voice/AI assistant.",
		pmGoal: "Often sold near cost as a wedge into the home, to drive engagement with Amazon's services and, increasingly, agentic shopping.",
		keyMetrics: ["Device attach rate to Amazon services", "Daily active usage", "Hardware margin (often near-zero)", "Voice command success rate"],
		competitors: ["Google Nest / Assistant", "Apple HomePod / Siri", "Roku"],
		sampleQuestions: [
			{
				question: "How would you measure whether Alexa+ is genuinely useful to customers, not just a novelty?",
				answerSteps: [
					{
						label: "Clarify",
						content: "\"Useful\" as in task completion, or just engagement? Those can diverge — heavy usage doesn't mean it's saving time or solving problems.",
					},
					{
						label: "Confirm goal",
						content: "Genuine engagement with the ecosystem, not vanity usage that doesn't translate into retention or cross-service adoption.",
					},
					{
						label: "Structure",
						content:
							"Layer the metrics: an input metric (DAU/WAU), a task-success metric (% completing without correction or giving up), and an outcome metric (does usage correlate with retention vs. a matched lower-usage cohort). Watch for launch-novelty decay.",
					},
					{
						label: "Recommend",
						content:
							"Combine task-success rate and 4-week feature retention as the primary dashboard; treat raw usage as supporting, not primary. Validate with qualitative session sampling since automated success detection is imperfect for open-ended queries.",
					},
					{
						label: "Metric",
						content: "Task-success rate and week-over-week feature retention curve.",
					},
				],
			},
			{
				question: "Should Alexa+ be free for all Prime members, or a separate paid add-on?",
				answerSteps: [
					{
						label: "Clarify",
						content: "What's the actual compute cost to serve Alexa+ per interaction — generative AI inference isn't free, unlike most existing Prime benefits.",
					},
					{
						label: "Confirm goal",
						content: "Devices exist to drive ecosystem engagement, often near cost — the decision should optimize for lock-in and LTV, not standalone profitability.",
					},
					{
						label: "Structure",
						content:
							"Bundling into Prime raises perceived Prime value but raises cost-per-member with no direct revenue. A paid add-on generates revenue and reveals real willingness-to-pay, but adds adoption friction.",
					},
					{
						label: "Recommend",
						content:
							"Given real compute cost and still-developing usage patterns, a staged approach — included with usage caps or tiering (basic free, higher-usage paid) — captures upside from both paths while limiting cost exposure.",
					},
					{
						label: "Metric",
						content: "Cost-to-serve per active user against Prime renewal lift attributable to Alexa+ usage; revisit if cost outpaces retention value.",
					},
				],
			},
			{
				question: "How would you decide which new device form factor to build next?",
				answerSteps: [
					{
						label: "Clarify",
						content: "A genuinely new category, or an iteration on an existing line? Strategic driver — filling a home gap, or extending Alexa+/agentic shopping reach?",
					},
					{
						label: "Confirm goal",
						content: "Devices are a wedge, not a profit center — evaluate on incremental ecosystem engagement and data, not hardware margin.",
					},
					{
						label: "Structure",
						content:
							"Map candidates against where Amazon has weak surface area in the home or on-the-go versus categories where a competitor already dominates and Amazon would enter late and defensively.",
					},
					{
						label: "Recommend",
						content:
							"Prioritize gaps where Amazon's existing strengths (voice AI, logistics, shopping) create genuine differentiation over categories that just match an established competitor with no unique angle.",
					},
					{
						label: "Metric",
						content: "Validate demand with a pilot or waitlist signal before full production commitment, given devices are typically sold near cost.",
					},
				],
			},
		],
	},
	{
		name: "Grocery (Amazon Fresh / Whole Foods / Amazon Now)",
		description: "Physical and online grocery, including rapid delivery.",
		pmGoal: "Win a high-frequency category that drives repeat engagement, extending the flywheel into a purchase category Amazon historically under-indexed on.",
		keyMetrics: ["Order frequency", "Basket size", "Delivery cost per order", "Perishable spoilage / waste rate"],
		competitors: ["Instacart", "Walmart Grocery", "DoorDash", "Local grocery chains"],
		sampleQuestions: [
			{
				question: "How would you decide which cities to expand rapid grocery delivery to next?",
				answerSteps: [
					{
						label: "Clarify",
						content: "Which format — Fresh stores, standard online grocery, or rapid Amazon Now delivery? Expansion criteria differ by capital intensity.",
					},
					{
						label: "Confirm goal",
						content: "Win a high-frequency category to deepen the flywheel — prioritize cities where success meaningfully lifts overall customer engagement.",
					},
					{
						label: "Structure",
						content:
							"Score cities on existing Prime penetration (logistics/trust proxy), density and income, existing fulfillment infrastructure to leverage, and competitive intensity.",
					},
					{
						label: "Recommend",
						content:
							"Weight existing-infrastructure leverage heavily for the first wave to prove the model with lower capital risk before greenfield build-outs.",
					},
					{
						label: "Metric",
						content: "Delivery cost per order and order frequency in the first 90 days for 2-3 pilot cities before wider rollout.",
					},
				],
			},
			{
				question: "Grocery order frequency is high but basket size is shrinking. How would you think about it?",
				answerSteps: [
					{
						label: "Clarify",
						content: "Shrinking in item count, dollar value, or both? Across all customers, or concentrated in a cohort (e.g. newer customers still forming habits)?",
					},
					{
						label: "Confirm goal",
						content: "Frequency-driven engagement is the goal, but a shrinking basket at constant delivery cost per order erodes unit economics.",
					},
					{
						label: "Structure",
						content:
							"Two very different causes: (a) customers splitting one large weekly order into several smaller rapid orders (frequency up is healthy, just a shopping-pattern shift), or (b) customers cutting spend per trip due to price sensitivity or freshness/substitution trust issues.",
					},
					{
						label: "Recommend",
						content:
							"Check whether total monthly spend per customer is flat or declining. If flat, optimize delivery-cost efficiency for smaller baskets. If declining, investigate price perception and substitution quality directly.",
					},
					{
						label: "Metric",
						content: "Monthly spend per active grocery customer as the north star, with delivery cost per order as an efficiency guardrail.",
					},
				],
			},
			{
				question: "How would you reduce perishable spoilage / waste in the grocery supply chain?",
				answerSteps: [
					{
						label: "Clarify",
						content:
							"Waste at which stage — inbound (spoiled before sale), in-store/dark-store (unsold inventory), or last-mile (spoiled in transit)? Which category?",
					},
					{
						label: "Confirm goal",
						content: "Waste directly hits margin in an already thin-margin category, and cost discipline is central to the flywheel's low-price side.",
					},
					{
						label: "Structure",
						content:
							"Segment by cause: demand forecasting error (over-ordering vs. actual sell-through), supply chain delay (too long from source to shelf for the product's shelf life), or last-mile failure (delayed/failed cold-chain delivery).",
					},
					{
						label: "Recommend",
						content:
							"Prioritize forecasting improvements first if that's the dominant driver — lowest capital cost via better hyper-local demand models — before infrastructure fixes for supply chain or last-mile, which need capital investment.",
					},
					{
						label: "Metric",
						content: "Spoilage/waste rate as % of perishable inventory, tracked separately by stage so the fix can be attributed and validated.",
					},
				],
			},
		],
	},
	{
		name: "Logistics & Delivery",
		description: "Fulfillment centers, Amazon's own delivery network, and Delivery Service Partners.",
		pmGoal: "Control delivery speed and unit cost directly rather than depending entirely on third-party carriers.",
		keyMetrics: ["On-time delivery rate", "Cost per package", "Same-day / next-day delivery %", "Owned-network vs. third-party carrier mix"],
		competitors: ["UPS", "FedEx", "USPS", "Regional last-mile startups"],
		sampleQuestions: [
			{
				question: "On-time delivery dropped noticeably in one region last week. How would you investigate?",
				answerSteps: [
					{
						label: "Clarify",
						content: "Isolated to one fulfillment center, carrier, or delivery partner, or does it affect the whole region uniformly?",
					},
					{
						label: "Confirm goal",
						content: "On-time delivery is core to the Prime value proposition — a regional dip risks eroding trust for a specific customer population.",
					},
					{
						label: "Structure",
						content:
							"Rule out a data/tracking issue first, then check for a known one-time event (weather, holiday, labor disruption). If neither, break down upstream (fulfillment processing time) vs. downstream (last-mile carrier performance).",
					},
					{
						label: "Recommend",
						content:
							"Validate the leading hypothesis with a before/after comparison, then apply an operational fix (capacity, carrier rebalancing) or a communication fix (proactive customer notification) — and add a regional anomaly alert so this is caught within a day next time.",
					},
					{
						label: "Metric",
						content: "Regional on-time delivery rate trend, with a same-day/next-day anomaly alert threshold.",
					},
				],
			},
			{
				question: "How would you decide whether to expand Amazon's own delivery network vs. relying more on third-party carriers in a region?",
				answerSteps: [
					{
						label: "Clarify",
						content: "A new-market entry decision, or re-evaluating an existing region currently served by third-party carriers?",
					},
					{
						label: "Confirm goal",
						content:
							"Control delivery speed and cost directly — but owning a network is a large capital and operational commitment, so it needs durable volume, not a temporary spike.",
					},
					{
						label: "Structure",
						content:
							"Compare regions on sustained package volume density (owned-network economics improve with density), current third-party performance/cost there, and how much strategic control matters (e.g. same-day-critical urban markets).",
					},
					{
						label: "Recommend",
						content:
							"Justify owned-network investment where density is high and sustained; use a Delivery Service Partner model in lower-density or volume-uncertain regions where third-party flexibility (variable cost, no capital commitment) fits better.",
					},
					{
						label: "Metric",
						content: "Cost per package and on-time rate for pilot regions vs. comparable third-party-served regions, over a window long enough to smooth ramp-up.",
					},
				],
			},
			{
				question: "Cost per package is rising even though volume is flat. How would you investigate?",
				answerSteps: [
					{
						label: "Clarify",
						content: "Rising for which cost component — line-haul, last-mile, labor, or fuel/fixed overhead spread over the same volume? One region or network-wide?",
					},
					{
						label: "Confirm goal",
						content: "Controlling unit cost is the explicit reason Amazon built its own network — a sustained rise without volume growth undermines that directly.",
					},
					{
						label: "Structure",
						content:
							"Rule out the common false lead first: is a fixed-cost base (leases, equipment) being spread over the same volume (a utilization issue, not inefficiency)? If genuinely operational, check carrier mix shift, labor cost inflation, or fuel pass-through.",
					},
					{
						label: "Recommend",
						content:
							"If it's fixed-cost utilization, the lever is growing volume into existing capacity or right-sizing it — not a delivery-process fix. If it's mix shift or input inflation, address that specific driver directly rather than a broad cost-cutting push.",
					},
					{
						label: "Metric",
						content: "Cost per package decomposed by driver (fixed overhead, carrier mix, labor, fuel) so the fix targets the actual cause.",
					},
				],
			},
		],
	},
	{
		name: "Marketplace / Seller Services",
		description: "Seller Central, Fulfillment by Amazon (FBA), and related seller tooling.",
		pmGoal: "Grow selection by making it easy for third-party sellers to list and fulfill, monetized via referral fees and fulfillment fees.",
		keyMetrics: ["Active seller count", "% of GMV from 3P sellers", "FBA adoption rate", "Seller support ticket volume"],
		competitors: ["eBay", "Walmart Marketplace", "Shopify", "Etsy"],
		sampleQuestions: [
			{
				question: "How would you help small sellers compete against large, established sellers in the same category?",
				answerSteps: [
					{
						label: "Clarify",
						content: "\"Compete\" as in winning the Buy Box, discoverability, or profitable unit economics? Each implies a different intervention.",
					},
					{
						label: "Confirm goal",
						content: "A healthy long tail of sellers drives selection, core to the flywheel — if only large sellers win, selection narrows over time.",
					},
					{
						label: "Structure",
						content:
							"Segment why small sellers lose: usually discoverability (large sellers outspend on ads) and trust signals (fewer reviews, shorter track record), not product quality.",
					},
					{
						label: "Recommend",
						content:
							"For discoverability: a curated \"emerging seller\" discovery mechanism gated by a quality bar. For trust: subsidized tools (professional photography, listing optimization) since listing quality is within small sellers' control without needing scale.",
					},
					{
						label: "Metric",
						content: "Small-seller GMV growth alongside a customer-side guardrail (return rate, review rating) to protect the customer experience.",
					},
				],
			},
			{
				question: "How would you decide whether to launch a new fulfillment fee tier for FBA?",
				answerSteps: [
					{
						label: "Clarify",
						content: "A new tier for a specific product type (oversized, low-price), or a general restructuring? Driven by Amazon margin pressure, or seller feedback that pricing doesn't fit their economics?",
					},
					{
						label: "Confirm goal",
						content: "FBA adoption drives selection and a consistent delivery experience — a fee change should protect adoption, not just extract margin.",
					},
					{
						label: "Structure",
						content:
							"Segment sellers by product economics most affected — low-price/high-volume sellers are most fee-sensitive; oversized/low-turnover items may be undercharged relative to their storage/handling cost.",
					},
					{
						label: "Recommend",
						content:
							"Target the segment where pricing is genuinely misaligned with cost-to-serve (e.g. a low-price tier funded by proportionally higher fees on costly-to-store items) rather than an across-the-board increase; pilot before full rollout.",
					},
					{
						label: "Metric",
						content: "FBA adoption in the targeted segment pre/post change, with seller support ticket volume in that segment as an early dissatisfaction signal.",
					},
				],
			},
			{
				question: "Seller support ticket volume has spiked. How would you triage the response?",
				answerSteps: [
					{
						label: "Clarify",
						content: "Spiked across all segments/categories, or concentrated? Sudden (one day) or ramping over days/weeks — the pattern points to different causes.",
					},
					{
						label: "Confirm goal",
						content: "Support health is a leading indicator for seller retention — unresolved friction can push sellers toward a competing marketplace.",
					},
					{
						label: "Structure",
						content:
							"A sudden spike usually points to a triggering event (policy change, outage, payment issue). A gradual ramp usually points to a structural issue (a recurring bug, unclear new policy, or support capacity not keeping up with seller growth).",
					},
					{
						label: "Recommend",
						content:
							"For a sudden spike: communicate about the known event immediately, even before full resolution — sellers escalate less when they know it's being worked. For a gradual ramp: categorize ticket topics to find the dominant driver and fix the root cause, not just add headcount.",
					},
					{
						label: "Metric",
						content: "Ticket volume by category/topic and resolution time, with seller churn rate as the ultimate lagging indicator if the cause isn't fixed.",
					},
				],
			},
		],
	},
	{
		name: "Emerging bets",
		description: "Amazon Leo (satellite internet, formerly Project Kuiper), healthcare (Amazon Pharmacy, One Medical), and generative/agentic AI products.",
		pmGoal: "Longer-horizon, higher-risk investments justified by the flywheel logic rather than near-term unit economics.",
		keyMetrics: ["Varies by bet — e.g. satellite coverage / subscriber count (Leo), patient enrollment (healthcare), model usage (generative AI)"],
		competitors: ["Starlink (Leo)", "CVS / Walgreens (Pharmacy)", "OpenAI / Google (generative AI)"],
		sampleQuestions: [
			{
				question: "How would you decide whether Amazon should keep investing in Amazon Leo versus reallocating that capital?",
				answerSteps: [
					{
						label: "Clarify",
						content: "A near-term budget reallocation question, or a fundamental strategic re-evaluation? Leo is a genuinely long-payback infrastructure bet by design.",
					},
					{
						label: "Confirm goal",
						content: "Emerging bets are justified by optionality and flywheel reinforcement, not near-term unit economics — the evaluation bar differs from a mature business.",
					},
					{
						label: "Structure",
						content:
							"Track leading indicators (deployment pace vs. plan, pilot conversion, subscriber growth vs. the modeled addressable market) and assess strategic rationale independent of standalone profitability (negotiating leverage, reduced dependency, underserved-market capture).",
					},
					{
						label: "Recommend",
						content:
							"Continue if metrics track to plan and no new competitive threat has emerged. If meaningfully off-track, recommend a staged re-scoping (slower deployment) over an abrupt stop, since sunk infrastructure capital is better utilized than abandoned.",
					},
					{
						label: "Metric",
						content: "Deployment pace vs. plan and pilot/subscriber conversion vs. the original addressable-market model.",
					},
				],
			},
			{
				question: "How would you decide whether a promising internal AI prototype should get more investment or be shut down?",
				answerSteps: [
					{
						label: "Clarify",
						content: "What stage is it at — internal-only, a limited pilot with real customers, or already public preview? What hypothesis was it meant to test?",
					},
					{
						label: "Confirm goal",
						content: "Evaluate against what the bet was meant to prove, not against a mature business's revenue bar — the question is whether the original uncertainty resolved favorably.",
					},
					{
						label: "Structure",
						content:
							"Separate three states: the hypothesis was validated and the bottleneck is now execution/scaling (invest more); it was invalidated with clear evidence (shut down, redeploy the team); or evidence is genuinely ambiguous (extend with a sharper, time-boxed success criterion).",
					},
					{
						label: "Recommend",
						content:
							"Avoid continuing an ambiguous bet indefinitely from sunk cost or internal enthusiasm — set a concrete, dated re-evaluation checkpoint with a pre-agreed metric threshold, and be willing to redeploy the team if it's not met.",
					},
					{
						label: "Metric",
						content: "Whatever leading indicator the original hypothesis specified (e.g. task-completion rate, pilot-user retention), measured against a pre-committed threshold.",
					},
				],
			},
			{
				question: "How would you evaluate whether Amazon Pharmacy / One Medical is on track, given it's not a typical Amazon business?",
				answerSteps: [
					{
						label: "Clarify",
						content: "Evaluating the healthcare bet overall, or a specific initiative within it (pharmacy delivery speed, One Medical membership growth)?",
					},
					{
						label: "Confirm goal",
						content:
							"Healthcare extends the flywheel into a high-frequency, high-trust category — success looks different from retail (regulatory constraints, clinical quality bar, slower trust-building) and shouldn't be judged on retail-speed metrics.",
					},
					{
						label: "Structure",
						content:
							"Track category-appropriate leading indicators instead of importing retail metrics wholesale: patient enrollment/retention, prescription fill rate and speed, and cross-service signal (do Amazon Pharmacy customers show higher Prime retention).",
					},
					{
						label: "Recommend",
						content:
							"Weight patient trust and clinical-quality indicators (medication error rate, appointment access) as heavily as growth metrics — a healthcare misstep carries reputational and regulatory risk disproportionate to its revenue size.",
					},
					{
						label: "Metric",
						content: "Patient retention/enrollment growth paired with a clinical-quality/safety guardrail, plus a cross-service engagement lift metric to validate the flywheel thesis.",
					},
				],
			},
		],
	},
];

export interface WorkingNorm {
	title: string;
	description: string;
}

export const AMAZON_TEAM_STRUCTURE: WorkingNorm[] = [
	{
		title: "Single-threaded leadership",
		description:
			"A dedicated leader owns one initiative end-to-end without competing priorities pulling their attention elsewhere — common framing for 'why does this need its own team' in system design / strategy answers.",
	},
	{
		title: "Two-pizza teams",
		description: "Small, autonomous teams (roughly 6-10 people) sized so a team can be fed with two pizzas — a proxy for keeping teams small enough to move fast and own their own scope.",
	},
	{
		title: "Working Backwards / PR-FAQ",
		description:
			"Before building, teams write a press release and FAQ for the finished product from the customer's point of view. Forces clarity on customer value before implementation details — a useful structure to reference in product sense answers.",
	},
	{
		title: "Narrative memos, not slide decks",
		description:
			"Meetings often open with everyone silently reading a written memo (famously the '6-pager') rather than a slide presentation, to force fuller, more precise reasoning than bullet points allow.",
	},
	{
		title: "Bar Raiser hiring process",
		description: "An interviewer from outside the hiring team, trained specifically to protect the hiring bar, has effective veto power on a hire — reinforces 'Hire and Develop the Best' in practice, not just as a slogan.",
	},
];

export interface NewsItem {
	title: string;
	summary: string;
	date: string;
	source: string;
}

// Sourced via web search on 2026-07-13 — refresh this list monthly rather
// than trusting model training data, which drifts stale within months.
export const AMAZON_RECENT_NEWS: NewsItem[] = [
	{
		title: "Rufus retired in favor of \"Alexa for Shopping\"",
		summary:
			"Amazon retired its standalone Rufus shopping chatbot (which had reached 300M+ customers) and folded its recommendation features into a new \"Alexa for Shopping\" experience built directly into the search bar — AI overviews, side-by-side product comparisons, and price-drop scheduling, available even without a Prime membership.",
		date: "2026-05",
		source: "https://www.cnbc.com/2026/05/13/amazon-ditches-rufus-ai-chatbot-in-favor-of-alexa-shopping-agent.html",
	},
	{
		title: "Amazon Quick and agentic AI for Connect",
		summary:
			"AWS launched Amazon Quick, an AI assistant for work with a desktop app and free/paid pricing tiers, and expanded Amazon Connect into four agentic AI solutions spanning supply chain, hiring, customer experience, and healthcare.",
		date: "2026",
		source: "https://aws.amazon.com/blogs/aws/top-announcements-of-the-whats-next-with-aws-2026/",
	},
	{
		title: "$1B AI-driven Forward Deployed Engineer initiative",
		summary: "Amazon launched a $1 billion initiative embedding engineers directly with enterprise customers to accelerate AI adoption, following a similar playbook to Anthropic and OpenAI's own forward-deployed teams.",
		date: "2026-07",
		source: "https://americanbazaaronline.com/2026/07/01/amazon-launches-1b-ai-driven-fde-initiative-483841/",
	},
	{
		title: "Amazon Leo (formerly Project Kuiper) satellite internet",
		summary:
			"Amazon's satellite broadband service, rebranded Amazon Leo, is rolling out with three consumer terminal tiers (Nano, Pro, Ultra). The FCC approved 4,500 additional satellites, bringing the total planned constellation to 7,727 — positioned as a direct Starlink competitor.",
		date: "2026",
		source: "https://www.aboutamazon.com/news/innovation-at-amazon/what-is-amazon-project-kuiper",
	},
	{
		title: "Bedrock Fully Managed Knowledge Bases + third-party frontier models",
		summary: "AWS Bedrock added Fully Managed Knowledge Bases (native data connectors, automatic multi-format parsing, and an agentic multi-step retriever) for building enterprise RAG pipelines, alongside preview access to the latest GPT models.",
		date: "2026",
		source: "https://aws.amazon.com/blogs/aws/top-announcements-of-the-whats-next-with-aws-2026/",
	},
	{
		title: "Prime Video ads expand internationally; Netflix ad partnership",
		summary: "Prime Video advertising launched in Belgium, Denmark, Norway, and Turkey, and Amazon Ads partnered with Netflix to give Amazon DSP advertisers direct access to Netflix's premium ad inventory.",
		date: "2026",
		source: "https://advertising.amazon.com/library/newsroom",
	},
];

// ==========================================================================
// Make (make.com) — the second company added to the app (2026-08-14).
// Grounded in real, researched facts: founded in Prague as Integromat,
// acquired by Celonis in 2020 (Celonis is a process mining / execution
// management company), rebranded to Make in Feb 2022 with a stated vision of
// "empowering creators to innovate without limits." Operates as its own
// business unit within Celonis, retaining a dedicated Prague-based product
// and engineering org while leveraging Celonis's enterprise security,
// infrastructure, and go-to-market. Product: a visual automation platform —
// "scenarios" (flowcharts) built from drag-and-drop "modules," 3,000+ app
// integrations, credit/operations-based pricing, and (since 2025/2026) Make
// AI Agents for adaptive, agentic workflows alongside classic deterministic
// scenarios. Competitors: Zapier (market leader, largest app ecosystem,
// premium/ease-first), n8n (open-source, developer-centric, fast-growing
// after its AI pivot), Workato and Tray.ai (enterprise-focused), Microsoft
// Power Automate. Content below is original, paraphrased material — not
// copied from any source (see docs/ai-rules.md) — a smaller starter set than
// Amazon's, expandable later the same way Amazon's grew over time.
// ==========================================================================

export const MAKE_LAST_UPDATED = "2026-08-14";

export const MAKE_MISSION =
	"Empower creators to innovate without limits: give anyone — technical or not — the power to build the automation and AI-powered workflows their work actually needs, without writing code.";

export const MAKE_FLYWHEEL =
	"More integrations and shared templates let more non-technical creators solve more of their own problems without waiting on engineering -> more usage and community-built scenarios/templates -> more third-party app makers want an official integration on the platform -> more integrations and more powerful building blocks -> repeat. Growth on one side (enterprise revenue via Make ONE, Celonis's enterprise infrastructure and go-to-market) funds investment on the other (broader integrations, deeper AI Agent capability) rather than each layer needing to be independently self-funding.";

export const MAKE_BUSINESS_LINES: BusinessLine[] = [
	{
		name: "Core Automation (Scenarios)",
		description: "The visual scenario builder — drag-and-drop modules connected into flowcharts, with routers, iterators, and error handling for complex logic.",
		pmGoal: "Keep the platform approachable enough for a first-time, non-technical creator while staying powerful enough for advanced users building complex, branching automations.",
		keyMetrics: ["First successful scenario run rate", "Median time to first working scenario", "Scenario failure/error rate", "Modules connected per active user"],
		competitors: ["Zapier", "n8n", "Microsoft Power Automate"],
		sampleQuestions: [
			{
				question: "How would you reduce the time it takes a first-time user to build a working scenario?",
				answerSteps: [
					{ label: "Clarify", content: "Is the friction in picking the right app/module, understanding how modules connect, or configuring a specific module's fields correctly?" },
					{ label: "Confirm goal", content: "Ties directly to Make's activation metric and its core mission of letting non-technical creators build real solutions themselves." },
					{ label: "Structure", content: "Segment by where users actually drop off: module discovery, connection/mapping logic, or testing/running the scenario for the first time." },
					{ label: "Recommend", content: "Start with guided templates for the most common first use cases (e.g. 'notify me on a form submission'), pre-filled with sensible defaults the user only has to confirm." },
					{ label: "Metric", content: "First-successful-run rate within the first session, without regressing power-user scenario complexity." },
				],
			},
			{
				question: "A power user says debugging a 20-module scenario is painful. How would you improve this?",
				answerSteps: [
					{ label: "Clarify", content: "Is the pain in finding which module failed, understanding why it failed, or fixing it without breaking the rest of the scenario?" },
					{ label: "Confirm goal", content: "Reliability and trust matter as much as raw power for creators who depend on scenarios running unattended in production." },
					{ label: "Structure", content: "Break debugging into three moments: detection (something failed), diagnosis (why), and recovery (fix and re-run safely)." },
					{ label: "Recommend", content: "Highlight the failing module directly on the visual canvas with a plain-language error summary, and let the user re-run from that exact module instead of the whole scenario." },
					{ label: "Metric", content: "Time from failure notification to a user re-running a fixed scenario successfully." },
				],
			},
		],
	},
	{
		name: "Make AI Agents",
		description: "Visual, agentic automation layered on top of classic scenarios — adaptive, AI-driven decision-making instead of fixed, deterministic steps, launched 2025 and expanded into a next generation in 2026.",
		pmGoal: "Let creators move from rigid, rule-based automation to adaptive AI agents without hitting a wall of complexity, while keeping agent actions safe and trustworthy inside real production workflows.",
		keyMetrics: ["% of active scenarios including an AI Agent step", "Agent task success rate", "Human-intervention rate on agent-taken actions"],
		competitors: ["Zapier (Zapier Agents)", "n8n (AI-native workflows)", "Workato (agentic automation)"],
		sampleQuestions: [
			{
				question: "Design the product experience for a creator upgrading a simple scenario into an AI Agent.",
				answerSteps: [
					{ label: "Clarify", content: "Does the user already know their deterministic logic is breaking down, or do they need help recognizing that an agent would serve them better?" },
					{ label: "Confirm goal", content: "The upgrade path should feel like a natural next step, not a cliff — core to Make's visual-first, accessible-but-powerful positioning." },
					{ label: "Structure", content: "Identify the trigger moment (e.g. repeated manual overrides of a fixed rule), then design an in-context prompt to try an agent step for just that part of the scenario." },
					{ label: "Recommend", content: "Let the agent step run in a shadow/preview mode first, showing what it *would* have decided, before the user trusts it to act live." },
					{ label: "Metric", content: "% of users who try the agent preview who then keep the agent step active after a week." },
				],
			},
			{
				question: "What responsible-AI risks would you watch for, given agents can take real actions in a user's connected apps?",
				answerSteps: [
					{ label: "Clarify", content: "Which class of action is highest-risk — irreversible ones (sending an email, deleting a record) vs. reversible/read-only ones?" },
					{ label: "Confirm goal", content: "Trust is the product here: one visible agent mistake in a real business system could undo a lot of adoption." },
					{ label: "Structure", content: "Map risk by action reversibility and blast radius (one record vs. many, internal vs. customer-facing)." },
					{ label: "Recommend", content: "Require explicit scoped permissions per connected app, and a human-approval step by default for irreversible, high-blast-radius actions." },
					{ label: "Metric", content: "Rate of agent actions that a user had to manually undo or correct after the fact." },
				],
			},
		],
	},
	{
		name: "Enterprise (Make ONE)",
		description: "Enterprise-tier features — SSO, audit logs, Databricks connectivity, custom credit allocation — built on Celonis's enterprise security, infrastructure, and go-to-market.",
		pmGoal: "Win larger organizations without losing the accessibility and speed that define Make's core prosumer/SMB product.",
		keyMetrics: ["Enterprise logo count", "Net revenue retention", "Average credits/seats per enterprise account"],
		competitors: ["Workato", "Tray.ai", "Microsoft Power Automate (enterprise tier)"],
		sampleQuestions: [
			{
				question: "Should Make invest further into the enterprise segment, or stay focused on its current prosumer/SMB middle tier?",
				answerSteps: [
					{ label: "Clarify", content: "Is the question about reallocating existing roadmap investment, or about a net-new enterprise-specific initiative?" },
					{ label: "Confirm goal", content: "Ties to Make's actual market position: more powerful than Zapier, more accessible than code, and now with real enterprise features via Celonis." },
					{ label: "Structure", content: "Weigh the two paths: enterprise (higher ACV, slower sales cycles, competes directly with Workato/Tray.ai) vs. prosumer/SMB (Make's current strength, faster growth loop via self-serve)." },
					{ label: "Recommend", content: "Continue enterprise investment incrementally through the existing Celonis relationship rather than a costly standalone enterprise go-to-market build-out, since that infrastructure is already a differentiator Make has and most competitors don't." },
					{ label: "Metric", content: "Enterprise net revenue retention vs. self-serve conversion rate, tracked separately so one doesn't mask the other." },
				],
			},
			{
				question: "How should Make leverage its relationship with Celonis as a genuine product advantage, not just an ownership structure?",
				answerSteps: [
					{ label: "Clarify", content: "Is this about go-to-market bundling, or a deeper product integration between Celonis's process intelligence and Make's execution/automation layer?" },
					{ label: "Confirm goal", content: "Most pure-play automation competitors don't have a process-mining parent company — this is a structurally hard-to-copy asset if used well." },
					{ label: "Structure", content: "Consider the natural pairing: Celonis identifies where a business process is broken or inefficient; Make is the layer that actually builds and runs the fix." },
					{ label: "Recommend", content: "Prioritize a concrete product connection (e.g. a Celonis-detected process gap suggesting a Make scenario template) over a purely commercial bundle." },
					{ label: "Metric", content: "% of Celonis enterprise customers who also activate Make, and the reverse." },
				],
			},
		],
	},
	{
		name: "Integration & Template Ecosystem",
		description: "The 3,000+ app integrations and community-built scenario templates that make Make useful on day one for a huge range of use cases.",
		pmGoal: "Grow the ecosystem's breadth and quality through both official partner integrations and a creator community that shares what it builds.",
		keyMetrics: ["Number of live integrations", "Community templates published", "% of new scenarios started from a template"],
		competitors: ["Zapier (largest app ecosystem)", "n8n (open-source community)"],
		sampleQuestions: [
			{
				question: "How would you grow the number of high-quality community-built templates?",
				answerSteps: [
					{ label: "Clarify", content: "Is the bottleneck that too few creators publish templates, or that published templates are low quality/hard to discover?" },
					{ label: "Confirm goal", content: "Templates are a growth-loop lever: they're how a new creator gets their first working scenario fastest, feeding Make's own flywheel." },
					{ label: "Structure", content: "Break the funnel into publish (do creators share what they build), discover (can others find the right template), and adopt (does it actually work for them)." },
					{ label: "Recommend", content: "Add a lightweight in-product prompt to publish a template right after a creator successfully runs a novel scenario, when the motivation to share is highest." },
					{ label: "Metric", content: "Templates published per month, and the % of new scenarios that start from one." },
				],
			},
			{
				question: "A popular third-party integration partner threatens to pull their official integration. How do you respond?",
				answerSteps: [
					{ label: "Clarify", content: "Is this a business dispute (pricing, competitive conflict) or a technical/maintenance burden issue on the partner's side?" },
					{ label: "Confirm goal", content: "Losing a popular integration directly breaks working scenarios for real creators who depend on it running unattended." },
					{ label: "Structure", content: "Assess blast radius: how many active scenarios depend on this integration, and is there a viable alternative path (a community-maintained connector, an API-based workaround)." },
					{ label: "Recommend", content: "Negotiate a transition window and communicate proactively with affected creators well before any integration is actually pulled, rather than a silent removal." },
					{ label: "Metric", content: "% of affected scenarios successfully migrated or still functioning by the time the transition window closes." },
				],
			},
		],
	},
];

export const MAKE_TEAM_STRUCTURE: WorkingNorm[] = [
	{
		title: "Prague-based product & engineering team",
		description: "Make originated as Integromat in Prague, and even after Celonis's 2020 acquisition, it kept its own dedicated product and engineering organization based there rather than being absorbed into Celonis's broader org.",
	},
	{
		title: "A business unit within Celonis",
		description: "Make operates with its own product, brand, and roadmap while leveraging Celonis's (a process mining and execution management company) enterprise security, infrastructure, and go-to-market — a structural advantage most standalone automation startups don't have.",
	},
	{
		title: "Community-driven roadmap (Waves)",
		description: "Make's annual community event, Waves, is where major product announcements (like the next-generation AI Agents) get unveiled — reflecting how much the roadmap is shaped by creator feedback and the template-sharing community, not just top-down planning.",
	},
	{
		title: "EU-native infrastructure",
		description: "Make positions its infrastructure around EU data residency and GDPR-friendly hosting — a real differentiator for EU enterprise customers versus competitors that are mostly US-headquartered and -hosted.",
	},
];

export const MAKE_RECENT_NEWS: NewsItem[] = [
	{
		title: "Next-generation Make AI Agents unveiled at Waves",
		summary:
			"Make introduced the next generation of Make AI Agents at its annual Waves community event, doubling down on visual properties and transparency and letting creators grow from deterministic workflows to adaptive, agentic intelligence with visual orchestration.",
		date: "2026-02",
		source: "https://www.make.com/en/blog/next-generation-make-AI-agents",
	},
	{
		title: "Make expands Enterprise (Make ONE) features",
		summary:
			"Make rolled out additional enterprise-specific features — SSO, audit logs, Databricks connectivity, and custom credit allocation — alongside its AI Agents and MCP toolset, aimed at larger organizations evaluating Make ONE.",
		date: "2026-07",
		source: "https://thebitmasters.com/blog/make-com-ai-update-july-2026-explained",
	},
	{
		title: "Make AI Agents launched in beta",
		summary:
			"Make announced the initial launch of Make AI Agents, adding real-time, decision-making intelligence directly into the no-code environment with access to 30,000+ available actions.",
		date: "2025-04",
		source: "https://www.make.com/en/make-ai-agents-press-release",
	},
];

// ==========================================================================
// RTB House — the third company added to the app (2026-08-26), and the
// first prepping for a Technical Account Manager role rather than a PM
// role. Grounded in real, researched facts: Warsaw-founded 2013, a
// demand-side platform (DSP) built on proprietary deep learning for
// real-time-bidding retargeting, present in 90+ markets with 1,500+
// employees across 30+ offices; its stated mission talks about "a better
// future for online advertising" that's consumer-first and kinder to
// advertisers' budgets; its product leadership names "driving business
// outcomes for clients" as its North Star; main direct competitor is
// Criteo; expanded in 2026 into rtb.com, a self-serve platform bringing its
// deep learning tech to SME e-commerce brands with no minimum budgets.
// Content below is original, paraphrased material — not copied from any
// source (see docs/ai-rules.md) — a starter set the same scale as Make's.
// ==========================================================================

export const META_LAST_UPDATED = "2026-10-02";

export const META_MISSION = "Give people the power to build community and bring the world closer together.";

export const META_FLYWHEEL =
	"More people connecting and sharing across the family of apps (Facebook, Instagram, WhatsApp, Messenger, Threads) -> more content, signal, and time spent -> better-trained ranking and ads models -> more relevant content and more effective ads -> more advertiser demand and ad revenue -> funds both continued engineering investment in the core apps and long-horizon bets (Meta AI, Reality Labs) -> stronger product that attracts and retains more people. Advertising revenue is explicitly what funds the free, ad-supported family of apps as well as Meta's AI and Reality Labs investment, not a separate business running in parallel.";

export const META_BUSINESS_LINES: BusinessLine[] = [
	{
		name: "Family of Apps — Feed & Ads",
		description: "The core business: Facebook and Instagram's ranking systems (Feed, Stories, Reels) paired with the ads auction that monetizes attention across them.",
		pmGoal: "Keep content relevant and engagement genuinely meaningful (not just maximized) while growing ad revenue, since the two can trade off against each other if ranking over-optimizes for raw time spent.",
		keyMetrics: ["Daily active people (DAP)", "Time spent", "Ad revenue / ARPU", "Meaningful social interactions"],
		competitors: ["TikTok", "YouTube", "Snapchat", "X"],
		sampleQuestions: [
			{
				question: "Time spent on Feed is up but meaningful social interactions (comments, shares between friends) are down. How would you investigate?",
				answerSteps: [
					{ label: "Clarify", content: "Is this specific to one surface (Feed) or app-wide? Over what timeframe, and is it a gradual drift or a step change?" },
					{ label: "Confirm goal", content: "Time spent alone isn't the real goal — meaningful interaction is what sustains long-term trust and retention, so this gap is worth taking seriously even if the headline metric looks fine." },
					{ label: "Structure", content: "Segment by content type: is the mix shifting toward more passive consumption (Reels, public Pages) and away from friends-and-family posts?" },
					{ label: "Recommend", content: "If ranking has drifted toward highly engaging but passive content, rebalance the ranking signal to weight friend/family interactions more, and test the impact on both metrics together." },
					{ label: "Metric", content: "Track meaningful social interactions and time spent together as a guardrail pair, not meaningful interactions in isolation — a fix that tanks time spent isn't actually a win either." },
				],
			},
			{
				question: "How would you decide whether a new ranking model change is ready to launch to everyone?",
				answerSteps: [
					{ label: "Clarify", content: "What specifically changed in the model, and what was it meant to improve?" },
					{ label: "Confirm goal", content: "A ranking change needs to improve the target metric without quietly degrading content quality, diversity, or advertiser outcomes." },
					{ label: "Structure", content: "Review offline model-quality metrics first, then a staged online rollout starting with a small percentage of people." },
					{ label: "Recommend", content: "Launch to a small, randomized slice with a holdback group, watch both the target metric and a defined set of guardrails (content diversity, integrity signals, ad performance) before expanding." },
					{ label: "Metric", content: "Primary metric improves with statistical significance and no guardrail regresses beyond an agreed threshold before expanding to 100%." },
				],
			},
		],
	},
	{
		name: "Reels & Short-Form Video",
		description: "Short-form video across Instagram and Facebook, built to compete directly with TikTok, combining a recommendation-driven discovery feed with creator monetization tools.",
		pmGoal: "Win attention in short-form video specifically by getting recommendation quality and creator incentives right at the same time — strong recommendations without enough creator supply, or vice versa, both fail.",
		keyMetrics: ["Reels watch time", "Creator retention / upload rate", "Session frequency from Reels", "Ad load / ad revenue from Reels"],
		competitors: ["TikTok", "YouTube Shorts", "Snapchat Spotlight"],
		sampleQuestions: [
			{
				question: "How would you decide whether to show someone more Reels from accounts they follow versus more from accounts recommended to them?",
				answerSteps: [
					{ label: "Clarify", content: "Is this about the default Reels tab specifically, or short-form video placement across the whole app?" },
					{ label: "Confirm goal", content: "The goal is sustained long-term engagement and discovery of new creators, not just maximizing today's watch time." },
					{ label: "Structure", content: "Frame it as explore vs. exploit: following-only content is safer but caps discovery; too much recommended content risks feeling irrelevant." },
					{ label: "Recommend", content: "Personalize the ratio based on how much a given person already engages with recommended content, rather than a single fixed ratio for everyone." },
					{ label: "Metric", content: "Long-term retention and the rate of following new creators discovered through recommendations, not just same-session watch time." },
				],
			},
			{
				question: "Reels creator uploads have plateaued even as watch time keeps growing. How would you think about this?",
				answerSteps: [
					{ label: "Clarify", content: "Is this plateau broad across all creators, or concentrated in a specific segment (e.g. smaller/newer creators)?" },
					{ label: "Confirm goal", content: "Watch time depends on a healthy, growing supply of content — a plateaued creator base is a leading indicator of a future supply problem even if watch time looks fine today." },
					{ label: "Structure", content: "Separate the funnel: are fewer new creators starting, or are existing creators posting less?" },
					{ label: "Recommend", content: "If existing creators are posting less, investigate monetization and discoverability for mid-tier creators specifically — the segment most likely to churn if they don't see growth." },
					{ label: "Metric", content: "Creator retention rate by tier, and what share of watch time comes from creators who joined in the last 6-12 months." },
				],
			},
		],
	},
	{
		name: "Meta AI & Generative AI",
		description: "Meta's AI assistant (Meta AI) embedded across Facebook, Instagram, WhatsApp, and Messenger, built on Meta's own foundation models, plus generative AI tools for advertisers (e.g. automated ad creative).",
		pmGoal: "Decide where a conversational AI assistant genuinely helps inside an existing social/messaging product versus where it's a novelty feature that doesn't earn its place in the interface.",
		keyMetrics: ["Meta AI weekly active users", "Query-to-satisfaction rate", "Advertiser adoption of AI creative tools", "Incremental ad performance from AI-generated creative"],
		competitors: ["OpenAI (ChatGPT)", "Google (Gemini)", "xAI (Grok, via X/Threads integration)"],
		sampleQuestions: [
			{
				question: "How would you decide whether to let Meta AI respond automatically inside a public Threads post versus requiring the user to explicitly ask for it?",
				answerSteps: [
					{ label: "Clarify", content: "Is this about replies to a user's own post, or Meta AI commenting on other people's public posts?" },
					{ label: "Confirm goal", content: "The feature needs to feel genuinely useful and trustworthy, not intrusive — a public, unsolicited AI reply carries real brand and trust risk at Meta's scale." },
					{ label: "Structure", content: "Weigh the UX benefit (lower friction, more usage) against the risk of unwanted or embarrassing AI output appearing publicly without consent." },
					{ label: "Recommend", content: "Start opt-in and explicit (e.g. '@Meta AI, is this true?') rather than automatic, and only consider loosening that once trust and output quality are proven at scale." },
					{ label: "Metric", content: "Opt-in usage rate and user-reported satisfaction/complaint rate, tracked before considering any move toward more automatic behavior." },
				],
			},
			{
				question: "How would you measure whether Meta AI is actually succeeding inside Messenger?",
				answerSteps: [
					{ label: "Clarify", content: "Succeeding at what — retention, task completion, or reducing load on human support/search elsewhere?" },
					{ label: "Confirm goal", content: "An assistant embedded in a messaging app should make the app itself more useful, not just generate standalone AI usage." },
					{ label: "Structure", content: "Separate usage metrics (how often people engage it) from quality metrics (whether it actually resolved what they needed) from downstream metrics (effect on overall Messenger engagement and retention)." },
					{ label: "Recommend", content: "Track a satisfaction/resolution signal (e.g. explicit feedback or a proxy like not re-asking the same thing) alongside usage, not usage alone." },
					{ label: "Metric", content: "Query resolution rate and whether Messenger users who use Meta AI retain better than a matched group who don't, controlling for existing engagement level." },
				],
			},
		],
	},
];

export const META_TEAM_STRUCTURE: WorkingNorm[] = [
	{
		title: "Cross-functional pods, Family of Apps org",
		description: "PMs sit in small cross-functional pods with engineering, design, and data science, nested inside the larger Family of Apps organization (separate from Reality Labs) — the PM is expected to drive the pod's roadmap, not just coordinate it.",
	},
	{
		title: "'Focus on Impact' shapes performance review, not just the roadmap",
		description: "Impact — the measurable outcome of what you shipped — is explicitly what performance reviews are graded on, which pushes PMs toward work with a clear, measurable result over busywork or effort for its own sake.",
	},
	{
		title: "A/B testing is the default decision-making tool",
		description: "At Meta's scale, most meaningful product changes ship behind an experiment before a full launch — a PM is expected to reason in terms of experiment design and guardrail metrics as a matter of course, not just for big launches.",
	},
	{
		title: "Advertising funds the free, ad-supported product",
		description: "Facebook, Instagram, WhatsApp, and Threads are free to use; the business is funded almost entirely by advertising, which is why ad revenue and Reality Labs/AI investment are discussed together in earnings — growth in one funds the other.",
	},
];

export const META_RECENT_NEWS: NewsItem[] = [
	{
		title: "Meta launches Muse Spark, its most capable in-house model yet",
		summary:
			"Meta Superintelligence Labs introduced Muse Spark, described as Meta's most powerful model to date — part of its continued push to build frontier in-house AI models that power Meta AI and other products across the family of apps.",
		date: "2026-04",
		source: "https://about.fb.com/news/2026/04/introducing-muse-spark-meta-superintelligence-labs/",
	},
	{
		title: "Threads tests a Grok-like Meta AI integration",
		summary:
			"Threads began testing a feature letting public accounts mention Meta AI directly in a post or reply to get more context on it — similar in concept to X's Grok integration — piloted in a handful of markets before any broader rollout.",
		date: "2026-05",
		source: "https://techcrunch.com/2026/05/12/threads-tests-a-meta-ai-integration-that-works-similarly-to-grok/",
	},
	{
		title: "Q2 2026 earnings: ad revenue up 28%, Reality Labs loses $4.6B",
		summary:
			"Meta's Q2 2026 results showed advertising revenue growing 27% year-over-year to roughly $59.4 billion, while Reality Labs' operating loss widened to about $4.6 billion — a concrete illustration of how the ads business funds Meta's long-horizon AI and Reality Labs bets.",
		date: "2026-07",
		source: "https://www.cnbc.com/2026/07/29/metas-reality-labs-lost-over-4point6-billion-in-second-quarter.html",
	},
];

// ==========================================================================
// Aggregated by company so CompanyKnowledge.tsx can render whichever one the
// user has selected (see App.tsx's practice-page selector for the
// equivalent pattern on the Practice page).
// ==========================================================================

export interface CompanyKnowledgeData {
	lastUpdated: string;
	mission: string;
	flywheel: string;
	businessLines: BusinessLine[];
	teamStructure: WorkingNorm[];
	recentNews: NewsItem[];
}

export const COMPANY_KNOWLEDGE: Record<"amazon" | "make" | "meta", CompanyKnowledgeData> = {
	amazon: {
		lastUpdated: AMAZON_LAST_UPDATED,
		mission: AMAZON_MISSION,
		flywheel: AMAZON_FLYWHEEL,
		businessLines: AMAZON_BUSINESS_LINES,
		teamStructure: AMAZON_TEAM_STRUCTURE,
		recentNews: AMAZON_RECENT_NEWS,
	},
	make: {
		lastUpdated: MAKE_LAST_UPDATED,
		mission: MAKE_MISSION,
		flywheel: MAKE_FLYWHEEL,
		businessLines: MAKE_BUSINESS_LINES,
		teamStructure: MAKE_TEAM_STRUCTURE,
		recentNews: MAKE_RECENT_NEWS,
	},
	meta: {
		lastUpdated: META_LAST_UPDATED,
		mission: META_MISSION,
		flywheel: META_FLYWHEEL,
		businessLines: META_BUSINESS_LINES,
		teamStructure: META_TEAM_STRUCTURE,
		recentNews: META_RECENT_NEWS,
	},
};
