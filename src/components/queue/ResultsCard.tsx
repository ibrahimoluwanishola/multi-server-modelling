
export function MetricCard({ label, value, subtext, highlight = false }: { label: string, value: string, subtext?: string, highlight?: boolean }) {
    return (
        <div className={`p-4 rounded-xl border ${highlight ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100'}`}>
            <p className={`text-xs font-medium uppercase ${highlight ? 'text-blue-600' : 'text-slate-400'}`}>{label}</p>
            <p className={`text-2xl font-bold mt-1 ${highlight ? 'text-blue-700' : 'text-slate-800'}`}>{value}</p>
            {subtext && <p className={`text-xs mt-1 ${highlight ? 'text-blue-500' : 'text-slate-400'}`}>{subtext}</p>}
        </div>
    );
}
