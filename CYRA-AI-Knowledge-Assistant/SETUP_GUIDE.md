# CYRA — Setup Guide for Windows (beginner friendly)

Follow the steps in order. Anything in a grey box is typed into **PowerShell**, then press **Enter**.
Where this guide says `<project folder>`, it means the folder that contains `README.md`
(for example `C:\Users\HP\Desktop\CYRA`).

---

## Part 1 — Install the software (once)

1. **Python 3.11.** Download from https://www.python.org/downloads/ . In the installer, tick
   **"Add python.exe to PATH"**. Check it worked (open a new PowerShell):
   ```powershell
   py -3.11 --version
   ```
   It should print `Python 3.11.x`.
2. **Node.js (LTS).** Download from https://nodejs.org/ and install with the defaults. Check:
   ```powershell
   node --version
   npm --version
   ```
3. **Tesseract OCR — optional.** It is only needed to read pages that are pictures (scanned pages).
   Ordinary text PDFs work without it. The bundled handbook has 5 picture-only pages
   (the cover, and a few blank/graphic pages); without Tesseract those pages are skipped and the
   rest of the document is indexed normally. To install: download the Windows installer from
   https://github.com/UB-Mannheim/tesseract/wiki , install with defaults, then check:
   ```powershell
   & "C:\Program Files\Tesseract-OCR\tesseract.exe" --version
   ```
   If you install it somewhere else, add `TESSERACT_CMD=<full path to tesseract.exe>` to `.env`.
4. **A Gemini API key** (free to create): sign in at https://aistudio.google.com/apikey and click
   **Create API key**. Keep it private.

## Part 2 — Prepare the project

5. **Extract the ZIP.** Right-click `CYRA_Final.zip` → *Extract All…* → choose a folder such as
   `C:\Users\HP\Desktop`. You get a folder called `CYRA`.
6. **Open PowerShell in the project folder.** Open the folder in File Explorer, click the address
   bar, type `powershell`, press Enter. (Or: `cd C:\Users\HP\Desktop\CYRA`.)
7. **Create the Python virtual environment** (a private box for CYRA's libraries):
   ```powershell
   py -3.11 -m venv .venv
   ```
8. **Activate it:**
   ```powershell
   .\.venv\Scripts\Activate.ps1
   ```
   You will see `(.venv)` at the start of the line. If Windows says scripts are disabled, run this once
   and activate again:
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
   ```
   > Every time you open a new PowerShell window for CYRA, run step 6 (go to the folder) and step 8 (activate) again.
9. **Install the backend libraries** (takes several minutes; it downloads PyTorch):
   ```powershell
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   ```
10. **Install the frontend libraries:**
    ```powershell
    cd frontend
    npm install
    cd ..
    ```

## Part 3 — Add your Gemini key

11. **Create your settings file** by copying the template:
    ```powershell
    Copy-Item .env.example .env
    notepad .env
    ```
12. **Paste the key.** In Notepad, find the line
    ```
    GOOGLE_API_KEY=your_gemini_api_key_here
    ```
    and replace `your_gemini_api_key_here` with your real key (no spaces, no quotes). Leave
    `PROJECT_ID=cyra` as it is. Save and close Notepad.

    The `.env` file lives **in the project folder, next to `README.md`**. Nobody else can see it; it is never
    uploaded, and it is not included in the project ZIP.

## Part 4 — Index the handbook, start CYRA

13. **Index (ingest) the bundled PDF.** The backend must **not** be running. The first run downloads the
    embedding model (about 2 GB) and then reads the 231 pages; expect 10–30 minutes on a normal PC.
    ```powershell
    python -m backend.ingestion.run
    ```
    At the end you should see `RESULT: OK - index verified`, `indexed pages: 231` and
    `retrieval probes: 6/6 found their own page`. If it says `FAILED` or `PROBLEM`, read the messages
    and see Troubleshooting. Running it again is safe: nothing is duplicated.
14. **Start the backend:**
    ```powershell
    python -m uvicorn backend.app:app --host 127.0.0.1 --port 7861
    ```
    Wait until you see `CYRA ready`. Leave this window open.
15. **Start the frontend** in a **second** PowerShell window:
    ```powershell
    cd C:\Users\HP\Desktop\CYRA\frontend
    npm run dev
    ```
16. **Open CYRA** in your browser: **http://localhost:5173**

## Part 5 — Check that it works

17. **Check the index.** Open http://127.0.0.1:7861/healthz . You want:
    `"status": "ok"`, `"project_chunks"` greater than 0, `"llm_configured": true`, and an empty
    `"problems"` list. Any problem is explained in plain words there. Open http://127.0.0.1:7861/documents to see
    `APH_Final.pdf`, its chunks and `"pages": 231`.
18. **Ask a question** in the chat. Good tests (the evidence was checked against the PDF):
    * *"How many years of Extension of Approval can existing institutions get from AY 2024-25?"* — the supporting text is in
      Chapter II, section 2.1 (PDF page 27). Check that the cited pages include 27.
    * *"Can a women's institution be converted into a co-ed institution?"* — section 2.15 (PDF page 40).
    * *"What is the best recipe for chocolate cake?"* — not in the handbook, so CYRA should say the documents do not contain enough
      information.

    Open the PDF at the cited page and compare. (Page numbers are **PDF pages**; printed page = PDF page − 16.)
19. **Test the Gemini key without showing it** (backend stopped, because the database is locked while it runs — this check
    itself only needs the key):
    ```powershell
    python -m backend.diagnose --llm
    ```
    `OK - model ... replied` means the key and model work. To see what the search finds for a question without calling Gemini:
    ```powershell
    python -m backend.diagnose "What are the requirements for Extension of Approval?"
    ```

## Everyday use

* **Start CYRA:** steps 6, 8, 14 (backend window) and 15 (frontend window).
* **Stop CYRA:** press `Ctrl+C` in each window.
* **Restart the backend after changing `.env`** (for example a new API key): `Ctrl+C`, then run step 14 again.
* **Add another PDF:** either open **Settings → Add a PDF** in the CYRA window (works while it is running; large files take a
  few minutes), or copy the PDF into the `corpus` folder, stop the backend, and run `python -m backend.ingestion.run`.
* **Re-index everything cleanly** (stop the backend first): `python -m backend.ingestion.run --reset`
* **Rebuild after a fresh install:** delete the `data` folder (if it exists) and run step 13 again — the index is created from `corpus\`.
* **Run the tests:**
  ```powershell
  pip install -r requirements-dev.txt
  python -m pytest
  cd frontend
  npm test
  ```

## Troubleshooting

| What you see | What to do |
|---|---|
| `ModuleNotFoundError: No module named 'backend'` (or similar) | You are not in the project folder, or `(.venv)` is not active. Do step 6 and step 8, then run the command again. Always run commands from the folder containing `README.md`. |
| `ModuleNotFoundError: No module named 'fastapi'` / `qdrant_client` | The libraries are not installed in this environment: activate `.venv` and run step 9. |
| `The Qdrant database ... is in use by another process` | The backend is running. Press `Ctrl+C` in its window, then run ingestion/diagnose, then start the backend again. |
| `/healthz` says `GOOGLE_API_KEY is not set` | Check step 11–12: the file must be named exactly `.env` (not `.env.txt`), in the project folder, with your real key. Restart the backend. |
| Chat shows "Gemini rejected the request" | The key is wrong or disabled. Create a new one at https://aistudio.google.com/apikey , update `.env`, restart the backend, then run `python -m backend.diagnose --llm`. |
| Chat shows "over quota" / "temporarily unavailable" | Wait a minute and retry; you may have hit the free-tier limit. |
| `/healthz` says `No documents are indexed for this project yet` | Run step 13 (with the backend stopped). |
| `python -m backend.diagnose` says chunks exist but none carry your `PROJECT_ID` | `PROJECT_ID` in `.env` differs from the one used when indexing. Set it to `cyra` and run `python -m backend.ingestion.run --reset`. |
| Chat says "The indexed documents do not contain enough information" for a question the handbook should answer | Run `python -m backend.diagnose "your question"` and read the retrieved pages. If the right pages are absent, rephrase using the handbook's own words (for example "Extension of Approval" instead of "renewal"). |
| "Can't reach the server" in the chat | The backend is not running, or is on another port. Start it (step 14) and keep that window open. |
| Browser shows a blank page / CORS error | Open the app at `http://localhost:5173` exactly, and make sure the backend runs on port 7861. |
| `Tesseract OCR is not available` message | Only matters for picture-only pages. Install Tesseract (step 3) or ignore it for ordinary PDFs. |
| `Address already in use` / port 7861 busy | Another copy is running. Close it, or start with `--port 7862` and set `VITE_API_URL=http://localhost:7862` in `frontend\.env`. |
| First start takes very long | It is downloading the embedding model (about 2 GB, once). Wait for `CYRA ready`. |
| `Activate.ps1 cannot be loaded because running scripts is disabled` | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, then activate again. |
