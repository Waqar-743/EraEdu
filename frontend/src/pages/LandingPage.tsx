import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "../components/shared";
import api from "../services/api";
import toast from "react-hot-toast";
import { useReveal } from "../hooks/useReveal";
import {
  AssessmentJourney,
  CompactJourney,
  ActivityReviewGraphic,
  CompactActivityGraphic,
  FocusGraphic,
  CopyGuardGraphic,
  PracticeGraphic,
  CourseGraphic,
  ExportGraphic,
  WorkflowGraphic,
  PrivateResultsGraphic,
} from "../components/landing/Illustrations";

/* ──────────────────────────────────────────────────────────────────────────
   Vibe: Ethereal Glass · Layout: Asymmetrical Bento + Editorial Split
   ────────────────────────────────────────────────────────────────────────── */

/* ───── Ultra-thin line icons (custom — no Lucide / Heroicons / Material) ───── */
const Stroke = ({
  d,
  size = 18,
  className = "",
}: {
  d: string;
  size?: number;
  className?: string;
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.25"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);

const Arrow = ({
  size = 14,
  className = "",
}: {
  size?: number;
  className?: string;
}) => <Stroke d="M5 19 19 5 M9 5h10v10" size={size} className={className} />;

/* ───── Floating Glass Island Nav (with morphing hamburger) ───── */
const NavIsland = () => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        document.getElementById("mobile-menu-toggle")?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  const links = [
    { href: "#features", label: "Features" },
    { href: "#how", label: "How it works" },
    { href: "#integrity", label: "Integrity" },
    { href: "#trust", label: "Trust" },
    { href: "#pricing", label: "Pricing" },
  ];

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-6">
        <div
          className="
            flex w-full max-w-5xl items-center gap-2 rounded-full p-1.5
            bg-white/70 backdrop-blur-2xl ring-1 ring-ink-900/5
            shadow-[0_20px_60px_-30px_rgba(5,7,11,0.25)]
          "
        >
          <div className="shrink-0 pl-3 pr-2">
            <Brand to="/" />
          </div>

          <nav className="hidden lg:flex items-center gap-1 px-2">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="
                  rounded-full px-3.5 py-2 whitespace-nowrap text-sm font-medium text-ink-600
                  transition-all duration-500 ease-spring
                  hover:text-ink-900 hover:bg-ink-900/[0.04]
                "
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <Link
              to="/login"
              className="
                hidden shrink-0 whitespace-nowrap sm:inline-flex rounded-full px-4 py-2 text-sm font-medium text-ink-700
                transition-all duration-500 ease-spring hover:text-ink-900 hover:bg-ink-900/[0.04]
              "
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="btn-island-primary hidden shrink-0 whitespace-nowrap sm:inline-flex"
            >
              <span className="pr-1">Get started</span>
              <span className="btn-icon bg-white/15">
                <Arrow />
              </span>
            </Link>

            {/* Hamburger → X morph */}
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-label="Menu"
              id="mobile-menu-toggle"
              aria-expanded={open}
              aria-controls="mobile-navigation"
              className="
                lg:hidden relative ml-1 flex h-10 w-10 items-center justify-center
                rounded-full bg-ink-900/[0.04] ring-1 ring-ink-900/5
              "
            >
              <span
                className={`absolute h-[1.5px] w-4 bg-ink-900 transition-all duration-500 ease-spring ${
                  open ? "rotate-45 translate-y-0" : "-translate-y-1.5"
                }`}
              />
              <span
                className={`absolute h-[1.5px] w-4 bg-ink-900 transition-all duration-500 ease-spring ${
                  open ? "-rotate-45 translate-y-0" : "translate-y-1.5"
                }`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile screen-filling glass overlay */}
      <div
        id="mobile-navigation"
        aria-hidden={!open}
        style={{ visibility: open ? "visible" : "hidden" }}
        className={`
          fixed inset-0 z-30 lg:hidden
          transition-all duration-700 ease-spring
          ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
          backdrop-blur-3xl bg-white/80
        `}
      >
        <div className="flex h-full flex-col justify-center px-8">
          {links.map((l, i) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`
                block py-4 font-display text-5xl tracking-tightest text-ink-900
                transition-all duration-700 ease-spring
                ${open ? "translate-y-0 opacity-100 blur-0" : "translate-y-12 opacity-0 blur-md"}
              `}
              style={{ transitionDelay: `${100 + i * 60}ms` }}
            >
              {l.label}
            </a>
          ))}
          <div className="mt-10 flex gap-3">
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="btn-island-ghost"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              onClick={() => setOpen(false)}
              className="btn-island-primary"
            >
              <span className="pr-1">Get started</span>
              <span className="btn-icon bg-white/15">
                <Arrow />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

/* ───── HERO ───── */
const Hero = () => (
  <section className="relative overflow-hidden pt-40 md:pt-48 pb-24 md:pb-32">
    {/* Mesh background */}
    <div aria-hidden className="absolute inset-0 -z-10 bg-mesh-emerald" />
    <div
      aria-hidden
      className="absolute inset-x-0 top-0 -z-10 h-[60vh] bg-grid-faint [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]"
    />
    {/* Floating glow orb */}
    <div
      aria-hidden
      className="absolute left-1/2 top-32 -z-10 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary-300/30 blur-3xl animate-pulse-soft"
    />

    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <span className="eyebrow eyebrow-light reveal">
          <span className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-pulse" />
          Assessment scheduling and review
        </span>

        <h1 className="reveal reveal-delay-1 mt-6 font-display text-[44px] sm:text-6xl md:text-7xl lg:text-[88px] leading-[0.95] tracking-tightest text-balance text-ink-900">
          The integrity engine for{" "}
          <span className="relative inline-block">
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #047857 0%, #10B981 40%, #06B6D4 100%)",
              }}
            >
              modern classrooms
            </span>
            <span className="absolute -bottom-2 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-primary-300/60 to-transparent blur-md" />
          </span>
        </h1>

        <p className="reveal reveal-delay-2 mx-auto mt-8 max-w-2xl text-pretty text-lg leading-relaxed text-ink-500">
          EraEdu supports every assessment with scheduled availability,
          tab-switch sentinels, and copy-paste guards — so educators measure
          what students actually know, not what they could borrow.
        </p>

        <div className="reveal reveal-delay-3 mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link to="/register" className="btn-island-primary">
            <span className="pr-1">Create an account</span>
            <span className="btn-icon bg-white/15">
              <Arrow />
            </span>
          </Link>
          <a href="#how" className="btn-island-ghost">
            <span className="pr-1">See how it works</span>
            <span className="btn-icon bg-ink-900/[0.06]">
              <Stroke d="M8 5v14l11-7z" size={12} />
            </span>
          </a>
        </div>

        <p className="reveal reveal-delay-4 mt-6 text-xs text-ink-400">
          Create a teacher account · Create, schedule and review assessments
        </p>
      </div>

      <figure className="reveal reveal-delay-5 mx-auto mt-16 max-w-5xl">
        <div className="bezel">
          <div className="bezel-core overflow-hidden bg-[#f7faf8]">
            <AssessmentJourney />
            <CompactJourney />
          </div>
        </div>
        <figcaption className="home-art-caption mt-4 px-2">
          <p>
            <span className="font-semibold text-ink-700">
              Create. Schedule. Review. Grade.
            </span>{" "}
            An illustrated workflow.
          </p>
        </figcaption>
      </figure>
    </div>
  </section>
);

/* ───── SOCIAL PROOF marquee ───── */

/* ───── FEATURE BENTO (Asymmetrical) ───── */
type Feat = {
  title: string;
  label: string;
  copy: string;
  span: string;
  visual: React.ReactNode;
  accent?: "emerald" | "cyan" | "violet";
};

const FeatureCard = ({
  title,
  label,
  copy,
  span,
  visual,
  accent = "emerald",
}: Feat) => {
  const tag =
    accent === "cyan"
      ? "text-accent-700 bg-accent-50 ring-accent-200"
      : accent === "violet"
        ? "text-secondary-700 bg-secondary-50 ring-secondary-200"
        : "text-primary-700 bg-primary-50 ring-primary-200";
  return (
    <div className={`reveal bezel ${span}`}>
      <div className="bezel-core flex h-full flex-col justify-between gap-6 p-7">
        <div
          className={`home-feature-art ${span.includes("row-span-2") ? "home-feature-art--large" : ""} relative overflow-hidden rounded-[1.25rem] bg-ink-50 ring-1 ring-ink-900/5`}
        >
          {visual}
        </div>
        <div>
          <span className={`eyebrow ring-1 ${tag}`}>{label}</span>
          <h3 className="mt-3 font-display text-2xl tracking-tightest text-ink-900">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">{copy}</p>
        </div>
      </div>
    </div>
  );
};

const features: Feat[] = [
  {
    title: "Assessment activity review",
    label: "Event review",
    copy: "Records tab and focus events for teacher review alongside submitted answers.",
    span: "md:col-span-7 md:row-span-2",
    visual: (
      <>
        <ActivityReviewGraphic />
        <CompactActivityGraphic />
      </>
    ),
  },
  {
    title: "Tab-switch sentinel",
    label: "Browser focus",
    copy: "Records supported tab visibility and focus changes during an attempt for teacher review.",
    span: "md:col-span-5",
    accent: "cyan",
    visual: <FocusGraphic />,
  },
  {
    title: "Copy-paste guard",
    label: "Attempt controls",
    copy: "Guards supported copy, paste, context-menu and developer-tool shortcuts during an assessment.",
    span: "md:col-span-5",
    accent: "violet",
    visual: <CopyGuardGraphic />,
  },
  {
    title: "Learning and practice",
    label: "Practice",
    copy: "Explore course resources, practise your skills, and use reviewed results to guide your next steps.",
    span: "md:col-span-4",
    visual: <PracticeGraphic />,
  },
  {
    title: "Course performance",
    label: "Courses",
    copy: "Educators review course performance, submissions and reported browser events from their dashboard.",
    span: "md:col-span-4",
    accent: "cyan",
    visual: <CourseGraphic />,
  },
  {
    title: "Assessment exports",
    label: "Reviewed marks",
    copy: "Review submissions, save teacher grades and feedback, and export marks as CSV.",
    span: "md:col-span-4",
    accent: "violet",
    visual: <ExportGraphic />,
  },
];

const FeaturesBento = () => (
  <section id="features" className="relative py-24 md:py-32">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="reveal mx-auto max-w-3xl text-center">
        <span className="eyebrow eyebrow-light">Capabilities</span>
        <h2 className="mt-4 font-display text-4xl md:text-6xl tracking-tightest text-ink-900 text-balance">
          Every layer of integrity, in one platform.
        </h2>
        <p className="mt-5 text-lg text-ink-500 text-pretty">
          From assessment entry to reviewed results, keep the work and its
          context together.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <span className="text-xs text-ink-500">Workflow illustrations</span>
        </div>
      </div>
      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-12 md:auto-rows-[minmax(280px,auto)]">
        {features.map((feature) => (
          <FeatureCard key={feature.title} {...feature} />
        ))}
      </div>
    </div>
  </section>
);

/* ───── HOW IT WORKS — vertical staggered timeline ───── */
const HowItWorks = () => {
  const steps = [
    {
      n: "01",
      t: "Author a quiz in minutes",
      d: "Create multiple-choice and short-answer questions, choose a course, and schedule when students can start.",
    },
    {
      n: "02",
      t: "Distribute via secure code",
      d: "Students enrol using a course code and enter a four-digit assessment code. The server checks assignments and availability.",
    },
    {
      n: "03",
      t: "Review assessment activity",
      d: "Review submitted answers and recorded tab and focus events before assigning a grade.",
    },
    {
      n: "04",
      t: "Grade and give feedback",
      d: "Review each submission, save a teacher grade and feedback, and export assessment marks.",
    },
  ];

  return (
    <section id="how" className="relative bg-white py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-16 lg:grid-cols-12">
          <div className="lg:col-span-5 lg:sticky lg:top-32 self-start">
            <span className="eyebrow eyebrow-light reveal">Workflow</span>
            <h2 className="reveal reveal-delay-1 mt-4 font-display text-4xl md:text-6xl tracking-tightest text-ink-900 text-balance">
              From blank slate to defensible grade.
            </h2>
            <p className="reveal reveal-delay-2 mt-5 text-lg text-ink-500 text-pretty">
              Four deliberate steps — engineered so educators spend more time
              teaching, less time policing.
            </p>
            <Link
              to="/register"
              className="reveal reveal-delay-3 mt-8 btn-island-primary"
            >
              <span className="pr-1">Try the workflow</span>
              <span className="btn-icon bg-white/15">
                <Arrow />
              </span>
            </Link>
            <div className="reveal mt-10 max-w-sm">
              <WorkflowGraphic />
            </div>
          </div>

          <div className="relative lg:col-span-7">
            <div className="absolute left-[27px] top-3 bottom-3 w-px bg-gradient-to-b from-transparent via-ink-900/10 to-transparent" />
            <ol className="space-y-6">
              {steps.map((s, i) => (
                <li key={s.n} className={`reveal reveal-delay-${i + 1}`}>
                  <div className="bezel">
                    <div className="bezel-core flex gap-5 p-6">
                      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ink-900 text-white font-display text-lg ring-4 ring-white">
                        {s.n}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-display text-2xl tracking-tightest text-ink-900">
                          {s.t}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-ink-500">
                          {s.d}
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ───── INTEGRITY SPOTLIGHT (dark editorial split) ───── */
const IntegritySpotlight = () => (
  <section
    id="integrity"
    className="relative overflow-hidden bg-ink-950 py-24 text-white md:py-32"
  >
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <span className="eyebrow eyebrow-dark reveal">
            Assessment integrity
          </span>
          <h2 className="reveal reveal-delay-1 mt-4 font-display text-4xl md:text-6xl tracking-tightest text-white text-balance">
            Assessment protection that respects{" "}
            <span className="text-primary-300">students.</span>
          </h2>
          <p className="reveal reveal-delay-2 mt-5 max-w-xl text-lg text-white/60 text-pretty">
            Sign in with email and password. Assessment timing and assignments
            are checked by the server. Browser activity events provide context
            for teacher review.
          </p>
          <ul className="reveal reveal-delay-3 mt-10 space-y-4">
            {[
              "Server-enforced assessment timing and assignment",
              "Browser events alongside submitted answers",
              "Results and feedback after teacher review",
              "Teacher judgment at the centre of review",
            ].map((line) => (
              <li key={line} className="flex items-start gap-3 text-white/80">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500/20 ring-1 ring-primary-400/40">
                  <Stroke
                    d="M5 13l4 4L19 7"
                    size={12}
                    className="text-primary-300"
                  />
                </span>
                <span className="text-sm leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
        </div>
        <figure className="reveal reveal-delay-2 min-w-0">
          <div className="bezel-dark">
            <div className="bezel-core-dark overflow-hidden">
              <PrivateResultsGraphic />
            </div>
          </div>
          <figcaption className="home-art-caption home-art-caption--dark mt-4 px-2">
            <p>Illustration · Submitted by students. Reviewed by you.</p>
          </figcaption>
        </figure>
      </div>
    </div>
  </section>
);

/* ───── METRICS strip ───── */
const Metrics = () => {
  const items = [
    { k: "Create", l: "Build course assessments" },
    { k: "Timed", l: "Server-enforced availability" },
    { k: "Review", l: "Teacher-approved grades" },
    { k: "Feedback", l: "Help students improve" },
  ];
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((m, i) => (
            <div
              key={m.k}
              className={`reveal reveal-delay-${i + 1} border-l border-ink-900/10 pl-6`}
            >
              <p className="font-display text-5xl tracking-tightest text-ink-900">
                {m.k}
              </p>
              <p className="mt-2 text-sm font-medium text-ink-500">{m.l}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ───── TESTIMONIALS — Z-axis cascade on desktop ───── */
const Testimonials = () => {
  const quotes = [
    {
      q: "Create course assessments and choose when enrolled students can start them.",
      a: "Create and schedule",
      r: "Teacher controls",
      rot: "md:-rotate-2",
    },
    {
      q: "Review answers and recorded events before saving a teacher grade and feedback.",
      a: "Review and grade",
      r: "Assessment workflow",
      rot: "md:rotate-1",
    },
    {
      q: "Organise topics, learning resources, and enrolled students within each course.",
      a: "Manage your courses",
      r: "Course workspace",
      rot: "md:-rotate-1",
    },
  ];

  return (
    <section id="trust" className="relative bg-ink-50 py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="reveal mx-auto max-w-3xl text-center">
          <span className="eyebrow eyebrow-light">Your workflow</span>
          <h2 className="mt-4 font-display text-4xl md:text-6xl tracking-tightest text-ink-900 text-balance">
            A clear path from questions to reviewed results.
          </h2>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-3">
          {quotes.map((qq, i) => (
            <figure
              key={i}
              className={`reveal reveal-delay-${i + 1} bezel ${qq.rot} transition-transform duration-700 ease-spring hover:rotate-0`}
            >
              <blockquote className="bezel-core flex h-full flex-col gap-6 p-7">
                <Stroke
                  d="M9 7H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2v3a2 2 0 0 1-2 2H4 M19 7h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2v3a2 2 0 0 1-2 2h-1"
                  size={28}
                  className="text-primary-500"
                />
                <p className="font-display text-xl leading-snug tracking-tightest text-ink-900">
                  {qq.q}
                </p>
                <figcaption className="mt-auto flex items-center gap-3 border-t border-ink-900/5 pt-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-accent-400 font-display text-white">
                    {qq.a.split(" ").slice(-1)[0][0]}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{qq.a}</p>
                    <p className="text-xs text-ink-500">{qq.r}</p>
                  </div>
                </figcaption>
              </blockquote>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ───── FINAL CTA ───── */
const FinalCTA = () => (
  <section className="relative px-4 py-32">
    <div className="reveal mx-auto max-w-6xl">
      <div className="bezel-dark">
        <div className="bezel-core-dark relative overflow-hidden px-8 py-24 sm:px-16 text-center">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-mesh-emerald opacity-80"
          />
          <span className="eyebrow eyebrow-dark">Ready when you are</span>
          <h2 className="mt-5 font-display text-5xl md:text-7xl tracking-tightest text-white text-balance">
            Bring integrity back to{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #6CE8B7 0%, #22D3EE 100%)",
              }}
            >
              every assessment.
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60 text-pretty">
            Manage courses, scheduled assessments and reviewed results with
            EraEdu.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to="/register" className="btn-island-emerald">
              <span className="pr-1">Create an account</span>
              <span className="btn-icon-dark">
                <Arrow />
              </span>
            </Link>
            <Link to="/contact" className="btn-island-ghost-dark">
              <span className="pr-1">Get support</span>
              <span className="btn-icon">
                <Arrow />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  </section>
);

/* ───── FOOTER ───── */
const Footer = () => (
  <footer className="border-t border-ink-900/5 bg-white">
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Brand to="/" />
          <p className="mt-5 max-w-sm text-sm text-ink-500">
            EraEdu is the integrity engine for modern classrooms. Built by
            educators, secured by engineers.
          </p>
        </div>
        {[
          {
            h: "Platform",
            l: [
              ["Features", "#features"],
              ["Workflow", "#how"],
              ["Integrity", "#integrity"],
              ["Trust", "#trust"],
            ],
          },
          {
            h: "Account",
            l: [
              ["Sign in", "/login"],
              ["Create account", "/register"],
              ["Profile", "/profile"],
            ],
          },
          {
            h: "Company",
            l: [
              ["Contact", "/contact"],
              ["Privacy", "/privacy"],
              ["Terms", "/terms"],
            ],
          },
        ].map((col) => (
          <div key={col.h} className="lg:col-span-2">
            <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-ink-400">
              {col.h}
            </p>
            <ul className="mt-4 space-y-2.5">
              {col.l.map(([label, href]) => (
                <li key={label}>
                  <Link
                    to={href.startsWith("#") ? `/${href}` : href}
                    className="text-sm text-ink-700 transition-colors duration-300 hover:text-primary-700"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="hairline-x mt-14" />
      <div className="mt-6 flex flex-col items-start justify-between gap-4 text-xs text-ink-400 sm:flex-row sm:items-center">
        <p>© {new Date().getFullYear()} EraEdu. All rights reserved.</p>
        <p className="font-mono">Engineered for academic integrity.</p>
      </div>
    </div>
  </footer>
);

const Pricing = () => {
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const plans = [
    { name: 'Explore', price: 'Free', description: 'A confident way to see how EraEdu fits your assessment workflow.', features: ['5 free assessment trials', 'AI integrity monitoring', 'Core exam analytics', 'No credit card required'], cta: 'Start 5 free trials', to: '/register' },
    { name: 'Institution', price: 'PKR 4,999', suffix: '/ month', description: 'One monthly licence for your whole institution, not per teacher.', features: ['Institution workspace', 'Unlimited assessments', 'Detailed integrity reports', 'Priority support'], cta: 'Pay with Safepay', to: '/profile', featured: true },
    { name: 'Enterprise', price: 'Custom', description: 'A tailored rollout for large departments and academic networks.', features: ['Everything in Institution', 'Flexible permissions', 'Institutional analytics', 'Dedicated onboarding'], cta: 'Talk to sales', to: '/contact' },
  ];
  const startCheckout = async () => {
    setCheckoutLoading(true);
    try { const response = await api.post('/safepay/checkout'); window.location.assign(response.data.data.url); }
    catch (error: any) { toast.error(error.response?.data?.error?.message || 'Please sign in with a teacher account to continue.'); setCheckoutLoading(false); }
  };

  return (
    <section id="pricing" className="relative overflow-hidden bg-white py-32">
      <div aria-hidden className="absolute inset-x-0 top-0 h-80 bg-mesh-emerald opacity-60" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="reveal mx-auto max-w-3xl text-center">
          <span className="eyebrow eyebrow-light">Simple pricing</span>
          <h2 className="mt-4 font-display text-4xl tracking-tightest text-ink-900 text-balance md:text-6xl">Start with five free trials. Scale when you are ready.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-500 text-pretty">Validate every feature with five complimentary assessment trials, then choose the plan that matches your classroom.</p>
        </div>

        <div className="mx-auto mt-16 grid max-w-6xl gap-5 lg:grid-cols-3 lg:items-stretch">
          {plans.map((plan, i) => (
            <article key={plan.name} className={`reveal reveal-delay-${i + 1} relative rounded-[2rem] p-1.5 ring-1 transition-transform duration-500 ease-spring hover:-translate-y-1 ${plan.featured ? 'bg-gradient-to-br from-primary-400 via-primary-500 to-accent-400 ring-primary-400/30 shadow-glow-emerald' : 'bg-ink-900/[0.04] ring-ink-900/5'}`}>
              {plan.featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary-800 px-3 py-1 text-[10px] font-semibold uppercase tracking-eyebrow text-white shadow-soft">Most popular</span>}
              <div className="flex h-full flex-col rounded-[calc(2rem-0.375rem)] bg-white p-7 sm:p-8">
                <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-primary-700">{plan.name}</p>
                <div className="mt-5 flex items-end gap-2"><span className="font-display text-5xl tracking-tightest text-ink-900">{plan.price}</span>{plan.suffix && <span className="mb-1 text-sm text-ink-500">{plan.suffix}</span>}</div>
                <p className="mt-4 min-h-[3rem] text-sm leading-relaxed text-ink-500">{plan.description}</p>
                <div className="my-7 h-px bg-ink-900/8" />
                <ul className="space-y-3.5">{plan.features.map((feature) => <li key={feature} className="flex items-start gap-3 text-sm text-ink-700"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700 ring-1 ring-primary-200"><Stroke d="M5 13l4 4L19 7" size={12} /></span>{feature}</li>)}</ul>
                {plan.featured ? <button type="button" onClick={startCheckout} disabled={checkoutLoading} className="btn-island-primary mt-8 w-full justify-between disabled:opacity-60"><span>{checkoutLoading ? 'Opening Safepay…' : 'Pay with Safepay'}</span><span className="btn-icon bg-white/15"><Arrow /></span></button> : <Link to={plan.to} className="btn-island-ghost mt-8 w-full justify-between"><span>{plan.cta}</span><span className="btn-icon bg-ink-900/[0.06]"><Arrow /></span></Link>}
              </div>
            </article>
          ))}
        </div>
        <p className="reveal mt-8 text-center text-sm text-ink-400">PKR 4,999 covers one institution for one month. Renew monthly to continue service.</p>
      </div>
    </section>
  );
};


const FAQ = () => {
  const [openQuestion, setOpenQuestion] = useState<number | null>(null);
  const questions = [
    ['What do the five free trials include?', 'Your institution can create up to five assessments on the free plan. The Institution plan unlocks unlimited assessment creation for its teachers.'],
    ['Is student camera footage stored?', 'EraEdu is designed for on-device face-presence checks. The product records configured integrity events for review, not a video recording of students.'],
    ['Can teachers control monitoring rules?', 'Yes. Teachers configure exam timing, availability, course access, violation limits, and supported integrity settings while creating an exam.'],
    ['Who should choose the Institution plan?', 'Choose it when your institution needs a shared workspace, multiple teachers, unlimited assessments, and detailed integrity reporting.'],
    ['How does payment work?', 'The Institution plan is a monthly Safepay checkout. The institution owner can activate the plan from their EraEdu profile.'],
  ];

  return (
    <section id="faq" className="relative bg-white/55 py-24 md:py-32">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow eyebrow-light">Questions, answered</span>
          <h2 className="mt-4 font-display text-4xl tracking-tightest text-ink-900 text-balance md:text-6xl">Everything you need before your first exam.</h2>
          <p className="mt-5 text-lg text-ink-500">Clear expectations for educators, institutions, and students.</p>
        </div>
        <div className="mt-12 space-y-3">
          {questions.map(([question, answer], index) => (
            <div key={question} className={`rounded-2xl bg-white/80 px-5 ring-1 ring-ink-900/5 transition-all ${openQuestion === index ? 'shadow-[0_16px_35px_-30px_rgba(4,120,87,.5)]' : ''}`}>
              <button
                type="button"
                onClick={() => setOpenQuestion((current) => current === index ? null : index)}
                className="flex w-full items-center justify-between gap-6 py-5 text-left text-sm font-semibold text-ink-900"
                aria-expanded={openQuestion === index}
                aria-controls={`faq-answer-${index}`}
              >
                {question}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-lg font-normal text-primary-700">
                  +
                </span>
              </button>
              {openQuestion === index && <p id={`faq-answer-${index}`} className="max-w-3xl pb-5 text-sm leading-relaxed text-ink-500">{answer}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};


/* ───── PAGE ROOT ───── */
const LandingPage = () => {
  useReveal();

  return (
    <div
      data-reveal-root
      data-home-visible="true"
      className="home-page min-h-[100dvh] bg-ink-50 text-ink-900 grain-fixed"
    >
      <a href="#main-content" className="skip-link">Skip to content</a>
      <NavIsland />
      <main id="main-content" tabIndex={-1}>
        <Hero />

        <FeaturesBento />
        <HowItWorks />
        <IntegritySpotlight />
        <Metrics />
        <Pricing />
        <Testimonials />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
};

export default LandingPage;
