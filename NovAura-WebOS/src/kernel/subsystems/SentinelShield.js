/**
 * SentinelShield — Platform Security Subsystem
 *
 * Real-time threat detection, prompt injection interception,
 * content scanning, anomaly detection, and viral destruction.
 * Sits on the IPC bus as a transparent interceptor — all events
 * flow through Sentinel before reaching subsystems.
 *
 * Architecture:
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │                     SentinelShield                          │
 *   ├────────────┬────────────┬──────────────┬────────────────────┤
 *   │ Prompt     │ Content    │ Anomaly      │ Quarantine         │
 *   │ Firewall   │ Scanner    │ Detector     │ Vault              │
 *   ├────────────┼────────────┼──────────────┼────────────────────┤
 *   │ Injection  │ File scan  │ Rate spikes  │ Threat log         │
 *   │ Jailbreak  │ XSS/SQLi   │ Escalation   │ Auto-block         │
 *   │ Encoding   │ Malicious  │ Brute force  │ Alert pipeline     │
 *   │ Exfil      │ code/URLs  │ Data exfil   │ Firestore audit    │
 *   └────────────┴────────────┴──────────────┴────────────────────┘
 *        │              │             │               │
 *     IPC:ai:*      IPC:fs:*    Rate windows     Notify + Block
 */

import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from 'firebase/firestore';

// ─── Threat Severity ──────────────────────────────────────────────────────────
const SEVERITY = {
  INFO:     0,   // logged, no action
  LOW:      1,   // logged + flagged
  MEDIUM:   2,   // logged + blocked + user warned
  HIGH:     3,   // logged + blocked + quarantined + admin alert
  CRITICAL: 4,   // logged + blocked + quarantined + session killed + admin alert
};

const SEVERITY_LABELS = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

// ─── Detection Categories ─────────────────────────────────────────────────────
const THREAT_TYPES = {
  PROMPT_INJECTION:    'prompt_injection',
  JAILBREAK:           'jailbreak',
  SYSTEM_PROMPT_LEAK:  'system_prompt_leak',
  ENCODING_ATTACK:     'encoding_attack',
  DATA_EXFILTRATION:   'data_exfiltration',
  XSS:                 'xss',
  SQL_INJECTION:       'sql_injection',
  MALICIOUS_URL:       'malicious_url',
  MALICIOUS_CODE:      'malicious_code',
  RATE_ANOMALY:        'rate_anomaly',
  ESCALATION:          'escalation',
  RESOURCE_ABUSE:      'resource_abuse',
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  VIRAL_PAYLOAD:       'viral_payload',
};

// ─── Prompt Injection Patterns ────────────────────────────────────────────────
const INJECTION_PATTERNS = [
  // Direct injection
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|directives?)/i,
  /disregard\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|prompts?|rules?|guidelines?)/i,
  /forget\s+(all\s+)?(previous|prior|everything|your)\s+(instructions?|context|rules?)/i,
  /you\s+are\s+now\s+(a|an|the)\s+/i,
  /new\s+(instructions?|rules?|directives?):\s*/i,
  /override\s+(system|safety|security|all)\s+(prompt|instructions?|rules?|settings?)/i,
  /bypass\s+(all\s+)?(safety|security|content|filter|restrictions?|guardrails?)/i,

  // Role hijacking
  /pretend\s+(you\s+are|to\s+be|you're)\s+(a|an|the)?\s*(unrestricted|unfiltered|evil|jailbroken)/i,
  /act\s+as\s+(a|an)?\s*(DAN|unrestricted|unfiltered|evil|different\s+AI)/i,
  /enter\s+(DAN|jailbreak|unrestricted|developer)\s+mode/i,
  /switch\s+to\s+(unrestricted|unfiltered|developer|admin)\s+mode/i,

  // System prompt extraction
  /(?:show|reveal|display|print|output|repeat|echo)\s+(?:me\s+)?(?:your|the)\s+(system|initial|original|hidden)\s+(prompt|instructions?|message|configuration)/i,
  /what\s+(?:is|are)\s+your\s+(system\s+)?(?:prompt|instructions?|rules?|original\s+instructions?)/i,
  /(?:give|tell)\s+me\s+(?:your|the)\s+(?:system|full|complete|original)\s+(prompt|instructions?)/i,

  // Delimiter attacks
  /```\s*system\s*\n/i,
  /\[SYSTEM\]\s*:/i,
  /<\|(?:system|im_start|endoftext)\|>/i,
  /<<\s*SYS\s*>>/i,
  /\[INST\]/i,

  // Encoding evasion
  /(?:base64|rot13|hex|unicode)\s*(?:decode|encode|convert|translate)/i,
  /eval\s*\(\s*atob\s*\(/i,

  // Data exfiltration
  /(?:send|transmit|upload|post|exfiltrate)\s+(?:all\s+)?(?:data|files?|information|messages?|conversations?|memories?)\s+(?:to|at|via)\s+/i,
  /fetch\s*\(\s*['"`]https?:\/\/(?!(?:us-central1-novaura-life\.cloudfunctions\.net|novaura\.life))/i,
];

// ─── XSS / Code Injection Patterns ───────────────────────────────────────────
const XSS_PATTERNS = [
  /<script[\s>]/i,
  /javascript\s*:/i,
  /on(?:error|load|click|mouseover|focus|blur|submit|change|input|keyup|keydown)\s*=/i,
  /document\.(?:cookie|write|execCommand|location)/i,
  /window\.(?:location|open|eval)/i,
  /eval\s*\(/i,
  /Function\s*\(/i,
  /setTimeout\s*\(\s*['"`]/i,
  /setInterval\s*\(\s*['"`]/i,
  /innerHTML\s*=/i,
  /outerHTML\s*=/i,
  /insertAdjacentHTML/i,
  /\.src\s*=\s*['"`]data:/i,
  /import\s*\(\s*['"`]data:/i,
];

// ─── SQL Injection Patterns ──────────────────────────────────────────────────
const SQLI_PATTERNS = [
  /(?:UNION\s+(?:ALL\s+)?SELECT|INSERT\s+INTO|UPDATE\s+.*SET|DELETE\s+FROM|DROP\s+(?:TABLE|DATABASE))/i,
  /(?:;\s*(?:DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|EXEC))\b/i,
  /(?:OR|AND)\s+['"]?\d+['"]?\s*=\s*['"]?\d+/i,
  /(?:OR|AND)\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?\s*--/i,
  /'\s*(?:OR|AND)\s+['"]?1['"]?\s*=\s*['"]?1/i,
  /WAITFOR\s+DELAY/i,
  /BENCHMARK\s*\(/i,
  /SLEEP\s*\(/i,
];

// ─── Malicious URL Patterns ──────────────────────────────────────────────────
const MALICIOUS_URL_PATTERNS = [
  /https?:\/\/[^/]*(?:\.ru|\.cn|\.tk|\.ml|\.ga|\.cf|\.gq)\//i,
  /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,    // bare IP URLs
  /data:text\/html/i,
  /data:application\/javascript/i,
  /javascript:void/i,
];

// ─── Viral / Malicious Code Patterns ─────────────────────────────────────────
const VIRAL_PATTERNS = [
  /while\s*\(\s*true\s*\)\s*\{/i,                     // infinite loops
  /for\s*\(\s*;\s*;\s*\)/i,                            // for(;;)
  /setInterval\s*\([^,]+,\s*[01]\s*\)/,                // 0ms interval bomb
  /(?:crypto|subtle)\.(?:encrypt|decrypt)/i,            // crypto ops
  /navigator\.(?:clipboard|credentials|mediaDevices)/i, // sensitive API access
  /indexedDB\.(?:deleteDatabase|open)/i,                // DB manipulation
  /caches\.(?:delete|keys)/i,                          // cache manipulation
  /ServiceWorker|importScripts/i,                      // SW injection
  /SharedArrayBuffer|Atomics/i,                        // side-channel timing
  /WebAssembly\.(?:instantiate|compile)/i,             // WASM injection
  /chrome\.runtime|browser\.runtime/i,                 // extension API access
  /\.postMessage\s*\(/i,                               // cross-origin messaging
  /new\s+Worker\s*\(\s*['"`]data:/i,                   // data: Worker
];

// ─── Rate Limiting Config ─────────────────────────────────────────────────────
const RATE_WINDOWS = {
  ai_requests:     { max: 30,  windowMs: 60_000,  severity: SEVERITY.MEDIUM },
  file_writes:     { max: 50,  windowMs: 60_000,  severity: SEVERITY.MEDIUM },
  file_reads:      { max: 100, windowMs: 60_000,  severity: SEVERITY.LOW },
  window_opens:    { max: 20,  windowMs: 60_000,  severity: SEVERITY.LOW },
  auth_attempts:   { max: 5,   windowMs: 300_000, severity: SEVERITY.HIGH },
  tool_calls:      { max: 60,  windowMs: 60_000,  severity: SEVERITY.MEDIUM },
  fetch_requests:  { max: 20,  windowMs: 60_000,  severity: SEVERITY.MEDIUM },
  notifications:   { max: 30,  windowMs: 60_000,  severity: SEVERITY.LOW },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ SentinelShield Class ═════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export default class SentinelShield {
  constructor() {
    this.kernel    = null;
    this._ready    = false;
    this._db       = null;

    // Threat log (in-memory ring buffer)
    this._threatLog     = [];
    this._maxLogSize    = 500;

    // Rate counters: { category: [{ timestamp }] }
    this._rateBuckets   = {};

    // Quarantine vault: blocked items
    this._quarantine    = [];
    this._maxQuarantine = 100;

    // Stats
    this._stats = {
      scansTotal:       0,
      threatsDetected:  0,
      threatsBlocked:   0,
      promptsScanned:   0,
      filesScanned:     0,
      urlsScanned:      0,
      injectionsCaught: 0,
      xssCaught:        0,
      sqliCaught:       0,
      viralCaught:      0,
      rateViolations:   0,
      quarantined:      0,
    };

    // State change listeners
    this._listeners = new Set();

    // IPC interceptor references (for cleanup)
    this._interceptors = [];
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  init(kernel) {
    this.kernel = kernel;
    this._db = kernel.auth?._db || null;
  }

  async boot() {
    if (!this.kernel) throw new Error('SentinelShield: init() must be called before boot()');

    const ipc = this.kernel.ipc;

    // ── Wire IPC interceptors ───────────────────────────────────────────────
    // These run BEFORE other subscribers see the event

    // 1. AI request scanning — prompt injection + jailbreak detection
    this._intercept(ipc, 'ai:request', (payload) => {
      return this._scanPrompt(payload?.prompt || payload?.message || '', 'ai:request');
    });

    // 2. NovaAgent chat — scan user messages to Nova
    this._intercept(ipc, 'nova:chat', (payload) => {
      return this._scanPrompt(payload?.message || '', 'nova:chat');
    });

    // 3. File write scanning — malicious code, XSS, viral payloads
    this._intercept(ipc, 'fs:write', (payload) => {
      return this._scanFileContent(payload?.path || '', payload?.data || payload?.content || '', 'fs:write');
    });

    // 4. URL fetch scanning — malicious URLs
    this._intercept(ipc, 'fetch:request', (payload) => {
      return this._scanUrl(payload?.url || '', 'fetch:request');
    });

    // 5. Window open monitoring — rate limiting
    this._intercept(ipc, 'window:open', () => {
      return this._checkRate('window_opens');
    });

    // 6. Auth monitoring — brute force detection
    this._intercept(ipc, 'auth:attempt', () => {
      return this._checkRate('auth_attempts');
    });

    // 7. Notification spam detection
    this._intercept(ipc, 'notification:push', () => {
      return this._checkRate('notifications');
    });

    // 8. Tool call scanning — NovaAgent tool execution monitoring
    this._intercept(ipc, 'nova:tool_call', (payload) => {
      this._checkRate('tool_calls');
      return this._scanToolCall(payload);
    });

    // 9. Plugin code scanning
    this._intercept(ipc, 'plugin:register', (payload) => {
      return this._scanPluginCode(payload);
    });

    // Load threat history from Firestore
    await this._loadThreatHistory();

    this._ready = true;
    this.kernel.ipc.emit('sentinel:ready', { stats: this.getStats() });
    this._notifyListeners('ready');
  }

  // ─── IPC Interceptor Wiring ─────────────────────────────────────────────────

  _intercept(ipc, channel, handler) {
    // Intercepts run as high-priority listeners
    const wrapped = (payload) => {
      try {
        const result = handler(payload);
        // If handler returns { blocked: true }, emit a block event
        if (result?.blocked) {
          ipc.emit('sentinel:blocked', {
            channel,
            threat: result.threat,
            severity: result.severity,
            timestamp: Date.now(),
          });
        }
      } catch (err) {
        console.error(`[SentinelShield] Interceptor error on ${channel}:`, err);
      }
    };
    ipc.on(channel, wrapped);
    this._interceptors.push({ channel, handler: wrapped });
  }

  // ─── Prompt Firewall ────────────────────────────────────────────────────────

  _scanPrompt(prompt, source) {
    if (!prompt || typeof prompt !== 'string') return { blocked: false };

    this._stats.scansTotal++;
    this._stats.promptsScanned++;
    this._checkRate('ai_requests');

    const threats = [];

    // 1. Prompt injection detection
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(prompt)) {
        threats.push({
          type: THREAT_TYPES.PROMPT_INJECTION,
          severity: SEVERITY.HIGH,
          pattern: pattern.source.slice(0, 60),
          match: prompt.match(pattern)?.[0]?.slice(0, 80),
        });
        break; // one match is enough per category
      }
    }

    // 2. Encoding attack detection (base64/hex/unicode payloads)
    const encodingThreats = this._detectEncodingAttacks(prompt);
    threats.push(...encodingThreats);

    // 3. Data exfiltration attempts
    const exfilPatterns = [
      /(?:send|post|upload|transmit)\s+(?:all\s+)?(?:user|private|secret|api[_ ]?key|token|password|credential)/i,
      /(?:curl|wget|fetch|XMLHttpRequest)\s+.*(?:api[_ ]?key|token|secret|password)/i,
    ];
    for (const pattern of exfilPatterns) {
      if (pattern.test(prompt)) {
        threats.push({
          type: THREAT_TYPES.DATA_EXFILTRATION,
          severity: SEVERITY.CRITICAL,
          pattern: pattern.source.slice(0, 60),
          match: prompt.match(pattern)?.[0]?.slice(0, 80),
        });
        break;
      }
    }

    // 4. XSS in prompts (trying to inject scripts via AI responses)
    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(prompt)) {
        threats.push({
          type: THREAT_TYPES.XSS,
          severity: SEVERITY.MEDIUM,
          pattern: pattern.source.slice(0, 60),
          match: prompt.match(pattern)?.[0]?.slice(0, 80),
        });
        break;
      }
    }

    if (threats.length > 0) {
      const maxSeverity = Math.max(...threats.map(t => t.severity));
      for (const threat of threats) {
        this._recordThreat(threat, source, prompt.slice(0, 200));
      }

      // Block if MEDIUM or above
      if (maxSeverity >= SEVERITY.MEDIUM) {
        this._stats.threatsBlocked++;
        this._stats.injectionsCaught += threats.filter(t => t.type === THREAT_TYPES.PROMPT_INJECTION).length;
        return {
          blocked: true,
          threat: threats[0].type,
          severity: maxSeverity,
          message: this._getBlockMessage(threats[0].type),
        };
      }
    }

    return { blocked: false };
  }

  // ─── Encoding Attack Detection ──────────────────────────────────────────────

  _detectEncodingAttacks(text) {
    const threats = [];

    // Base64 encoded payloads
    const b64Regex = /(?:atob|btoa|base64[_.]?(?:decode|encode))\s*\(\s*['"`]([A-Za-z0-9+/=]{20,})['"`]/i;
    const b64Match = text.match(b64Regex);
    if (b64Match) {
      try {
        const decoded = atob(b64Match[1]);
        // Recursively scan the decoded content
        const hasInjection = INJECTION_PATTERNS.some(p => p.test(decoded));
        const hasXSS = XSS_PATTERNS.some(p => p.test(decoded));
        if (hasInjection || hasXSS) {
          threats.push({
            type: THREAT_TYPES.ENCODING_ATTACK,
            severity: SEVERITY.HIGH,
            pattern: 'base64_hidden_payload',
            match: `Decoded: ${decoded.slice(0, 60)}`,
          });
        }
      } catch { /* not valid base64 */ }
    }

    // Unicode escape sequences hiding malicious content
    const unicodeEscapes = (text.match(/\\u[0-9a-fA-F]{4}/g) || []).length;
    if (unicodeEscapes > 10) {
      threats.push({
        type: THREAT_TYPES.ENCODING_ATTACK,
        severity: SEVERITY.MEDIUM,
        pattern: 'excessive_unicode_escapes',
        match: `${unicodeEscapes} unicode escapes detected`,
      });
    }

    // Hex encoding
    const hexPayload = text.match(/(?:0x[0-9a-fA-F]{2}\s*,?\s*){10,}/);
    if (hexPayload) {
      threats.push({
        type: THREAT_TYPES.ENCODING_ATTACK,
        severity: SEVERITY.MEDIUM,
        pattern: 'hex_encoded_payload',
        match: hexPayload[0].slice(0, 60),
      });
    }

    return threats;
  }

  // ─── File Content Scanner ───────────────────────────────────────────────────

  _scanFileContent(path, content, source) {
    if (!content || typeof content !== 'string') return { blocked: false };

    this._stats.scansTotal++;
    this._stats.filesScanned++;
    this._checkRate('file_writes');

    const threats = [];
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const isCode = ['js', 'jsx', 'ts', 'tsx', 'html', 'htm', 'svg', 'css', 'py', 'sh', 'bat', 'ps1'].includes(ext);

    // 1. XSS in HTML/JS files
    if (isCode || ext === 'html' || ext === 'htm' || ext === 'svg') {
      for (const pattern of XSS_PATTERNS) {
        if (pattern.test(content)) {
          // Allow legitimate code — only flag in user-uploaded or suspicious contexts
          if (source === 'fs:write' && !path.startsWith('/system/') && !path.startsWith('/kernel/')) {
            threats.push({
              type: THREAT_TYPES.XSS,
              severity: SEVERITY.LOW, // LOW for code files (could be legitimate)
              pattern: pattern.source.slice(0, 60),
              match: content.match(pattern)?.[0]?.slice(0, 80),
              file: path,
            });
            break;
          }
        }
      }
    }

    // 2. SQL injection in any content
    for (const pattern of SQLI_PATTERNS) {
      if (pattern.test(content)) {
        threats.push({
          type: THREAT_TYPES.SQL_INJECTION,
          severity: SEVERITY.MEDIUM,
          pattern: pattern.source.slice(0, 60),
          match: content.match(pattern)?.[0]?.slice(0, 80),
          file: path,
        });
        break;
      }
    }

    // 3. Viral / destructive code patterns
    for (const pattern of VIRAL_PATTERNS) {
      if (pattern.test(content)) {
        threats.push({
          type: THREAT_TYPES.VIRAL_PAYLOAD,
          severity: SEVERITY.HIGH,
          pattern: pattern.source.slice(0, 60),
          match: content.match(pattern)?.[0]?.slice(0, 80),
          file: path,
        });
        break;
      }
    }

    // 4. Malicious URLs in files
    for (const pattern of MALICIOUS_URL_PATTERNS) {
      if (pattern.test(content)) {
        threats.push({
          type: THREAT_TYPES.MALICIOUS_URL,
          severity: SEVERITY.MEDIUM,
          pattern: pattern.source.slice(0, 60),
          match: content.match(pattern)?.[0]?.slice(0, 80),
          file: path,
        });
        break;
      }
    }

    // 5. Large file bomb detection (>5MB content string)
    if (content.length > 5_000_000) {
      threats.push({
        type: THREAT_TYPES.RESOURCE_ABUSE,
        severity: SEVERITY.HIGH,
        pattern: 'file_bomb',
        match: `File size: ${(content.length / 1_000_000).toFixed(1)}MB`,
        file: path,
      });
    }

    if (threats.length > 0) {
      const maxSeverity = Math.max(...threats.map(t => t.severity));
      for (const threat of threats) {
        this._recordThreat(threat, source, `File: ${path}`);
      }
      this._stats.xssCaught += threats.filter(t => t.type === THREAT_TYPES.XSS).length;
      this._stats.sqliCaught += threats.filter(t => t.type === THREAT_TYPES.SQL_INJECTION).length;
      this._stats.viralCaught += threats.filter(t => t.type === THREAT_TYPES.VIRAL_PAYLOAD).length;

      if (maxSeverity >= SEVERITY.HIGH) {
        this._stats.threatsBlocked++;
        this._quarantineItem(path, content.slice(0, 1000), threats);
        return {
          blocked: true,
          threat: threats[0].type,
          severity: maxSeverity,
          message: this._getBlockMessage(threats[0].type),
        };
      }
    }

    return { blocked: false };
  }

  // ─── URL Scanner ────────────────────────────────────────────────────────────

  _scanUrl(url, source) {
    if (!url || typeof url !== 'string') return { blocked: false };

    this._stats.scansTotal++;
    this._stats.urlsScanned++;
    this._checkRate('fetch_requests');

    const threats = [];

    for (const pattern of MALICIOUS_URL_PATTERNS) {
      if (pattern.test(url)) {
        threats.push({
          type: THREAT_TYPES.MALICIOUS_URL,
          severity: SEVERITY.HIGH,
          pattern: pattern.source.slice(0, 60),
          match: url.slice(0, 120),
        });
        break;
      }
    }

    // Homograph attack detection (mixed scripts in domain)
    try {
      const domain = new URL(url).hostname;
      const hasNonASCII = /[^\x00-\x7F]/.test(domain);
      if (hasNonASCII) {
        threats.push({
          type: THREAT_TYPES.MALICIOUS_URL,
          severity: SEVERITY.HIGH,
          pattern: 'homograph_attack',
          match: `IDN domain: ${domain}`,
        });
      }
    } catch { /* not a valid URL */ }

    if (threats.length > 0) {
      for (const threat of threats) {
        this._recordThreat(threat, source, url.slice(0, 200));
      }
      this._stats.threatsBlocked++;
      return {
        blocked: true,
        threat: threats[0].type,
        severity: threats[0].severity,
        message: 'Blocked: suspicious or malicious URL detected.',
      };
    }

    return { blocked: false };
  }

  // ─── Tool Call Scanner ──────────────────────────────────────────────────────

  _scanToolCall(payload) {
    if (!payload) return { blocked: false };

    const { tool, args } = payload;
    const threats = [];

    // Block dangerous tool + argument combos
    if (tool === 'run_terminal') {
      const cmd = args?.command || '';
      const dangerousCommands = [
        /rm\s+-rf\s+\//i,
        /del\s+\/[sf]\s+/i,
        /format\s+[a-z]:/i,
        /:(){ :|:& };:/,                    // fork bomb
        />\s*\/dev\/sd[a-z]/i,               // disk overwrite
        /mkfs\./i,                           // filesystem format
        /dd\s+if=.*of=\/dev\//i,             // raw disk write
        /curl\s+.*\|\s*(?:bash|sh|python)/i, // pipe-to-shell
        /wget\s+.*\|\s*(?:bash|sh|python)/i,
        /powershell\s+-e\s+/i,              // encoded command
        /net\s+user\s+/i,                    // user manipulation
        /reg\s+(?:add|delete)\s+/i,          // registry manipulation
      ];

      for (const pattern of dangerousCommands) {
        if (pattern.test(cmd)) {
          threats.push({
            type: THREAT_TYPES.MALICIOUS_CODE,
            severity: SEVERITY.CRITICAL,
            pattern: pattern.source.slice(0, 60),
            match: cmd.slice(0, 120),
          });
          break;
        }
      }
    }

    // Block fetch to non-whitelisted domains
    if (tool === 'fetch_url') {
      const urlResult = this._scanUrl(args?.url || '', 'nova:tool_call');
      if (urlResult.blocked) return urlResult;
    }

    // Scan file content being created
    if (tool === 'create_file' || tool === 'save_to_ide') {
      const fileResult = this._scanFileContent(
        args?.path || args?.filename || 'unknown',
        args?.content || '',
        'nova:tool_call'
      );
      if (fileResult.blocked) return fileResult;
    }

    if (threats.length > 0) {
      for (const threat of threats) {
        this._recordThreat(threat, 'nova:tool_call', `Tool: ${tool}`);
      }
      this._stats.threatsBlocked++;
      return {
        blocked: true,
        threat: threats[0].type,
        severity: threats[0].severity,
        message: `Blocked: dangerous ${tool} invocation detected.`,
      };
    }

    return { blocked: false };
  }

  // ─── Plugin Code Scanner ────────────────────────────────────────────────────

  _scanPluginCode(payload) {
    if (!payload?.code && !payload?.capabilities) return { blocked: false };

    this._stats.scansTotal++;
    const threats = [];
    const code = typeof payload.code === 'string' ? payload.code : JSON.stringify(payload);

    // Scan plugin code for viral patterns
    for (const pattern of VIRAL_PATTERNS) {
      if (pattern.test(code)) {
        threats.push({
          type: THREAT_TYPES.VIRAL_PAYLOAD,
          severity: SEVERITY.HIGH,
          pattern: pattern.source.slice(0, 60),
          match: code.match(pattern)?.[0]?.slice(0, 80),
        });
        break;
      }
    }

    // Check for eval usage
    if (/\beval\s*\(/.test(code) || /new\s+Function\s*\(/.test(code)) {
      threats.push({
        type: THREAT_TYPES.MALICIOUS_CODE,
        severity: SEVERITY.HIGH,
        pattern: 'dynamic_code_execution',
        match: code.match(/(?:eval|new\s+Function)\s*\([^)]{0,60}/)?.[0],
      });
    }

    if (threats.length > 0) {
      for (const threat of threats) {
        this._recordThreat(threat, 'plugin:register', `Plugin: ${payload.pluginId || 'unknown'}`);
      }
      this._stats.viralCaught++;
      if (Math.max(...threats.map(t => t.severity)) >= SEVERITY.HIGH) {
        this._stats.threatsBlocked++;
        this._quarantineItem(payload.pluginId || 'unknown_plugin', code.slice(0, 500), threats);
        return {
          blocked: true,
          threat: threats[0].type,
          severity: SEVERITY.HIGH,
          message: 'Blocked: plugin contains potentially malicious code.',
        };
      }
    }

    return { blocked: false };
  }

  // ─── Rate Limiter ───────────────────────────────────────────────────────────

  _checkRate(category) {
    const config = RATE_WINDOWS[category];
    if (!config) return { blocked: false };

    if (!this._rateBuckets[category]) {
      this._rateBuckets[category] = [];
    }

    const now = Date.now();
    const bucket = this._rateBuckets[category];

    // Prune old entries outside the window
    while (bucket.length > 0 && bucket[0] < now - config.windowMs) {
      bucket.shift();
    }

    bucket.push(now);

    if (bucket.length > config.max) {
      this._stats.rateViolations++;
      this._recordThreat({
        type: THREAT_TYPES.RATE_ANOMALY,
        severity: config.severity,
        pattern: `${category}_rate_exceeded`,
        match: `${bucket.length}/${config.max} in ${config.windowMs / 1000}s`,
      }, 'rate_limiter', category);

      if (config.severity >= SEVERITY.MEDIUM) {
        this._stats.threatsBlocked++;
        return {
          blocked: true,
          threat: THREAT_TYPES.RATE_ANOMALY,
          severity: config.severity,
          message: `Rate limit exceeded: ${category}. Please slow down.`,
        };
      }
    }

    return { blocked: false };
  }

  // ─── Threat Recording ───────────────────────────────────────────────────────

  _recordThreat(threat, source, context) {
    const entry = {
      id: `threat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...threat,
      severityLabel: SEVERITY_LABELS[threat.severity] || 'UNKNOWN',
      source,
      context: context?.slice(0, 200),
      timestamp: Date.now(),
      timestampISO: new Date().toISOString(),
    };

    this._threatLog.push(entry);
    if (this._threatLog.length > this._maxLogSize) {
      this._threatLog.shift();
    }

    this._stats.threatsDetected++;
    this._notifyListeners('threat');

    // Emit IPC event for other subsystems
    this.kernel?.ipc?.emit('sentinel:threat', entry);

    // Persist HIGH+ to Firestore
    if (threat.severity >= SEVERITY.HIGH) {
      this._persistThreat(entry);
    }

    // Push notification for MEDIUM+
    if (threat.severity >= SEVERITY.MEDIUM) {
      this.kernel?.notifications?.push({
        title: `Security Alert: ${threat.type.replace(/_/g, ' ')}`,
        body: entry.context?.slice(0, 100),
        type: threat.severity >= SEVERITY.HIGH ? 'error' : 'warning',
        source: 'SentinelShield',
        autoDismiss: threat.severity < SEVERITY.HIGH ? 8000 : 0,
      });
    }

    return entry;
  }

  // ─── Quarantine Vault ───────────────────────────────────────────────────────

  _quarantineItem(id, content, threats) {
    const entry = {
      id: `quar_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      originalId: id,
      content: content?.slice(0, 2000),
      threats,
      timestamp: Date.now(),
      timestampISO: new Date().toISOString(),
      status: 'quarantined',
    };

    this._quarantine.push(entry);
    if (this._quarantine.length > this._maxQuarantine) {
      this._quarantine.shift();
    }

    this._stats.quarantined++;
    this._notifyListeners('quarantine');
    return entry;
  }

  // ─── Firestore Persistence ──────────────────────────────────────────────────

  async _persistThreat(entry) {
    try {
      const uid = this.kernel?.auth?.uid;
      if (!uid || !this._db) return;
      await addDoc(collection(this._db, `users/${uid}/security_threats`), {
        ...entry,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('[SentinelShield] Failed to persist threat:', err);
    }
  }

  async _loadThreatHistory() {
    try {
      const uid = this.kernel?.auth?.uid;
      if (!uid || !this._db) return;
      const q = query(
        collection(this._db, `users/${uid}/security_threats`),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      snap.forEach(doc => {
        this._threatLog.unshift({ id: doc.id, ...doc.data() });
      });
    } catch (err) {
      console.warn('[SentinelShield] Could not load threat history:', err);
    }
  }

  // ─── Block Messages ─────────────────────────────────────────────────────────

  _getBlockMessage(threatType) {
    const messages = {
      [THREAT_TYPES.PROMPT_INJECTION]:    'Blocked: Prompt injection attempt detected. This request was not sent.',
      [THREAT_TYPES.JAILBREAK]:           'Blocked: Jailbreak attempt detected and logged.',
      [THREAT_TYPES.SYSTEM_PROMPT_LEAK]:  'Blocked: System prompt extraction attempt detected.',
      [THREAT_TYPES.ENCODING_ATTACK]:     'Blocked: Encoded malicious payload detected.',
      [THREAT_TYPES.DATA_EXFILTRATION]:   'Blocked: Data exfiltration attempt intercepted.',
      [THREAT_TYPES.XSS]:                 'Blocked: Cross-site scripting payload detected.',
      [THREAT_TYPES.SQL_INJECTION]:       'Blocked: SQL injection payload detected.',
      [THREAT_TYPES.MALICIOUS_URL]:       'Blocked: Malicious or suspicious URL.',
      [THREAT_TYPES.MALICIOUS_CODE]:      'Blocked: Malicious code pattern detected.',
      [THREAT_TYPES.RATE_ANOMALY]:        'Blocked: Unusual activity rate detected. Please slow down.',
      [THREAT_TYPES.ESCALATION]:          'Blocked: Privilege escalation attempt.',
      [THREAT_TYPES.RESOURCE_ABUSE]:      'Blocked: Resource abuse detected.',
      [THREAT_TYPES.UNAUTHORIZED_ACCESS]: 'Blocked: Unauthorized access attempt.',
      [THREAT_TYPES.VIRAL_PAYLOAD]:       'Blocked: Viral/destructive code pattern detected and quarantined.',
    };
    return messages[threatType] || 'Blocked: Security threat detected.';
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** Manually scan arbitrary text (e.g., paste input, form data) */
  scan(text, source = 'manual') {
    const promptResult = this._scanPrompt(text, source);
    if (promptResult.blocked) return promptResult;

    const fileResult = this._scanFileContent('manual_input', text, source);
    if (fileResult.blocked) return fileResult;

    return { blocked: false, clean: true };
  }

  /** Manually scan a URL */
  scanUrl(url) {
    return this._scanUrl(url, 'manual');
  }

  /** Get the threat log */
  getThreatLog(n = 100) {
    return this._threatLog.slice(-n);
  }

  /** Get quarantine vault contents */
  getQuarantine() {
    return [...this._quarantine];
  }

  /** Release an item from quarantine */
  releaseFromQuarantine(quarantineId) {
    const idx = this._quarantine.findIndex(q => q.id === quarantineId);
    if (idx === -1) return false;
    this._quarantine[idx].status = 'released';
    this._notifyListeners('quarantine');
    return true;
  }

  /** Permanently delete a quarantined item */
  destroyQuarantined(quarantineId) {
    const idx = this._quarantine.findIndex(q => q.id === quarantineId);
    if (idx === -1) return false;
    this._quarantine.splice(idx, 1);
    this._notifyListeners('quarantine');
    return true;
  }

  /** Get live security stats */
  getStats() {
    return {
      ...this._stats,
      threatLogSize: this._threatLog.length,
      quarantineSize: this._quarantine.length,
      rateBuckets: Object.fromEntries(
        Object.entries(this._rateBuckets).map(([k, v]) => [k, v.length])
      ),
      ready: this._ready,
    };
  }

  /** Get rate limiter status for all categories */
  getRateLimits() {
    const result = {};
    for (const [category, config] of Object.entries(RATE_WINDOWS)) {
      const bucket = this._rateBuckets[category] || [];
      const now = Date.now();
      const active = bucket.filter(t => t > now - config.windowMs).length;
      result[category] = {
        current: active,
        max: config.max,
        windowMs: config.windowMs,
        percentUsed: Math.round((active / config.max) * 100),
        severity: SEVERITY_LABELS[config.severity],
      };
    }
    return result;
  }

  /** Get security health report */
  getHealthReport() {
    const recentThreats = this._threatLog.filter(t => t.timestamp > Date.now() - 3_600_000);
    const criticalCount = recentThreats.filter(t => t.severity >= SEVERITY.HIGH).length;

    let status = 'SECURE';
    if (criticalCount > 5) status = 'CRITICAL';
    else if (criticalCount > 0) status = 'ALERT';
    else if (recentThreats.length > 10) status = 'ELEVATED';

    return {
      status,
      recentThreats: recentThreats.length,
      criticalThreats: criticalCount,
      quarantined: this._quarantine.filter(q => q.status === 'quarantined').length,
      topThreatTypes: this._getTopThreatTypes(recentThreats),
      rateLimits: this.getRateLimits(),
      uptime: this._ready ? Date.now() - (this._bootTimestamp || Date.now()) : 0,
    };
  }

  _getTopThreatTypes(threats) {
    const counts = {};
    for (const t of threats) {
      counts[t.type] = (counts[t.type] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));
  }

  // ─── State Listeners ────────────────────────────────────────────────────────

  onStateChange(handler) {
    this._listeners.add(handler);
    return () => this._listeners.delete(handler);
  }

  _notifyListeners(event) {
    for (const handler of this._listeners) {
      try { handler(event); } catch { /* swallow */ }
    }
  }

  // ─── Shutdown ───────────────────────────────────────────────────────────────

  shutdown() {
    if (this.kernel?.ipc) {
      for (const { channel, handler } of this._interceptors) {
        this.kernel.ipc.off(channel, handler);
      }
    }
    this._interceptors = [];
    this._ready = false;
  }
}
