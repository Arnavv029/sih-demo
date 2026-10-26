# CYRA — AI Knowledge & Document Assistant

**Turn your documents into a searchable knowledge base. Ask questions and get AI-generated answers with source citations.**

CYRA is an AI-powered document assistant built using Retrieval-Augmented Generation (RAG). It processes PDF documents, retrieves relevant information, and uses Google Gemini to generate answers grounded in the available content.

It includes a document ingestion pipeline with text extraction, OCR support for scanned PDFs, semantic search, and source-based answers.

## ✨ Features

### 📄 Document Processing
- **PDF Text Extraction:** Extract text from PDFs using PyMuPDF.
- **OCR for Scanned PDFs:** Use Tesseract OCR to recognize text on scanned pages that don't contain selectable text.
- **Image-Based Text Recognition:** Optional OCR support for text embedded in images on PDF pages.
- **Text Cleaning & Chunking:** Prepare extracted content for efficient retrieval.
- **Page-Aware Processing:** Preserve page information to support source citations.

### 🧠 AI & Retrieval
- **Retrieval-Augmented Generation (RAG):** Generate answers using relevant document content.
- **Semantic Search:** Retrieve passages based on meaning rather than exact keyword matches.
- **Vector Search:** Store and search document embeddings using Qdrant.
- **Gemini Integration:** Generate responses using Google's Gemini models.
- **Source Citations:** Connect answers to supporting document passages and page references.
- **Context-Grounded Responses:** Designed to acknowledge when the available documents don't support an answer.

### 💬 User Interface
- Interactive React-based chat interface.
- Ask questions about the indexed documents using natural language.
- View answers with supporting source references.

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| Python | Backend and document-processing pipeline |
| FastAPI | Backend API |
| React + TypeScript | Frontend |
| Google Gemini | AI answer generation |
| Qdrant | Vector database |
| BAAI/bge-m3 | Text embeddings |
| PyMuPDF | PDF text extraction |
| Tesseract OCR | Text recognition for scanned pages |
| pytest | Automated backend testing |
| Vite | Frontend development and build tooling |

## ⚙️ How CYRA Works

```text
                 PDF Documents
                       |
                       v
              Document Ingestion
                       |
                       v
              PDF Text Extraction
                       |
              +--------+--------+
              |                 |
        Selectable Text    Scanned Pages
              |                 |
              |            Tesseract OCR
              |                 |
              +--------+--------+
                       |
                       v
               Text Cleaning
                       |
                       v
                Text Chunking
                       |
                       v
              Semantic Embeddings
                       |
                       v
               Qdrant Vector Store
                       |
             User asks a question
                       |
                       v
               Semantic Retrieval
                       |
                       v
             Relevant Document Context
                       |
                       v
                 Google Gemini
                       |
                       v
             Answer + Source Citations
```

## 🔍 OCR & PDF Processing

CYRA supports processing PDFs that contain selectable text as well as scanned pages that require OCR.

The ingestion pipeline can:
1. Extract existing text from PDF pages.
2. Identify pages with little or no selectable text.
3. Apply Tesseract OCR to recognize text from scanned pages.
4. Optionally OCR images embedded in pages that already contain text.
5. Clean and split extracted content into searchable chunks.
6. Preserve document and page information for retrieval and citations.

**OCR requirement:** Tesseract OCR must be installed separately for OCR functionality. English language data (`eng`) is sufficient for English text recognition; additional languages require their corresponding trained-data files.

## 🚀 Getting Started

### Prerequisites

- Python 3.11
- Node.js and npm
- A Google Gemini API key
- Tesseract OCR, if you want OCR functionality

### 1. Clone the repository

```bash
git clone https://github.com/ArunVijaykumarcsds/CYRA-AI-Knowledge-Assistant.git
cd CYRA-AI-Knowledge-Assistant
```

### 2. Set up the Python environment

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create a local environment configuration file:

```powershell
Copy-Item .env.example .env
```

Add your Gemini API key to `.env`:

```env
GOOGLE_API_KEY=your_gemini_api_key_here
```

Never commit your actual `.env` file or API key to GitHub.

### 3. Install Tesseract OCR (optional)

Install Tesseract OCR and ensure it is available on your system PATH.

If it is installed in a custom location, configure `TESSERACT_CMD` in your local `.env` file.

### 4. Install frontend dependencies

Open a second terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
```

### 5. Run CYRA

From the project root, start the backend:

```powershell
uvicorn backend.app:app --reload --port 7861
```

From the `frontend` directory in the second terminal, start the frontend:

```powershell
npm run dev
```

Open the local URL displayed by Vite, usually `http://localhost:5173`.

> **Important:** Document question-answering requires the document corpus and vector index to be prepared. Follow `SETUP_GUIDE.md` for the complete ingestion and indexing workflow.

## 📁 Project Structure

```text
CYRA/
├── backend/
│   ├── ingestion/       # PDF extraction, OCR and ingestion pipeline
│   ├── providers/       # AI provider integrations
│   ├── tests/           # Automated backend tests
│   └── app.py           # FastAPI application
├── frontend/            # React + TypeScript interface
├── corpus/              # Local source documents
├── data/                # Local vector database
├── .env.example         # Example configuration
├── requirements.txt      # Python dependencies
├── README.md
└── SETUP_GUIDE.md       # Detailed setup instructions
```

*Local documents, databases, and secrets should remain outside the public repository unless there is a clear reason and permission to publish them.*

## 🔐 Security & Limitations

- Keep API keys in local environment files.
- Do not upload private documents or sensitive data without authorization.
- OCR accuracy depends on image quality, resolution, orientation, and language support.
- AI-generated answers should be checked against their cited source passages.
- The availability and quality of an answer depend on the documents indexed by the system.

## 🗺️ Future Improvements

- Support for additional document formats.
- More robust multilingual OCR.
- Expanded retrieval and answer-quality evaluation.
- Deployment for public access.

## 👨‍💻 Author

**Arun VK**

[GitHub Repository](https://github.com/ArunVijaykumarcsds/CYRA-AI-Knowledge-Assistant)

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
