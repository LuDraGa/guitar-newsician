# WereCode Frontend

Modern React frontend built with Vite, TypeScript, and Tailwind CSS.

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Zustand** - Lightweight state management
- **Zod** - TypeScript-first schema validation
- **ESLint + Prettier** - Code quality and formatting

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Analyze Bundle Size

```bash
npm run analyze
```

This generates a visual bundle size report at `dist/stats.html`.

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run analyze` - Analyze bundle size

## Project Structure

```
frontend/
├── src/
│   ├── components/      # React components
│   ├── store/           # Zustand stores
│   ├── schemas/         # Zod validation schemas
│   ├── App.tsx          # Main app component
│   ├── main.tsx         # Entry point
│   └── index.css        # Global styles + Tailwind
├── public/              # Static assets
├── index.html           # HTML template
├── vite.config.ts       # Vite configuration
├── tailwind.config.js   # Tailwind configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies and scripts
```

## Build Optimization

The Vite configuration includes:

- **Code splitting** - Automatic vendor chunk splitting
- **Tree shaking** - Remove unused code
- **Minification** - Terser with optimized settings
- **Asset optimization** - Optimized images and CSS
- **Bundle visualization** - rollup-plugin-visualizer

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Vercel auto-detects Vite and deploys

Or use Vercel CLI:

```bash
npm install -g vercel
vercel
```

### Other Platforms

Build the project and deploy the `dist` folder:

```bash
npm run build
# Deploy the dist/ folder to your hosting platform
```

## Environment Variables

Copy `.env.example` to `.env.local` and update values:

```bash
cp .env.example .env.local
```

All environment variables must be prefixed with `VITE_` to be exposed to the client.

## Code Quality

- **ESLint** - Enforces code quality rules
- **Prettier** - Auto-formats code
- **TypeScript** - Strict type checking
- **Tailwind Plugin** - Auto-sorts Tailwind classes

Run checks before committing:

```bash
npm run lint
npm run format:check
```

## License

MIT
