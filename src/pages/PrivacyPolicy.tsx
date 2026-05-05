import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
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
          <h1 className="text-4xl font-bold tracking-tight text-white mb-3">Privacy Policy</h1>
          <p className="text-sm text-slate-500">Last Updated: May 4, 2026</p>
        </div>

        <div className="space-y-10 text-sm">

          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">
              1. Overview
            </h2>
            <p className="text-slate-400 leading-relaxed mb-3">
              This Privacy Policy explains how information is collected, used, and disclosed by AxiomSplits
              ("we," "us," or "our") and applies to information collected when you use our website, mobile
              applications, or financial collaboration tools (collectively, the "Service"). We are committed
              to protecting the privacy of our users while providing a transparent platform for financial
              collaboration.
            </p>
            <p className="text-slate-400 leading-relaxed">
              By accessing or using our Service, you signify your acceptance of this Privacy Policy.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">
              2. Information Collected
            </h2>
            <p className="text-slate-400 leading-relaxed mb-5">
              We collect information in the following ways:
            </p>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-slate-200 mb-3">A. Information You Provide Directly</h3>
                <ul className="space-y-2 text-slate-400">
                  <li className="flex gap-2">
                    <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                    <span><span className="text-slate-300 font-medium">Account Information:</span> Name, email address, and profile preferences.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                    <span><span className="text-slate-300 font-medium">Split & Financial Data:</span> Expense details, group titles, and individual share amounts entered for the purpose of debt calculation and tracking.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                    <span><span className="text-slate-300 font-medium">Transaction Information:</span> Billing details for paid tiers. Note that all payment processing is handled securely by Stripe; AxiomSplits does not store full credit card numbers or CVV codes on our servers.</span>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 mb-3">B. Information Collected Automatically</h3>
                <ul className="space-y-2 text-slate-400">
                  <li className="flex gap-2">
                    <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                    <span><span className="text-slate-300 font-medium">Usage Data:</span> System activity, browser type, and features used.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                    <span><span className="text-slate-300 font-medium">Technical Identifiers:</span> IP addresses and device identifiers collected via Supabase to manage authentication and security.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                    <span><span className="text-slate-300 font-medium">Cookies:</span> We use essential cookies to maintain your session and remember your preferences.</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">
              3. Use of Information
            </h2>
            <p className="text-slate-400 leading-relaxed mb-4">
              We use the information collected for the following purposes:
            </p>
            <ul className="space-y-2 text-slate-400">
              <li className="flex gap-2">
                <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                <span><span className="text-slate-300 font-medium">Core Functionality:</span> Operating "Splits," maintaining dashboards, and calculating balances.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                <span><span className="text-slate-300 font-medium">Communication:</span> Sending technical alerts, security updates, and responding to support requests via{' '}
                  <a href="mailto:support@axiomsplits.com" className="text-violet-400 hover:text-violet-300 transition-colors">support@axiomsplits.com</a>.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                <span><span className="text-slate-300 font-medium">Security:</span> Monitoring for unauthorized access or fraudulent financial activity.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                <span><span className="text-slate-300 font-medium">AI Insights:</span> We may use AI features to categorize data. We maintain a zero-retention policy with third-party LLMs; your private financial data is not used to train external models.</span>
              </li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">
              4. Sharing and Disclosure
            </h2>
            <p className="text-slate-400 leading-relaxed mb-4">
              We do not sell your personal data. Sharing is limited to:
            </p>
            <ul className="space-y-2 text-slate-400">
              <li className="flex gap-2">
                <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                <span><span className="text-slate-300 font-medium">Collaborators:</span> Your name and expense data are visible to other members of the specific "Splits" you join.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                <span><span className="text-slate-300 font-medium">Service Providers:</span> We share data with Supabase (Database/Auth) and Stripe (Payments) only as necessary to provide the Service.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                <span><span className="text-slate-300 font-medium">Legal Requirements:</span> We may disclose data if required by law or to protect the safety of our users.</span>
              </li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">
              5. Policy Toward Minors (13–17)
            </h2>
            <p className="text-slate-400 leading-relaxed mb-4">
              AxiomSplits is a general-audience service. We recognize the importance of protecting the
              privacy of younger users.
            </p>
            <ul className="space-y-2 text-slate-400">
              <li className="flex gap-2">
                <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                <span><span className="text-slate-300 font-medium">Minimum Age:</span> You must be at least 13 years old to create an account.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                <span><span className="text-slate-300 font-medium">Data Minimization:</span> For users under 18, we collect only the minimum data required to provide the Service and do not engage in behavioral profiling or targeted advertising.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                <span><span className="text-slate-300 font-medium">Children Under 13:</span> We do not knowingly collect data from children under 13. If we discover a user is under 13, we will delete their account and associated data immediately in compliance with COPPA.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                <span><span className="text-slate-300 font-medium">Parental Rights:</span> Parents of users aged 13–17 may request to review or delete their child's information by contacting{' '}
                  <a href="mailto:support@axiomsplits.com" className="text-violet-400 hover:text-violet-300 transition-colors">support@axiomsplits.com</a>.
                </span>
              </li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">
              6. Your Rights and Data Retention
            </h2>
            <ul className="space-y-2 text-slate-400">
              <li className="flex gap-2">
                <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                <span><span className="text-slate-300 font-medium">Access & Correction:</span> You may update your profile or group data at any time via the application settings.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                <span><span className="text-slate-300 font-medium">Data Retention:</span> We retain your data as long as your account is active.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                <span><span className="text-slate-300 font-medium">Deletion:</span> Upon account deactivation, we delete personal identifiers within 90 days. Please note that historical transaction data within a "Split" may remain visible to other group members to maintain the integrity of their financial records.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-400 shrink-0 mt-0.5">—</span>
                <span><span className="text-slate-300 font-medium">California & Georgia Residents:</span> You have the right to request a report of the categories of personal information we have collected about you and to request the deletion of that data.</span>
              </li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">
              7. Security
            </h2>
            <p className="text-slate-400 leading-relaxed">
              We utilize industry-standard encryption (AES-256) and secure Row Level Security (RLS) via
              Supabase to ensure that your financial data is only accessible to authorized members of your
              Splits.
            </p>
          </section>

          {/* 8 */}
          <section className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] px-5 py-5">
            <h2 className="text-base font-semibold text-white mb-3">8. Contact Us</h2>
            <p className="text-slate-400 leading-relaxed">
              For questions regarding this policy or to exercise your data rights, please contact:{' '}
              <a
                href="mailto:support@axiomsplits.com"
                className="text-violet-400 hover:text-violet-300 transition-colors font-medium"
              >
                support@axiomsplits.com
              </a>
            </p>
          </section>

        </div>

        {/* Footer note */}
        <div className="mt-12 pt-8 border-t border-white/[0.06] text-center">
          <p className="text-xs text-slate-600">
            Also see our{' '}
            <a href="/terms" className="text-violet-400 hover:text-violet-300 transition-colors">
              Terms of Service
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
