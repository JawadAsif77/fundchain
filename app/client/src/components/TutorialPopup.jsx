import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

const SLIDES = [
  {
    icon: '🚀',
    title: 'Welcome to the Platform',
    description:
      'A secure, blockchain-powered business investment platform built on Solana. Connect with real entrepreneurs and invest using platform tokens — transparently and safely.',
  },
  {
    icon: '👻',
    title: 'Step 1: Connect Your Phantom Wallet',
    description:
      "This platform uses Phantom Wallet for authentication. Click 'Connect Wallet' in the navbar, approve the connection in your Phantom extension, and you're logged in — no password needed.",
  },
  {
    icon: '🪪',
    title: 'Step 2: Complete KYC Verification',
    description:
      'To invest or launch a campaign, you must verify your identity. Basic KYC requires your email, phone, and ID. Advanced KYC requires business documents for campaign creators.',
  },
  {
    icon: '🪙',
    title: 'Step 3: Get Platform SPL Tokens',
    description:
      "All investments are made using the platform's native SPL token on Solana. You can acquire tokens through the platform's token purchase flow. No NFTs are involved.",
  },
  {
    icon: '🔍',
    title: 'Step 4: Browse & Evaluate Campaigns',
    description:
      "Explore verified business campaigns. Each campaign shows its funding goal, milestones, creator KYC badge, AI risk score, and roadmap. Use the 'Is This Safe?' panel before investing.",
  },
  {
    icon: '💰',
    title: 'Step 5: Invest Using Tokens',
    description:
      'Found a campaign you believe in? Choose your investment amount within the allowed limits and confirm the transaction via your Phantom Wallet. Your tokens are locked in a secure smart contract escrow.',
  },
  {
    icon: '📊',
    title: 'Step 6: Track Milestones & Escrow',
    description:
      'Your funds are NOT released all at once. Creators must complete milestones and submit proof. You can track progress in real time from your investor dashboard.',
  },
  {
    icon: '🗳️',
    title: 'Step 7: Vote on Milestone Release or Refund',
    description:
      'When a creator submits milestone proof, investors vote to approve fund release or request a refund. Your tokens give you governance power over your investment.',
  },
  {
    icon: '✅',
    title: "You're Ready!",
    description:
      'You now know everything you need to get started. Click Get Started below to create your account, complete KYC, and begin exploring campaigns.',
  },
];

export default function TutorialPopup({ onClose }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const primaryButtonClass =
    'bg-[#29C7AC] text-white shadow-md transition-all hover:bg-[#22A897] hover:shadow-lg';

  const currentSlide = SLIDES[step];
  const isFirstStep = step === 0;
  const isLastStep = step === SLIDES.length - 1;
  const stepLabel = `Step ${step + 1} of ${SLIDES.length}`;

  const finishTutorial = () => {
    localStorage.setItem('platformTutorialSeen', 'true');
    navigate('/register');
  };

  const skipTutorial = () => {
    localStorage.setItem('platformTutorialSeen', 'true');
    sessionStorage.setItem('tutorialShownThisRun', 'true');
    if (typeof onClose === 'function') {
      onClose();
      return;
    }
    window.location.href = '/';
  };

  const goNext = () => {
    if (isLastStep) {
      finishTutorial();
      return;
    }
    setDirection(1);
    setStep((prev) => Math.min(prev + 1, SLIDES.length - 1));
  };

  const goBack = () => {
    if (isFirstStep) return;
    setDirection(-1);
    setStep((prev) => Math.max(prev - 1, 0));
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();

        if (step === SLIDES.length - 1) {
          localStorage.setItem('platformTutorialSeen', 'true');
          navigate('/register');
          return;
        }

        setDirection(1);
        setStep((prev) => Math.min(prev + 1, SLIDES.length - 1));
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();

        if (step === 0) return;
        setDirection(-1);
        setStep((prev) => Math.max(prev - 1, 0));
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [navigate, step]);

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-slate-950/80 p-2 backdrop-blur-sm sm:p-4"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        background: 'rgba(15, 23, 42, 0.78)',
        backdropFilter: 'blur(3px)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.32, ease: 'easeOut' }}
        className="relative w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-3xl border border-slate-300 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.28)] sm:p-8 lg:p-10"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '980px',
          maxHeight: '92vh',
          overflow: 'hidden',
          borderRadius: '24px',
          border: '1px solid #cbd5e1',
          backgroundColor: '#ffffff',
          boxShadow: '0 30px 80px rgba(15,23,42,0.28)',
          padding: '20px',
        }}
      >
        <div className="pointer-events-none absolute -left-24 -top-20 h-56 w-56 rounded-full bg-slate-300/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -right-20 h-64 w-64 rounded-full bg-emerald-200/70 blur-3xl" />

        <button
          type="button"
          onClick={skipTutorial}
          aria-label="Skip tutorial and go to home page"
          className="absolute right-5 top-5 z-50 cursor-pointer rounded-md border border-slate-300 bg-white/95 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-900 sm:right-8 sm:top-8"
        >
          Skip Tutorial
        </button>

        <div className="relative flex max-h-[78vh] flex-col justify-between">
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                initial={{ opacity: 0, y: 26, x: direction * 26 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, y: -14, x: direction * -20 }}
                transition={{ duration: 0.34, ease: 'easeOut' }}
                className="mx-auto flex min-h-[320px] max-w-3xl flex-col items-center justify-center text-center"
              >
                <div className="mb-6 text-7xl leading-none sm:text-8xl">{currentSlide.icon}</div>

                <h2 className="mb-5 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                  {currentSlide.title}
                </h2>

                <p className="max-w-3xl text-base leading-8 text-slate-800 sm:text-lg">
                  {currentSlide.description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="pt-5 sm:pt-7">
            <div className="mb-5 flex items-center justify-center text-sm font-semibold text-slate-600">
              {stepLabel}
            </div>

            <div className="mb-7 flex items-center justify-center gap-2.5">
              {SLIDES.map((_, index) => {
                const isActive = index === step;
                return (
                  <motion.span
                    key={index}
                    animate={{
                      width: isActive ? 26 : 8,
                      height: isActive ? 10 : 8,
                      opacity: isActive ? 1 : 0.45,
                    }}
                    transition={{ duration: 0.22 }}
                    className={`rounded-full ${isActive ? 'bg-emerald-600' : 'bg-slate-400'}`}
                  />
                );
              })}
            </div>

            <div className="grid grid-cols-3 items-center gap-3">
              <motion.button
                type="button"
                whileHover={!isFirstStep ? { y: -1.5 } : {}}
                whileTap={!isFirstStep ? { scale: 0.98 } : {}}
                onClick={goBack}
                disabled={isFirstStep}
                className={`justify-self-start rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
                  isFirstStep
                    ? 'cursor-not-allowed text-slate-300'
                    : `${primaryButtonClass}`
                }`}
              >
                Back
              </motion.button>

              <div className="justify-self-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                Onboarding
              </div>

              <motion.button
                type="button"
                whileHover={{ y: -1.5, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={goNext}
                className={`justify-self-end rounded-xl px-6 py-2.5 text-sm font-bold ${primaryButtonClass}`}
              >
                {isLastStep ? 'Get Started' : 'Next'}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
