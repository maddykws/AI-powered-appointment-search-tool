// ── State ─────────────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:3335';

let vapi = null;
let activeAgent = 'customer-service';
let callActive = false;
let muted = false;
let callStartTime = null;
let timerInterval = null;
let config = null;

const AGENTS = {
  'customer-service': {
    name: 'Aria — Customer Support',
    icon: '🎧',
    color: '#6366f1',
    colorClass: '',
  },
  'appointment-booking': {
    name: 'Max — Appointment Scheduler',
    icon: '📅',
    color: '#10b981',
    colorClass: 'green',
  },
};

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  buildVisualizer();

  try {
    const res = await fetch(`${API_BASE}/api/config`);
    config = await res.json();
  } catch {
    config = { configured: false, demo_mode: true };
  }

  if (!config.configured) {
    document.getElementById('setup-hint').style.display = 'block';
    showDemoBanner();
  } else {
    // Init Vapi SDK
    vapi = new Vapi(config.publicKey);
    bindVapiEvents();
  }
}

function showDemoBanner() {
  const container = document.getElementById('demo-banner-container');
  container.innerHTML = `
    <div class="demo-banner">
      <strong>Demo mode</strong> — Vapi key not configured.
      Add your key to <code>.env</code> to enable live voice calls.
    </div>`;
}

// ── Visualizer ────────────────────────────────────────────────────────────────

function buildVisualizer() {
  const viz = document.getElementById('visualizer');
  viz.innerHTML = '';
  const heights = [8,14,20,28,20,32,20,28,20,14,8,20,28,14,8];
  const durations = [0.5,0.7,0.4,0.6,0.8,0.5,0.7,0.4,0.6,0.8,0.5,0.6,0.4,0.7,0.5];
  heights.forEach((h, i) => {
    const bar = document.createElement('div');
    bar.className = 'viz-bar';
    bar.style.setProperty('--h', `${h}px`);
    bar.style.setProperty('--dur', `${durations[i]}s`);
    bar.dataset.idx = i;
    viz.appendChild(bar);
  });
}

function setVisualizerActive(active) {
  document.querySelectorAll('.viz-bar').forEach(bar => {
    bar.classList.toggle('active', active);
  });
}

function setVisualizerSpeaking(isSpeaking) {
  const bars = document.querySelectorAll('.viz-bar');
  bars.forEach((bar, i) => {
    if (isSpeaking) {
      bar.classList.add('active');
      const h = 8 + Math.random() * 28;
      bar.style.setProperty('--h', `${h}px`);
      bar.style.setProperty('--dur', `${0.3 + Math.random() * 0.5}s`);
    } else {
      bar.style.setProperty('--h', `4px`);
    }
  });
}

// ── Agent selection ───────────────────────────────────────────────────────────

function selectAgent(id) {
  if (callActive) return; // can't switch mid-call
  activeAgent = id;
  const agent = AGENTS[id];

  // Update sidebar cards
  document.querySelectorAll('.agent-card').forEach(c => c.classList.remove('active'));
  const card = document.getElementById(`card-${id}`);
  card.classList.add('active');
  if (agent.colorClass) card.classList.add(agent.colorClass);

  // Update widget header
  const avatar = document.getElementById('widget-avatar');
  avatar.textContent = agent.icon;
  avatar.className = `agent-avatar ${agent.colorClass}`;
  document.getElementById('widget-name').textContent = agent.name;

  // Update call button color
  const btn = document.getElementById('btn-call');
  btn.className = `btn-call start ${agent.colorClass}`;

  // Clear transcript
  clearTranscript();
}

// ── Call control ──────────────────────────────────────────────────────────────

async function toggleCall() {
  if (!callActive) await startCall();
  else endCall();
}

async function startCall() {
  if (!config.configured) {
    addMessage('system', '⚠️ Vapi key not configured. Add VAPI_PUBLIC_KEY to .env and restart the server.');
    return;
  }

  setCallState('connecting');

  try {
    // Fetch assistant config from our backend
    const res = await fetch(`${API_BASE}/api/assistant/${activeAgent}`);
    const assistant = await res.json();

    // Start Vapi call with inline assistant config
    await vapi.start({
      model: {
        provider: assistant.model.provider,
        model: assistant.model.model,
        messages: [{ role: 'system', content: assistant.systemPrompt }],
      },
      voice: {
        provider: assistant.voice.provider,
        voiceId: assistant.voice.voiceId,
      },
      firstMessage: assistant.firstMessage,
      silenceTimeoutSeconds: 30,
      maxDurationSeconds: 300,
      endCallMessage: 'Thank you for calling. Goodbye!',
    });
  } catch (err) {
    console.error('Start call failed:', err);
    addMessage('system', `❌ Failed to start call: ${err.message}`);
    setCallState('idle');
  }
}

function endCall() {
  if (vapi) vapi.stop();
  setCallState('idle');
}

function toggleMute() {
  if (!vapi || !callActive) return;
  muted = !muted;
  vapi.setMuted(muted);
  const btn = document.getElementById('btn-mute');
  btn.textContent = muted ? '🔇' : '🎤';
  btn.classList.toggle('muted', muted);
}

// ── UI state ──────────────────────────────────────────────────────────────────

function setCallState(state) {
  const dot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const btnCall = document.getElementById('btn-call');
  const btnIcon = document.getElementById('btn-icon');
  const btnText = document.getElementById('btn-text');
  const btnMute = document.getElementById('btn-mute');
  const timer = document.getElementById('call-timer');
  const agent = AGENTS[activeAgent];

  if (state === 'idle') {
    callActive = false;
    dot.className = 'status-dot idle';
    statusText.textContent = 'Ready';
    btnCall.className = `btn-call start ${agent.colorClass}`;
    btnCall.disabled = false;
    btnIcon.textContent = '📞';
    btnText.textContent = 'Start Call';
    btnMute.disabled = true;
    setVisualizerActive(false);
    stopTimer();
    timer.style.display = 'none';
    muted = false;
    btnMute.textContent = '🎤';
    btnMute.classList.remove('muted');
  } else if (state === 'connecting') {
    dot.className = 'status-dot calling';
    statusText.textContent = 'Connecting...';
    btnCall.disabled = true;
    btnText.textContent = 'Connecting...';
    btnIcon.textContent = '⏳';
  } else if (state === 'active') {
    callActive = true;
    dot.className = 'status-dot';
    statusText.textContent = 'In call';
    btnCall.className = 'btn-call end';
    btnCall.disabled = false;
    btnIcon.textContent = '📵';
    btnText.textContent = 'End Call';
    btnMute.disabled = false;
    setVisualizerActive(true);
    startTimer();
    timer.style.display = 'block';
  }
}

// ── Timer ─────────────────────────────────────────────────────────────────────

function startTimer() {
  callStartTime = Date.now();
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    document.getElementById('call-timer').textContent = `${m}:${s}`;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  callStartTime = null;
}

// ── Transcript ────────────────────────────────────────────────────────────────

let typingEl = null;

function clearTranscript() {
  const t = document.getElementById('transcript');
  t.innerHTML = `
    <div class="transcript-empty" id="transcript-empty">
      <div class="empty-icon">🎙️</div>
      <p>Press <strong>Start Call</strong> to begin a voice conversation<br>with the AI agent.</p>
    </div>`;
}

function hideEmpty() {
  const el = document.getElementById('transcript-empty');
  if (el) el.remove();
}

function addMessage(role, text) {
  hideEmpty();
  removeTyping();
  const t = document.getElementById('transcript');
  const msg = document.createElement('div');
  msg.className = `msg ${role}`;
  const agent = AGENTS[activeAgent];
  const label = role === 'agent' ? agent.name.split('—')[0].trim() : role === 'user' ? 'You' : 'System';
  msg.innerHTML = `
    <div>
      <div class="msg-bubble">${escapeHtml(text)}</div>
      <div class="msg-label">${label}</div>
    </div>`;
  t.appendChild(msg);
  t.scrollTop = t.scrollHeight;
}

function showTyping() {
  hideEmpty();
  removeTyping();
  const t = document.getElementById('transcript');
  typingEl = document.createElement('div');
  typingEl.className = 'msg agent';
  typingEl.innerHTML = `<div><div class="typing"><span></span><span></span><span></span></div></div>`;
  t.appendChild(typingEl);
  t.scrollTop = t.scrollHeight;
}

function removeTyping() {
  if (typingEl) { typingEl.remove(); typingEl = null; }
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Vapi events ───────────────────────────────────────────────────────────────

function bindVapiEvents() {
  vapi.on('call-start', () => {
    setCallState('active');
    addMessage('system', '✅ Call connected');
  });

  vapi.on('call-end', () => {
    setCallState('idle');
    addMessage('system', '📵 Call ended');
    setVisualizerSpeaking(false);
  });

  vapi.on('speech-start', () => {
    setVisualizerSpeaking(true);
  });

  vapi.on('speech-end', () => {
    setVisualizerSpeaking(false);
  });

  vapi.on('message', (msg) => {
    if (msg.type === 'transcript') {
      if (msg.transcriptType === 'final') {
        if (msg.role === 'assistant') {
          removeTyping();
          addMessage('agent', msg.transcript);
        } else if (msg.role === 'user') {
          addMessage('user', msg.transcript);
          showTyping();
        }
      }
    }
  });

  vapi.on('error', (err) => {
    console.error('Vapi error:', err);
    addMessage('system', `❌ Error: ${err.message || JSON.stringify(err)}`);
    setCallState('idle');
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────

init();
