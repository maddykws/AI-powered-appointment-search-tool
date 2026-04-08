import { config as dotenvConfig } from 'dotenv';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Resolve .env relative to server.mjs regardless of CWD
const __dotenvDir = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: join(__dotenvDir, '.env') });

const __dirname = __dotenvDir;
const app = express();
const PORT = process.env.PORT || 3335;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// ── Assistant configurations ──────────────────────────────────────────────────

const ASSISTANTS = {
  'customer-service': {
    id: 'customer-service',
    name: 'Aria — Customer Support',
    description: 'Handles returns, orders, complaints, and general support queries',
    firstMessage: "Hi! I'm Aria, your customer support assistant. I can help with orders, returns, billing, or any questions. How can I help you today?",
    systemPrompt: `You are Aria, a friendly and efficient customer service agent for TechShop, an online electronics retailer.

Your capabilities:
- Look up order status (use fake order numbers like #TS-4821, #TS-9034)
- Process return requests (policy: 30 days, original packaging)
- Answer product questions (laptops, phones, accessories)
- Escalate to human agent if needed (say "Let me connect you to a specialist")
- Handle billing disputes

Tone: Professional but warm. Concise answers — 1-3 sentences max per response. Always confirm the customer's issue before solving.

If asked about order status, provide a realistic response: "Your order #TS-XXXX shipped on [date] and is expected by [date+2 days]."
If unsure, say: "Let me check on that for you" then give a reasonable answer.`,
    voice: { provider: '11labs', voiceId: 'paula' },
    model: { provider: 'openai', model: 'gpt-4o-mini' },
    color: '#6366f1',
    icon: '🎧',
  },
  'appointment-booking': {
    id: 'appointment-booking',
    name: 'Max — Appointment Scheduler',
    description: 'Books, reschedules, and cancels appointments for a medical clinic',
    firstMessage: "Hello! I'm Max from Hillside Medical Clinic. I can help you book, reschedule, or cancel an appointment. What would you like to do today?",
    systemPrompt: `You are Max, an appointment scheduling assistant for Hillside Medical Clinic.

Available appointment types:
- General Checkup (30 min) — Dr. Chen, Dr. Patel
- Specialist Consultation (45 min) — Dr. Williams (Cardiology), Dr. Lee (Dermatology)
- Urgent Care (15 min) — Dr. Patel, available same-day
- Follow-up Visit (20 min) — Any doctor

Available slots (use these realistically):
- Monday–Friday: 9am, 10:30am, 1pm, 2:30pm, 4pm
- Saturday: 9am, 10:30am only

Workflow:
1. Ask what type of appointment
2. Ask for preferred date and time
3. Confirm doctor availability
4. Ask for patient name and date of birth for verification
5. Confirm booking with a reference number like "APT-" + 4 random digits
6. Offer to send a confirmation (say "I'll send a confirmation to your email on file")

If rescheduling: ask for existing appointment reference, then offer new slots.
If canceling: confirm reference, process cancellation, ask about rebooking.

Tone: Calm, professional, efficient. Never ask for sensitive info like SSN or full insurance details.`,
    voice: { provider: '11labs', voiceId: 'adam' },
    model: { provider: 'openai', model: 'gpt-4o-mini' },
    color: '#10b981',
    icon: '📅',
  },
};

// ── Routes ────────────────────────────────────────────────────────────────────

// Health + status (portfolio polls this)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'vapi-voice-agent',
    agents: Object.keys(ASSISTANTS).map(id => ({
      id,
      name: ASSISTANTS[id].name,
      description: ASSISTANTS[id].description,
      icon: ASSISTANTS[id].icon,
      color: ASSISTANTS[id].color,
    })),
    vapi_configured: !!(process.env.VAPI_PUBLIC_KEY && process.env.VAPI_PUBLIC_KEY !== 'your_vapi_public_key_here'),
    timestamp: new Date().toISOString(),
  });
});

// Get public key for frontend (safe to expose)
app.get('/api/config', (req, res) => {
  const configured = !!(process.env.VAPI_PUBLIC_KEY && process.env.VAPI_PUBLIC_KEY !== 'your_vapi_public_key_here');
  res.json({
    publicKey: configured ? process.env.VAPI_PUBLIC_KEY : null,
    configured,
    demo_mode: !configured,
  });
});

// Get assistant config for a given agent
app.get('/api/assistant/:id', (req, res) => {
  const assistant = ASSISTANTS[req.params.id];
  if (!assistant) return res.status(404).json({ error: 'Assistant not found' });
  // Return config without sensitive fields
  const { systemPrompt, ...safe } = assistant;
  res.json({ ...safe, systemPrompt }); // FDE demo: share full config
});

// List all assistants
app.get('/api/assistants', (req, res) => {
  res.json(Object.values(ASSISTANTS).map(({ systemPrompt, ...a }) => a));
});

// Serve demo at /demo
app.get('/demo', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  const configured = !!(process.env.VAPI_PUBLIC_KEY && process.env.VAPI_PUBLIC_KEY !== 'your_vapi_public_key_here');
  console.log(`\n🎙️  Vapi Voice Agent Server`);
  console.log(`   Port    : ${PORT}`);
  console.log(`   Demo    : http://localhost:${PORT}`);
  console.log(`   API     : http://localhost:${PORT}/api/health`);
  console.log(`   Vapi    : ${configured ? '✅ configured' : '⚠️  add VAPI_PUBLIC_KEY to .env'}\n`);
});
