# Gigvora Lander

This project is a Vite-powered React single page experience that introduces the Gigvora ecosystem. It showcases the brand logo
and favicon, highlights platform capabilities, and provides a waitlist capture call-to-action.

## Getting started

```bash
npm install
npm run dev
```

The development server starts on [http://localhost:5173](http://localhost:5173) by default.

## Available scripts

- `npm run dev` – start the development server with hot reloading.
- `npm run build` – create a production build in `dist/`.
- `npm run lint` – run ESLint using the shared configuration.
- `npm run preview` – serve the production build locally for inspection.

## Project structure

```
Front-End/
└── gigvora-lander/
    ├── public/           # Static assets (favicon)
    ├── src/
    │   ├── App.jsx       # Landing page layout and sections
    │   ├── App.css       # Styling with glassmorphism-inspired theme
    │   ├── assets/       # Gigvora brand imagery
    │   ├── index.css     # Global styles and typography
    │   └── main.jsx      # React entry point
    └── vite.config.js    # Vite configuration
```

The landing page content can be customised by editing `src/App.jsx` and its accompanying styles.
