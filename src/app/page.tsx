import Link from "next/link";
import { ArrowRight, Activity, Users, Clock } from "lucide-react";
import { TypewriterText } from "@/components/ui/TypewriterText";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-blue-500 selection:text-white">
      <main className="container mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 text-sm font-medium mb-8 border border-blue-500/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          M/M/c Multi-Server Queueing Model &middot; Case Study: Massey Street Children&apos;s Hospital, Lagos Island
        </div>

        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
          Modelling patient queues so <span className="text-blue-400">Lagos hospitals</span> can staff smarter, not harder.
        </h1>

        <p className="text-slate-400 text-base md:text-lg max-w-3xl mx-auto mb-10 leading-relaxed min-h-24 md:min-h-16">
          <TypewriterText text="MediQueue Optima applies Kendall's M/M/c queueing model to hospital outpatient and emergency department flow, validates it with discrete-event simulation, and layers a machine-learning demand forecast on top to recommend how many doctors each department needs, hour by hour." />
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-semibold transition-all flex items-center gap-2"
          >
            Staff Sign In <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/simulation"
            className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-full font-semibold transition-all border border-slate-700"
          >
            Run Simulation
          </Link>
          <Link
            href="/about"
            className="px-8 py-4 text-slate-300 hover:text-white font-semibold transition-all underline underline-offset-4 decoration-slate-600"
          >
            About this project
          </Link>
        </div>
      </main>

      <section className="container mx-auto px-6 py-24 border-t border-slate-800/50">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Clock,
              title: "Predict Wait Times",
              desc: "See hourly queue build-up and wait time trends so the hospital can respond before lines grow."
            },
            {
              icon: Users,
              title: "Staffing Intelligence",
              desc: "Determine how many doctors are needed per department to keep patient waiting times within a safe, stable target."
            },
            {
              icon: Activity,
              title: "ML-Driven Forecasting",
              desc: "Forecast next-day arrival volume per department and turn it directly into an hour-by-hour staffing recommendation."
            }
          ].map((feature, i) => (
            <div key={i} className="p-8 rounded-3xl bg-slate-900/70 border border-slate-700/50">
              <feature.icon className="w-8 h-8 text-blue-400 mb-6" />
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-slate-400 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
