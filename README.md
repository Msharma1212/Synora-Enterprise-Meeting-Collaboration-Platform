# Synora - Enterprise Meeting & Collaboration Platform

Synora is a modern enterprise-grade real-time collaboration platform that enables secure meetings, live communication, audience engagement, scheduling, multilingual support, analytics, and seamless team workspace collaboration.

Designed with premium typography, deep space layouts, and smooth transition animations, Synora offers a polished user experience tailored for high-performance and distributed professional teams.

---

## 🚀 Key Features

- **🔒 Enterprise Security & Auth**: Full JSON Web Token (JWT) based credential storage, secure password hashing, and user authentication.
- **📹 HD Video Conferencing**: Low-latency peer-to-peer real-time streaming, high-fidelity audio/video pipelines, and robust media tester suites.
- **🌍 Advanced Multilingual Support**: Dynamic, instant locale toggles across English, Bengali, Hindi, Spanish, French, and Arabic.
- **🤖 Server-Side Gemini AI**: Intelligent real-time meeting transcripts analysis and smart summaries.
- **📊 Analytics Dashboard**: Comprehensive metrics trackers for host statistics, upcoming and past meetings, top referrers, and live workspace status.
- **💬 Team Collaboration Workspace**: Centralized team chats, instant sharing links, custom invitation workflows, and referral mechanisms.

---

## 🛠️ Architecture

Synora is built using a modern, scalable full-stack architecture:

- **Frontend**:
  - React 19 / TypeScript 5 with fast, optimized builds.
  - Vite for development and bundling.
  - Tailwind CSS for sleek utility-first responsive styling.
  - Motion (`motion/react`) for smooth animations and transitions.
  - Lucide React for consistent, crisp visual iconography.

- **Backend**:
  - Node.js & Express API proxy layer running on port `3000`.
  - Full TypeScript compilation via `tsx` and `esbuild` for enterprise compatibility.
  - Real-time communication powered by low-latency Socket.IO endpoints.

---

## 📦 Installation & Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- NPM (packaged with Node.js)

### Step 1: Install Dependencies

To set up the workspace and install all pre-requisites:

```bash
npm install
```

### Step 2: Configure Environment Variables

Create a `.env` file in the root directory and specify your secret API credentials:

```env
# Server Ingress Port (Default: 3000)
PORT=3000

# Secret Key for JWT Signing
JWT_SECRET=your_jwt_signing_secret_here

# AI Assistance Services (Server-Side)
GEMINI_API_KEY=your_gemini_api_key_here
```

### Step 3: Run the Development Server

To boot up the application in development mode with HMR and express-vite middlewares:

```bash
npm run dev
```

The application will be accessible at [http://localhost:3000](http://localhost:3000).

---

## 🏗️ Production Deployment

To package Synora for containerized or serverless production systems:

1. **Build the assets**:
   ```bash
   npm run build
   ```
2. **Start the production server**:
   ```bash
   npm run start
   ```

The application compiles into a single bundled CommonJS server file (`dist/server.cjs`) using `esbuild` to bypass ES Module import runtime checks and streamline deployment execution.

---

## 📸 Interface Overviews

- **Synora Home Dashboard**: Visually rich central workspace displaying ongoing sessions, host statistics, referrals list, and action toggles.
- **Collaborative Meeting Rooms**: Integrated chat panel, real-time participant trackers, active audio-waveform indicators, and advanced media test facilities.
- **Enterprise Authenticator**: Sleek cosmic-themed user access controls featuring responsive layout animations and instant translations.

---

## 🤝 Contribution Guidelines

We welcome contributions to Synora! To suggest features, report issues, or propose changes:

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request for review.

---

*Synora - Next-generation collaboration for global enterprises.*
