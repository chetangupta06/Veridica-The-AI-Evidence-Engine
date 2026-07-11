<div align="center">
  <img src="public/logo.png" alt="Veridica Logo" width="120"/>
  <h1>Veridica</h1>
  <p><strong>The AI Evidence Engine</strong></p>
  <p>Paste any claim. Get evidence, not opinions.</p>
  <br/>
  <a href="https://veridica-ai.vercel.app/" target="_blank">
    <img src="https://img.shields.io/badge/Live%20Demo-Vercel-brightgreen?style=for-the-badge&logo=vercel" alt="Live Demo on Vercel"/>
  </a>
</div>

---

## 🧐 What is Veridica?
Veridica is an open-source, AI-powered fact-checking engine designed to evaluate claims by analyzing real-time web evidence through a consensus of multiple state-of-the-art Large Language Models (LLMs). 

Instead of trusting a single AI hallucination, Veridica builds trust by sourcing raw data from Google and Wikipedia and demanding that multiple top-tier models (like GPT-4o, Claude 3.5, and DeepSeek) independently agree on the verdict.

## ✨ Key Features
- **🕵️ Real-time Web Search**: Actively scrapes Google Search and Wikipedia to retrieve the latest articles, papers, and news related to a claim.
- **🧠 Multi-Model Consensus**: Queries up to 3 distinct LLMs simultaneously, measuring their agreement to generate an aggregated "Trust Score".
- **⚡ Smart Routing**: Our intelligent routing algorithm automatically directs simple claims to fast models and complex, nuanced claims to heavy reasoning models.
- **📱 Fully Responsive Design**: A beautiful, modern interface engineered to be flawless on both desktop and mobile devices, complete with Dark Mode support.
- **💬 Interactive Follow-up Chat**: Ask follow-up questions directly to the AI about the evidence it found.

## 🛠️ Tech Stack
- **Framework**: [Next.js 14+ (App Router)](https://nextjs.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **AI Integration**: [Mesh API](https://mesh.dev/) for cross-model inference
- **Search**: [Serper.dev](https://serper.dev/) (Google Search API fallback)

## 🚀 Getting Started

### Prerequisites
1. **Node.js** (v18 or newer)
2. **Mesh API Key** - Get yours to access all the leading AI models through one single endpoint.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/chetangupta06/Veridica-The-AI-Evidence-Engine.git
   cd Veridica-The-AI-Evidence-Engine
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Configure your API keys:**
   Open `http://localhost:3000` in your browser. Navigate to the **Settings** page (⚙️ icon) to securely save your Mesh API Key (and optionally your Serper API Key) into your browser's local storage.

## 📜 How It Works
1. **Input**: A user inputs a claim (e.g., *"Coffee stunts your growth"*).
2. **Extraction**: The system searches Google and Wikipedia and uses a fast extraction model to pull verbatim, factual snippets from the retrieved articles.
3. **Consensus Analysis**: The extracted snippets are bundled and sent concurrently to the user's selected LLMs.
4. **Verdict Generation**: The models return independent verdicts. Veridica calculates an aggregated Trust Score and clearly highlights the AI consensus and cited sources.

## 🤝 Contributing
Contributions are always welcome! Feel free to open an issue or submit a pull request if you have ideas for new features, better routing logic, or UI improvements.
