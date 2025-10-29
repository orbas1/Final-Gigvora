import Surface from '../../components/primitives/Surface'
import Button from '../../components/primitives/Button'
import Icon from '../../components/primitives/Icon'
import './HomePage.css'

const metrics = [
  { label: 'Talent activated', value: '42k+' },
  { label: 'Global marketplaces', value: '68' },
  { label: 'Avg. time-to-match', value: '36 hrs' },
]

const features = [
  {
    icon: 'insight',
    title: 'Command centre visibility',
    description:
      'Unify marketplace, talent, and payments telemetry into a single workspace tuned for your operators.',
  },
  {
    icon: 'team',
    title: 'Network intelligence',
    description:
      'Activate private talent graphs with live availability, verified credentials, and AI-curated shortlists.',
  },
  {
    icon: 'wallet',
    title: 'Trusted payments',
    description:
      'Spin up compliant escrow, milestone releases, and multi-currency payouts across 195 countries.',
  },
  {
    icon: 'shield',
    title: 'Enterprise guardrails',
    description:
      'Deploy configurable approval flows, audit trails, and marketplace-grade dispute tooling out of the box.',
  },
  {
    icon: 'calendar',
    title: 'Live collaboration',
    description:
      'Co-create briefs, structured updates, and async stand-ups with clients and talent in real time.',
  },
  {
    icon: 'celebrate',
    title: 'Launch-ready playbooks',
    description:
      'Ship curated onboarding journeys, nurture cadences, and campaign automation without extra headcount.',
  },
]

const moments = [
  {
    title: 'Go live in days, not quarters',
    description:
      'Launch a branded marketplace with pre-built flows for sourcing, vetting, contracting, and payouts.',
  },
  {
    title: 'Unlock premium talent revenue',
    description:
      'Convert static communities into revenue engines with offers, subscriptions, and bundled services.',
  },
  {
    title: 'Scale globally with confidence',
    description:
      'Gigvora partners handle compliance, localisation, and treasury so your team can focus on growth.',
  },
]

const testimonials = [
  {
    quote:
      '“We replaced six disconnected tools with Gigvora. Our operators now orchestrate talent, payments, and partner activations from one canvas.”',
    author: 'Mira Tal, COO · Northglow Collective',
  },
  {
    quote:
      '“Gigvora gave us the rails to launch a premium talent marketplace in 30 days. Conversion lifted 28% with their guided proposals.”',
    author: 'Devin Alvarez, Head of Ops · Aurora Labs',
  },
]

const partnerLogos = ['Aurora', 'Northglow', 'Solstice', 'Atlas', 'Gradient', 'Lumen']

const journey = [
  {
    stage: '1. Align',
    summary: 'Co-design your talent thesis with our solution architects and import your existing graph.',
  },
  {
    stage: '2. Launch',
    summary: 'Brand the experience, invite early operators, and go live with guided playbooks.',
  },
  {
    stage: '3. Scale',
    summary: 'Expand to new markets with performance tooling, automation, and premium monetisation.',
  },
]

function HomePage() {
  return (
    <div className="home">
      <header className="home__nav">
        <div className="home__logo" aria-label="Gigvora">
          <span>Gigvora</span>
        </div>
        <nav className="home__nav-links" aria-label="Primary">
          <a href="#platform">Platform</a>
          <a href="#features">Capabilities</a>
          <a href="#stories">Stories</a>
          <a href="#launch">Launch program</a>
        </nav>
        <div className="home__nav-actions">
          <Button variant="ghost" size="sm">
            Book a demo
          </Button>
          <Button size="sm">Launch console</Button>
        </div>
      </header>

      <main>
        <section className="home__hero" id="platform">
          <div className="home__hero-content">
            <div className="home__tag">
              <span>New</span> Launch your marketplace in days
            </div>
            <h1>Build trust-first talent ecosystems with Gigvora</h1>
            <p>
              Gigvora is the operating system for global talent marketplaces. Power sourcing, activation, collaboration, and
              payments from one composable command centre.
            </p>
            <div className="home__hero-actions">
              <Button size="lg">Start the launch program</Button>
              <Button variant="glass" size="lg">
                Explore the product deck
              </Button>
            </div>
            <dl className="home__metrics">
              {metrics.map((metric) => (
                <div key={metric.label}>
                  <dt>{metric.label}</dt>
                  <dd>{metric.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <Surface className="home__hero-preview" elevation="lg" padding="none" aria-label="Gigvora product preview">
            <div className="home__preview-top">
              <div>
                <strong>Operator pulse</strong>
                <span>Live marketplace telemetry</span>
              </div>
              <Button variant="ghost" size="sm">
                View dashboard
              </Button>
            </div>
            <div className="home__preview-grid">
              <Surface elevation="md" className="home__preview-card" padding="lg">
                <h3>Opportunities</h3>
                <ul>
                  <li>
                    <strong>Product Design Sprints</strong>
                    <span>£18k · 12 days · Remote</span>
                  </li>
                  <li>
                    <strong>Marketplace PM</strong>
                    <span>$12k · 8 weeks · Hybrid</span>
                  </li>
                  <li>
                    <strong>Growth Collective</strong>
                    <span>€9k · Retainer · Remote</span>
                  </li>
                </ul>
              </Surface>
              <Surface elevation="md" className="home__preview-card" padding="lg">
                <h3>Talent heatmap</h3>
                <ul>
                  <li>
                    <span>Product</span>
                    <strong>94%</strong>
                  </li>
                  <li>
                    <span>Engineering</span>
                    <strong>88%</strong>
                  </li>
                  <li>
                    <span>Growth</span>
                    <strong>82%</strong>
                  </li>
                </ul>
              </Surface>
              <Surface elevation="md" className="home__preview-card" padding="lg">
                <h3>Escrow in motion</h3>
                <ul>
                  <li>
                    <span>Settled</span>
                    <strong>$2.4m</strong>
                  </li>
                  <li>
                    <span>Pending</span>
                    <strong>$640k</strong>
                  </li>
                  <li>
                    <span>On hold</span>
                    <strong>$88k</strong>
                  </li>
                </ul>
              </Surface>
            </div>
          </Surface>
        </section>

        <section className="home__partners" aria-label="Customer logos">
          {partnerLogos.map((partner) => (
            <span key={partner}>{partner}</span>
          ))}
        </section>

        <section className="home__features" id="features">
          <div className="home__section-heading">
            <span className="home__eyebrow">Capabilities</span>
            <h2>Designed for operators who build trust into every interaction</h2>
            <p>
              Modular building blocks let you orchestrate bespoke talent experiences without rebuilding core infrastructure.
            </p>
          </div>
          <div className="home__features-grid">
            {features.map((feature) => (
              <Surface key={feature.title} className="home__feature-card" padding="lg" elevation="md" interactive>
                <div className="home__feature-icon">
                  <Icon name={feature.icon} size={28} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </Surface>
            ))}
          </div>
        </section>

        <section className="home__moments" id="stories">
          <Surface elevation="lg" padding="lg" className="home__moments-surface">
            <div className="home__section-heading">
              <span className="home__eyebrow">Operator outcomes</span>
              <h2>Moments teams unlock with Gigvora</h2>
              <p>Every workflow is instrumented with telemetry, automation, and human-first interactions.</p>
            </div>
            <div className="home__moments-grid">
              {moments.map((moment) => (
                <div key={moment.title}>
                  <h3>{moment.title}</h3>
                  <p>{moment.description}</p>
                </div>
              ))}
            </div>
          </Surface>
        </section>

        <section className="home__testimonials">
          {testimonials.map((testimonial) => (
            <Surface key={testimonial.author} elevation="md" padding="lg" className="home__testimonial">
              <p className="home__testimonial-quote">{testimonial.quote}</p>
              <p className="home__testimonial-author">{testimonial.author}</p>
            </Surface>
          ))}
        </section>

        <section className="home__journey" id="launch">
          <div className="home__section-heading">
            <span className="home__eyebrow">Launch program</span>
            <h2>Co-pilot your rollout with Gigvora specialists</h2>
            <p>We partner with your operators across three focused sprints to deliver value on week one.</p>
          </div>
          <div className="home__journey-grid">
            {journey.map((step) => (
              <Surface key={step.stage} elevation="md" padding="lg" className="home__journey-card">
                <h3>{step.stage}</h3>
                <p>{step.summary}</p>
              </Surface>
            ))}
          </div>
        </section>

        <section className="home__cta">
          <Surface elevation="lg" padding="lg" className="home__cta-surface">
            <div>
              <span className="home__eyebrow">Ready to activate?</span>
              <h2>Schedule a workshop with the Gigvora launch team</h2>
              <p>
                Bring your marketplace vision, we will bring operating playbooks, activation specialists, and global compliance
                rails.
              </p>
            </div>
            <div className="home__cta-actions">
              <Button size="lg">Book a workshop</Button>
              <Button variant="ghost" size="lg">
                Download product deck
              </Button>
            </div>
          </Surface>
        </section>
      </main>

      <footer className="home__footer">
        <div className="home__footer-inner">
          <div>
            <strong>Gigvora</strong>
            <p>Building trusted talent ecosystems for the modern economy.</p>
          </div>
          <div className="home__footer-links">
            <a href="#platform">Platform</a>
            <a href="#features">Capabilities</a>
            <a href="#stories">Stories</a>
            <a href="#launch">Launch program</a>
          </div>
          <p className="home__footer-note">© {new Date().getFullYear()} Gigvora. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

export default HomePage
