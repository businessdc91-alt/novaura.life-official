/**
 * hostingAndDomainsIntegrations.js — Production Hosting, Cloud Deploy & Domain Registrars
 * 
 * Battle-tested templates for IONOS Cloud VPS & Deploy API, Name.com DNS Management API v4,
 * and Cloudflare Edge Deployments.
 */

export const HOSTING_AND_DOMAINS_INTEGRATIONS = [
  // ── 1. IONOS CLOUD DEPLOY & VPS ──────────────────────────────────────────
  {
    id: 'ionos_cloud_deploy_vps',
    title: 'IONOS Cloud VPS Deploy API & Provisioning',
    category: 'hosting_domains',
    vendor: 'IONOS Cloud',
    badge: 'Infrastructure & VPS',
    icon: 'Server',
    color: '#002875',
    description: 'Production IONOS Cloud Deploy API integration: Automated VPS provisioning, Cloud-Init script injection, data center region selection, SSH key management, and public IP allocation.',
    suggestedPath: '/projects/cybeni/integrations/ionosCloudService.js',
    language: 'javascript',
    aiPrompt: 'Implement an IONOS Cloud Deploy API client. Support data center selection, server creation with CPU/RAM cores, Cloud-Init script injection for Docker, and public IP allocation.',
    faqs: [
      {
        question: 'How do you authenticate with the IONOS Cloud API?',
        answer: 'Generate an API token from the IONOS Cloud Data Center Designer (DCD) management console and send it in the Authorization: Bearer <token> header.'
      },
      {
        question: 'Can this run automated server initialization (Cloud-Init)?',
        answer: 'Yes, pass cloudInit base64-encoded user-data during the POST /datacenters/{dcId}/servers creation call.'
      }
    ],
    code: `export class IonosCloudService {
  constructor({ apiToken, endpoint = 'https://api.ionos.com/cloudapi/v6' }) {
    if (!apiToken) throw new Error('IONOS API Token is required');
    this.apiToken = apiToken;
    this.endpoint = endpoint;
  }

  async request(path, options = {}) {
    const res = await fetch(\`\${this.endpoint}\${path}\`, {
      ...options,
      headers: {
        'Authorization': \`Bearer \${this.apiToken}\`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      throw new Error(\`IONOS Cloud API HTTP \${res.status}: \${await res.text()}\`);
    }

    if (res.status === 204) return null;
    return await res.json();
  }

  // List Data Centers
  async listDataCenters() {
    const data = await this.request('/datacenters?depth=2');
    return data.items || [];
  }

  // Provision VPS Server with Cloud-Init
  async provisionServer({
    dataCenterId,
    serverName = 'sovereign-node-01',
    cores = 4,
    ram = 8192,
    cpuFamily = 'INTEL_SKYLAKE',
    sshKey,
    cloudInitUserData,
  }) {
    const body = {
      properties: {
        name: serverName,
        cores,
        ram,
        cpuFamily,
      },
      entities: {
        volumes: {
          items: [
            {
              properties: {
                name: \`\${serverName}-root\`,
                type: 'SSD Standard',
                size: 80,
                imageAlias: 'ubuntu:latest',
                sshKeys: sshKey ? [sshKey] : undefined,
                userData: cloudInitUserData 
                  ? Buffer.from(cloudInitUserData).toString('base64') 
                  : undefined,
              },
            },
          ],
        },
      },
    };

    return await this.request(\`/datacenters/\${dataCenterId}/servers\`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Get Server IP and Power State
  async getServerStatus(dataCenterId, serverId) {
    return await this.request(\`/datacenters/\${dataCenterId}/servers/\${serverId}?depth=3\`);
  }
}
`
  },

  // ── 2. NAME.COM DNS & DOMAIN API ─────────────────────────────────────────
  {
    id: 'namecom_dns_records',
    title: 'Name.com DNS Management API v4',
    category: 'hosting_domains',
    vendor: 'Name.com',
    badge: 'DNS & Domains',
    icon: 'Globe',
    color: '#34a853',
    description: 'Complete Name.com Core API v4 client for automated DNS record creation (A, CNAME, TXT, MX), nameserver delegation, domain search, and SSL record verification.',
    suggestedPath: '/projects/cybeni/integrations/namecomDns.js',
    language: 'javascript',
    aiPrompt: 'Implement Name.com API v4 client. Support automated domain DNS record management (A, CNAME, TXT), listing records, deleting records, and checking domain availability.',
    faqs: [
      {
        question: 'How do I authenticate with Name.com API v4?',
        answer: 'Use HTTP Basic Authentication with your Name.com username and API Production Token: Authorization: Basic base64(username:token).'
      },
      {
        question: 'How fast do DNS updates propagate?',
        answer: 'Set TTL to 300 (5 minutes) for rapid propagation during deployment and SSL challenge verification.'
      }
    ],
    code: `export class NamecomDnsClient {
  constructor({ username, apiToken, useTestEndpoint = false }) {
    if (!username || !apiToken) throw new Error('Name.com username and apiToken are required');
    this.authHeader = 'Basic ' + Buffer.from(\`\${username}:\${apiToken}\`).toString('base64');
    this.endpoint = useTestEndpoint 
      ? 'https://api.dev.name.com/v4' 
      : 'https://api.name.com/v4';
  }

  async request(path, options = {}) {
    const res = await fetch(\`\${this.endpoint}\${path}\`, {
      ...options,
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      throw new Error(\`Name.com HTTP \${res.status}: \${await res.text()}\`);
    }

    if (res.status === 204) return null;
    return await res.json();
  }

  // 1. List All DNS Records for Domain
  async listRecords(domainName) {
    const data = await this.request(\`/domains/\${domainName}/records\`);
    return data.records || [];
  }

  // 2. Create DNS Record (e.g. A, CNAME, TXT)
  async createRecord(domainName, { host = '@', type = 'A', answer, ttl = 300 }) {
    return await this.request(\`/domains/\${domainName}/records\`, {
      method: 'POST',
      body: JSON.stringify({ host, type, answer, ttl }),
    });
  }

  // 3. Upsert A Record for Root or Subdomain
  async upsertARecord(domainName, host, targetIp) {
    const records = await this.listRecords(domainName);
    const existing = records.find(r => r.type === 'A' && (r.host === host || (host === '@' && !r.host)));

    if (existing) {
      return await this.request(\`/domains/\${domainName}/records/\${existing.id}\`, {
        method: 'PUT',
        body: JSON.stringify({ host, type: 'A', answer: targetIp, ttl: 300 }),
      });
    }

    return await this.createRecord(domainName, { host, type: 'A', answer: targetIp, ttl: 300 });
  }

  // 4. Check Domain Availability
  async checkAvailability(domainNames = []) {
    return await this.request('/domains:checkAvailability', {
      method: 'POST',
      body: JSON.stringify({ domainNames }),
    });
  }
}
`
  }
];
