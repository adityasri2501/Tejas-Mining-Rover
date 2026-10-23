# HackBios Rover

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-98.5%25-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/Supabase-Postgres-3ECF8E?style=for-the-badge&logo=supabase" alt="Supabase" />
</p>

A modern mining safety and workforce management platform built for real-world safety operations. This project combines PPE inspection, attendance tracking, hazard monitoring, and remote rover access for mining teams.

Live Demo: https://hack-bios-rover.vercel.app

Video Demo: https://www.youtube.com/shorts/rsTL63lPHdQ?si=A1TVd2HE-u_kVX76

## Overview

HackBios Rover is a full-stack frontend application designed for mining and industrial safety teams. It helps teams:

- register workers and review PPE compliance
- mark attendance and manage check-in/check-out flow
- monitor site hazards through a risk heatmap dashboard
- view and export safety insights from various mine zones
- access a remote rover dashboard for mining operations

The application is built with Vite, React, TypeScript, Tailwind CSS, and Supabase, with a heavy focus on operational dashboards and worker safety workflows.

## Key Features

### 1. Worker Safety Registration
- Upload or capture a worker photo
- Analyze visible PPE using AI-powered inspection workflow
- Review helmet, vest, gloves, boots, and goggles status
- Save worker details and attendance record in one flow

### 2. Attendance Management
- Track today's attendance
- Review worker entry and exit times
- Manage attendance adjustments and updates
- Prevent duplicate active IN entries for the same worker

### 3. Risk Heatmap
- View hazard data by site, area, shift, and category
- Filter safety incidents by severity
- Export hazard data as CSV for reporting

### 4. Rover Access
- Open the existing remote rover dashboard from the MineScan interface
- Provide a central operational control panel for mining teams

### 5. Authenticated Dashboard UX
- Protected routes with session-based access
- Clean operational theme designed for field teams
- Responsive layout for desktop and tablet-style workflows

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui components
- React Router
- Supabase for auth and data storage
- Recharts for dashboard visualization
- Lucide React for icons

## Project Structure

```bash
.
├── src/
│   ├── components/
│   ├── integrations/
│   ├── lib/
│   ├── pages/
│   ├── App.tsx
│   └── main.tsx
├── public/
├── supabase/
├── Hardware/
├── .env.example
├── .gitignore
├── components.json
├── deno.json
├── eslint.config.js
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── README.md
└── package-lock.json
```

## Main Application Pages

- `/login` — authentication screen
- `/` — MineScan dashboard home
- `/safety` — worker PPE analysis and registration
- `/attendance` — today's attendance overview
- `/modify-attendance` — updates to attendance records
- `/heatmap` — hazard heatmap and incident monitoring

## Getting Started

### Prerequisites

Before running this project, make sure you have:

- Node.js 18+
- npm or bun
- A Supabase project with the required database tables and storage buckets
- A browser with camera permissions enabled for photo capture

### Installation

```bash
git clone https://github.com/adityasri2501/HackBios-Rover.git
cd HackBios-Rover
npm install
```

### Environment Variables

Create a `.env` file in the root of the project and configure your Supabase credentials.

Example:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can also refer to the repository's `.env.example` for the base setup.

### Run the Development Server

```bash
npm run dev
```

Then open the app at:

```bash
http://localhost:5173
```

### Production Build

```bash
npm run build
```

Preview the build locally:

```bash
npm run preview
```

## Features in Detail

### MineScan Dashboard
The home dashboard provides quick access to the main operational workflows:

- Analyze Image & Add Attendance
- Open Rover Dashboard
- View Today's Attendance
- Modify Attendance Records

### PPE Analysis Workflow
The app allows workers to be checked against required protective equipment. The flow includes:

1. upload worker image
2. capture photo from camera (if available)
3. analyze visible PPE elements
4. review AI assessment
5. save worker record and attendance event

### Heatmap Monitoring
The heatmap page offers:

- filterable hazard views
- severity categorization
- exportable reporting CSV
- visual location summaries for operational teams

## Supabase Integration

This project uses Supabase for:

- authentication
- worker registry storage
- attendance tracking
- storage of uploaded worker images
- function calls for analysis and data retrieval

## Deployment

This project is currently configured for deployment to Vercel, as indicated by the demo URL.

Typical deployment steps:

```bash
npm run build
```

Then deploy the generated static app to your platform of choice (Vercel, Netlify, or a custom hosting setup).

## Contributing

Contributions are welcome. If you’d like to improve the project:

1. fork the repository
2. create a feature branch
3. make your changes
4. open a pull request with a clear description

## Notes

This repository is built as a modern TypeScript application focused on mining safety, attendance, and operational monitoring. It is particularly useful for organizations that need a single interface to manage PPE compliance, worker tracking, and hazard monitoring in the field.

## Contact

For questions or collaboration opportunities, reach out to the repository owner:

- GitHub: https://github.com/adityasri2501

---

Built with care for safer mining operations and better workforce visibility.
