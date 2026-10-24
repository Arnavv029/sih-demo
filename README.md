# AICTE Application Verification Portal

A Vite + React demonstration of institution application submission and officer review workflows.

## Run locally

Prerequisite: Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Use the **Restore Demo Credentials** button on the login screen to populate the demo account fields. Login fields are blank by default. A newly registered institute is available only for the current browser session; refreshing the page clears its account.

## Validate

```sh
npm test
npm run lint
npm run build
npm run preview
```

`npm run build` creates the static deployment bundle in `dist/`. Deploy that directory to a static hosting provider configured to serve `index.html` as the fallback for application routes.

## Project layout

```text
src/
  components/     React pages and workflow views
  data/           Demo profiles, applications, and DocuPass sample records
  utils/          Application rules, report generation, and PDF export
  App.jsx         Portal state and top-level navigation
  main.jsx        React entry point
  index.css       Tailwind and global styles
public/           Static assets copied to dist/
```

## Prototype limitations

This repository is a frontend-only prototype, not a production authentication or application service. Demo accounts and workflow decisions are client-side simulations. New institute registration and its password exist only in application memory for the current page session. Uploaded files are represented by client-side metadata and are not sent to durable storage. There is no API, database, server-side authorization, password recovery, real OCR/signature verification, or durable audit log.

Before using this for real institutions or deploying it as a production service, implement and review a backend for identity verification, secure password handling, authorization, database persistence, uploaded-file storage/scanning, and audit logging. Do not enter real credentials or sensitive application documents into this demo.
