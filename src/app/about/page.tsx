import { BookOpen, Building2, FlaskConical, Sparkles, ShieldAlert, Link as LinkIcon, LucideIcon } from "lucide-react";
import { HOSPITAL_PROFILE } from "@/lib/hospital-data";

function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
    return (
        <section className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            </div>
            <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed space-y-3">{children}</div>
        </section>
    );
}

export default function AboutPage() {
    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">About This Project</h1>
                <p className="text-slate-500 mt-1">
                    M/M/C Multi-Server Queuing Model for Hospital Appointment System — Case Study: {HOSPITAL_PROFILE.name}
                </p>
            </div>

            <Section icon={BookOpen} title="Project Overview & Objectives">
                <p>
                    MediQueue Optima is a decision-support web application that applies Kendall&apos;s M/M/c multi-server
                    queueing model to hospital outpatient and emergency department operations. It exists to answer one
                    practical operations-management question: <em>how many doctors does a department need so patients
                    are seen within an acceptable time, without overstaffing?</em>
                </p>
                <ul>
                    <li>Compute exact steady-state queue performance metrics analytically (Erlang-C formulae).</li>
                    <li>Validate those analytical results empirically with a discrete-event simulation.</li>
                    <li>Automatically determine the minimum server count (doctors) needed to meet a target wait time.</li>
                    <li>Forecast time-varying patient demand with a regression-based ML model and turn that forecast into an hour-by-hour staffing plan.</li>
                    <li>Present all of the above through an interactive dashboard suitable for non-technical hospital administrators.</li>
                </ul>
            </Section>

            <Section icon={FlaskConical} title="Theoretical Background — The M/M/c Model">
                <p>
                    The M/M/c model (Erlang-C) describes a queueing system with Poisson (memoryless) arrivals at rate
                    <strong> λ</strong>, exponentially distributed service times at rate <strong>μ</strong> per server,
                    <strong> c</strong> identical parallel servers, first-come-first-served discipline, and an infinite
                    queue and calling population. The system is stable only if traffic intensity ρ = λ / (c·μ) &lt; 1.
                </p>
                <p>From ρ, the model derives:</p>
                <ul>
                    <li><strong>P₀</strong> — probability the system is empty</li>
                    <li><strong>Lq</strong> — mean number of patients waiting in queue</li>
                    <li><strong>Wq</strong> — mean waiting time in queue (via Little&apos;s Law, Wq = Lq/λ)</li>
                    <li><strong>L, W</strong> — mean number and mean time in the system (queue + service)</li>
                </ul>
                <p>
                    These are implemented exactly as closed-form expressions in <code>src/lib/mmc.ts</code>, and cross-checked
                    against a discrete-event simulation (<code>src/lib/simulation.ts</code>) that runs multiple independent
                    replications with a warm-up period and reports a 95% confidence interval, rather than a single noisy run.
                </p>
            </Section>

            <Section icon={Building2} title={`Case Study: ${HOSPITAL_PROFILE.name}`}>
                <p>
                    {HOSPITAL_PROFILE.name} is a {HOSPITAL_PROFILE.beds}-bed, {HOSPITAL_PROFILE.ownership.toLowerCase()}
                    paediatric hospital on {HOSPITAL_PROFILE.location.split(",")[0]}, {HOSPITAL_PROFILE.location.split(",").slice(1).join(",")}.
                    {" "}{HOSPITAL_PROFILE.notes}
                </p>
                <p>
                    The department list in this system (General Outpatient, Emergency Room, Neonatal &amp; Maternity,
                    General Surgery, Cardiology &amp; Specialist Clinics, Obstetrics &amp; Gynaecology) and the doctor/nurse
                    staffing totals used to seed it are informed by the hospital&apos;s publicly reported clinical staff
                    composition (2 consultant paediatricians/neonatologists, 1 senior registrar, 4 registrars, and 31
                    nursing staff across services including endocrinology, orthopaedics, nutrition, obstetrics &amp;
                    gynaecology, cardiology, general surgery and optometry).
                </p>
                <div className="not-prose mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 flex gap-3">
                    <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                        <strong>Important methodological note.</strong> Lagos State hospitals do not publish granular,
                        timestamped patient-arrival logs. The arrival rate (λ) and service rate (μ) values used per
                        department are therefore <em>informed estimates</em>, not measured ground truth — calibrated to be
                        consistent with the hospital&apos;s known staffing levels and to be realistic for a busy public
                        referral hospital. This assumption, and its implications for interpreting the results, should be
                        stated explicitly in your report&apos;s methodology/limitations section.
                    </div>
                </div>
            </Section>

            <Section icon={Building2} title="Real-Time Patient Flow & Role-Based Access">
                <p>
                    Beyond the queueing-theory tooling, the system now models the actual operational workflow of a
                    hospital department end to end, informed by how commercial hospital queue-management systems are
                    architected in practice: digital check-in, a live queue visible to staff, and automatic notification
                    of the next available clinician rather than a paper list or a shout across the corridor.
                </p>
                <ul>
                    <li><strong>Receptionist</strong> checks a patient in once — name, department, reason for visit/symptoms, and priority (Routine/Urgent/Emergency, triage-ordered) — on the Reception page.</li>
                    <li>Every doctor assigned to that department is notified <strong>instantly</strong>, with the exact reason-for-visit text the receptionist captured, so the patient never has to repeat themselves.</li>
                    <li><strong>Doctor</strong> sees their live, priority-ordered queue, starts a consultation (which frees the notification and marks them busy), and completes it with optional notes — all timestamped.</li>
                    <li><strong>Admin</strong> creates and manages doctor/receptionist accounts, assigns them to departments, and has full visibility across the hospital.</li>
                </ul>
                <p>
                    Real-time delivery uses <strong>Server-Sent Events (SSE)</strong> rather than WebSockets: the data
                    flow here is one-directional (server → client push of &ldquo;a new patient is waiting&rdquo;), which is exactly
                    what SSE is designed for. It runs over plain HTTP using the browser&apos;s built-in
                    <code>EventSource</code> API (automatic reconnection, no extra client library) and needs no custom
                    server — unlike WebSockets, which solve a bidirectional problem this system doesn&apos;t have.
                    Authentication is a small, dependency-free implementation on top of Node&apos;s built-in
                    <code>crypto</code> module (scrypt password hashing, HMAC-signed session cookies), appropriate for a
                    coursework system with a handful of staff accounts and no real patient PII at stake.
                </p>
            </Section>

            <Section icon={ShieldAlert} title="A note on 'real' vs. planning data">
                <p>
                    This system draws a hard line between two kinds of numbers, and it is important your report does
                    too:
                </p>
                <ul>
                    <li>
                        <strong>Real, event-sourced data</strong> — every figure on the Dashboard and Reports pages
                        (patients checked in today, actual wait times, completed consultations) is computed exclusively
                        from real check-in and completion timestamps logged through Reception and Doctor accounts in
                        this running system. There is no seeded, synthetic, or pre-populated history anywhere in the
                        codebase — a fresh deployment starts genuinely empty, and these pages say so honestly until
                        real visits are logged.
                    </li>
                    <li>
                        <strong>Planning/theoretical data</strong> — the λ (arrival rate) and μ (service rate) values
                        configured per department, and everything derived from them (M/M/c metrics, the discrete-event
                        simulation, the Optimization page), are informed estimates used for capacity-planning &ldquo;what-if&rdquo;
                        analysis, exactly as described in the case-study section above. The ML Forecast page trains
                        only on real logged check-ins and will explicitly tell you when there isn&apos;t yet enough real
                        history to produce a trustworthy forecast, rather than fabricating one.
                    </li>
                </ul>
            </Section>

            <Section icon={Sparkles} title="Machine Learning Component">
                <p>
                    A pure M/M/c model assumes a constant arrival rate λ, but real hospital arrivals follow a strong
                    daily cycle — busier mid-morning and early afternoon, quiet overnight. The Forecast page addresses
                    this with a small, fully transparent <strong>harmonic linear regression</strong>: sine/cosine
                    features at two frequencies (to capture a bimodal daily curve) plus a weekend indicator, fitted by
                    ordinary least squares (closed-form normal equations — no external ML library, no opaque black box).
                </p>
                <p>
                    The model trains exclusively on the hour-of-day of real patient check-ins recorded in this running
                    system (see the note above) — there is no synthetic training set. Because a fresh deployment starts
                    with zero visits, the Forecast page requires a minimum amount of real history before it will train,
                    and says so explicitly rather than ever showing an invented curve. Once trained, it reports its
                    in-sample R² transparently, and its 24-hour λ(t) prediction feeds directly into the same
                    server-optimisation routine used elsewhere in the app, producing an hour-by-hour recommended doctor
                    count — a genuine hybrid of demand forecasting and queueing theory.
                </p>
            </Section>

            <Section icon={FlaskConical} title="Validation Against Theory">
                <p>
                    The <strong>Validation</strong> page runs the discrete-event simulation across ten parameter
                    configurations — light, moderate, heavy, and near-critical utilization at 1, 2, 3, and 4 servers —
                    and compares every simulated metric (ρ, Lq, Wq, L, W) against the exact analytical prediction for
                    that same configuration. Each comparison uses 15 independent replications of a 12-hour simulated
                    day, and reports the percentage error alongside a 95% confidence interval, rather than relying on
                    a single spot-check. This is the system&apos;s systematic accuracy-validation objective, demonstrated
                    directly as a reproducible feature rather than argued for narratively.
                </p>
            </Section>

            <Section icon={Building2} title="Case Study Validation Through Real Operation">
                <p>
                    Beyond the mathematical validation above, the system&apos;s practical applicability is demonstrated
                    operationally: the Reception, Doctor, and Admin portals implement a real (not simulated) patient
                    check-in → consultation → completion workflow against the case-study departments. Reports and
                    dashboard figures are computed entirely from these real, timestamped visit records — there is no
                    seeded or synthetic activity data anywhere in the running system. This lets the case study be
                    evaluated the way a real deployment would be: check patients in, watch queues form and clear, and
                    read the resulting reports, rather than only inspecting parameters in the abstract.
                </p>
            </Section>

            <Section icon={FlaskConical} title="Technology Stack">
                <ul>
                    <li><strong>Next.js 16</strong> (App Router) + <strong>React 19</strong> + <strong>TypeScript</strong></li>
                    <li><strong>Tailwind CSS 4</strong> + <strong>Framer Motion</strong> for styling and animation</li>
                    <li><strong>Recharts</strong> for data visualisation</li>
                    <li>Analytical M/M/c engine, discrete-event simulation engine, and regression-based ML forecaster — all implemented in-house in TypeScript for full transparency and inspectability</li>
                    <li>Dependency-free authentication (Node <code>crypto</code>: scrypt password hashing, HMAC-signed, server-side-expiring session cookies) and role-based route protection via <code>src/proxy.ts</code></li>
                    <li>Server-Sent Events for real-time doctor/receptionist notifications, backed by an in-process pub-sub event bus</li>
                    <li>A dual-mode server-side data layer (<code>src/lib/server/db.ts</code>) for departments, staff accounts, real patient visits, and notifications: a normalized Postgres schema (via Supabase, four tables with foreign-key constraints — see <code>supabase/schema.sql</code>) when configured, falling back automatically to an in-memory store so the project also runs with zero external setup for quick local grading</li>
                </ul>
            </Section>

            <Section icon={LinkIcon} title="Sources">
                <ul>
                    {HOSPITAL_PROFILE.sources.map((s) => (
                        <li key={s.url}>
                            {s.label} — <span className="text-blue-600">{s.url}</span>
                        </li>
                    ))}
                </ul>
            </Section>

            <p className="text-center text-sm text-slate-400 py-6">
                Built as an academic project in Operations Research and Healthcare Systems Engineering.
            </p>
        </div>
    );
}
