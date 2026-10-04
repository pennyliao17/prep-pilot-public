// Static reference content — not user data, so (like companyKnowledgeData.ts)
// this lives in the bundle rather than the database.
//
// Three parts (2026-09):
// 1. A cheat sheet — compact, scannable reference tables/diagrams for the
//    concepts that don't need a full worked-example treatment (interview
//    framework, API/communication patterns, scalability, caching, consistent
//    hashing, CAP theorem, CDNs, monitoring, a database-by-cloud-provider
//    matrix). This replaces an earlier, much longer prose "Building Blocks"
//    section that covered similar ground — this version is deliberately
//    terse, styled after two cheat-sheet infographics the user shared,
//    re-checked against the source article below for concept coverage.
// 2. Common interview questions with full worked example answers, written as
//    spoken answers (first person, the way you'd actually talk through it,
//    not a spec doc) while still following the article's 5-step framework —
//    each beat is marked inline as **[Requirements]**, **[High-level
//    design]**, etc. so the structure stays visible under the words. The
//    source article only lists question prompts by category, not answers —
//    these are original walkthroughs.
// 3. An AI/LLM infrastructure knowledge base (batch inference, GPU cluster
//    management, RAG, LLM rate limiting) — also original explanatory
//    content; the source article only names these terms without explaining
//    them.
//
// Question framing and category structure are pulled from
// https://www.tryexponent.com/blog/system-design-interview-guide (2026);
// the explanations and example answers below go well beyond what that
// article covers.

export interface GuideItem {
	id: string;
	label: string;
	// A one-line plain-language analogy — sits above the diagram as a fast
	// "what is this, actually" before the full explanation. English-only,
	// same as the rest of the app (see the i18n removal in
	// the private retrospective §2.5).
	eli5En?: string;
	body: string;
}

export interface GuideSection {
	id: string;
	title: string;
	intro?: string;
	items: GuideItem[];
}

export const SYSTEM_DESIGN_GUIDE_SOURCE = "https://www.tryexponent.com/blog/system-design-interview-guide";

export const SYSTEM_DESIGN_GUIDE: GuideSection[] = [
	{
		id: "cheat-sheet",
		title: "Cheat Sheet",
		intro: "Fast, scannable reference for the concepts underneath every worked example below — tables and diagrams first, just enough prose to know when to reach for each one. Skim this before an interview; go deep in the worked examples.",
		items: [
			{
				id: "cs-framework",
				label: "Interview Framework",
				body: `| Step | Time | Focus |
| --- | --- | --- |
| **1. Clarify Requirements** | 5–8 min | Functional and non-functional needs — scale, latency, consistency, constraints. |
| **2. High-Level Design** | 8–10 min | Sketch how the pieces fit together, starting from the API. |
| **3. Deep Dive** | 10–15 min | Pick the one or two components that matter most and go deep — normal traffic, failure modes, edge cases. |
| **4. Scale, Cost & Ops** | 5–8 min | Bottlenecks, monitoring, failure recovery, cost trade-offs (reserved vs. spot capacity), operational maturity. |
| **5. Wrap Up** | 3–5 min | Summarize trade-offs, justify the calls you made, name what you'd improve with more time. |

Every worked example below follows this same shape — look for the **[Requirements]** / **[High-level design]** / **[Deep dive]** / **[Scale, cost, operations]** / **[Trade-offs]** labels running through each one.`,
			},
			{
				id: "cs-api-patterns",
				label: "API Design & Communication Patterns",
				eli5En:
					"Phone calls, texts, letters, and video calls are all \"communication\" — you just pick the one that fits the occasion, not the phone every time. Choosing an API protocol and communication pattern works the same way.",
				body: `The protocol should follow from the shape of the interaction, not default to whatever's familiar.

| | REST | RPC (e.g. gRPC) | GraphQL |
| --- | --- | --- | --- |
| **Style** | Resource-oriented (\`/users/123/orders\`), stateless | Action-oriented, binary, strongly typed | Single endpoint, client picks exactly which fields it wants |
| **Data** | JSON, XML, plain text | Protobuf, Thrift, FlatBuffers | JSON |
| **Best for** | Public APIs, web/cloud apps — the default absent a specific reason otherwise | Low-latency internal service-to-service calls, IoT | Clients with very different data needs hitting the same backend (mobile vs. web dashboard) |

### Communication patterns
- **Synchronous:** the caller blocks waiting for a response. Simple, but every hop's latency stacks up, and a slow downstream service slows everyone above it.
- **Async messaging:** the producer drops a message on a queue and moves on; a consumer processes it whenever it's ready. Decouples the two services' uptime and pace from each other.
- **Publish/Subscribe:** one event fans out to any number of independent subscribers, without the publisher knowing who — or how many — are listening.

A fourth option belongs on this list even though it isn't request/response at all: **WebSockets** — a persistent, bidirectional connection for anything the server needs to push without being asked (chat, live notifications, collaborative editing).`,
			},
			{
				id: "cs-scalability",
				label: "Scalability: Load Balancing, Replication & Sharding",
				eli5En:
					"A restaurant chain scaling up: hire more waiters to split the crowd (load balancing), keep copies of the menu at every branch so one fire doesn't lose it (replication), and split the seating into sections each handling its own regulars (sharding) — three different moves for the same problem: more volume than one location can handle.",
				body: `Three different moves for the same underlying problem — more load than one server or one dataset can handle.

**Load balancing** spreads incoming traffic across a pool of servers so no single one gets overwhelmed — this is how you scale horizontally (add more servers) instead of only vertically (make one bigger). Layer 4 routes on IP/port alone (fast, protocol-agnostic); Layer 7 reads the request itself and can route by path or keep a session pinned to one backend.

**Replication** keeps multiple copies of the same data on different nodes, for durability (a disk failure doesn't lose data) and read scaling (spread reads across replicas). The core trade-off is synchronous (safer, slower, blocks on the slowest replica) vs. asynchronous (faster, a small window of possible data loss on a crash).

**Sharding** splits one dataset across multiple nodes so each holds only a subset — this is what scales *writes* past what a single machine can handle, which replication alone doesn't solve (every replica still holds the full dataset). The real decision is the shard key: a bad one creates a "hot shard" that absorbs disproportionate traffic (e.g. sharding by user ID, until one celebrity account's shard eats 100x the load of every other shard).`,
			},
			{
				id: "cs-caching",
				label: "Caching",
				eli5En:
					"You don't flip through the whole dictionary every time you need a word — you jot the common ones on a sticky note on your desk. The cache is that sticky note; the database is the thick dictionary.",
				body: `Caching stores a copy of frequently-read or expensive-to-compute data somewhere faster than its source of truth, so repeat reads don't hit the database or redo the work.

### In-memory vs. distributed
- **In-memory (in-process):** fastest — no network hop — but not shared across instances, and lost on restart.
- **Distributed (Redis, Memcached):** shared across every instance and survives an individual instance restarting, at the cost of a network round trip.

### Write strategies
- **Cache-aside (read-through):** app checks the cache, misses, reads the DB, writes the result into the cache. Simple; the first read after a miss is slow.
- **Write-through:** every write updates the cache and DB together. Cache is never stale; writes are slower.
- **Write-behind (write-back):** writes hit the cache immediately, flushed to the DB async. Fast writes; a crash before the flush can lose data.
- **Write-around:** writes go straight to the DB, skipping the cache — good when written data is rarely read back right away.

### Eviction policies
LRU (least recently used), LFU (least frequently used), FIFO, MRU (most recently used), random eviction, and TTL-based expiration — the choice is about which item you'd rather lose first once the cache is full. The harder problem is invalidation, not eviction: deciding *when* a cached value has gone stale, not just which one to drop.`,
			},
			{
				id: "cs-consistent-hashing",
				label: "Consistent Hashing",
				eli5En:
					"Like musical chairs where both the people and the chairs stand in the same circle, each claiming the nearest chair ahead of them. Add or remove one chair and only the people next to it need to move — everyone else stays put.",
				body: `A technique for distributing data (or requests) across nodes such that adding or removing a node only reshuffles a small fraction of the keys, instead of nearly all of them.

With naive hashing (\`hash(key) % number_of_nodes\`), adding or removing one node changes the modulus, reassigning almost every key — a near-total cache wipe, or a massive database rebalance. Consistent hashing instead places nodes and keys on the same circular "ring"; a key belongs to the next node clockwise from it, so only the keys between a changed node and its neighbor move. Virtual nodes (each physical node getting several points on the ring) smooth out uneven load.

Shows up in distributed caches (scaling the cache tier without a cache-wide wipe) and distributed databases/DHTs — it's the specific mechanism behind *which* shard a key lands on in sharding, above.`,
			},
			{
				id: "cs-cap-theorem",
				label: "CAP Theorem",
				eli5En:
					"The moment the network drops, you get one choice: \"close up and wait for the signal to come back\" (better to serve nothing than serve something wrong), or \"keep selling off yesterday's numbers\" (better to serve something stale than nothing). Before the outage, you could have both.",
				body: `During a network partition (some nodes can't talk to others — and in any real distributed system, this *will* happen eventually), you have to choose between **Consistency** (every read gets the most recent write, or an error) and **Availability** (every request gets a response, even if stale).

- **CP (consistency over availability):** a node that can't confirm it has the latest data refuses the request rather than risk staleness. Good for financial balances, inventory counts — anywhere a wrong-but-fast answer is worse than an honest failure.
- **AP (availability over consistency):** every node answers with what it has, reconciling later ("eventual consistency"). Good for social likes, view counts, a shopping cart — a moment of staleness is a fine trade for always responding.

Quick test: if this part of the system momentarily returns wrong-but-available data, does someone lose money or oversell inventory? → **CP**. Is the worst case "a like count is briefly off by one"? → **AP**. Most systems are CP in one place (payments) and AP in another (recommendations), not one everywhere.`,
			},
			{
				id: "cs-cdns",
				label: "CDNs",
				eli5En:
					"A convenience store opens a branch in every neighborhood instead of making everyone drive to the central warehouse. A CDN does the same — the popular stuff gets pre-stocked at the branch closest to you.",
				body: `Caches static content — images, video, JS/CSS bundles, even short-TTL cacheable API responses — at edge locations physically close to users, so a request in Singapore doesn't round-trip to a data center in Virginia.

Anything the same for every user and slow-changing belongs on a CDN: media, static assets, public pages. Skipping it is a real gap for any prompt involving video or a globally distributed user base — "a CDN would absorb most of this read traffic before it reaches our servers" is a strong, low-effort line for the scale step. The trade-off to name: cache invalidation — versioned URLs/filenames sidestep it entirely when an asset changes.`,
			},
			{
				id: "cs-monitoring",
				label: "Monitoring & Observability",
				eli5En:
					"Like a car's dashboard — the RPM and fuel gauges (metrics: is it healthy right now), the dash-cam footage (logs: replay exactly what happened), and the route history in your GPS (traces: see where the time actually went).",
				body: `| Pillar | What it is | Reach for it when |
| --- | --- | --- |
| **Logs** | Discrete, timestamped records of events | Something broke once and you need to know exactly what happened on one specific request |
| **Metrics** | Numeric time-series (request rate, error rate, p50/p99 latency) | You want to know if the system's degrading right now, and get paged before it's an outage |
| **Traces** | Follow one request across every service it touches | Latency is bad and you don't know which of five downstream services is the culprit |

Naming what you'd alert on (error rate crossing a threshold, p99 latency, queue backlog growing) unprompted during the scale/cost/ops step is the difference between "I know monitoring exists" and "I've operated a system in production."`,
			},
			{
				id: "cs-database-cheatsheet",
				label: "Database Cheat Sheet",
				eli5En:
					"A relational database is a neatly ruled spreadsheet where everything lines up and cross-references cleanly. Every non-relational shape (key-value, document, time-series, graph...) is a differently-shaped storage bin — contents don't have to match, you just need to grab and stash fast. This table is the quick lookup for \"what's this called on AWS vs. Azure vs. GCP.\"",
				body: `The database choice should follow from access patterns and consistency needs, not habit — name the specific engine and justify it against your requirements, not just the category ("NoSQL scales better" reads as memorized; "writes are append-only and we scan by time range, so a wide-column store beats relational here" reads as senior).

| Data shape | Use case | AWS | Azure | GCP | Cloud-agnostic |
| --- | --- | --- | --- | --- | --- |
| **Relational** | ACID transactions (OLTP) | RDS, Aurora | Azure SQL Database | Cloud SQL, Cloud Spanner | PostgreSQL, MySQL, SQL Server, Oracle |
| **Columnar** | Analytics (OLAP) | Redshift | Azure Synapse | BigQuery | ClickHouse, Druid, Pinot, Spark |
| **Key-value** | Simple lookups by key | DynamoDB | Cosmos DB | Bigtable | Redis, ScyllaDB, Ignite |
| **In-memory / cache** | Sub-millisecond reads | ElastiCache | Azure Cache for Redis | Memorystore | Redis, Valkey, Memcached, Hazelcast |
| **Wide-column** | Massive write throughput | Keyspaces | Cosmos DB | Bigtable | HBase, Cassandra, ScyllaDB |
| **Time series** | Metrics, sensor data | Timestream | Cosmos DB | Bigtable, BigQuery | OpenTSDB, InfluxDB, ScyllaDB |
| **Immutable ledger** | Audit trail, tamper-evident history | QLDB | Azure SQL Database Ledger | — | Hyperledger Fabric |
| **Geospatial** | Location & geo-entities | Keyspaces | Cosmos DB | Bigtable, BigQuery | Solr, PostGIS, MongoDB (GeoJSON) |
| **Graph** | Entity relationships | Neptune | Cosmos DB | JanusGraph + Bigtable | Neo4j, OrientDB, Giraph |
| **Vector** | Embeddings & similarity search | OpenSearch (vector mode) | Azure AI Search | Vertex AI Vector Search | Pinecone, Weaviate, Qdrant, Milvus |
| **Document** | Nested objects (JSON/XML) | DocumentDB | Cosmos DB | Firestore | MongoDB, Couchbase, Solr |
| **Full-text search** | Search across unstructured text | OpenSearch, CloudSearch | Azure AI Search | Search APIs on datastores | Elasticsearch, Solr, Elassandra |
| **Blob / object storage** | Files, images, video | S3 | Blob Storage | Cloud Storage | HDFS, MinIO |`,
			},
		],
	},
	{
		id: "common-questions",
		title: "Common Interview Questions & Example Answers",
		intro: "Eight worked examples spanning the most common question categories, written as spoken answers — the way you'd actually talk through them out loud, not a spec doc. Each one still follows the article's 5-step framework (marked inline in brackets: requirements, high-level design, deep dive, scale/cost/operations, trade-offs), so you can see the shape underneath the words. Reason from these, don't memorize them.",
		items: [
			{
				id: "q-url-shortener",
				label: "Design a URL Shortener (e.g. Bitly)",
				eli5En:
					"You give a long address a short, memorable house number — anyone who enters that number gets automatically routed to the real, much longer address.",
				body: `**[Requirements]** Okay, so first I'd want to nail down what "design a URL shortener" actually means here. Functionally it's simple — take a long URL, give back a short one, and when someone hits the short one, redirect them to the original. The stuff that actually matters is the non-functional side. This is going to be read-heavy — way more people clicking short links than creating them — and redirects need to be fast, because they're sitting right on the critical path of someone's click. I'd also ask: do we need custom aliases, expiration, click analytics? I'll assume basic redirect plus optional analytics, and say I'm leaving auth and abuse prevention out of scope for now.

**[High-level design]** At a high level there's really just two paths. Write path: someone submits a long URL, we generate a short code, we store the mapping. Read path: someone hits the short URL, we look up the code, and redirect. So the whole system is basically one key-value lookup — short code maps to long URL — with a redirect on the read side.

**[Deep dive]** The part I'd actually want to dig into is how you generate that short code, because there are two real options and they trade off differently. One is hash-based — hash the long URL, take the first six or seven characters, base62 encode it. It's simple and deterministic, but you can get collisions, so you need a fallback, like appending a counter and re-hashing. The other is counter-based — you have some globally unique, always-increasing ID, and you base62 encode that instead. No collisions by construction, but now you need a reliable way to generate those IDs without it becoming a bottleneck — a single shared counter that every write hits doesn't scale, so in practice you'd pre-allocate ranges of IDs to each app server instead.

**[Scale, cost, operations]** Given this is read-heavy, I'd cache aggressively — a Redis layer in front of the database, cache-aside, because a small number of links get a disproportionate amount of traffic. Once that's cached, the actual redirect is cheap. The database itself can start as a straightforward key-value store and get sharded later once volume actually demands it. If I wanted to squeeze more latency out, I'd push redirects to the edge — a CDN or edge function — since geography matters a lot for a click-to-redirect flow.

**[Trade-offs]** The one decision I'd flag explicitly is 301 versus 302 redirects. A 301 gets cached by the browser, which is great for load — but it also means I lose visibility into every click if I ever want analytics, and I can't repoint the link later. A 302 keeps every request hitting my server, which costs more but keeps me in control. I'd start with 302 since click tracking is valuable, and revisit if traffic costs start to matter more than that visibility. And honestly, if I had more time, the next thing I'd build is abuse prevention on link creation — nothing here stops someone from spamming the create endpoint right now.`,
			},
			{
				id: "q-rate-limiter",
				label: "Design a Rate Limiter",
				eli5En:
					"Like a theme-park wristband that only lets you ride the same attraction three times an hour — go over, and you wait. It's there to protect the ride (the server) from getting swamped, not to annoy you.",
				body: `**[Requirements]** So the goal here is to stop a client — could be identified by API key, user ID, or IP — from hammering the system past some limit, without that check itself becoming slow, since it sits in front of every single request. I'd clarify: are we protecting ourselves from abuse, or enforcing a billing tier, or both? That actually changes how strict the limiter needs to be, so I'd want an answer before going further.

**[High-level design]** This basically sits as a piece of middleware in front of the API. Every request comes in, we check the client's current usage against their limit — under the limit, let it through and bump the counter; over, reject with a 429 and ideally a Retry-After header so the client knows when to come back. The real design decision is what algorithm you use to track "current usage," because the naive versions have real problems.

**[Deep dive]** There's a handful of options and I'd want to talk through why I'd pick one. Fixed window is the simplest — count requests in the current minute, reset at the boundary — but it lets someone burst up to double their limit right at the window edge, because a burst at 0:59 and another at 1:00 are technically two separate windows. Sliding window log is accurate — you store a timestamp per request and count how many fall in the last N seconds — but memory grows with volume, which isn't great. What I'd actually reach for is token bucket: you've got a bucket that refills at a steady rate, each request costs a token, empty bucket means reject. What I like about it is it naturally allows some burst up to the bucket size while still enforcing a long-run average — that's basically what most real-world API rate limiters do, including the big LLM APIs, because "steady rate plus some burst tolerance" is what you actually want.

**[Scale, cost, operations]** If this is one server, an in-memory counter is fine. The moment you've got multiple API servers, that counter needs to live somewhere shared — Redis, usually, with an atomic increment plus a TTL, or a Lua script if you need the token-bucket logic to be atomic. And then Redis itself becomes a thing you have to think about at very high scale — either you shard the limiter state by client key, or you accept a bit of approximation, where each server tracks a local budget and syncs periodically instead of hitting Redis on every single request.

**[Trade-offs]** That's really the trade-off I'd want to name explicitly — strict accuracy against a shared source of truth costs you latency and a hard dependency on every request; approximate local limiting is faster and more resilient, but a client can slightly exceed their limit during the sync window. For most abuse-prevention use cases I'd take the approximate version. If this were enforcing something like a hard billing quota, I'd eat the latency cost and go with the accurate version instead.`,
			},
			{
				id: "q-notification-system",
				label: "Design a Notification System",
				eli5En:
					"A warehouse doesn't call every customer one by one when an order ships — it pins a notice to a bulletin board, and whoever's job it is to send the email, push, or text just picks it up from there.",
				body: `**[Requirements]** Design a notification system — I'd first ask what's actually triggering these. Comments, price drops, order updates, that kind of thing? And what channels — push, email, SMS, in-app? I'll assume all of the above, potentially fanning out to millions of users, and the thing I care about most on the non-functional side is that this can never become a bottleneck for the services actually triggering the events — the order service shouldn't be waiting around on notifications to finish before it can move on.

**[High-level design]** So instead of the order service calling a notification service directly and waiting, it just publishes an event — "order 123 shipped" — onto a queue and moves on. A notification service consumes those events, figures out who needs to be told and how, checks their preferences, and dispatches to the right channel handler. Each of those channel handlers — push, email, SMS — is usually its own async, retried thing too.

**[Deep dive]** The part worth digging into is preferences and delivery guarantees. Preferences — which channels, quiet hours, opted out — shouldn't live in the triggering event, because the order service has no business knowing whether someone muted push notifications. So that argues for a dedicated preferences store the notification service checks per event, right before dispatch. On delivery, I'd design this as at-least-once, meaning it's better to occasionally double-notify someone than silently drop a notification. That pushes the responsibility for handling duplicates onto the client — give every notification a unique ID so a duplicate push doesn't render twice — which I think is the right trade to make.

**[Scale, cost, operations]** The scaling risk here is fan-out — one popular event, say a celebrity's post blowing up, can generate a huge burst of individual notification jobs all at once. The queue is what absorbs that burst so the producing service never feels it, and consumers just scale horizontally to work through the backlog. One thing I'd flag: the third-party providers — APNs, FCM, Twilio — have their own rate limits, so the dispatch layer needs its own backoff-and-retry logic per provider, separate from whatever's happening on my internal queue. And on cost, SMS is meaningfully more expensive than push or email per message, so anything high-volume and low-urgency, I'd default away from SMS.

**[Trade-offs]** The trade-off I'd call out is real-time versus batched delivery. A security alert needs to go out immediately. A daily activity digest is actually better batched — less noisy for the user, and cheaper for me. So I wouldn't design this assuming every notification is urgent; I'd want the preferences and dispatch layer to support both from day one.`,
			},
			{
				id: "q-social-feed",
				label: "Design a Social Media Feed (Instagram/Twitter-style)",
				eli5En:
					"If every post had to be instantly stuffed into every follower's mailbox, one post from a celebrity with a million followers would flood the whole system. So an average post gets pushed right away, while a celebrity's post just waits for followers to open the app and go fetch it.",
				body: `**[Requirements]** "Design Instagram" is broad, so I'd scope it down — I'll focus specifically on the feed: users post, and users see roughly reverse-chronological posts from people they follow. I'm going to leave things like Stories, DMs, and search out of scope. The thing that makes this hard isn't posting, it's read volume. Viewing a feed happens constantly compared to posting, so this needs to be fast and read-optimized, for potentially hundreds of millions of users.

**[High-level design]** There's really two pieces of data — the posts themselves, and the social graph, who follows whom. And the interesting design decision, honestly, is when you actually assemble someone's feed — at write time, when a post goes out, or at read time, when someone opens the app.

**[Deep dive]** This is the part I'd want to spend most of the time on, because both extremes have a real problem. Fan-out on write means the moment you post, it gets pushed into the precomputed feed of every one of your followers — reads become trivially fast, just fetch your feed. But if you've got a few million followers, one post just became a few million writes. That's the celebrity problem. Fan-out on read is the opposite — nothing happens on write, and instead, when you open your feed, the system goes and fetches recent posts from everyone you follow and merges them live. Cheap writes regardless of follower count, but now reads get expensive as the number of people you follow grows. What most large systems actually do is a hybrid — fan-out on write for typical accounts, and for anyone above some follower threshold, their posts get merged in at read time instead of pushed everywhere. So a celebrity's post doesn't spam millions of precomputed feeds — it just gets pulled in live for the relatively small number of people actively looking at their feed right then.

**[Scale, cost, operations]** The precomputed feed itself is usually something like a capped list per user — you really only need to precompute a recent window, not someone's whole feed history. A CDN helps with the actual post content, images and video, but not with feed assembly, since that's inherently personalized per user. If ranking comes into play instead of pure chronological, I'd keep that as its own separate service the feed pulls a score from, rather than baking ranking logic into the fan-out mechanism — they're genuinely different problems and I don't want them coupled.

**[Trade-offs]** So the trade-off is: pure fan-out-on-write is simple but breaks on celebrities; pure fan-out-on-read is simple but gets slow for anyone following a lot of people; the hybrid handles both but it's meaningfully more complex to build and reason about. Honestly, I'd start with plain fan-out-on-write plus a follower-count cutoff — that's the simplest version that actually survives the celebrity case — and treat true ranking as a later iteration, not a v1 requirement.`,
			},
			{
				id: "q-chat-messaging",
				label: "Design a Chat/Messaging App (WhatsApp-style)",
				eli5En:
					"Two walkie-talkies trying to talk need to know which cell tower each one is near right now — only then can the tower figure out where to patch the call through.",
				body: `**[Requirements]** For a WhatsApp-style app, the core requirement is messages between users, ideally arriving in near real time if the recipient's online, and reliably delivered once they come back if they're not. I'd want ordering within a conversation, and delivery status — sent, delivered, read. I'd also ask up front whether end-to-end encryption is required, because — I'll get to this — it actually changes a lot about what the server is even allowed to do.

**[High-level design]** Since the server needs to push messages to a client without the client asking first, this can't be plain request-response — you need a persistent connection, WebSockets, between clients and some set of gateway servers. A message comes in from the sender's client, hits their gateway server, goes to a message service that figures out routing, and if the recipient's online, gets pushed out through their gateway server. And regardless of whether they're online, it gets written to durable storage.

**[Deep dive]** The interesting problem is: with a lot of gateway servers, the sender and the recipient are almost never connected to the same one. So how does the message service know which server to route to? You need some kind of presence registry — I'd reach for Redis, mapping user ID to whichever gateway server they're currently connected to — so the message service can look that up and route correctly. If the recipient's offline entirely, it falls back to a push notification plus the message just sits in storage until they reconnect. And for ordering, I wouldn't trust timestamps across different servers to be reliably ordered, so I'd use a per-conversation sequence number instead — something unambiguous regardless of which server touched the message.

**[Scale, cost, operations]** What's interesting here is the bottleneck isn't request throughput, it's connection count — millions of long-lived WebSocket connections, so gateway servers need to be sized around memory-per-connection, not CPU. Group chats add fan-out, similar to the notification system — one message, N recipients. And message history is write-heavy and append-only, which is a good fit for something like a wide-column store partitioned by conversation.

**[Trade-offs]** Coming back to encryption — if this needs to be end-to-end encrypted, the server can route and store ciphertext, but it can't read the content. That kills any server-side search or moderation on message content, which is a real product trade-off, not just an implementation detail. I'd want that requirement nailed down at the start, because it changes the design, not just a feature bolted on afterward.`,
			},
			{
				id: "q-ride-sharing",
				label: "Design a Ride-Sharing Service (Uber-style)",
				eli5En:
					"A ride-hailing app has to find the nearest driver out of thousands, fast — instead of calculating every driver's distance one by one, it slices the map into a grid and only checks your cell and the neighboring ones.",
				body: `**[Requirements]** For ride-sharing, functionally: a rider requests a trip from A to B, gets matched with a nearby driver, and both sides track the trip in real time. There's pricing and payment too, but I'd want to focus on the part that's actually hard here, which is the matching — finding the right nearby driver, fast, at scale. I'd leave payments mostly out of scope and just note it's a separate concern.

**[High-level design]** Drivers' apps are continuously streaming their location to a location service. When a rider requests a trip, a matching service asks "who's available near this rider right now," picks someone — nearest, or some score involving ETA and rating — and a trip service tracks state as the trip moves from requested to matched to in progress to done, pushed to both apps over a live connection.

**[Deep dive]** The part I'd actually dig into is how you efficiently find nearby drivers, because scanning every driver and computing distance obviously doesn't scale. The standard move is a geospatial index — you divide the map into cells, using something like geohashing, or Uber's own approach with a hexagonal grid — and "drivers near this point" becomes "drivers in this cell and its neighbors," which is a fast lookup instead of a full scan. And because driver locations update every few seconds, this index needs to handle both fast writes and fast proximity reads, which is why you'd usually reach for something in-memory — Redis has geospatial commands, or you build a custom in-memory grid service — rather than a general-purpose database, which just isn't built for that update frequency.

**[Scale, cost, operations]** Location pings are extremely high volume, and honestly most of that data doesn't need durability — you care about a driver's current location, not their full history, for most of what this system does. So I'd treat location as ephemeral, high-throughput data, kept separate from the durable trip records. On the matching side, you need to avoid double-booking a driver if two requests come in concurrently — some kind of atomic claim when a driver gets matched. And geography is a natural shard key — a driver in Taipei is never relevant to someone requesting a ride in Berlin, so I'd shard by region.

**[Trade-offs]** Nearest-driver matching is the simple version, but it's not actually optimal system-wide — sometimes it'd be better to send the second-nearest driver if the nearest one's about to wrap up a longer trip somewhere else. That's a genuinely hard optimization problem, honestly closer to operations research than a system design answer, so I'd start with straightforward proximity matching and call out the more sophisticated version as a quality improvement down the line, not something I'd try to solve in the first pass.`,
			},
			{
				id: "q-video-streaming",
				label: "Design a Video Streaming Service (YouTube/Netflix-style)",
				eli5En:
					"After you upload a video, the system pre-processes it into several quality levels — like printing the same document in large, medium, and small font ahead of time. Good network gets the big font; a weak signal auto-switches to the small one.",
				body: `**[Requirements]** For a streaming service, I'd separate upload from playback, because they're really different problems. On upload, video needs to go through some kind of processing before it's watchable. On playback, users need to stream at a quality that adapts to their network, to a genuinely global audience. I'd call out up front that this is probably the most bandwidth-heavy thing in this whole set of questions — video is expensive to serve, full stop, and that shapes a lot of the design.

**[High-level design]** Upload goes to object storage — S3 or equivalent — and then asynchronously through a transcoding pipeline that produces multiple resolutions and chunks the video up. On playback, the client requests a manifest describing what quality levels and chunks are available, and then streams chunks — and critically, those chunks come from a CDN, not straight from origin storage.

**[Deep dive]** Transcoding is the piece I'd go deep on. Turning one uploaded video into several resolutions and codecs is CPU-heavy and slow, so it always happens async — the uploader sees "processing" for a while. The output gets chunked into a few seconds each, per quality level, using something like HLS or DASH. And here's the thing that's easy to gloss over: the actual adaptive part, where the player switches quality based on your network, happens entirely on the client. The player watches its own buffer health and throughput and decides which quality's chunk to request next. The server's whole job is just making sure every quality level's chunks exist and are reachable — it's not making that decision for the client.

**[Scale, cost, operations]** This is maybe the clearest case where a CDN isn't optional — almost all playback traffic needs to be served from the edge, both for buffering latency and because origin bandwidth at this scale would be enormous otherwise. Storage cost is dominated by keeping multiple transcoded copies of every video around, so a real lever here is not eagerly transcoding every quality level for content nobody's likely to watch — you could transcode the common ones up front and generate the rest lazily, on first request, for the long tail.

**[Trade-offs]** So that's the trade-off — eager transcoding into every quality on upload is simple, but you're burning compute on videos that might get ten views. Lazy transcoding for the long tail saves that cost, but the first person who requests an unusual quality level eats some extra latency waiting for it to generate. I'd default to eager for the common qualities and lazy for the rest, and I'd say that out loud as a deliberate cost decision, not something I just didn't think about.`,
			},
			{
				id: "q-llm-chat-system",
				label: "Design an LLM Chat/Query System",
				eli5En:
					"Asking an AI a question is like ordering food — if the kitchen waited for every order before cooking, you'd wait forever. It's better if the kitchen keeps cooking while slipping in new orders as they arrive, so whoever ordered first gets served first.",
				body: `**[Requirements]** So this one's asking for a system where someone sends a text query, maybe with conversation history, and gets back a generated response from an LLM. What I'd actually push on here is the non-functional side: latency has to feel acceptable, cost can't scale linearly out of control given how expensive this compute actually is, and ideally the answers are grounded in something more current or specific than whatever the model happened to memorize during training.

**[High-level design]** Request comes in through a gateway that handles auth and rate limiting, into an orchestration layer that does a few things — optionally retrieves relevant context based on the query, builds the actual prompt out of system instructions plus that retrieved context plus conversation history plus the new query, sends that off to wherever the model's being served, and — this part matters a lot for how it feels — streams the response back token by token instead of making the user wait for the whole thing.

**[Deep dive]** Here's the thing I'd actually want to talk through, because it's a real tension: streaming wants to start responding immediately, but GPU efficiency wants to batch a bunch of different users' requests together so the GPU doesn't sit half-idle. If you batch the naive way, you're waiting around for a batch to fill before anyone's generation even starts, which directly fights against wanting to stream right away. What actually solves this is continuous batching — sometimes called in-flight batching — where a new request can join a batch that's already generating, at the token level, so nobody's stuck waiting for some batch boundary, and the GPU still stays busy the whole time. I'd bring this up unprompted if the interviewer pushes on latency, because it's exactly the kind of thing that shows you've actually thought about how this gets served, not just how it gets called. (See Batch Inference in the AI/LLM Infrastructure section below.)

**[Scale, cost, operations]** Cost here isn't the usual bandwidth-and-storage story, it's almost entirely GPU time. So the decisions that actually move the needle are batching strategy, how big or quantized the model is, and caching — if the same or a very similar prompt shows up repeatedly, or there's a long shared system prompt, you really don't want to recompute that from scratch every time. Rate limiting also needs to think in tokens, not just requests, because someone asking for a two-sentence answer and someone asking for a five-page summary cost wildly different amounts, even though they're both "one request." And for monitoring, I'd track time-to-first-token separately from tokens-per-second, because those two numbers tell you different things — one's about queueing and batching delay, the other's about raw generation speed.

**[Trade-offs]** The trade-off worth naming is retrieval — pulling in outside context makes answers more accurate and current, but it costs latency, because now there's a lookup before generation can even start, and it costs infrastructure, because you're maintaining a vector store that has to stay fresh. I wouldn't route every single query through retrieval by default; I'd scope it to the query types where the model's built-in knowledge is actually demonstrably not enough.`,
			},
		],
	},
	{
		id: "ai-llm-infra",
		title: "AI/LLM Infrastructure",
		intro: "You don't need to be an ML expert for a 2026 system design interview, but if the company ships AI features you're expected to understand the infrastructure patterns underneath them — the mechanics are classic distributed-systems patterns (queuing, batching, load balancing, async processing) applied to an unusually expensive, unusually bursty compute resource: the GPU.",
		items: [
			{
				id: "batch-inference",
				label: "Batch Inference",
				eli5En:
					"A photocopier is painfully slow one page at a time, so you stack the pages and feed them through together. A GPU works the same way — processing a pile of requests at once is far more efficient than one at a time.",
				body: `Running a model against many inputs together, rather than one at a time, because GPUs are throughput machines — they're most efficient when kept busy on large parallel workloads, and a single request rarely uses a GPU's full capacity.

### Static vs. dynamic vs. continuous batching
- **Static batching:** collect a fixed number of requests (or wait a fixed time window), run them through the model together as one batch, return all results together. Simple, but every request in the batch waits for the *slowest* one to finish, and short requests get stuck behind long ones.
- **Dynamic batching:** batch size and wait time adapt to current load — fill batches faster under high traffic, don't wait as long when traffic is light. Better latency under variable load, still has the "wait for the slowest" problem within a batch.
- **Continuous (in-flight) batching:** the technique behind most modern LLM-serving systems (vLLM and similar). Instead of batching whole requests, it batches at the *token* level — a new request can join a batch already generating tokens for other requests, and a finished request leaves the batch immediately, freeing its slot for someone else. This is what makes streaming-while-batching possible (see the LLM chat system example above) — no one waits for an artificial batch boundary.

### Where this shows up in an interview
"Design a batch inference API for a GPU cluster" (a commonly reported Anthropic prompt) is really asking you to reason about: how requests queue and get grouped, how you keep GPU utilization high without making latency unpredictable, and what happens when the queue backs up faster than the cluster can drain it (backpressure — reject new requests, or let the queue grow with a latency warning, is a real design decision to make explicit).`,
			},
			{
				id: "gpu-cluster-management",
				label: "GPU Cluster Management",
				eli5En:
					"GPUs are expensive and scarce — you can't just buy more like a USB drive. So you need a schedule that decides who gets to use one now, and whose job can be paused for something more urgent.",
				body: `Deciding how a shared pool of GPUs gets allocated across multiple models, teams, or workloads — the resource-scheduling problem, but with a resource that's scarce, expensive, and doesn't scale by just adding cheap commodity instances.

### Why this is a different problem than CPU/general compute scheduling
GPUs are expensive enough that idle capacity is a real cost problem (unlike a CPU server sitting at 20% utilization, an idle GPU is a much bigger waste of money), but they're also scarce/hard to provision on demand, so over-provisioning "just in case" is expensive and under-provisioning causes queueing and latency spikes. This pushes toward careful scheduling rather than the "just autoscale" answer that works for stateless web servers.

### Key mechanisms to know
- **Multi-tenancy / sharing:** multiple models or workloads sharing a GPU cluster need isolation (one team's runaway job shouldn't starve another's) and prioritization (a real-time user-facing request should preempt a batch job).
- **Model/data parallelism:** a model too large to fit on one GPU gets split across several (model parallelism), or the same model runs on multiple GPUs each handling different data in parallel (data parallelism) — worth knowing these exist and roughly what problem each solves, without needing to implement either.
- **Spot vs. reserved capacity:** reserved GPU capacity is expensive but guaranteed; spot/preemptible capacity is much cheaper but can be reclaimed with little notice — a reasonable design uses reserved capacity for baseline load and spot for burst/batch workloads that can tolerate interruption.

### Interview framing
"Prioritize and allocate distributed compute resources across multiple projects" (a reported 2026 prompt) is asking for a scheduling/prioritization policy, not a specific tool — talk about how you'd rank competing requests (SLA tier, cost budget, deadline) and what happens to lower-priority work when the cluster is saturated (queue, downgrade to a smaller/cheaper model, or reject).`,
			},
			{
				id: "rag",
				label: "Retrieval-Augmented Generation (RAG)",
				eli5En:
					"Before the AI answers, let it flip through the company's internal folder or the latest webpage first, pull out the relevant pages, and hand them over alongside the question — so it answers from that fresh material instead of guessing from stale memory.",
				body: `A pattern for giving an LLM access to information it wasn't trained on (private company data, something that changed after training, a large document set it can't hold in context) by retrieving relevant pieces of text and inserting them into the prompt before generation, rather than retraining or fine-tuning the model.

### The pipeline
1. **Indexing (offline, ahead of time):** split source documents into chunks, generate an embedding (a vector representation) for each chunk using an embedding model, store them in a vector database (Pinecone, Weaviate, pgvector, etc.).
2. **Retrieval (at query time):** embed the incoming query the same way, search the vector store for the chunks whose embeddings are closest (most semantically similar) to the query.
3. **Augmentation:** insert the retrieved chunks into the prompt as context, alongside the original query.
4. **Generation:** the LLM generates a response grounded in that injected context, rather than relying only on what it memorized during training.

### Why it's used instead of just fine-tuning
Fine-tuning is expensive, slow to update (retrain every time the underlying data changes), and doesn't give you a clean way to cite sources. RAG's knowledge source is just data in a database — update the vector store and the next query sees the new information immediately, no retraining. It also reduces hallucination on facts the retrieved context actually covers, and lets you show users *what* was retrieved as a citation/source.

### What's worth knowing beyond the basic pipeline
**Re-ranking:** the initial vector search often returns "similar" but not necessarily "most useful" results, so a second, more precise (and more expensive) re-ranking step over the top-K candidates improves quality before the final few chunks go into the prompt. **Chunking strategy** (how documents are split) materially affects retrieval quality — too large and irrelevant text dilutes the useful part; too small and you lose surrounding context. **Freshness** — if the underlying documents change frequently, the indexing pipeline needs to be a real, monitored system (not a one-time script), which is itself a data-pipeline design problem layered on top of the retrieval problem.`,
			},
			{
				id: "llm-rate-limiting",
				label: "Rate Limiting for LLM APIs",
				eli5En:
					"A normal limit is \"three orders an hour,\" but an AI service should charge by portion size instead — a one-word question and a 5,000-word report aren't the same order, so the limit is counted in words (tokens), not in orders.",
				body: `Rate limiting an LLM API has to account for a cost dimension that a typical web API doesn't have: requests are wildly unequal in cost, because cost scales with tokens processed (both input and output), not with the request itself.

### Why request-count limiting isn't enough
A rate limiter that just counts "requests per minute" treats a one-word query and a request asking to summarize a 50-page document as equivalent — but the second one might cost 100x more in compute. Production LLM rate limits are typically expressed (and enforced) in **tokens per minute**, often *in addition to* requests per minute, to bound actual cost/compute exposure rather than just request volume.

### Mechanism
Token bucket (see the Rate Limiter worked example above) is a natural fit — refill the bucket at a steady token-rate, and each request consumes tokens from it. The complication specific to LLMs: you often don't know the exact output token count *before* generation happens (the response length isn't known in advance), so systems either estimate conservatively upfront and reconcile after, or track consumption against the budget as tokens actually stream out.

### Other LLM-specific considerations
- **Tiered limits:** different limits per pricing tier or customer, sometimes with separate limits for different model sizes (a cheap, fast model might have a much higher rate limit than an expensive, slow one).
- **Queuing over hard rejection:** because generation is often not truly latency-critical to the millisecond, some systems queue excess requests with a delay instead of hard-rejecting at the limit, trading a bit of latency for a better experience than a flat error.
- **Streaming and rate limits interact:** if a client cancels a streaming response partway through, does the rate limiter charge for tokens generated so far, or the full requested length? This needs an explicit answer, not an accident of implementation.

### Interview framing
If asked to design rate limiting for an LLM API, the strongest answer explicitly separates "protecting the system from overload" (requests/second, straightforward) from "controlling cost exposure" (tokens/minute, LLM-specific) — naming both dimensions is the signal an interviewer is listening for.`,
			},
		],
	},
];
