# iprintr

**iprintr** is a premium, hardware-inspired web application that routes text-to-image generation across multiple leading AI engines through a single, tactile interface. Designed to mimic the clean, mechanical aesthetics of a high-end physical printer, it seamlessly blends industrial design with cutting-edge generative AI.

## ✨ Features

- **Hardware-Inspired UI**: A pixel-perfect vanilla CSS design featuring a deep slate-blue accent, charcoal control panels, and satisfying CSS animations (including a "print scan" loader and a "feed slot" image reveal).
- **Dynamic AI Routing**: Select your preferred rendering engine on the fly:
  - `Engine V1 (Realistic)` - Powered by Hugging Face **FLUX.1-schnell**
  - `Engine V2 (Artistic)` - Powered by Hugging Face **Stable Diffusion 3.5 Large**
  - `Engine V3 (Fast/Smart)` - Powered by Google **Gemini 3.1 Flash** (Vector/SVG generation)
- **AI Prompt Optimizer**: An optional built-in tool that uses Gemini 3.1 Flash to rewrite and enhance your basic prompts into highly descriptive, studio-quality instructions before printing.
- **Local Print History**: A mock authentication system that uses `localStorage` to securely save your generated "prints" to a personal shelf without needing an external database.

## 🚀 Getting Started

### Prerequisites
You will need API keys from both Google and Hugging Face to run all engines.
1. [Google AI Studio API Key](https://aistudio.google.com/) (For Gemini engines & prompt optimization)
2. [Hugging Face Access Token](https://huggingface.co/settings/tokens) (For FLUX and SD 3.5)

### Installation

1. Clone the repository and navigate into the project:
   ```bash
   cd iprintr
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory and add your keys:
   ```env
   GEMINI_API_KEY="your_google_ai_studio_key"
   HF_TOKEN="your_hugging_face_token"
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser and start printing!

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Library**: React 18
- **Styling**: Vanilla CSS (CSS Modules & Custom Properties)
- **AI Integrations**: 
  - Google Generative AI (`gemini-3.1-flash`)
  - Hugging Face Serverless Inference API
