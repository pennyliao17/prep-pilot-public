import type { ReactNode } from "react";

// Small, hand-rolled SVG diagrams for the System Design Guide's cheat sheet,
// worked example answers, and AI/LLM infrastructure notes — a fast visual of
// the shape each concept describes, sitting above the prose explanation
// (which stays the primary, complete content). A few cheat-sheet items cover
// more than one concept (Scalability, Communication Patterns), so those get
// a small composite component stacking several labeled diagrams together
// instead of one-diagram-per-item. Deliberately plain inline SVG (no
// charting/diagramming library) to match the project's dependency-light
// approach, styled with the app's own ink/cream/green design tokens rather
// than a separate diagram palette.

function Box({
	x,
	y,
	w,
	h,
	label,
	sublabel,
	fill,
}: {
	x: number;
	y: number;
	w: number;
	h: number;
	label: string;
	sublabel?: string;
	fill?: string;
}) {
	return (
		<g>
			<rect x={x} y={y} width={w} height={h} rx={8} fill={fill ?? "var(--card-bg)"} stroke="var(--ink)" strokeWidth={1.5} />
			<text
				x={x + w / 2}
				y={y + h / 2 + (sublabel ? -6 : 0)}
				textAnchor="middle"
				dominantBaseline="middle"
				fontSize={12}
				fontWeight={600}
				fill="var(--ink)"
			>
				{label}
			</text>
			{sublabel && (
				<text x={x + w / 2} y={y + h / 2 + 11} textAnchor="middle" dominantBaseline="middle" fontSize={9.5} fill="var(--ink-muted)">
					{sublabel}
				</text>
			)}
		</g>
	);
}

function Arrow({
	x1,
	y1,
	x2,
	y2,
	label,
	markerId,
	dashed,
	bothEnds,
}: {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	label?: string;
	markerId: string;
	dashed?: boolean;
	bothEnds?: boolean;
}) {
	return (
		<g>
			<line
				x1={x1}
				y1={y1}
				x2={x2}
				y2={y2}
				stroke="var(--ink)"
				strokeWidth={1.5}
				strokeDasharray={dashed ? "4 3" : undefined}
				markerEnd={`url(#${markerId})`}
				markerStart={bothEnds ? `url(#${markerId}-start)` : undefined}
			/>
			{label && (
				<text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle" fontSize={9.5} fill="var(--ink-muted)">
					{label}
				</text>
			)}
		</g>
	);
}

function ArrowDefs({ id, both }: { id: string; both?: boolean }) {
	return (
		<defs>
			<marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
				<path d="M0,0 L10,5 L0,10 z" fill="var(--ink)" />
			</marker>
			{both && (
				<marker id={`${id}-start`} viewBox="0 0 10 10" refX="2" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
					<path d="M10,0 L0,5 L10,10 z" fill="var(--ink)" />
				</marker>
			)}
		</defs>
	);
}

function Frame({ viewBox, children }: { viewBox: string; children: ReactNode }) {
	return (
		<svg viewBox={viewBox} className="sdg-diagram-svg" role="img">
			{children}
		</svg>
	);
}

// ---------- Cheat Sheet ----------

export function SyncCallDiagram() {
	return (
		<Frame viewBox="0 0 560 100">
			<ArrowDefs id="sync" both />
			<Box x={20} y={30} w={100} h={40} label="Client" />
			<Box x={230} y={30} w={110} h={40} label="Service A" />
			<Box x={440} y={30} w={110} h={40} label="Service B" />
			<Arrow x1={120} y1={50} x2={230} y2={50} label="HTTP sync" markerId="sync" bothEnds />
			<Arrow x1={340} y1={50} x2={440} y2={50} label="HTTP sync" markerId="sync" bothEnds />
		</Frame>
	);
}

export function AsyncMessagingDiagram() {
	return (
		<Frame viewBox="0 0 560 100">
			<ArrowDefs id="asyncmq" />
			<Box x={20} y={30} w={110} h={40} label="Service A" />
			<Box x={225} y={30} w={110} h={40} label="Queue" />
			<Box x={430} y={30} w={110} h={40} label="Service B" />
			<Arrow x1={130} y1={50} x2={225} y2={50} label="message" markerId="asyncmq" />
			<Arrow x1={335} y1={50} x2={430} y2={50} label="subscribe" markerId="asyncmq" />
		</Frame>
	);
}

export function PubSubDiagram() {
	return (
		<Frame viewBox="0 0 560 150">
			<ArrowDefs id="pubsub" />
			<Box x={20} y={55} w={110} h={40} label="Producer" />
			<Box x={225} y={55} w={110} h={40} label="Topic" />
			<Box x={430} y={10} w={110} h={32} label="Consumer A" />
			<Box x={430} y={59} w={110} h={32} label="Consumer B" />
			<Arrow x1={130} y1={75} x2={225} y2={75} label="publish" markerId="pubsub" />
			<Arrow x1={335} y1={68} x2={430} y2={26} label="subscribe" markerId="pubsub" />
			<Arrow x1={335} y1={80} x2={430} y2={75} markerId="pubsub" />
		</Frame>
	);
}

// The API Design cheat-sheet item covers all three communication patterns —
// stack them together (each labeled) rather than picking just one.
export function CommunicationPatternsDiagrams() {
	return (
		<>
			<p className="md-sublabel">Synchronous</p>
			<SyncCallDiagram />
			<p className="md-sublabel">Async Messaging</p>
			<AsyncMessagingDiagram />
			<p className="md-sublabel">Publish / Subscribe</p>
			<PubSubDiagram />
		</>
	);
}

export function LoadBalancingDiagram() {
	return (
		<Frame viewBox="0 0 560 150">
			<ArrowDefs id="lb" />
			<Box x={20} y={55} w={100} h={40} label="Clients" />
			<Box x={210} y={55} w={110} h={40} label="Load Balancer" />
			<Box x={430} y={10} w={110} h={32} label="Server A" />
			<Box x={430} y={59} w={110} h={32} label="Server B" />
			<Box x={430} y={108} w={110} h={32} label="Server C" />
			<Arrow x1={120} y1={75} x2={210} y2={75} markerId="lb" />
			<Arrow x1={320} y1={70} x2={430} y2={26} markerId="lb" />
			<Arrow x1={320} y1={75} x2={430} y2={75} markerId="lb" />
			<Arrow x1={320} y1={80} x2={430} y2={124} markerId="lb" />
		</Frame>
	);
}

export function ReplicationDiagram() {
	return (
		<Frame viewBox="0 0 560 170">
			<ArrowDefs id="repl" />
			<Box x={20} y={65} w={90} h={40} label="Client" />
			<Box x={225} y={10} w={110} h={40} label="Leader" />
			<Box x={70} y={120} w={110} h={36} label="Follower A" />
			<Box x={225} y={120} w={110} h={36} label="Follower B" />
			<Box x={380} y={120} w={110} h={36} label="Follower C" />
			<Arrow x1={110} y1={80} x2={225} y2={40} label="writes" markerId="repl" />
			<Arrow x1={280} y1={50} x2={125} y2={120} label="replicate" markerId="repl" />
			<Arrow x1={280} y1={50} x2={280} y2={120} markerId="repl" />
			<Arrow x1={280} y1={50} x2={435} y2={120} markerId="repl" />
			<text x={280} y={165} textAnchor="middle" fontSize={9.5} fill="var(--ink-muted)">
				reads can be served from any follower
			</text>
		</Frame>
	);
}

export function ShardingDiagram() {
	return (
		<Frame viewBox="0 0 560 150">
			<ArrowDefs id="shard" />
			<Box x={20} y={55} w={100} h={40} label="App" sublabel="routes by key" />
			<Box x={230} y={10} w={140} h={35} label="Shard 1" sublabel="keys A–H" />
			<Box x={230} y={58} w={140} h={35} label="Shard 2" sublabel="keys I–P" />
			<Box x={230} y={106} w={140} h={35} label="Shard 3" sublabel="keys Q–Z" />
			<Arrow x1={120} y1={70} x2={230} y2={27} markerId="shard" />
			<Arrow x1={120} y1={75} x2={230} y2={75} markerId="shard" />
			<Arrow x1={120} y1={80} x2={230} y2={123} markerId="shard" />
		</Frame>
	);
}

export function CachingDiagram() {
	return (
		<Frame viewBox="0 0 560 100">
			<ArrowDefs id="cache" both />
			<Box x={20} y={30} w={110} h={40} label="App" />
			<Box x={225} y={30} w={110} h={40} label="Cache" sublabel="e.g. Redis" />
			<Box x={430} y={30} w={110} h={40} label="Database" />
			<Arrow x1={130} y1={50} x2={225} y2={50} label="check" markerId="cache" bothEnds />
			<Arrow x1={335} y1={50} x2={430} y2={50} label="on miss" markerId="cache" bothEnds />
		</Frame>
	);
}

export function ConsistentHashingDiagram() {
	// Ring center (150,140), r=105. Nodes placed around it; key sits between
	// N1 and N2 and is claimed by the next node clockwise (N2).
	return (
		<Frame viewBox="0 0 300 280">
			<ArrowDefs id="ch" />
			<circle cx={150} cy={140} r={105} fill="none" stroke="var(--ink)" strokeWidth={1.5} />
			{/* N1 top */}
			<circle cx={150} cy={35} r={7} fill="var(--card-bg)" stroke="var(--ink)" strokeWidth={1.5} />
			<text x={150} y={18} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ink)">
				N1
			</text>
			{/* N2 right */}
			<circle cx={255} cy={140} r={7} fill="var(--card-bg)" stroke="var(--ink)" strokeWidth={1.5} />
			<text x={278} y={144} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ink)">
				N2
			</text>
			{/* N3 bottom */}
			<circle cx={150} cy={245} r={7} fill="var(--card-bg)" stroke="var(--ink)" strokeWidth={1.5} />
			<text x={150} y={266} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ink)">
				N3
			</text>
			{/* N4 left */}
			<circle cx={45} cy={140} r={7} fill="var(--card-bg)" stroke="var(--ink)" strokeWidth={1.5} />
			<text x={22} y={144} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ink)">
				N4
			</text>
			{/* Key, between N1 and N2 */}
			<circle cx={222} cy={68} r={6} fill="var(--green)" stroke="var(--ink)" strokeWidth={1.5} />
			<text x={222} y={52} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ink)">
				Key
			</text>
			<Arrow x1={228} y1={74} x2={251} y2={133} label="owned by N2 (next clockwise)" markerId="ch" dashed />
		</Frame>
	);
}

export function CapTheoremDiagram() {
	return (
		<Frame viewBox="0 0 560 175">
			<ArrowDefs id="cap" />
			<Box x={225} y={10} w={150} h={40} label="Network Partition" fill="var(--cream)" />
			<Box x={30} y={105} w={230} h={55} label="Choose Consistency (CP)" sublabel="error instead of stale data" />
			<Box x={300} y={105} w={230} h={55} label="Choose Availability (AP)" sublabel="answer anyway, maybe stale" />
			<Arrow x1={280} y1={50} x2={165} y2={105} markerId="cap" />
			<Arrow x1={320} y1={50} x2={425} y2={105} markerId="cap" />
		</Frame>
	);
}

export function CdnDiagram() {
	return (
		<Frame viewBox="0 0 560 160">
			<ArrowDefs id="cdn" />
			<Box x={20} y={16} w={100} h={36} label="User (Asia)" />
			<Box x={20} y={108} w={100} h={36} label="User (EU)" />
			<Box x={200} y={16} w={130} h={36} label="Edge Node (Asia)" />
			<Box x={200} y={108} w={130} h={36} label="Edge Node (EU)" />
			<Box x={420} y={62} w={120} h={36} label="Origin Server" />
			<Arrow x1={120} y1={34} x2={200} y2={34} label="fast" markerId="cdn" />
			<Arrow x1={120} y1={126} x2={200} y2={126} label="fast" markerId="cdn" />
			<Arrow x1={330} y1={40} x2={420} y2={70} label="cache miss only" markerId="cdn" dashed />
			<Arrow x1={330} y1={120} x2={420} y2={90} markerId="cdn" dashed />
		</Frame>
	);
}

// Scalability covers three concepts in one cheat-sheet item — stack all
// three diagrams together (each labeled) rather than picking just one.
export function ScalabilityDiagrams() {
	return (
		<>
			<p className="md-sublabel">Load Balancing</p>
			<LoadBalancingDiagram />
			<p className="md-sublabel">Replication</p>
			<ReplicationDiagram />
			<p className="md-sublabel">Sharding</p>
			<ShardingDiagram />
		</>
	);
}

export const CHEAT_SHEET_DIAGRAMS: Record<string, () => ReactNode> = {
	"cs-api-patterns": CommunicationPatternsDiagrams,
	"cs-scalability": ScalabilityDiagrams,
	"cs-caching": CachingDiagram,
	"cs-consistent-hashing": ConsistentHashingDiagram,
	"cs-cap-theorem": CapTheoremDiagram,
	"cs-cdns": CdnDiagram,
};

// ---------- Common Interview Questions & Example Answers: one architecture
// diagram per worked example, showing the shape described in that answer's
// [High-level design] beat — a fast visual before reading the walkthrough.

export function UrlShortenerDiagram() {
	return (
		<Frame viewBox="0 0 560 130">
			<ArrowDefs id="url" both />
			<Box x={20} y={45} w={90} h={40} label="Client" />
			<Box x={195} y={45} w={110} h={40} label="Redirect Service" />
			<Box x={400} y={10} w={140} h={35} label="Cache" sublabel="short code → URL" />
			<Box x={400} y={78} w={140} h={35} label="Database" sublabel="source of truth" />
			<Arrow x1={110} y1={65} x2={195} y2={65} label="GET /abc123" markerId="url" bothEnds />
			<Arrow x1={305} y1={55} x2={400} y2={30} label="check" markerId="url" bothEnds />
			<Arrow x1={305} y1={70} x2={400} y2={95} label="on miss" markerId="url" dashed bothEnds />
		</Frame>
	);
}

export function RateLimiterDiagram() {
	return (
		<Frame viewBox="0 0 560 150">
			<ArrowDefs id="rl" both />
			<Box x={20} y={55} w={90} h={40} label="Client" />
			<Box x={195} y={55} w={140} h={40} label="Rate Limiter" sublabel="checks + updates usage" />
			<Box x={420} y={55} w={120} h={40} label="Backend" />
			<Box x={220} y={115} w={110} h={30} label="Redis" sublabel="token bucket" fill="var(--cream)" />
			<Arrow x1={110} y1={75} x2={195} y2={75} markerId="rl" />
			<Arrow x1={335} y1={75} x2={420} y2={75} label="if allowed" markerId="rl" />
			<Arrow x1={265} y1={95} x2={265} y2={115} markerId="rl" bothEnds />
		</Frame>
	);
}

export function NotificationSystemDiagram() {
	return (
		<Frame viewBox="0 0 600 150">
			<ArrowDefs id="notif" />
			<Box x={10} y={55} w={110} h={40} label="Order Service" sublabel="publishes event" />
			<Box x={175} y={55} w={90} h={40} label="Queue" />
			<Box x={315} y={55} w={130} h={40} label="Notification Svc" sublabel="checks preferences" />
			<Box x={495} y={10} w={95} h={30} label="Push" />
			<Box x={495} y={60} w={95} h={30} label="Email" />
			<Box x={495} y={110} w={95} h={30} label="SMS" />
			<Arrow x1={120} y1={75} x2={175} y2={75} markerId="notif" />
			<Arrow x1={265} y1={75} x2={315} y2={75} markerId="notif" />
			<Arrow x1={445} y1={68} x2={495} y2={25} markerId="notif" />
			<Arrow x1={445} y1={75} x2={495} y2={75} markerId="notif" />
			<Arrow x1={445} y1={82} x2={495} y2={125} markerId="notif" />
		</Frame>
	);
}

export function SocialFeedDiagram() {
	return (
		<Frame viewBox="0 0 560 150">
			<ArrowDefs id="feed" />
			<Box x={20} y={55} w={90} h={40} label="New Post" />
			<Box x={280} y={10} w={170} h={38} label="Precomputed Feeds" sublabel="fan-out on write (typical accounts)" />
			<Box x={280} y={92} w={170} h={38} label="Merge at Read Time" sublabel="fan-out on read (celebrity accounts)" />
			<Box x={500} y={51} w={50} h={40} label="Feed" />
			<Arrow x1={110} y1={65} x2={280} y2={29} label="push" markerId="feed" />
			<Arrow x1={110} y1={85} x2={280} y2={111} label="pull, merged live" markerId="feed" dashed />
			<Arrow x1={450} y1={29} x2={500} y2={65} markerId="feed" />
			<Arrow x1={450} y1={111} x2={500} y2={80} markerId="feed" />
		</Frame>
	);
}

export function ChatMessagingDiagram() {
	return (
		<Frame viewBox="0 0 600 160">
			<ArrowDefs id="chat" />
			<Box x={10} y={15} w={85} h={32} label="Client A" />
			<Box x={125} y={15} w={100} h={32} label="Gateway A" />
			<Box x={265} y={60} w={110} h={40} label="Message Svc" sublabel="presence registry" />
			<Box x={405} y={15} w={100} h={32} label="Gateway B" />
			<Box x={535} y={15} w={55} h={32} label="Client B" />
			<Box x={215} y={120} w={110} h={30} label="Storage" fill="var(--cream)" />
			<Arrow x1={95} y1={31} x2={125} y2={31} markerId="chat" />
			<Arrow x1={175} y1={47} x2={295} y2={60} markerId="chat" />
			<Arrow x1={345} y1={60} x2={430} y2={47} markerId="chat" />
			<Arrow x1={455} y1={31} x2={535} y2={31} markerId="chat" />
			<Arrow x1={300} y1={100} x2={280} y2={120} markerId="chat" />
		</Frame>
	);
}

export function RideSharingDiagram() {
	return (
		<Frame viewBox="0 0 560 185">
			<ArrowDefs id="ride" />
			<Box x={20} y={15} w={110} h={35} label="Driver App" sublabel="streams location" />
			<Box x={230} y={15} w={140} h={35} label="Location Service" sublabel="geospatial index" />
			<Box x={20} y={115} w={110} h={35} label="Rider App" />
			<Box x={230} y={115} w={140} h={35} label="Matching Service" />
			<Box x={430} y={65} w={110} h={35} label="Trip Service" />
			<Arrow x1={130} y1={32} x2={230} y2={32} markerId="ride" />
			<Arrow x1={130} y1={132} x2={230} y2={132} markerId="ride" />
			<Arrow x1={300} y1={115} x2={300} y2={50} label="nearby?" markerId="ride" />
			<Arrow x1={370} y1={120} x2={430} y2={95} markerId="ride" />
			<text x={280} y={170} textAnchor="middle" fontSize={9.5} fill="var(--ink-muted)">
				Trip Service pushes live updates to both apps over a persistent connection
			</text>
		</Frame>
	);
}

export function VideoStreamingDiagram() {
	return (
		<Frame viewBox="0 0 600 110">
			<ArrowDefs id="video" />
			<Box x={10} y={30} w={85} h={40} label="Upload" />
			<Box x={130} y={30} w={100} h={40} label="Object Storage" />
			<Box x={265} y={30} w={110} h={40} label="Transcoding" sublabel="multi-quality chunks" />
			<Box x={410} y={30} w={75} h={40} label="CDN" />
			<Box x={520} y={30} w={70} h={40} label="Player" />
			<Arrow x1={95} y1={50} x2={130} y2={50} markerId="video" />
			<Arrow x1={230} y1={50} x2={265} y2={50} markerId="video" />
			<Arrow x1={375} y1={50} x2={410} y2={50} markerId="video" />
			<Arrow x1={485} y1={50} x2={520} y2={50} markerId="video" />
			<text x={300} y={90} textAnchor="middle" fontSize={9.5} fill="var(--ink-muted)">
				player picks the quality level per chunk based on its own buffer/throughput ("adaptive")
			</text>
		</Frame>
	);
}

export function LlmChatSystemDiagram() {
	return (
		<Frame viewBox="0 0 600 175">
			<ArrowDefs id="llmchat" both />
			<Box x={10} y={60} w={80} h={40} label="Client" />
			<Box x={130} y={60} w={100} h={40} label="Gateway" sublabel="auth, rate limit" />
			<Box x={270} y={60} w={120} h={40} label="Orchestrator" />
			<Box x={270} y={5} w={120} h={32} label="Vector DB" sublabel="optional retrieval" fill="var(--cream)" />
			<Box x={430} y={60} w={150} h={40} label="Model Serving" sublabel="continuous batching" />
			<Arrow x1={90} y1={80} x2={130} y2={80} markerId="llmchat" bothEnds />
			<Arrow x1={230} y1={80} x2={270} y2={80} markerId="llmchat" bothEnds />
			<Arrow x1={330} y1={60} x2={330} y2={37} markerId="llmchat" bothEnds />
			<Arrow x1={390} y1={80} x2={430} y2={80} markerId="llmchat" bothEnds />
			<text x={300} y={140} textAnchor="middle" fontSize={9.5} fill="var(--ink-muted)">
				response streams back token-by-token along the same path, client → gateway → orchestrator
			</text>
		</Frame>
	);
}

export const COMMON_QUESTION_DIAGRAMS: Record<string, () => ReactNode> = {
	"q-url-shortener": UrlShortenerDiagram,
	"q-rate-limiter": RateLimiterDiagram,
	"q-notification-system": NotificationSystemDiagram,
	"q-social-feed": SocialFeedDiagram,
	"q-chat-messaging": ChatMessagingDiagram,
	"q-ride-sharing": RideSharingDiagram,
	"q-video-streaming": VideoStreamingDiagram,
	"q-llm-chat-system": LlmChatSystemDiagram,
};

// ---------- AI/LLM Infrastructure ----------

export function RagPipelineDiagram() {
	return (
		<Frame viewBox="0 0 660 170">
			<ArrowDefs id="rag" />
			<Box x={300} y={10} w={130} h={40} label="Documents" sublabel="chunked + embedded" fill="var(--cream)" />
			<Box x={10} y={95} w={90} h={40} label="Query" />
			<Box x={140} y={95} w={110} h={40} label="Embed Query" />
			<Box x={290} y={95} w={110} h={40} label="Vector DB" sublabel="similarity search" />
			<Box x={520} y={95} w={130} h={40} label="Prompt + LLM" sublabel="query + context" />
			<Arrow x1={100} y1={115} x2={140} y2={115} markerId="rag" />
			<Arrow x1={250} y1={115} x2={290} y2={115} markerId="rag" />
			<Arrow x1={400} y1={115} x2={520} y2={115} label="retrieved chunks" markerId="rag" />
			<Arrow x1={365} y1={50} x2={365} y2={95} markerId="rag" dashed />
			<text x={365} y={68} textAnchor="middle" fontSize={9.5} fill="var(--ink-muted)">
				indexed offline, ahead of time
			</text>
		</Frame>
	);
}

export function BatchInferenceDiagram() {
	// Two GPU-utilization timelines: static batching leaves idle gaps waiting
	// for a batch to fill; continuous batching keeps the GPU busy the whole
	// time as requests join/leave mid-stream.
	const busy = "var(--green)";
	const idle = "var(--card-bg)";
	return (
		<Frame viewBox="0 0 560 130">
			<text x={10} y={20} fontSize={11} fontWeight={600} fill="var(--ink)">
				Static batching
			</text>
			<rect x={140} y={8} width={70} height={24} fill={busy} stroke="var(--ink)" strokeWidth={1.5} />
			<rect x={210} y={8} width={40} height={24} fill={idle} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="3 3" />
			<rect x={250} y={8} width={70} height={24} fill={busy} stroke="var(--ink)" strokeWidth={1.5} />
			<rect x={320} y={8} width={40} height={24} fill={idle} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="3 3" />
			<rect x={360} y={8} width={70} height={24} fill={busy} stroke="var(--ink)" strokeWidth={1.5} />
			<rect x={430} y={8} width={40} height={24} fill={idle} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="3 3" />
			<rect x={470} y={8} width={80} height={24} fill={busy} stroke="var(--ink)" strokeWidth={1.5} />
			<text x={10} y={52} fontSize={9.5} fill="var(--ink-muted)">
				waits for a batch to fill before each run — idle gaps
			</text>

			<text x={10} y={85} fontSize={11} fontWeight={600} fill="var(--ink)">
				Continuous batching
			</text>
			<rect x={140} y={73} width={410} height={24} fill={busy} stroke="var(--ink)" strokeWidth={1.5} />
			<line x1={225} y1={73} x2={225} y2={97} stroke="var(--card-bg)" strokeWidth={2} />
			<line x1={340} y1={73} x2={340} y2={97} stroke="var(--card-bg)" strokeWidth={2} />
			<line x1={460} y1={73} x2={460} y2={97} stroke="var(--card-bg)" strokeWidth={2} />
			<text x={10} y={117} fontSize={9.5} fill="var(--ink-muted)">
				requests join/leave at the token level — GPU stays busy
			</text>
		</Frame>
	);
}

export function GpuClusterManagementDiagram() {
	return (
		<Frame viewBox="0 0 560 160">
			<ArrowDefs id="gpu" />
			<Box x={10} y={10} w={170} h={32} label="High priority (SLA)" fill="var(--green)" />
			<Box x={10} y={64} w={170} h={32} label="Medium priority" />
			<Box x={10} y={118} w={170} h={32} label="Low priority (batch)" />
			<Box x={370} y={48} w={170} h={56} label="GPU Pool" sublabel="N GPUs, shared" />
			<Arrow x1={180} y1={26} x2={370} y2={65} markerId="gpu" />
			<Arrow x1={180} y1={80} x2={370} y2={76} markerId="gpu" />
			<Arrow x1={180} y1={134} x2={370} y2={95} label="preempted if pool is full" markerId="gpu" dashed />
		</Frame>
	);
}

export const AI_LLM_DIAGRAMS: Record<string, () => ReactNode> = {
	rag: RagPipelineDiagram,
	"gpu-cluster-management": GpuClusterManagementDiagram,
	"batch-inference": BatchInferenceDiagram,
};

// All diagrams keyed by their guide item id, for a single lookup in
// SystemDesignGuide.tsx.
export const ALL_DIAGRAMS: Record<string, () => ReactNode> = {
	...CHEAT_SHEET_DIAGRAMS,
	...COMMON_QUESTION_DIAGRAMS,
	...AI_LLM_DIAGRAMS,
};
