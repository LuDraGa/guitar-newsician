import { motion } from 'framer-motion'
import { Button, Container, BentoCard } from '@/components/ui'

export function LandingPage() {
  const fadeIn = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 },
  }

  return (
    <div className="min-h-screen bg-dark-400">
      {/* Background gradient mesh */}
      <div className="fixed inset-0 bg-gradient-mesh opacity-40" />

      {/* Floating Glassmorphic Nav */}
      <nav className="fixed left-1/2 top-6 z-50 -translate-x-1/2">
        <div className="nav-glass rounded-full px-6 py-3 shadow-2xl">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-accent" />
              <span className="font-display text-sm font-semibold text-white">
                WereCode
              </span>
            </div>
            <div className="flex items-center gap-6">
              <a
                href="#features"
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                Features
              </a>
              <a
                href="#docs"
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                Docs
              </a>
              <a
                href="#pricing"
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                Pricing
              </a>
            </div>
            <Button size="sm" className="rounded-full">
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-24 sm:pt-40 sm:pb-32">
        {/* Accent glow orbs */}
        <div className="absolute left-1/4 top-20 h-[600px] w-[600px] animate-pulse-slow rounded-full bg-accent-500/10 blur-3xl" />
        <div className="absolute bottom-20 right-1/4 h-[600px] w-[600px] animate-pulse-slow rounded-full bg-accent-400/10 blur-3xl" />

        <Container className="relative">
          <motion.div className="mx-auto max-w-5xl text-center" {...fadeIn}>
            {/* Badge */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-accent-500/20 bg-accent-500/5 px-4 py-2 text-sm font-mono backdrop-blur-sm">
              <div className="h-2 w-2 animate-pulse rounded-full bg-accent-400" />
              <span className="text-accent-300">Now in Beta</span>
            </div>

            {/* Main Heading - Display Font */}
            <h1 className="mb-6 font-display text-6xl font-bold leading-[1.05] tracking-tight text-white sm:text-7xl lg:text-8xl">
              Music Analysis
              <br />
              <span className="text-gradient">Reimagined</span>
            </h1>

            {/* Subheading - Body Font */}
            <p className="mx-auto mb-12 max-w-2xl text-lg leading-relaxed text-gray-400 sm:text-xl">
              Download, analyze, and dissect music with AI-powered stem separation,
              tempo detection, and synchronized lyrics—all in one platform.
            </p>

            {/* CTA */}
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" className="min-w-[200px] rounded-full">
                Get Started Free
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-w-[200px] rounded-full"
              >
                View Demo →
              </Button>
            </div>

            {/* Stats */}
            <div className="mt-20 grid grid-cols-3 gap-8 border-t border-white/5 pt-12">
              <div>
                <div className="mb-2 font-display text-4xl font-bold text-white">
                  10K+
                </div>
                <div className="font-mono text-sm text-gray-500">
                  Songs Analyzed
                </div>
              </div>
              <div>
                <div className="mb-2 font-display text-4xl font-bold text-accent-400">
                  98%
                </div>
                <div className="font-mono text-sm text-gray-500">Accuracy</div>
              </div>
              <div>
                <div className="mb-2 font-display text-4xl font-bold text-white">
                  &lt;2min
                </div>
                <div className="font-mono text-sm text-gray-500">
                  Processing Time
                </div>
              </div>
            </div>
          </motion.div>
        </Container>
      </section>

      {/* Bento Grid Features */}
      <section className="relative py-24">
        <Container>
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-display text-4xl font-bold text-white sm:text-5xl">
              Everything you need
            </h2>
            <p className="text-lg text-gray-400">
              Powerful tools for music analysis and manipulation
            </p>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-4 md:grid-rows-3">
            {/* Large feature - Stem Separation */}
            <BentoCard size="2x2" className="group/card flex flex-col justify-between">
              <div>
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-accent shadow-lg shadow-accent-500/20 transition-shadow group-hover/card:shadow-accent-500/40">
                  <svg
                    className="h-7 w-7 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                    />
                  </svg>
                </div>
                <h3 className="mb-3 font-display text-2xl font-bold text-white">
                  AI Stem Separation
                </h3>
                <p className="text-gray-400">
                  Separate any song into vocals, drums, bass, and instruments with
                  state-of-the-art AI models. Crystal clear isolation in seconds.
                </p>
              </div>
              <div className="mt-8 h-48 rounded-2xl bg-gradient-to-br from-accent-500/10 via-gray-900/50 to-dark-300" />
            </BentoCard>

            {/* Music Analysis */}
            <BentoCard size="2x1" className="group/card">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-800 transition-colors group-hover/card:bg-accent-500/20">
                <svg
                  className="h-6 w-6 text-gray-300 transition-colors group-hover/card:text-accent-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h3 className="mb-2 font-display text-xl font-bold text-white">
                Deep Analysis
              </h3>
              <p className="text-sm text-gray-400">
                Detect tempo, key, chords, and song structure with precision
              </p>
            </BentoCard>

            {/* Real-time Processing */}
            <BentoCard size="1x1" className="group/card">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-800 transition-colors group-hover/card:bg-accent-500/20">
                <svg
                  className="h-6 w-6 text-gray-300 transition-colors group-hover/card:text-accent-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="mb-2 font-display text-lg font-bold text-white">
                Lightning Fast
              </h3>
              <p className="font-mono text-xs text-gray-500">
                Background processing
              </p>
            </BentoCard>

            {/* Synced Lyrics */}
            <BentoCard size="1x1" className="group/card">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-800 transition-colors group-hover/card:bg-accent-500/20">
                <svg
                  className="h-6 w-6 text-gray-300 transition-colors group-hover/card:text-accent-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                  />
                </svg>
              </div>
              <h3 className="mb-2 font-display text-lg font-bold text-white">
                Synced Lyrics
              </h3>
              <p className="font-mono text-xs text-gray-500">
                Timestamped playback
              </p>
            </BentoCard>

            {/* Studio Mixer */}
            <BentoCard size="2x1" className="group/card">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-800 transition-colors group-hover/card:bg-accent-500/20">
                <svg
                  className="h-6 w-6 text-gray-300 transition-colors group-hover/card:text-accent-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                  />
                </svg>
              </div>
              <h3 className="mb-2 font-display text-xl font-bold text-white">
                Professional Mixer
              </h3>
              <p className="text-sm text-gray-400">
                Multi-track playback with mute, solo, and volume controls
              </p>
            </BentoCard>

            {/* Download */}
            <BentoCard size="1x1" className="group/card">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-800 transition-colors group-hover/card:bg-accent-500/20">
                <svg
                  className="h-6 w-6 text-gray-300 transition-colors group-hover/card:text-accent-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </div>
              <h3 className="mb-2 font-display text-lg font-bold text-white">
                Easy Import
              </h3>
              <p className="font-mono text-xs text-gray-500">YouTube Music</p>
            </BentoCard>

            {/* API */}
            <BentoCard size="1x1" className="group/card">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-800 transition-colors group-hover/card:bg-accent-500/20">
                <svg
                  className="h-6 w-6 text-gray-300 transition-colors group-hover/card:text-accent-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
              </div>
              <h3 className="mb-2 font-display text-lg font-bold text-white">
                REST API
              </h3>
              <p className="font-mono text-xs text-gray-500">Full OpenAPI</p>
            </BentoCard>
          </div>
        </Container>
      </section>

      {/* CTA Section */}
      <section className="relative py-24">
        <Container>
          <div className="relative overflow-hidden rounded-3xl border border-accent-500/20 bg-gradient-to-br from-accent-500/10 via-dark-200 to-dark-300 p-16 text-center backdrop-blur-sm">
            <div className="relative z-10">
              <h2 className="mb-4 font-display text-4xl font-bold text-white sm:text-5xl">
                Ready to transform your music?
              </h2>
              <p className="mb-8 text-lg text-gray-300">
                Start analyzing music for free. No credit card required.
              </p>
              <Button size="lg" className="min-w-[200px] rounded-full shadow-2xl">
                Get Started Now
              </Button>
            </div>
            {/* Decorative gradient */}
            <div className="absolute -right-32 -top-32 h-72 w-72 rounded-full bg-accent-500/20 blur-3xl" />
            <div className="absolute -bottom-32 -left-32 h-72 w-72 rounded-full bg-accent-400/20 blur-3xl" />
          </div>
        </Container>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12">
        <Container>
          <div className="flex flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
            <div>
              <div className="mb-2 flex items-center justify-center gap-2 sm:justify-start">
                <div className="h-6 w-6 rounded-lg bg-gradient-accent" />
                <span className="font-display text-lg font-semibold text-white">
                  WereCode
                </span>
              </div>
              <p className="text-sm text-gray-500">
                Music analysis & transcription platform
              </p>
            </div>
            <div className="flex gap-8 font-mono text-sm text-gray-500">
              <a href="#" className="transition-colors hover:text-accent-400">
                Features
              </a>
              <a href="#" className="transition-colors hover:text-accent-400">
                Documentation
              </a>
              <a href="#" className="transition-colors hover:text-accent-400">
                API
              </a>
              <a href="#" className="transition-colors hover:text-accent-400">
                GitHub
              </a>
            </div>
          </div>
          <div className="mt-8 border-t border-white/5 pt-8 text-center font-mono text-sm text-gray-600">
            © 2025 WereCode. Built with React, Vite, and Tailwind CSS.
          </div>
        </Container>
      </footer>
    </div>
  )
}
