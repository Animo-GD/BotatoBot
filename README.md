# 🥔 BatataBotato: The Universal Customizable AI Chatbot
**BatataBotato** is a premium, state-of-the-art AI chatbot platform designed for deep personalization and high-performance RAG (Retrieval-Augmented Generation). Built with a stunning glassmorphic UI and a robust webhook-driven architecture, it transforms from a simple "potato" into a specialized assistant tailored exactly to the user's needs.

## Live Demo
http://batatabotato.com/](http://batatabotato.com/)

---

## Key Features

### 1. Advanced 7-Step Onboarding
A beautiful, animated onboarding flow that captures the user's:
- **Identity**: Nickname & Avatar.
- **Voice**: Preferred Tone & Communication Style.
- **Purpose**: Personalized usage goals.
- **i18n**: Full native support for English and Arabic (RTL).

### 2. RAG Knowledge Base (PDF Support)
Empower your bot with your own data:
- **Client-Side Parsing**: Fast, stable PDF text extraction directly in the browser.
- **Smart Chunking**: Automatic text segmentation (1000 chars/chunk) for optimal context.
- **Vector Ready**: Seamless integration with `pgvector` for similarity search.
- **Management Dashboard**: Easily upload, list, and delete knowledge files.

### 3. Smart RAG Toggle
Differentiate between general chat and data-driven answers with a single click. The app sends a `rag_enabled` flag to your webhook, allowing for complex n8n logic.

### 4. Premium Aesthetic
- **Glassmorphism**: Sleek, translucent UI elements with smooth backdrop filters.
- **Interactive Animations**: Powered by Framer Motion for a "living" interface.
- **Custom Scrollbars**: Tailored to match the dark culinary/tech theme.
- **Markdown Support**: Beautifully rendered bot responses with bolding, lists, and code blocks.

---

## Technology Stack

- **Frontend**: Next.js 15+ (App Router), React 19, TypeScript.
- **Styling**: Vanilla CSS with custom design tokens.
- **Database**: Supabase (PostgreSQL + pgvector).
- **Authentication**: Supabase Auth.
- **Logic Engine**: n8n (Webhook-driven intelligence).
- **Icons**: Lucide React.

---

## Environment Variables

Create a `.env.local` file with the following keys:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# n8n Webhook Endpoints
NEXT_PUBLIC_WEBHOOK_INIT_URL=url_for_personality_generation
NEXT_PUBLIC_WEBHOOK_SUBMIT_URL=url_for_finalizing_profile
NEXT_PUBLIC_WEBHOOK_CHAT_URL=url_for_live_chat
```

---

## Project Structure

- `/src/app/chat`: The core 3-phase chat experience (MCQ → Submitting → Free Chat).
- `/src/app/onboarding`: The 7-step personality builder.
- `/src/app/actions`: Server Actions for PDF chunking and database persistence.
- `/lib/supabase`: Client configuration for database interactions.

---

## Getting Started

1. **Clone the repo**: `git clone https://github.com/Animo-GD/BotatoBot.git`
2. **Install deps**: `npm install`
3. **Configure DB**: Run the provided migrations in your Supabase SQL editor to create the `batata.profiles`, `batata.interactions`, and `batata.knowledge` tables.
4. **Run Dev**: `npm run dev`

---

## Why Batata?

Because like a potato, this bot can be mashed, baked, or fried into **anything** you need. It's the most versatile base for your next AI project. 🥘✨
