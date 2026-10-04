import { useState } from "react";
import { postSalaryPositioning } from "./api";
import type { Company, SalaryPositioningResult } from "./types";
import { DISPLAY_BANDS, SALARY_REGION_OPTIONS, type SalaryRegion } from "./salaryBands";
import Dropdown from "./Dropdown";
import { LoadingSpinner } from "./LoadingSpinner";

// Demo-only tool (see worker/src/index.ts's DEMO_ALLOWED_ROUTES). The band it
// positions against depends on the selected company and is a rough estimate
// from public aggregators (see salaryBands.ts), not an offer. The server
// holds the authoritative copy and the prompt says it is an estimate.
const COMPANY_LABELS: Record<Company, string> = { amazon: "Amazon", make: "Make", meta: "Meta" };

const POSITION_LABELS: Record<string, string> = {
	below_floor: "Below the band floor",
	lower_band: "Lower end of the band",
	mid_band: "Middle of the band",
	upper_band: "Upper end of the band",
	above_ceiling: "Above the band ceiling",
};

export default function SalaryPositioningTool({ company }: { company: Company }) {
	const [region, setRegion] = useState<SalaryRegion>("europe");
	const band = DISPLAY_BANDS[company][region];
	const resultKey = `${company}:${region}`;
	const [currentSalary, setCurrentSalary] = useState("");
	const [currentSalaryCurrency, setCurrentSalaryCurrency] = useState("USD");
	const [monthlyRent, setMonthlyRent] = useState("");
	const [monthlyLivingExpenses, setMonthlyLivingExpenses] = useState("");
	const [currentSavingsRate, setCurrentSavingsRate] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [resultState, setResultState] = useState<{ key: string; result: SalaryPositioningResult } | null>(null);
	// A result belongs to the company and region it was computed for; hide it after switching.
	const result = resultState && resultState.key === resultKey ? resultState.result : null;

	const canSubmit =
		currentSalary.trim() !== "" &&
		currentSalaryCurrency.trim() !== "" &&
		monthlyRent.trim() !== "" &&
		monthlyLivingExpenses.trim() !== "" &&
		currentSavingsRate.trim() !== "";

	async function handleSubmit() {
		setError(null);
		setResultState(null);
		setLoading(true);
		try {
			const res = await postSalaryPositioning({
					company,
					region,
				currentSalary: Number(currentSalary),
				currentSalaryCurrency: currentSalaryCurrency.trim(),
				monthlyRent: Number(monthlyRent),
				monthlyLivingExpenses: Number(monthlyLivingExpenses),
				currentSavingsRate: currentSavingsRate.trim(),
			});
			setResultState({ key: resultKey, result: res });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="salary-tool">
			<Dropdown label="Region" value={region} onChange={setRegion} options={SALARY_REGION_OPTIONS} />
			<p>
				An AI coach positions your ask within an <strong>estimated</strong> band for a {band.roleLabel} role at{" "}
				{COMPANY_LABELS[company]} in {band.cityLabel} ({band.currency} {band.floor.toLocaleString()}–{band.ceiling.toLocaleString()}{" "}
				{band.period}) — a rough figure from public salary sites, not an offer. Enter your own current pay and living costs in any
				currency; the tool estimates what it would take to maintain your standard of living there, and where that lands within the
				band. The band follows the Company dropdown above and the Region dropdown here.
			</p>
			<p>
				<strong>Limit:</strong> each company can be tried once every 10 days (the Europe / United States toggle shares its
				company's allowance), so pick the region before you submit.
			</p>
			<p className="salary-tool-caveat">Basis: {band.source} Always re-check levels.fyi and Glassdoor before a real negotiation.</p>

			<div className="salary-tool-form">
				<label>
					Current gross salary (per year)
					<input type="number" min="0" value={currentSalary} onChange={(e) => setCurrentSalary(e.target.value)} placeholder="e.g. 60000" />
				</label>
				<label>
					Currency
					<input
						type="text"
						value={currentSalaryCurrency}
						onChange={(e) => setCurrentSalaryCurrency(e.target.value)}
						placeholder="e.g. USD, TWD, EUR"
						maxLength={10}
					/>
				</label>
				<label>
					Monthly rent (0 if you own your home or have none)
					<input type="number" min="0" value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} placeholder="e.g. 1200" />
				</label>
				<label>
					Other monthly living expenses (excluding rent)
					<input
						type="number"
						min="0"
						value={monthlyLivingExpenses}
						onChange={(e) => setMonthlyLivingExpenses(e.target.value)}
						placeholder="e.g. 1500"
					/>
				</label>
				<label>
					Current annual savings rate
					<input
						type="text"
						value={currentSavingsRate}
						onChange={(e) => setCurrentSavingsRate(e.target.value)}
						placeholder="e.g. 20% or 'about $8,000/year'"
						maxLength={50}
					/>
				</label>
				<button type="button" onClick={handleSubmit} disabled={!canSubmit || loading}>
					{loading ? <LoadingSpinner label="Positioning..." /> : "Get my positioning"}
				</button>
			</div>

			{error && <p className="error">{error}</p>}

			{result && (
				<div className="salary-tool-result">
					<p className="salary-tool-position">{POSITION_LABELS[result.positionWithinBand] ?? result.positionWithinBand}</p>
					<dl>
						<dt>Estimated equivalent cost at this location</dt>
						<dd>
							{result.currency} {result.estimatedEquivalentCost.toLocaleString()} /month
						</dd>
						<dt>Suggested target (where to aim)</dt>
						<dd>
							{result.currency} {result.target.toLocaleString()} /month
						</dd>
						<dt>Suggested anchor (what to open with)</dt>
						<dd>
							{result.currency} {result.anchor.toLocaleString()} /month
						</dd>
					</dl>
					<p>{result.reasoning}</p>
					{result.numbeoCaveat && <p className="salary-tool-caveat">{result.numbeoCaveat}</p>}
				</div>
			)}
		</div>
	);
}
