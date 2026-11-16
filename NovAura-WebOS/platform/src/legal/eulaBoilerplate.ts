import type { LicenseTier } from '@/types';
import { kernelStorage } from '@/kernel/kernelStorage.js';

export interface LicenseTerms {
  name: string;
  shortName: string;
  royaltyPercentage: number;
  requiresAttribution: boolean;
  allowsCommercial: boolean;
  allowsModification: boolean;
  allowsDistribution: boolean;
  description: string;
  useCase: string;
}

/**
 * NovAura Market Royalty Tiers
 * 
 * art_3pct:       Individual art assets (sprites, textures)
 * music_1pct:     Music & audio when used as primary soundtrack
 * integration_10pct: Multiple assets from same creator defining game's aesthetic
 * functional_15pct: Functional Sub-Games/Templates
 * source_20pct:     Full source code, complete game projects
 * opensource:       Free / Attribution only
 */
export const LICENSE_TERMS: Record<LicenseTier, LicenseTerms> = {
  art_3pct: {
    name: 'Individual Art License',
    shortName: 'Art (3%)',
    royaltyPercentage: 3,
    requiresAttribution: true,
    allowsCommercial: true,
    allowsModification: true,
    allowsDistribution: true,
    description: 'For individual art assets, sprites, textures used as components in your project.',
    useCase: 'Single sprites, texture packs, individual artwork',
  },
  music_1pct: {
    name: 'Music & Audio License',
    shortName: 'Music (1%)',
    royaltyPercentage: 1,
    requiresAttribution: true,
    allowsCommercial: true,
    allowsModification: true,
    allowsDistribution: true,
    description: 'For music, soundtracks, and audio when used as the primary sonic identity of your game.',
    useCase: 'Background music, soundtracks, theme songs, ambient audio',
  },
  integration_10pct: {
    name: 'Collection License',
    shortName: 'Collection (10%)',
    royaltyPercentage: 10,
    requiresAttribution: true,
    allowsCommercial: true,
    allowsModification: true,
    allowsDistribution: true,
    description: 'When multiple assets from the same creator collectively define the primary visual or audio identity of your game.',
    useCase: 'All art from one artist, complete character sets, entire soundtrack',
  },
  functional_15pct: {
    name: 'Framework License',
    shortName: 'Framework (15%)',
    royaltyPercentage: 15,
    requiresAttribution: true,
    allowsCommercial: true,
    allowsModification: true,
    allowsDistribution: true,
    description: 'For game systems, frameworks, and reusable code that powers core mechanics.',
    useCase: 'Card game frameworks, battle systems, UI/HUD frameworks, physics systems',
  },
  source_20pct: {
    name: 'Full Source License', // Kept name for consistency with other licenses
    shortName: 'Source (20%)',
    royaltyPercentage: 20,
    requiresAttribution: true,
    allowsCommercial: true,
    allowsModification: true,
    allowsDistribution: true,
    description: 'For complete game projects, full source code, and comprehensive templates.',
    useCase: 'Complete game projects, full engine implementations, comprehensive templates',
  },
  opensource: {
    name: 'Open Source License',
    shortName: 'Open Source',
    royaltyPercentage: 0,
    requiresAttribution: true,
    allowsCommercial: true,
    allowsModification: true,
    allowsDistribution: true,
    description: 'MIT/Apache licensed. Free to use with proper attribution.',
    useCase: 'Open source tools, MIT-licensed libraries, community contributions',
  },
};

export const getLicenseSpecificTerms = (tier: LicenseTier): LicenseTerms => {
  return LICENSE_TERMS[tier] || LICENSE_TERMS.opensource;
};

export const getRoyaltyPercentage = (tier: LicenseTier): number => {
  return LICENSE_TERMS[tier]?.royaltyPercentage ?? 0;
};

// License tier options for creator upload form
export const LICENSE_OPTIONS: { 
  value: LicenseTier; 
  label: string; 
  description: string; 
  royalty: string;
  examples: string;
}[] = [
  { 
    value: 'art_3pct', 
    label: 'Individual Art', 
    description: 'For sprites, textures, and individual artwork used as components',
    royalty: '3%',
    examples: 'Single character sprite, texture pack, UI element',
  },
  { 
    value: 'music_1pct', 
    label: 'Music & Audio', 
    description: 'For music, soundtracks, and audio when defining your game\'s sonic identity',
    royalty: '1%',
    examples: 'Background music, theme songs, ambient soundscapes',
  },
  { 
    value: 'integration_10pct', 
    label: 'Asset Collection', 
    description: 'When your assets collectively define a game\'s primary aesthetic',
    royalty: '10%',
    examples: 'Complete art pack, full character roster, entire game soundtrack',
  },
  { 
    value: 'functional_15pct', 
    label: 'Game Framework', 
    description: 'Reusable systems and frameworks that power core game mechanics',
    royalty: '15%',
    examples: 'Card game system, battle framework, UI/HUD toolkit, physics engine',
  },
  {
    value: 'source_20pct', 
    label: 'Full Source Code', 
    description: 'Complete projects, engine templates, or full frameworks.',
    royalty: '20%',
    examples: 'Complete game template, full project source, comprehensive demo',
  },
  { 
    value: 'opensource', 
    label: 'Open Source', 
    description: 'MIT/Apache licensed - free to use with attribution',
    royalty: 'Citation Only',
    examples: 'Community tools, educational resources, MIT libraries',
  },
];

// Full EULA Boilerplate Text
export const EULA_BOILERPLATE = {
  preamble: `END USER LICENSE AGREEMENT
NovAura Market Commercial License v2.0

IMPORTANT: THIS IS A LEGALLY BINDING CONTRACT. PLEASE READ CAREFULLY.

By purchasing, downloading, installing, or using this Asset, you acknowledge that you have 
read, understood, and agree to be bound by the terms of this Agreement.`,

  royaltyTiersExplanation: `
SECTION 1: ROYALTY TIER SYSTEM

NovAura Market uses a graduated royalty system based on the type and scope of assets:

• 1% - Music & Audio License
  For music, soundtracks, and audio when used as the primary sonic identity of your game.
  This applies when a single creator's music defines the majority of your game's soundtrack,
  background ambience, or audio experience. Designed to fairly compensate musicians while
  keeping costs manageable for developers.

• 3% - Individual Art License
  For single sprites, textures, and artwork used as components in your project 
  alongside other assets.

• 10% - Collection License  
  When multiple assets from the same creator collectively define your game's primary
  visual style, character aesthetic, or comprehensive audio identity. This applies when 
  the creator's work is the dominant artistic influence on your game's look or sound.

• 10% - Game Integration License: When your assets heavily define the project's identity (e.g., used in over 50% of scenes, core character sprites).
• 15% - Functional Sub-Game License: For barebone logic templates and mechanics alongside assets.
• 20% - Full Source License: For entire game templates or major frameworks where you provide the underlying code/architecture. 

These royalties are automatically tracked and dispersed. Buyers MUST attribute your work if specified in your attached EULA terms.

• 0% - Open Source License
  MIT/Apache licensed assets requiring only attribution, no monetary royalties.

The appropriate tier is selected by the creator at time of upload and is binding.`,

  royaltyClause: (percentage: number, creatorName: string) => `
SECTION 2: YOUR ROYALTY OBLIGATION (${percentage}%)

YOU AGREE TO PAY ${percentage}% OF ALL GROSS COMMERCIAL REVENUE GENERATED FROM PRODUCTS 
OR SERVICES THAT INCORPORATE THIS ASSET.

Royalty Calculation:
• Gross Revenue = Total revenue before any deductions (platform fees, taxes, refunds)
• Royalty Rate = ${percentage}% of Gross Revenue
• Payment Due = Quarterly, within 30 days of quarter end (Jan 30, Apr 30, Jul 30, Oct 30)
• Currency = USD or equivalent at time of payment
• Minimum Payment = No minimum; all revenue subject to royalty

Example Calculation:
If your product generates $100,000 in gross revenue, you owe:
$100,000 × ${percentage}% = $${(100000 * percentage / 100).toLocaleString()} in royalties

Perpetual Obligation:
This royalty obligation continues for as long as the Asset remains integrated into your 
commercial product, even if you cease active development. The obligation survives license 
termination for revenue earned during the license period.

Payment Method:
Royalties must be paid directly to ${creatorName} via the payment method specified in the 
Asset documentation or as agreed upon in writing. NovAura Market may provide payment 
processing services but is not responsible for ensuring payment.`,

  collectionClause: `
SECTION 3: COLLECTION LICENSE SPECIFIC TERMS (10%)

When using the Collection License tier, the following additional terms apply:

Dominant Aesthetic Threshold:
The 10% royalty rate applies when assets from a single creator constitute the majority 
of your game's visual or audio identity. This includes:

• All or most character art from one artist
• The complete visual style defined by one creator's assets
• The majority of music/sound from one composer's collection
• A cohesive art pack that defines your game's look

Multiple Asset Calculation:
If you use multiple assets from the same creator under Collection License:
• The 10% rate applies to ALL revenue from the product
• You cannot separate revenue by individual asset
• The obligation is per-creator, not per-asset

Attribution Requirements:
Collection License requires prominent attribution including:
• In-game credits with creator's name
• On store pages and marketing materials
• In source code comments (if source distributed)`,

  frameworkClause: `
SECTION 4: FRAMEWORK LICENSE SPECIFIC TERMS (15%)

When using the Framework License tier, the following additional terms apply:

Framework Definition:
A Framework is reusable code, systems, or templates that provide core functionality:

• Game systems (card games, battle systems, crafting, inventory)
• UI/HUD frameworks and component libraries
• Physics engines and simulation systems
• Networking/multiplayer frameworks
• Tooling and editor extensions

Derivative Works:
When building upon a Framework:
• Your modifications remain subject to the 15% royalty
• The obligation applies to the entire product using the framework
• You may not resell the framework itself as a standalone product

Attribution in Code:
Framework License requires:
• Copyright notices preserved in source code
• Attribution in documentation
• Link to original framework in about/credits section`,

  auditRightsClause: `
SECTION 5: AUDIT RIGHTS

THE CREATOR RETAINS THE RIGHT TO CONDUCT FINANCIAL AUDITS

If the Creator has reasonable suspicion that you have underreported or failed to report 
commercial revenue generated using the Asset, the Creator may:

1. Demand a third-party financial audit of your business records related to products 
   incorporating the Asset

2. Request access to:
   • Sales records and revenue reports
   • Payment processor statements (Steam, App Store, etc.)
   • Platform payout records
   • Tax filings related to products using the Asset
   • Analytics and user count data
   • Any other financial documentation requested

3. Audit Costs:
   • If underreporting of 5% or more is discovered: You bear full audit costs
   • If underreporting is less than 5%: Creator bears audit costs
   • Base audit cost estimate: $2,000-$10,000 depending on scope

4. Timeline:
   • Audit request must be made in writing
   • You must provide documentation within 30 days
   • Audit must be completed within 90 days of request

Non-Compliance:
Failure to comply with an audit request constitutes a material breach of this Agreement 
and may result in:
• Immediate license termination
• Legal action for breach of contract
• Statutory damages where applicable
• Attorney fees and court costs`,

  platformIndemnificationClause: `
SECTION 6: PLATFORM INDEMNIFICATION

NOVARAURA MARKET IS NOT A PARTY TO THIS AGREEMENT

NovAura Market, Inc. ("Platform") operates solely as a neutral marketplace and transaction 
ledger provider. By using this Platform, both Creator and Purchaser acknowledge and agree:

NO LIABILITY
The Platform bears absolutely no legal responsibility for:
• Enforcing royalty payments or collection
• Resolving disputes between parties
• Mediating conflicts or disagreements
• Verifying accuracy of royalty reports
• Ensuring compliance with license terms

NO WARRANTY
The Platform makes no representations or warranties about:
• Quality, functionality, or fitness for purpose of any Asset
• Accuracy of creator descriptions or claims
• Security or safety of Asset files
• Compatibility with specific systems or engines

FULL INDEMNIFICATION
Both parties agree to indemnify and hold harmless the Platform, its parent companies, 
subsidiaries, employees, agents, contractors, and affiliates from any claims, damages, 
liabilities, costs, and expenses (including reasonable attorneys' fees) arising from:
• This Agreement or any breach thereof
• The use or inability to use any Asset
• Any dispute between Creator and Purchaser
• Any claim that an Asset infringes third-party rights
• Any failure to pay royalties or comply with license terms
• Any damages resulting from use of the Platform

DISPUTE RESOLUTION
Any disputes between Creator and Purchaser must be resolved directly between those parties. 
The Platform will not intervene, mediate, arbitrate, or provide legal assistance.

LIMITATION OF LIABILITY
TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE PLATFORM SHALL NOT BE LIABLE FOR ANY INDIRECT, 
INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, ARISING 
OUT OF OR RELATED TO THIS AGREEMENT OR ANY ASSET PURCHASED THROUGH THE PLATFORM.

In no event shall the Platform's total liability exceed the amount paid for the specific 
Asset giving rise to the claim.

LEDGER FUNCTION ONLY
The Platform's sole function is to:
• Record that a transaction occurred
• Store the terms agreed upon at the time of purchase
• Provide access to Asset files
• Maintain a history of license agreements accepted

The Platform does not guarantee payment, enforce compliance, or provide legal remedies.`,

  enhancersAndAdaptersClause: `
SECTION 7: DERIVATIVE WORKS AND ADAPTATIONS

If you enhance, adapt, modify, or create derivative works based on this Asset:

Attribution Chain:
You must maintain clear attribution to the original creator in all derivative works:
• Documentation and README files
• Source code comments (preserved in all copies)
• User-facing credits and about pages
• Marketing materials and store listings

Royalty Chain:
Royalty obligations flow through derivative works:
• Your derivative work using a 15% Framework: 15% of your product revenue
• Your game using 10% Collection assets: 10% of your game revenue
• Multiple assets: Each creator's rate applies to total revenue

No Additional Restrictions:
You may not impose additional restrictions on users of your derivative work that would 
conflict with the terms of this original license.

Notification:
If you publicly distribute a significant derivative work (>1,000 users or >$10,000 revenue), 
you should notify the original creator as a professional courtesy.

The goal of this clause is to encourage a culture of sharing and building upon each other's 
work while ensuring original creators receive fair compensation for their contributions.`,

  terminationClause: `
SECTION 8: TERMINATION

This Agreement may be terminated by the Creator if you materially breach any term.

Upon termination:
• All licenses granted herein immediately terminate
• You must cease all use of the Asset in new projects within 30 days
• Royalty obligations for revenue already earned remain in effect
• Products already distributed may remain in market, subject to continued royalty payments
• You must remove the Asset from any projects still in development

Survival:
Sections 2 (Royalty), 5 (Audit Rights), 6 (Indemnification), and 9 (Governing Law) 
survive termination of this Agreement.

Effect of Termination:
Termination does not relieve you of obligations to:
• Pay royalties for revenue earned during the license period
• Maintain records for audit purposes
• Comply with attribution requirements for distributed products`,

  governingLawClause: `
SECTION 9: GOVERNING LAW AND JURISDICTION

This Agreement shall be governed by and construed in accordance with the laws of the State 
of Delaware, United States, without regard to its conflict of law principles.

Any legal action arising from this Agreement shall be brought in the state or federal courts 
located in Delaware. Both parties consent to the exclusive jurisdiction of these courts.

If any provision of this Agreement is found unenforceable, the remaining provisions shall 
continue in full force and effect.`,
};

// Generate full EULA text based on license tier
export const generateFullEULA = (
  assetTitle: string,
  creatorName: string,
  licenseTier: LicenseTier
): string => {
  const terms = getLicenseSpecificTerms(licenseTier);
  const percentage = terms.royaltyPercentage;
  
  let sections = [
    EULA_BOILERPLATE.preamble,
    '',
    `ASSET: ${assetTitle}`,
    `CREATOR: ${creatorName}`,
    `LICENSE TYPE: ${terms.name}`,
    `ROYALTY RATE: ${percentage > 0 ? percentage + '%' : 'Attribution Only'}`,
    '',
    EULA_BOILERPLATE.royaltyTiersExplanation,
    '',
    EULA_BOILERPLATE.royaltyClause(percentage, creatorName),
  ];
  
  // Add tier-specific clauses
  if (licenseTier === 'integration_10pct') {
    sections.push('', EULA_BOILERPLATE.collectionClause);
  }
  if (licenseTier === 'functional_15pct') {
    sections.push('', EULA_BOILERPLATE.frameworkClause);
  }
  
  sections.push(
    '',
    EULA_BOILERPLATE.auditRightsClause,
    '',
    EULA_BOILERPLATE.platformIndemnificationClause,
    '',
    EULA_BOILERPLATE.enhancersAndAdaptersClause,
    '',
    EULA_BOILERPLATE.terminationClause,
    '',
    EULA_BOILERPLATE.governingLawClause
  );
  
  return sections.join('\n') + `\n\n---\n\nThis agreement was generated on ${new Date().toISOString()}.\nAgreement Version: 2.0.0\nPlatform: NovAura Market\n\nBy digitally signing this agreement, you acknowledge that you have read, understood, \nand agree to be bound by all terms and conditions set forth herein.`;
};

// Save agreement to user's local storage
export const saveUserAgreement = (
  userId: string,
  assetId: string,
  assetTitle: string,
  creatorName: string,
  licenseTier: LicenseTier,
  signatureName: string
): void => {
  const terms = getLicenseSpecificTerms(licenseTier);
  
  const agreement = {
    id: `agr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    assetId,
    assetTitle,
    creatorName,
    licenseTier,
    royaltyPercentage: terms.royaltyPercentage,
    signatureName,
    signedAt: new Date().toISOString(),
    agreementText: generateFullEULA(assetTitle, creatorName, licenseTier),
    version: '2.0.0',
  };

  const existing = JSON.parse(kernelStorage.getItem('novaura_agreements') || '[]');
  existing.push(agreement);
  kernelStorage.setItem('novaura_agreements', JSON.stringify(existing));
  
  // Also save to a separate indexed list for easy lookup
  const agreementIndex = JSON.parse(kernelStorage.getItem('novaura_agreement_index') || '[]');
  agreementIndex.push({
    id: agreement.id,
    userId,
    assetId,
    assetTitle,
    signedAt: agreement.signedAt,
    royaltyPercentage: agreement.royaltyPercentage,
  });
  kernelStorage.setItem('novaura_agreement_index', JSON.stringify(agreementIndex));
};

// Get all agreements for a user
export const getUserAgreements = (userId: string) => {
  const all = JSON.parse(kernelStorage.getItem('novaura_agreements') || '[]');
  return all.filter((a: any) => a.userId === userId);
};

// Get agreement for specific asset
export const getAssetAgreement = (userId: string, assetId: string) => {
  const all = JSON.parse(kernelStorage.getItem('novaura_agreements') || '[]');
  return all.find((a: any) => a.userId === userId && a.assetId === assetId);
};

// Check if user has agreed to asset terms
export const hasUserAgreed = (userId: string, assetId: string): boolean => {
  return !!getAssetAgreement(userId, assetId);
};

// Agreement record interface
interface AgreementRecord {
  id: string;
  userId: string;
  assetId: string;
  assetTitle: string;
  creatorName: string;
  licenseTier: LicenseTier;
  royaltyPercentage: number;
  signatureName: string;
  signedAt: string;
  agreementText: string;
  version: string;
}

// Calculate total royalty obligations for a user
export const calculateTotalRoyaltyObligations = (userId: string): {
  totalAgreements: number;
  royaltyAgreements: number;
  openSourceAgreements: number;
  weightedAverageRate: number;
} => {
  const agreements: AgreementRecord[] = getUserAgreements(userId);
  const royaltyAgreements = agreements.filter((a: AgreementRecord) => a.royaltyPercentage > 0);
  
  const totalRate = royaltyAgreements.reduce((sum: number, a: AgreementRecord) => sum + a.royaltyPercentage, 0);
  const weightedAverage = royaltyAgreements.length > 0 ? totalRate / royaltyAgreements.length : 0;
  
  return {
    totalAgreements: agreements.length,
    royaltyAgreements: royaltyAgreements.length,
    openSourceAgreements: agreements.filter((a: AgreementRecord) => a.royaltyPercentage === 0).length,
    weightedAverageRate: Math.round(weightedAverage * 10) / 10,
  };
};
