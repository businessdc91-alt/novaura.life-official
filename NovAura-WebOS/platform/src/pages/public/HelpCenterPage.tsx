import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, Book, Zap, Shield, HelpCircle, MessageCircle, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqs: FAQItem[] = [
  {
    category: 'Getting Started',
    question: 'What is NovAura Market?',
    answer: 'NovAura is an ethical, high-fidelity digital asset exchange platform. We facilitate the trade of advanced 3D assets, music, software, and logic-based building blocks while ensuring creators receive fair, automated royalties through our "Foundation" system.'
  },
  {
    category: 'Getting Started',
    question: 'How do I become a creator?',
    answer: 'Simply sign up and navigate to the Creator Studio. Once you complete your profile and agree to the Creator Terms, you can start uploading assets. All assets are reviewed by our staff to ensure quality and compliance before going live.'
  },
  {
    category: 'Economics & Royalties',
    question: 'How does the 10% Platform Fee work?',
    answer: 'To maintain our high-compute infrastructure and neural networks (like Aura), NovAura applies a flat 10% fee to every marketplace transaction. This is deducted before royalty distributions, ensuring the ecosystem remains autonomous and sustainable.'
  },
  {
    category: 'Economics & Royalties',
    question: 'What is the "Guaranteed Creator Stake"?',
    answer: 'We believe creators should always be the primary beneficiaries of their work. Even with complex royalty chains (foundations), the current publisher is always guaranteed a minimum of 50% of the sale price after the platform fee.'
  },
  {
    category: 'Aura AI',
    question: 'Is Aura free to use?',
    answer: 'Yes! Standard architectural guidance and chat with Aura are free for all users, up to a generous daily interaction limit. Advanced operations, such as deploying smart contracts or specific builder tasks, may utilize Consciousness Coins.'
  },
  {
    category: 'Support',
    question: 'How do I report a bug or issue?',
    answer: 'You can reach out directly via our Contact page, or talk to Aura. Aura is capable of lodging support tickets directly to our staff. For urgent technical matters, you can also email our customer care team at Dillan.Copeland@Novauraverse.com.'
  }
];

export default function HelpCenterPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const categories = ['All', ...Array.from(new Set(faqs.map(f => f.category)))];

  const filteredFaqs = faqs.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          faq.answer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'All' || faq.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h1 className="font-heading text-4xl font-bold text-text-primary mb-4 tracking-tight">
                How can we <span className="text-neon-cyan">help you</span> build?
              </h1>
              <p className="text-text-secondary max-w-2xl mx-auto mb-8">
                Search our knowledge base for answers about royalties, asset licensing, 
                and the NovAura ecosystem.
              </p>
            </motion.div>

            <div className="relative max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search topics, keywords, or features..."
                className="pl-12 h-14 bg-void border-white/10 text-lg rounded-2xl focus:border-neon-cyan/50 shadow-2xl"
              />
            </div>
          </div>

          {/* Quick Support Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
            <SupportCard 
              icon={Book} 
              title="Documentation" 
              desc="Deep dive into our SDKs and APIs."
              href="/legal/agreement"
            />
            <SupportCard 
              icon={Zap} 
              title="Quick Start" 
              desc="Get your first asset live in minutes."
              href="/creator/dashboard"
            />
            <SupportCard 
              icon={Shield} 
              title="Trust & Safety" 
              desc="Learn about our review process."
              href="/legal/terms"
            />
          </div>

          {/* FAQ Categories */}
          <div className="flex gap-2 overflow-x-auto pb-4 mb-8 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-neon-cyan text-void shadow-[0_0_15px_rgba(0,255,249,0.4)]' : 'bg-white/5 text-text-muted hover:bg-white/10'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* FAQ Accordion */}
          <div className="space-y-3">
            {filteredFaqs.map((faq, idx) => (
              <div 
                key={idx}
                className="bg-void-light border border-white/5 rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <span className="font-medium text-text-primary">{faq.question}</span>
                  <ChevronDown className={`w-5 h-5 text-text-muted transition-transform duration-300 ${openIndex === idx ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {openIndex === idx && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <div className="px-6 pb-6 text-text-secondary text-sm leading-relaxed">
                        <div className="h-px bg-white/5 mb-6" />
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

          {/* Still Need Help */}
          <div className="mt-20 p-8 rounded-3xl bg-gradient-to-br from-neon-cyan/5 to-neon-violet/5 border border-white/5 text-center">
            <HelpCircle className="w-12 h-12 text-neon-cyan mx-auto mb-4" />
            <h3 className="text-xl font-bold text-text-primary mb-2">Still need architectural help?</h3>
            <p className="text-text-secondary mb-8 max-w-md mx-auto">
              Our support staff and Aura are available 24/7 to assist with your journey.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="/contact" 
                className="flex items-center justify-center gap-2 px-8 py-3 bg-neon-cyan text-void font-bold rounded-xl hover:scale-105 transition-transform"
              >
                <MessageCircle className="w-4 h-4" />
                Contact Staff
              </a>
              <button 
                onClick={() => {
                  const aura = document.querySelector('button[aria-label="Aura Guide"]') as HTMLButtonElement;
                  if (aura) aura.click();
                }}
                className="flex items-center justify-center gap-2 px-8 py-3 bg-white/5 text-white font-bold rounded-xl hover:bg-white/10 transition-colors border border-white/10"
              >
                Talk to Aura
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SupportCard({ icon: Icon, title, desc, href }: { icon: any, title: string, desc: string, href: string }) {
  return (
    <a 
      href={href}
      className="p-6 rounded-2xl bg-void-light border border-white/5 hover:border-neon-cyan/30 transition-all group"
    >
      <div className="w-12 h-12 bg-neon-cyan/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-neon-cyan/20 transition-colors">
        <Icon className="w-6 h-6 text-neon-cyan" />
      </div>
      <h3 className="font-bold text-text-primary mb-1 flex items-center gap-2">
        {title}
        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
      </h3>
      <p className="text-xs text-text-muted leading-relaxed">{desc}</p>
    </a>
  );
}
