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

export default function TutorialPopup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const currentSlide = SLIDES[step];
  const isFirstStep = step === 0;
  const isLastStep = step === SLIDES.length - 1;
  const stepLabel = `Step ${step + 1} of ${SLIDES.length}`;

  const finishTutorial = () => {
    localStorage.setItem('platformTutorialSeen', 'true');
    navigate('/register');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-2 backdrop-blur-sm sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.32, ease: 'easeOut' }}
        className="relative h-[calc(100vh-16px)] w-[calc(100vw-16px)] overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:h-[calc(100vh-32px)] sm:w-[calc(100vw-32px)] sm:p-8 lg:p-10"
      >
        <div className="pointer-events-none absolute -left-24 -top-20 h-56 w-56 rounded-full bg-slate-200 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -right-20 h-64 w-64 rounded-full bg-emerald-100 blur-3xl" />

        <button
          type="button"
          onClick={finishTutorial}
          className="absolute right-5 top-5 text-xs font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:text-slate-700 sm:right-8 sm:top-8"
        >
          Skip Tutorial
        </button>

        <div className="relative flex h-full flex-col justify-between">
          <div className="flex-1">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                initial={{ opacity: 0, y: 26, x: direction * 26 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, y: -14, x: direction * -20 }}
                transition={{ duration: 0.34, ease: 'easeOut' }}
                className="mx-auto flex h-full max-w-4xl flex-col items-center justify-center text-center"
              >
                <div className="mb-6 text-7xl leading-none sm:text-8xl">{currentSlide.icon}</div>

                <h2 className="mb-5 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                  {currentSlide.title}
                </h2>

                <p className="max-w-3xl text-base leading-8 text-slate-700 sm:text-lg">
                  {currentSlide.description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="pt-5 sm:pt-7">
            <div className="mb-5 flex items-center justify-center text-sm font-semibold text-slate-500">
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
                    className={`rounded-full ${isActive ? 'bg-emerald-600' : 'bg-slate-300'}`}
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
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
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
                className="justify-self-end rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-emerald-700"
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
