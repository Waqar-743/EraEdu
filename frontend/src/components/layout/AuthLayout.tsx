import { Outlet, Navigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import Brand from '../shared/Brand';
import MotionControl from '../shared/MotionControl';
import { AssessmentJourney, CompactJourney } from '../landing/Illustrations';

const AuthLayout = () => {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <div className="era-auth min-h-[100dvh] bg-ink-50">
    <a href="#account-content" className="skip-link">Skip to account form</a>
    <header className="era-auth-header">
      <Brand to="/" />
      <Link to="/" className="era-back-link"><span aria-hidden="true">↖</span> Back to home</Link>
    </header>
    <main id="account-content" className="era-auth-grid" tabIndex={-1}>
      <section className="era-auth-story" aria-labelledby="account-story-title">
        <span className="eyebrow eyebrow-light">Learning, with integrity</span>
        <h1 id="account-story-title">A clearer path to <span className="era-gradient-text">what comes next.</span></h1>
        <p>Your courses, assessments, and feedback, together in one thoughtful workspace.</p>
        <div className="bezel mt-10"><div className="bezel-core overflow-hidden bg-[#f7faf8]"><AssessmentJourney /><CompactJourney /></div></div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-ink-500">Create. Schedule. Review. Grade.</span>
          <MotionControl />
        </div>
      </section>
      <section className="bezel era-auth-form" aria-label="Your account">
        <div className="bezel-core px-6 py-8 sm:px-10 sm:py-10"><Outlet /></div>
      </section>
    </main>
    <footer className="era-auth-footer"><span>© {new Date().getFullYear()} EraEdu</span><div className="flex gap-5"><Link to="/contact">Support</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></div></footer>
  </div>;
};

export default AuthLayout;
