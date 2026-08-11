document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const wsStatusDot = document.getElementById('ws-status-dot');
  const wsStatusText = document.getElementById('ws-status-text');
  const kpiTotalEvents = document.getElementById('kpi-total-events');
  const kpiThreatsDetected = document.getElementById('kpi-threats-detected');
  const kpiAvgRisk = document.getElementById('kpi-avg-risk');
  const kpiRiskBar = document.getElementById('kpi-risk-bar');
  const kpiThreatRate = document.getElementById('kpi-threat-rate');
  const nodeHealthTag = document.getElementById('node-health-tag');
  const pythonHealthTag = document.getElementById('python-health-tag');
  const healthUptimeText = document.getElementById('health-uptime-text');
  
  const streamTableBody = document.getElementById('stream-table-body');
  const streamCountBadge = document.getElementById('stream-count-badge');
  const btnClearStream = document.getElementById('btn-clear-stream');
  
  const btnAutoStream = document.getElementById('btn-auto-stream');
  const autoStreamState = document.getElementById('auto-stream-state');
  
  // Modal Elements
  const eventModal = document.getElementById('event-modal');
  const btnModalClose = document.getElementById('btn-modal-close');
  const modalJson = document.getElementById('modal-json');
  const modalTitle = document.getElementById('modal-title');

  // State
  let totalEvents = 0;
  let totalThreats = 0;
  let totalRiskAccumulator = 0;
  let autoStreamInterval = null;
  let eventsList = [];

  // ==========================================
  // 1. WebSocket Real-Time Connection
  // ==========================================
  let socket = null;
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/events`;

    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      wsStatusDot.className = 'status-dot connected dot-pulse';
      wsStatusText.textContent = 'Live Stream Active';
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'SECURITY_EVENT_STREAM') {
          handleIncomingEvent(message.data);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    socket.onclose = () => {
      wsStatusDot.className = 'status-dot disconnected';
      wsStatusText.textContent = 'Reconnecting...';
      setTimeout(connectWebSocket, 3000);
    };

    socket.onerror = (err) => {
      console.error('WebSocket error:', err);
      socket.close();
    };
  }

  // ==========================================
  // 2. Incoming Event Processing & KPI Update
  // ==========================================
  function handleIncomingEvent(eventData, isInitial = false) {
    totalEvents++;
    const analysis = eventData.analysis || {};
    const isThreat = analysis.is_threat || false;
    const riskScore = analysis.risk_score || 0;

    if (isThreat) {
      totalThreats++;
    }
    totalRiskAccumulator += riskScore;

    // Update KPI Displays
    kpiTotalEvents.textContent = totalEvents.toLocaleString();
    kpiThreatsDetected.textContent = totalThreats.toLocaleString();
    
    const avgRisk = totalEvents > 0 ? (totalRiskAccumulator / totalEvents).toFixed(1) : '0.0';
    kpiAvgRisk.textContent = avgRisk;
    kpiRiskBar.style.width = `${Math.min(100, Math.max(0, avgRisk))}%`;

    const threatRate = totalEvents > 0 ? Math.round((totalThreats / totalEvents) * 100) : 0;
    kpiThreatRate.textContent = `${threatRate}% Threat Rate`;

    // Add to Table
    eventsList.unshift(eventData);
    if (eventsList.length > 100) eventsList.pop();

    renderTableRow(eventData, !isInitial);
    streamCountBadge.textContent = `${eventsList.length} events`;
  }

  function renderTableRow(eventData, animate = true) {
    // Remove empty row if present
    const emptyRow = document.getElementById('empty-state-row');
    if (emptyRow) emptyRow.remove();

    const analysis = eventData.analysis || {};
    const riskScore = analysis.risk_score !== undefined ? analysis.risk_score : 0;
    const severity = analysis.severity || 'LOW';
    const isThreat = analysis.is_threat;

    const row = document.createElement('tr');
    if (animate) row.className = 'new-event-anim';

    // Format time
    const timeStr = eventData.timestamp 
      ? new Date(eventData.timestamp).toLocaleTimeString() 
      : new Date().toLocaleTimeString();

    let badgeClass = 'badge-low';
    if (severity === 'CRITICAL') badgeClass = 'badge-critical';
    else if (severity === 'HIGH') badgeClass = 'badge-high';
    else if (severity === 'MEDIUM') badgeClass = 'badge-medium';

    let riskClass = riskScore >= 50 ? 'danger' : riskScore >= 20 ? 'warn' : 'safe';

    const patternsText = analysis.detected_patterns && analysis.detected_patterns.length > 0
      ? analysis.detected_patterns.join(', ')
      : analysis.recommendation || 'Normal traffic';

    row.innerHTML = `
      <td><span class="code-font">${timeStr}</span></td>
      <td><code>${escapeHtml(eventData.event_type)}</code></td>
      <td><span class="code-font">${escapeHtml(eventData.source_ip)}</span></td>
      <td><span class="risk-pill ${riskClass}">${riskScore.toFixed(0)}</span></td>
      <td><span class="badge ${badgeClass}">${severity}</span></td>
      <td><span title="${escapeHtml(patternsText)}">${escapeHtml(truncate(patternsText, 45))}</span></td>
    `;

    row.addEventListener('click', () => {
      openModal(eventData);
    });

    streamTableBody.insertBefore(row, streamTableBody.firstChild);
  }

  // ==========================================
  // 3. Health Endpoint Polling
  // ==========================================
  async function pollHealth() {
    try {
      const res = await fetch('/health');
      if (res.ok) {
        const data = await res.json();
        nodeHealthTag.textContent = 'UP (200 OK)';
        nodeHealthTag.className = 'status-tag status-up';
        
        healthUptimeText.textContent = `Uptime: ${data.uptime_seconds || 0}s | WS Clients: ${data.system.active_ws_clients}`;

        const pyDep = data.dependencies?.python_analytics_service;
        if (pyDep && pyDep.status === 'UP') {
          pythonHealthTag.textContent = `UP (${pyDep.latencyMs}ms)`;
          pythonHealthTag.className = 'status-tag status-up';
        } else {
          pythonHealthTag.textContent = 'DEGRADED / DOWN';
          pythonHealthTag.className = 'status-tag status-down';
        }
      }
    } catch (err) {
      nodeHealthTag.textContent = 'OFFLINE';
      nodeHealthTag.className = 'status-tag status-down';
    }
  }

  // ==========================================
  // 4. Ingest Event API Helper
  // ==========================================
  async function sendEvent(eventPayload) {
    try {
      const res = await fetch('/api/v1/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventPayload),
      });
      return await res.json();
    } catch (err) {
      console.error('Failed to send event:', err);
    }
  }

  // ==========================================
  // 5. Presets & Buttons Handlers
  // ==========================================
  document.getElementById('btn-preset-benign').addEventListener('click', () => {
    sendEvent({
      event_type: 'api_access',
      source_ip: '192.168.1.100',
      user_id: 'usr_sarah',
      payload: { path: '/api/v1/dashboard', method: 'GET', user_agent: 'Mozilla/5.0' },
    });
  });

  document.getElementById('btn-preset-sqli').addEventListener('click', () => {
    sendEvent({
      event_type: 'sql_query',
      source_ip: '45.33.32.156',
      user_id: 'guest',
      payload: { query: "SELECT * FROM users WHERE username = 'admin' OR 1=1 --", path: '/api/v1/login' },
    });
  });

  document.getElementById('btn-preset-xss').addEventListener('click', () => {
    sendEvent({
      event_type: 'api_access',
      source_ip: '104.244.42.1',
      user_id: 'usr_anon',
      payload: { comment: "<script>alert('XSS_PAYLOAD_EXEC')</script>", page: 'forum_post' },
    });
  });

  document.getElementById('btn-preset-auth').addEventListener('click', () => {
    sendEvent({
      event_type: 'auth_attempt',
      source_ip: '185.220.101.5',
      user_id: 'root_admin',
      payload: { status: 'failed', failed_attempts: 12, user_agent: 'hydra/9.1' },
    });
  });

  document.getElementById('btn-preset-financial').addEventListener('click', () => {
    sendEvent({
      event_type: 'transaction',
      source_ip: '198.51.100.42',
      user_id: 'usr_whale_99',
      payload: { action: 'wire_transfer', amount: 85000.0, currency: 'USD', destination: 'OFFSHORE_ACC' },
    });
  });

  document.getElementById('btn-preset-path').addEventListener('click', () => {
    sendEvent({
      event_type: 'file_upload',
      source_ip: '194.26.29.112',
      payload: { filename: '../../../../etc/passwd', action: 'read' },
    });
  });

  // Custom Form Submission
  document.getElementById('custom-event-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const event_type = document.getElementById('input-event-type').value;
    const source_ip = document.getElementById('input-source-ip').value;
    let payload = {};
    try {
      payload = JSON.parse(document.getElementById('input-payload').value);
    } catch (err) {
      alert('Invalid JSON in payload field');
      return;
    }

    sendEvent({
      event_type,
      source_ip,
      payload,
    });
  });

  // Clear Stream
  btnClearStream.addEventListener('click', () => {
    streamTableBody.innerHTML = `
      <tr class="empty-row" id="empty-state-row">
        <td colspan="6">Event stream cleared. Ingest new events to resume.</td>
      </tr>
    `;
    eventsList = [];
    streamCountBadge.textContent = '0 events';
  });

  // Auto Stream Toggle
  btnAutoStream.addEventListener('click', () => {
    if (autoStreamInterval) {
      clearInterval(autoStreamInterval);
      autoStreamInterval = null;
      autoStreamState.textContent = 'OFF';
      btnAutoStream.classList.remove('active');
    } else {
      autoStreamState.textContent = 'ON (2s)';
      btnAutoStream.classList.add('active');
      const presets = [
        () => document.getElementById('btn-preset-benign').click(),
        () => document.getElementById('btn-preset-benign').click(),
        () => document.getElementById('btn-preset-sqli').click(),
        () => document.getElementById('btn-preset-xss').click(),
        () => document.getElementById('btn-preset-financial').click(),
        () => document.getElementById('btn-preset-auth').click(),
      ];
      autoStreamInterval = setInterval(() => {
        const randomPreset = presets[Math.floor(Math.random() * presets.length)];
        randomPreset();
      }, 2000);
    }
  });

  // Modal Controls
  function openModal(eventData) {
    modalTitle.textContent = `Inspection: ${eventData.id}`;
    modalJson.textContent = JSON.stringify(eventData, null, 2);
    eventModal.classList.add('active');
  }

  btnModalClose.addEventListener('click', () => {
    eventModal.classList.remove('active');
  });

  eventModal.addEventListener('click', (e) => {
    if (e.target === eventModal) eventModal.classList.remove('active');
  });

  // Utility helpers
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
  }

  // ==========================================
  // 6. Initial Load
  // ==========================================
  connectWebSocket();
  pollHealth();
  setInterval(pollHealth, 5000);

  // Fetch initial event history
  fetch('/api/v1/events?limit=10')
    .then((res) => res.json())
    .then((data) => {
      if (data.events && data.events.length > 0) {
        data.events.reverse().forEach((evt) => handleIncomingEvent(evt, true));
      }
    })
    .catch((err) => console.log('No prior events found'));
});
