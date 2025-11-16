# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Build and Development:**
- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run Next.js linter

**Package Manager:** This project uses pnpm (not npm or yarn)

## Architecture Overview

This is a Next.js 15 application built with v0.app for creating an AI Agent Readiness Score tool. The application evaluates how easily AI agents can navigate websites and accomplish specific goals.

**Key Technologies:**
- Next.js 15 with App Router
- React 19 with TypeScript
- Tailwind CSS with shadcn/ui components
- Radix UI primitives for accessibility

**Project Structure:**
- `app/` - Next.js app router pages and layouts
- `components/` - Reusable UI components (shadcn/ui based)
- `lib/` - Utility functions and shared logic
- `public/` - Static assets
- `styles/` - Global CSS files

**Component System:**
- Uses shadcn/ui component library with "new-york" style variant
- Components are located in `components/ui/`
- Custom theme provider in `components/theme-provider.tsx`
- Path aliases configured: `@/` maps to root directory

**Main Application:**
- Single-page application (`app/page.tsx`) that provides a form for testing website agent readiness
- Supports testing different agent goals: login, checkout, and navigation
- Generates mock readiness scores (currently simulated, not real analysis)

**Styling:**
- Tailwind CSS with CSS variables for theming
- Custom animations with tailwindcss-animate
- Responsive design with mobile-first approach

**API Integration:**
- Uses Browserbase for hosted browser sessions
- Integrates with Stagehand for AI agent automation
- Requires environment variables: `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, `ANTHROPIC_API_KEY`

**Application Workflow:**
1. User inputs website URL to test
2. Creates Browserbase session for manual task completion
3. Captures screenshot after manual task completion  
4. User inputs agent prompt describing the task
5. Stagehand agent executes the prompt on a fresh browser session
6. Screenshots are compared to determine success (100) or failure (0)

**API Routes:**
- `/api/session/create` - Creates new Browserbase session
- `/api/session/screenshot` - Captures screenshot from session
- `/api/agent/execute` - Executes Stagehand agent with prompt
- `/api/compare` - Compares manual vs agent screenshots

**Dependencies:**
- `@browserbasehq/stagehand` - AI browser automation framework
- `playwright` - Browser automation (used by Stagehand)

**Note:** This was originally a v0.app generated project but has been significantly modified to include AI agent testing capabilities with Browserbase and Stagehand integration.
