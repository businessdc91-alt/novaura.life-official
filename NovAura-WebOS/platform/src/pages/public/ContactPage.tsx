import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Mail, Phone, MapPin, Send, AtSign, 
  CheckCircle2, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useUIStore } from '@/stores/uiStore';

export default function ContactPage() {
  const { addToast } = useUIStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsSubmitting(false);
    setIsSent(true);
    
    addToast({
      type: 'success',
      title: 'Message Sent',
      message: 'We\'ll get back to you as soon as possible.',
    });
  };

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="font-heading text-4xl font-bold text-text-primary mb-4">
              Contact Us
            </h1>
            <p className="text-text-secondary max-w-2xl mx-auto">
              Have questions about NovAura Market? Need help with a purchase or sale? 
              We're here to help.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-1 space-y-6"
            >
              <div className="bg-void-light border border-white/5 rounded-2xl p-6">
                <h2 className="font-heading text-xl font-bold text-text-primary mb-6">
                  Get in Touch
                </h2>
                
                <div className="space-y-6">
                  <ContactItem
                    icon={Mail}
                    title="Professional Email"
                    value="Dillan.Copeland@Novauraverse.com"
                    href="mailto:Dillan.Copeland@Novauraverse.com"
                  />
                  
                  <ContactItem
                    icon={Mail}
                    title="Personal Email"
                    value="the.lost.catalyst@gmail.com"
                    href="mailto:the.lost.catalyst@gmail.com"
                  />
                  
                  <ContactItem
                    icon={Phone}
                    title="Phone"
                    value="(701) 715-8674"
                    href="tel:+17017158674"
                  />
                  
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-neon-cyan/10 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-neon-cyan" />
                    </div>
                    <div>
                      <p className="font-medium text-text-primary">NovAura Market</p>
                      <p className="text-text-secondary text-sm">Digital Asset Exchange Platform</p>
                      <p className="text-text-muted text-sm mt-1">United States</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Links */}
              <div className="bg-void-light border border-white/5 rounded-2xl p-6">
                <h3 className="font-medium text-text-primary mb-4">Quick Links</h3>
                <div className="space-y-3">
                  <a href="/legal/privacy" className="flex items-center gap-2 text-text-secondary hover:text-neon-cyan transition-colors">
                    <CheckCircle2 className="w-4 h-4" />
                    Privacy Policy
                  </a>
                  <a href="/legal/licensing" className="flex items-center gap-2 text-text-secondary hover:text-neon-cyan transition-colors">
                    <CheckCircle2 className="w-4 h-4" />
                    Licensing Terms
                  </a>
                  <a href="/help" className="flex items-center gap-2 text-text-secondary hover:text-neon-cyan transition-colors">
                    <MessageSquare className="w-4 h-4" />
                    FAQ
                  </a>
                </div>
              </div>

              {/* Response Time */}
              <div className="bg-gradient-to-br from-neon-cyan/10 to-neon-violet/10 border border-neon-cyan/20 rounded-2xl p-6">
                <h3 className="font-medium text-text-primary mb-2">Response Time</h3>
                <p className="text-text-secondary text-sm">
                  We typically respond within 24-48 hours during business days. 
                  For urgent issues, please call directly.
                </p>
              </div>
            </motion.div>

            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-2 space-y-8"
            >
              {/* Aura Support Terminal */}
              <div className="bg-void-light border border-neon-cyan/20 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,255,249,0.05)]">
                <div className="bg-neon-cyan/5 px-6 py-4 border-b border-neon-cyan/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AtSign className="w-5 h-5 text-neon-cyan" />
                    <h3 className="font-heading text-lg font-bold text-white uppercase tracking-widest">Aura Support Terminal</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
                    <span className="text-[9px] text-neon-cyan font-black uppercase">Live Escalation Active</span>
                  </div>
                </div>
                <div className="p-8">
                  <p className="text-text-secondary text-sm mb-6 leading-relaxed">
                    Need instant architectural assistance or management escalation? Aura is trained to resolve most issues or directly connect you with the staff and customer care teams.
                  </p>
                  <Button 
                    onClick={() => {
                      const aura = document.querySelector('button[aria-label="Aura Guide"]') as HTMLButtonElement;
                      if (aura) aura.click();
                    }}
                    className="w-full h-14 bg-void border border-neon-cyan/50 text-neon-cyan font-black hover:bg-neon-cyan/10 transition-all uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(0,255,249,0.1)]"
                  >
                    Initialize AI Direct Link
                  </Button>
                </div>
              </div>

              <div className="bg-void-light border border-white/5 rounded-2xl p-8">
                {isSent ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 rounded-full bg-neon-lime/10 flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 className="w-10 h-10 text-neon-lime" />
                    </div>
                    <h2 className="font-heading text-2xl font-bold text-text-primary mb-2">
                      Message Sent!
                    </h2>
                    <p className="text-text-secondary mb-6">
                      Thank you for reaching out. We'll get back to you as soon as possible.
                    </p>
                    <Button
                      onClick={() => {
                        setIsSent(false);
                        setFormData({ name: '', email: '', subject: '', message: '' });
                      }}
                      variant="outline"
                      className="border-white/20"
                    >
                      Send Another Message
                    </Button>
                  </div>
                ) : (
                  <>
                    <h2 className="font-heading text-2xl font-bold text-text-primary mb-6">
                      Direct Staff Inquiry
                    </h2>
                    
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-[10px] text-text-muted uppercase tracking-widest mb-2 font-bold">
                            Your Name
                          </label>
                          <Input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="John Doe"
                            className="py-6 bg-void border-white/5 text-text-primary placeholder:text-text-muted/30 focus:border-neon-cyan/50 h-12"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-[10px] text-text-muted uppercase tracking-widest mb-2 font-bold">
                            Email Address
                          </label>
                          <Input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="you@example.com"
                            className="py-6 bg-void border-white/5 text-text-primary placeholder:text-text-muted/30 focus:border-neon-cyan/50 h-12"
                            required
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-[10px] text-text-muted uppercase tracking-widest mb-2 font-bold">
                          Subject / Topic
                        </label>
                        <Input
                          type="text"
                          value={formData.subject}
                          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                          placeholder="How can we help?"
                          className="py-6 bg-void border-white/5 text-text-primary placeholder:text-text-muted/30 focus:border-neon-cyan/50 h-12"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-[10px] text-text-muted uppercase tracking-widest mb-2 font-bold">
                          Detailed Message
                        </label>
                        <Textarea
                          value={formData.message}
                          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                          placeholder="Tell us more about your question or issue..."
                          rows={6}
                          className="bg-void border-white/5 text-text-primary placeholder:text-text-muted/30 focus:border-neon-cyan/50 resize-none p-4"
                          required
                        />
                      </div>
                      
                      <Button
                        type="submit"
                        className="w-full bg-neon-cyan text-void font-black py-7 text-xs shadow-[0_0_25px_rgba(0,255,249,0.2)] hover:scale-[1.01] transition-transform uppercase tracking-[0.2em]"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <div className="w-5 h-5 border-2 border-void/30 border-t-void rounded-full animate-spin" />
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-3" />
                            Dispatch Request
                          </>
                        )}
                      </Button>
                    </form>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactItem({ 
  icon: Icon, 
  title, 
  value, 
  href 
}: { 
  icon: typeof Mail; 
  title: string; 
  value: string; 
  href: string;
}) {
  return (
    <a 
      href={href}
      className="flex items-start gap-4 group"
    >
      <div className="w-10 h-10 rounded-lg bg-neon-cyan/10 flex items-center justify-center flex-shrink-0 group-hover:bg-neon-cyan/20 transition-colors">
        <Icon className="w-5 h-5 text-neon-cyan" />
      </div>
      <div>
        <p className="text-text-muted text-sm">{title}</p>
        <p className="text-text-primary group-hover:text-neon-cyan transition-colors">{value}</p>
      </div>
    </a>
  );
}
