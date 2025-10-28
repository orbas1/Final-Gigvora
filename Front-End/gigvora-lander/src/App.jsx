import './App.css'

const featureHighlights = [
  {
    title: 'Unified Work Graph',
    description:
      'Bring projects, gigs, jobs, and communities together in a single operating system designed for modern, flexible teams.',
  },
  {
    title: 'Intelligent Matching',
    description:
      'Match with opportunities and collaborators using skills, goals, availability, and trust indicators that evolve with you.',
  },
  {
    title: 'Glassmorphism UI Toolkit',
    description:
      'Craft premium client experiences with adaptive components, global theming, and real-time collaboration primitives.',
  },
]

const ecosystemPillars = [
  {
    heading: 'Create',
    copy: 'Launch projects, gigs, and roles with guided flows, escrow-ready milestones, and collaborative briefs.',
  },
  {
    heading: 'Collaborate',
    copy: 'Messages, live speed networking, and shared workspaces keep momentum high across time zones.',
  },
  {
    heading: 'Grow',
    copy: 'Insights, recommendations, and reputation tools help you convert connections into long-term partnerships.',
  },
]

function App() {
  return (
    <div className="page-shell">
      <header className="hero">
        <nav className="top-nav">
          <div className="brand">
            <img src="/logo.png" alt="Gigvora logo" className="brand__mark" />
            <span className="brand__wordmark">Gigvora</span>
          </div>
          <div className="nav-links">
            <a href="#features">Platform</a>
            <a href="#ecosystem">Ecosystem</a>
            <a href="#cta">Join</a>
          </div>
          <a className="nav-cta" href="#cta">
            Request Access
          </a>
        </nav>
        <div className="hero__content">
          <p className="tagline">The professional universe, illuminated.</p>
          <h1>
            Build, scale, and celebrate the future of work with a platform engineered for bold creators and teams.
          </h1>
          <p className="hero__body">
            Gigvora unifies marketplaces, messaging, communities, and workflow automation into one beautiful glassmorphic
            experience. Power your next collaboration with trust, clarity, and momentum from day zero.
          </p>
          <div className="hero__actions">
            <a className="primary-button" href="#cta">
              Secure Early Access
            </a>
            <a className="ghost-button" href="#features">
              Explore Capabilities
            </a>
          </div>
        </div>
        <div className="hero__showcase">
          <div className="stat-card">
            <span className="stat-value">12+</span>
            <span className="stat-label">Integrated work streams</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">360°</span>
            <span className="stat-label">Visibility across teams</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">24/7</span>
            <span className="stat-label">Global support & security</span>
          </div>
        </div>
      </header>

      <main>
        <section id="features" className="feature-grid">
          {featureHighlights.map((feature) => (
            <article key={feature.title} className="feature-card">
              <h2>{feature.title}</h2>
              <p>{feature.description}</p>
            </article>
          ))}
        </section>

        <section id="ecosystem" className="ecosystem">
          <div className="ecosystem__intro">
            <h2>Launch a full-spectrum ecosystem</h2>
            <p>
              From initial idea to global community, Gigvora equips builders with the infrastructure to orchestrate
              high-trust relationships, real-time decisioning, and scalable monetisation.
            </p>
          </div>
          <div className="ecosystem__pillars">
            {ecosystemPillars.map((pillar) => (
              <article key={pillar.heading} className="pillar-card">
                <h3>{pillar.heading}</h3>
                <p>{pillar.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="testimonial">
          <blockquote>
            “Gigvora reframes work as a shared, living network. The experience is luminous, immediate, and designed for
            creative momentum.”
          </blockquote>
          <p className="testimonial__attribution">— Founding Community Partner</p>
        </section>
      </main>

      <footer id="cta" className="footer-cta">
        <div className="footer-cta__content">
          <h2>Ready to light up your work galaxy?</h2>
          <p>
            Request an invitation to the Gigvora early access program and be among the first to craft projects, gigs, and
            global communities with our unified glassmorphic studio.
          </p>
        </div>
        <form className="cta-form">
          <label htmlFor="email" className="visually-hidden">
            Email address
          </label>
          <input id="email" type="email" name="email" placeholder="Enter your email" required />
          <button type="submit">Join the Waitlist</button>
        </form>
        <small className="footer-note">© {new Date().getFullYear()} Gigvora. All rights reserved.</small>
      </footer>
    </div>
  )
}

export default App
