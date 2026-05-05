import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#080810] text-slate-300">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors mb-10"
        >
          <ArrowLeft size={15} />
          Back
        </button>

        {/* Title block */}
        <div className="mb-10">
          <p className="text-xs font-semibold tracking-widest uppercase text-violet-400 mb-3">Legal</p>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-3">Terms of Service</h1>
          <p className="text-sm text-slate-500">Last Updated: May 2, 2026</p>
        </div>

        {/* Intro */}
        <p className="text-slate-400 leading-relaxed mb-10 text-sm">
          The following Terms of Service (the "Terms") form a binding agreement between you, in your individual
          capacity, or on behalf of the entity you represent ("User," "you," and "your"), and AxiomSplits
          ("AxiomSplits," "we," and "us"), and govern your use of the applications, software, services, and
          websites offered by AxiomSplits (the "Service").
        </p>

        <div className="space-y-10 text-sm">

          {/* A */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">
              A. Account Terms
            </h2>
            <div className="space-y-5">
              <div>
                <h3 className="font-semibold text-slate-200 mb-1">Acceptance of Terms</h3>
                <p className="text-slate-400 leading-relaxed">
                  By creating an account, joining a collaborative workspace, or otherwise using the Service,
                  you agree to be bound by these Terms.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 mb-1">Registration and Authority</h3>
                <p className="text-slate-400 leading-relaxed">
                  To use the Service, you must create an Account. You must provide accurate and up-to-date
                  information. If you create an account on behalf of an entity, you represent that you have
                  the authority to bind that entity to these Terms.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 mb-1">Requirements</h3>
                <p className="text-slate-400 leading-relaxed">
                  You must be 18 years or older (or the age of majority in your jurisdiction) to use
                  AxiomSplits. You may not share login credentials or use the Service in violation of U.S.
                  export control or sanctions laws.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 mb-1">Security</h3>
                <p className="text-slate-400 leading-relaxed">
                  You are responsible for all activity under your Account. You must notify us immediately of
                  any unauthorized access.
                </p>
              </div>
            </div>
          </section>

          {/* B */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">
              B. Collaborative Workspaces ("Splits")
            </h2>
            <div className="space-y-5">
              <div>
                <h3 className="font-semibold text-slate-200 mb-1">Shared Workspaces</h3>
                <p className="text-slate-400 leading-relaxed">
                  AxiomSplits allows you to create shared spaces ("Splits") to manage data, assets, or
                  distributions with other Users ("Members").
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 mb-1">Administration</h3>
                <p className="text-slate-400 leading-relaxed">
                  The creator of a Split is the "Admin." Admins have the authority to add/remove Members,
                  manage permissions, and control billing for that specific Split.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 mb-1">Access and Modification</h3>
                <p className="text-slate-400 leading-relaxed">
                  By adding Members to a Split, you authorize AxiomSplits to share all Content within that
                  workspace with those Members. You acknowledge that Members with edit permissions may
                  modify or copy the data contained therein.
                </p>
              </div>
            </div>
          </section>

          {/* C */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">
              C. Subscriptions and Payment
            </h2>
            <div className="space-y-5">
              <div>
                <h3 className="font-semibold text-slate-200 mb-1">Pricing</h3>
                <p className="text-slate-400 leading-relaxed">
                  AxiomSplits offers both free and paid subscription tiers. Fees are billed immediately upon
                  upgrading to a paid tier. Pricing details are available on our official Pricing Page.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 mb-1">Payment Processing</h3>
                <p className="text-slate-400 leading-relaxed">
                  We use third-party payment processors (e.g., Stripe) to handle billing. By subscribing,
                  you authorize us to charge your provided payment method for recurring fees.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 mb-1">Cancellations</h3>
                <p className="text-slate-400 leading-relaxed">
                  You may cancel your subscription at any time via your Account settings. Cancellations are
                  effective at the end of the current billing cycle; no refunds are provided for partial months.
                </p>
              </div>
            </div>
          </section>

          {/* D */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">
              D. User Content and Data
            </h2>
            <div className="space-y-5">
              <div>
                <h3 className="font-semibold text-slate-200 mb-1">Ownership</h3>
                <p className="text-slate-400 leading-relaxed">
                  You retain all ownership rights to the data, text, and information you upload or create
                  (the "User Content").
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 mb-1">License to AxiomSplits</h3>
                <p className="text-slate-400 leading-relaxed">
                  You grant us a worldwide, non-exclusive license to host, reproduce, and display your
                  Content solely as necessary to provide the Service (e.g., performing calculations,
                  displaying data to your Members, and creating backups).
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 mb-1">AI Features</h3>
                <p className="text-slate-400 leading-relaxed mb-3">
                  If you use AxiomSplits' AI-assisted tools:
                </p>
                <ul className="space-y-2 text-slate-400">
                  <li className="flex gap-2">
                    <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                    <span><span className="text-slate-300 font-medium">Inputs/Outputs:</span> You own the inputs and resulting outputs.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                    <span><span className="text-slate-300 font-medium">No Training:</span> We do not use your private data to train our underlying machine learning models.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                    <span><span className="text-slate-300 font-medium">Accuracy:</span> AI outputs are provided "as-is." You are responsible for verifying the accuracy of any AI-generated calculations or summaries before relying on them for financial decisions.</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* E */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">
              E. Acceptable Use
            </h2>
            <p className="text-slate-400 leading-relaxed">
              You agree not to use the Service for any unlawful activity, including fraud, money laundering,
              or the unauthorized distribution of proprietary financial data. You may not attempt to scrape
              or reverse-engineer the AxiomSplits platform.
            </p>
          </section>

          {/* F */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">
              F. Termination
            </h2>
            <ul className="space-y-3 text-slate-400">
              <li className="flex gap-2">
                <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                <span><span className="text-slate-300 font-medium">By You:</span> You may delete your account at any time.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                <span><span className="text-slate-300 font-medium">By Us:</span> We reserve the right to suspend or terminate your access for violations of these Terms or for any reason with 30 days' notice.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                <span><span className="text-slate-300 font-medium">Data Retention:</span> Upon termination, we typically delete User Content within 90 days, except for data that has been shared in collaborative Splits which must remain accessible to other active Members.</span>
              </li>
            </ul>
          </section>

          {/* G */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">
              G. Disclaimers and Limitation of Liability
            </h2>
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-slate-300 leading-relaxed text-xs tracking-wide font-mono">
                  AS-IS WARRANTY: THE SERVICE IS PROVIDED "AS IS." AXIOMSPLITS MAKES NO WARRANTIES
                  REGARDING THE ACCURACY OF CALCULATIONS OR THE PERPETUAL AVAILABILITY OF THE SERVICE.
                  USE OF THE SERVICE FOR FINANCIAL OR LEGAL LOGISTICS IS AT YOUR OWN RISK.
                </p>
              </div>
              <p className="text-slate-400 leading-relaxed">
                <span className="text-slate-300 font-medium">Limitation of Liability:</span> To the maximum
                extent permitted by law, AxiomSplits shall not be liable for any loss of profits, data, or
                indirect damages. Our total liability shall not exceed the greater of $100 or the amount you
                paid us in the past 12 months.
              </p>
            </div>
          </section>

          {/* H */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">
              H. Miscellaneous
            </h2>
            <div className="space-y-3 text-slate-400">
              <p>
                <span className="text-slate-300 font-medium">Governing Law:</span> These Terms are governed
                by the laws of the State of Delaware, without regard to conflict of law principles.
              </p>
              <p>
                <span className="text-slate-300 font-medium">Changes:</span> We may update these Terms from
                time to time. We will notify you of material changes via email or a prominent notice on the
                platform.
              </p>
              <p>
                <span className="text-slate-300 font-medium">Entire Agreement:</span> These Terms constitute
                the entire agreement between you and AxiomSplits.
              </p>
            </div>
          </section>

          {/* Privacy Statement */}
          <section className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] px-5 py-5">
            <h2 className="text-base font-semibold text-white mb-4">Privacy Statement (Brief)</h2>
            <ul className="space-y-2 text-slate-400">
              <li className="flex gap-2">
                <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                <span><span className="text-slate-300 font-medium">Data Collection:</span> We collect your email, billing info, and usage data.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                <span><span className="text-slate-300 font-medium">Data Sharing:</span> We do not sell your data. We share data only with necessary service providers (hosting, payment) or when required by law.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                <span><span className="text-slate-300 font-medium">Security:</span> We use industry-standard encryption to protect your sensitive "Split" data.</span>
              </li>
            </ul>
          </section>

        </div>

        {/* Footer note */}
        <div className="mt-12 pt-8 border-t border-white/[0.06] text-center">
          <p className="text-xs text-slate-600">
            Questions? Contact us at{' '}
            <a href="mailto:support@axiomsplits.com" className="text-violet-400 hover:text-violet-300 transition-colors">
              support@axiomsplits.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
