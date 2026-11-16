import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Palette, ShoppingBag, Zap, Check, Sparkles, BookOpen, Upload, Compass } from 'lucide-react';
import { NovAuraLogo } from '@/components/ui/NovAuraLogo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { kernelStorage } from '../@/kernel/kernelStorage.js';

// Types
type UserRole = 'creator' | 'buyer' | 'both' | null;

interface OnboardingState {
  currentStep: number;
  selectedRole: UserRole;
  selectedInterests: string[];
  isCompleted: boolean;
}

// Constants
const STORAGE_KEY = 'novaura_onboarding_state';

const INTERESTS = [
  'Game Dev',
  'Web Dev',
  '3D Art',
  '2D Art',
  'Music',
  'Sound Effects',
  'AI Tools',
  'VR/AR',
  'Mobile Apps',
  'Desktop Apps',
];

const ROLE_OPTIONS: Array<{
  id: UserRole;
  title: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'creator',
    title: "I'm a Creator",
    description: 'Upload & sell assets',
    icon: <Palette className="w-8 h-8" />,
  },
  {
    id: 'buyer',
    title: "I'm a Buyer",
    description: 'Find assets for my projects',
    icon: <ShoppingBag className="w-8 h-8" />,
  },
  {
    id: 'both',
    title: "I'm Both",
    description: 'Create and purchase',
    icon: <Zap className="w-8 h-8" />,
  },
];

// Animation variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
};

const slideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 100 : -100,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 100 : -100,
    opacity: 0,
    transition: { duration: 0.2 },
  }),
};

// Confetti Component
function ConfettiAnimation() {
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    color: string;
    delay: number;
    rotation: number;
  }>>([]);

  useEffect(() => {
    const colors = ['#00F0FF', '#8B5CF6', '#FF006E', '#39FF14'];
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 50 - 50,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.5,
      rotation: Math.random() * 360,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute w-2 h-2 rounded-full"
          style={{
            backgroundColor: particle.color,
            left: `${particle.x}%`,
            top: '-10px',
          }}
          initial={{ y: particle.y, opacity: 1, rotate: 0 }}
          animate={{
            y: '110vh',
            opacity: [1, 1, 0],
            rotate: particle.rotation,
          }}
          transition={{
            duration: 2 + Math.random() * 2,
            delay: particle.delay,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
}

// Step 1: Welcome
function WelcomeStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full text-center px-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div variants={itemVariants} className="mb-8">
        <NovAuraLogo size="xl" animated showText={false} />
      </motion.div>

      <motion.h1
        variants={itemVariants}
        className="text-4xl md:text-5xl font-black mb-4 rgb-text-flow"
        style={{ fontFamily: 'Orbitron, sans-serif' }}
      >
        Welcome to NovAura
      </motion.h1>

      <motion.p
        variants={itemVariants}
        className="text-xl text-text-secondary mb-12 max-w-md"
      >
        The creator ecosystem that puts you first
      </motion.p>

      <motion.div variants={itemVariants}>
        <Button
          onClick={onNext}
          className="btn-rgb-living px-12 py-6 text-lg rounded-xl"
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Let's get started
        </Button>
      </motion.div>

      <motion.button
        variants={itemVariants}
        onClick={onSkip}
        className="absolute bottom-8 right-8 text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        Skip onboarding →
      </motion.button>
    </motion.div>
  );
}

// Step 2: Role Selection
function RoleSelectionStep({
  selectedRole,
  onSelect,
  onNext,
  onBack,
}: {
  selectedRole: UserRole;
  onSelect: (role: UserRole) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      className="flex flex-col h-full px-6 py-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div variants={itemVariants} className="text-center mb-8">
        <h2
          className="text-3xl font-bold text-white mb-2"
          style={{ fontFamily: 'Orbitron, sans-serif' }}
        >
          What brings you here?
        </h2>
        <p className="text-text-secondary">Choose how you'll use NovAura</p>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
        {ROLE_OPTIONS.map((role) => (
          <Card
            key={role.id}
            onClick={() => onSelect(role.id)}
            className={cn(
              'relative cursor-pointer p-6 flex flex-col items-center justify-center gap-4 transition-all duration-300 hover:scale-[1.02]',
              'bg-void-light border-void-lighter',
              selectedRole === role.id
                ? 'rgb-border-flow bg-void-lighter'
                : 'hover:border-neon-cyan/30'
            )}
          >
            <div
              className={cn(
                'p-4 rounded-full transition-colors',
                selectedRole === role.id
                  ? 'bg-neon-cyan/20 text-neon-cyan'
                  : 'bg-void-lighter text-text-muted'
              )}
            >
              {role.icon}
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white mb-1">{role.title}</h3>
              <p className="text-sm text-text-secondary">{role.description}</p>
            </div>
            {selectedRole === role.id && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-3 right-3 w-6 h-6 bg-neon-cyan rounded-full flex items-center justify-center"
              >
                <Check className="w-4 h-4 text-black" />
              </motion.div>
            )}
          </Card>
        ))}
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="flex justify-between items-center mt-8 pt-6 border-t border-void-lighter"
      >
        <Button variant="ghost" onClick={onBack} className="text-text-secondary">
          ← Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!selectedRole}
          className={cn(
            'px-8 py-5 rounded-xl transition-all',
            selectedRole
              ? 'btn-rgb-living'
              : 'bg-void-lighter text-text-muted cursor-not-allowed'
          )}
        >
          Continue
        </Button>
      </motion.div>
    </motion.div>
  );
}

// Step 3: Interests
function InterestsStep({
  selectedInterests,
  onToggle,
  onNext,
  onBack,
}: {
  selectedInterests: string[];
  onToggle: (interest: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      className="flex flex-col h-full px-6 py-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div variants={itemVariants} className="text-center mb-8">
        <h2
          className="text-3xl font-bold text-white mb-2"
          style={{ fontFamily: 'Orbitron, sans-serif' }}
        >
          What are you interested in?
        </h2>
        <p className="text-text-secondary">Select all that apply</p>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="flex flex-wrap justify-center gap-3 flex-1 content-start max-w-2xl mx-auto"
      >
        {INTERESTS.map((interest) => {
          const isSelected = selectedInterests.includes(interest);
          return (
            <button
              key={interest}
              onClick={() => onToggle(interest)}
              className={cn(
                'px-5 py-3 rounded-full text-sm font-medium transition-all duration-200',
                'border hover:scale-105 active:scale-95',
                isSelected
                  ? 'bg-neon-cyan text-black border-neon-cyan shadow-lg shadow-neon-cyan/20'
                  : 'bg-void-light text-text-secondary border-void-lighter hover:border-neon-cyan/30'
              )}
            >
              {interest}
            </button>
          );
        })}
      </motion.div>

      <motion.div variants={itemVariants} className="text-center mt-6">
        <p className="text-xs text-text-muted">
          {selectedInterests.length > 0
            ? `${selectedInterests.length} interest${selectedInterests.length > 1 ? 's' : ''} selected`
            : 'Select at least one interest to continue'}
        </p>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="flex justify-between items-center mt-8 pt-6 border-t border-void-lighter"
      >
        <Button variant="ghost" onClick={onBack} className="text-text-secondary">
          ← Back
        </Button>
        <Button
          onClick={onNext}
          disabled={selectedInterests.length === 0}
          className={cn(
            'px-8 py-5 rounded-xl transition-all',
            selectedInterests.length > 0
              ? 'btn-rgb-living'
              : 'bg-void-lighter text-text-muted cursor-not-allowed'
          )}
        >
          Continue
        </Button>
      </motion.div>
    </motion.div>
  );
}

// Step 4: Complete
function CompleteStep({
  selectedRole,
  onFinish,
}: {
  selectedRole: UserRole;
  onFinish: () => void;
}) {
  const getPersonalizedMessage = () => {
    switch (selectedRole) {
      case 'creator':
        return 'Start sharing your creations with the world!';
      case 'buyer':
        return 'Discover amazing assets for your next project!';
      case 'both':
        return 'Create, buy, and sell—all in one place!';
      default:
        return 'Start exploring the NovAura ecosystem!';
    }
  };

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full text-center px-6 relative"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <ConfettiAnimation />

      <motion.div
        variants={itemVariants}
        className="w-24 h-24 rounded-full bg-neon-cyan/20 flex items-center justify-center mb-8 relative"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
          className="w-16 h-16 rounded-full bg-neon-cyan flex items-center justify-center"
        >
          <Check className="w-8 h-8 text-black" />
        </motion.div>
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-neon-cyan"
          initial={{ scale: 1, opacity: 1 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      </motion.div>

      <motion.h2
        variants={itemVariants}
        className="text-4xl font-black text-white mb-4"
        style={{ fontFamily: 'Orbitron, sans-serif' }}
      >
        You're all set!
      </motion.h2>

      <motion.p variants={itemVariants} className="text-xl text-text-secondary mb-10">
        {getPersonalizedMessage()}
      </motion.p>

      <motion.div variants={itemVariants} className="mb-10">
        <Button onClick={onFinish} className="btn-rgb-living px-12 py-6 text-lg rounded-xl">
          <Sparkles className="w-5 h-5 mr-2" />
          Start Exploring
        </Button>
      </motion.div>

      <motion.div variants={itemVariants} className="flex flex-wrap justify-center gap-4">
        <QuickLink icon={<Compass className="w-4 h-4" />} label="Browse Marketplace" href="/browse" />
        <QuickLink icon={<Upload className="w-4 h-4" />} label="Upload Asset" href="/creator/assets/new" />
        <QuickLink icon={<BookOpen className="w-4 h-4" />} label="View Docs" href="/help" />
      </motion.div>
    </motion.div>
  );
}

// Quick Link Component
function QuickLink({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <Link
      to={href}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-void-light border border-void-lighter text-text-secondary hover:text-neon-cyan hover:border-neon-cyan/30 transition-all text-sm"
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

// Main Onboarding Flow Component
export function OnboardingFlow() {
  const [state, setState] = useState<OnboardingState>({
    currentStep: 1,
    selectedRole: null,
    selectedInterests: [],
    isCompleted: false,
  });
  const [direction, setDirection] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const saved = kernelStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setState((prev) => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.error('Failed to load onboarding state:', error);
    }
    setIsLoading(false);
  }, []);

  // Save state to localStorage when it changes
  useEffect(() => {
    if (!isLoading) {
      try {
        kernelStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        console.error('Failed to save onboarding state:', error);
      }
    }
  }, [state, isLoading]);

  const updateState = useCallback((updates: Partial<OnboardingState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleNext = useCallback(() => {
    setDirection(1);
    setState((prev) => ({ ...prev, currentStep: Math.min(prev.currentStep + 1, 4) }));
  }, []);

  const handleBack = useCallback(() => {
    setDirection(-1);
    setState((prev) => ({ ...prev, currentStep: Math.max(prev.currentStep - 1, 1) }));
  }, []);

  const handleSkip = useCallback(() => {
    updateState({ isCompleted: true });
  }, [updateState]);

  const handleFinish = useCallback(() => {
    updateState({ isCompleted: true });
  }, [updateState]);

  const handleRoleSelect = useCallback(
    (role: UserRole) => {
      updateState({ selectedRole: role });
    },
    [updateState]
  );

  const handleInterestToggle = useCallback(
    (interest: string) => {
      setState((prev) => {
        const newInterests = prev.selectedInterests.includes(interest)
          ? prev.selectedInterests.filter((i) => i !== interest)
          : [...prev.selectedInterests, interest];
        return { ...prev, selectedInterests: newInterests };
      });
    },
    []
  );

  // Reset onboarding (for testing/debugging)
  const resetOnboarding = useCallback(() => {
    kernelStorage.removeItem(STORAGE_KEY);
    setState({
      currentStep: 1,
      selectedRole: null,
      selectedInterests: [],
      isCompleted: false,
    });
    setDirection(1);
  }, []);

  // If onboarding is completed, don't render
  if (state.isCompleted) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={resetOnboarding}
          className="text-xs text-text-muted hover:text-neon-cyan transition-colors px-3 py-1 rounded-full bg-void-light border border-void-lighter"
        >
          Reset Onboarding
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-neon-cyan/20 border-t-neon-cyan animate-spin" />
      </div>
    );
  }

  const progressValue = (state.currentStep / 4) * 100;

  return (
    <div className="min-h-screen bg-void flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl min-h-[600px] bg-void-light border-void-lighter overflow-hidden relative">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 z-10">
          <div className="h-1 bg-void-lighter">
            <motion.div
              className="h-full bg-gradient-to-r from-neon-cyan via-neon-violet to-neon-magenta"
              initial={{ width: 0 }}
              animate={{ width: `${progressValue}%` }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            />
          </div>
        </div>

        {/* Step Indicators */}
        <div className="absolute top-6 left-0 right-0 flex justify-center gap-2 z-10">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={cn(
                'w-2 h-2 rounded-full transition-all duration-300',
                step === state.currentStep
                  ? 'bg-neon-cyan w-6'
                  : step < state.currentStep
                    ? 'bg-neon-cyan/60'
                    : 'bg-void-lighter'
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div className="h-full pt-16 pb-6">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={state.currentStep}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="h-full"
            >
              {state.currentStep === 1 && (
                <WelcomeStep onNext={handleNext} onSkip={handleSkip} />
              )}
              {state.currentStep === 2 && (
                <RoleSelectionStep
                  selectedRole={state.selectedRole}
                  onSelect={handleRoleSelect}
                  onNext={handleNext}
                  onBack={handleBack}
                />
              )}
              {state.currentStep === 3 && (
                <InterestsStep
                  selectedInterests={state.selectedInterests}
                  onToggle={handleInterestToggle}
                  onNext={handleNext}
                  onBack={handleBack}
                />
              )}
              {state.currentStep === 4 && (
                <CompleteStep selectedRole={state.selectedRole} onFinish={handleFinish} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </Card>
    </div>
  );
}

export default OnboardingFlow;
