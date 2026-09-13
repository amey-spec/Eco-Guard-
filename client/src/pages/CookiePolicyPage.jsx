import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Reveal from '../components/Reveal';
import { ArrowRight } from 'lucide-react';

export default function CookiePolicyPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Cookie policy"
        title="What EcoGuard stores in your browser"
        subtitle="EcoGuard does not use analytics, advertising, or tracking cookies. This page explains the browser storage the application actually uses."
      />

      <div className="mx-auto w-full max-w-4xl px-4 pb-24 sm:px-6 lg:px-8">
        <Reveal>
          <div className="space-y-10">
            {/* Introduction */}
            <section>
              <h2 className="text-2xl">About this policy</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                A cookie policy should describe the technologies a site actually uses. For EcoGuard,
                that means local storage used for authentication and appearance preferences — and
                nothing more.
              </p>
              <p className="mt-4 leading-relaxed text-mist-700">
                EcoGuard does not use non-essential cookies. It does not run analytics scripts, tracking
                pixels, advertising tags, social media embeds, or third-party widgets. Because of that,
                this policy describes the storage the application genuinely relies on rather than
                listing categories that do not exist here.
              </p>
            </section>

            {/* What the app does not use */}
            <section>
              <h2 className="text-2xl">What EcoGuard does not use</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                To be clear, EcoGuard currently does not use:
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-mist-700">
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-400" />
                  <span className="flex-1">Analytics cookies or scripts.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-400" />
                  <span className="flex-1">Advertising cookies or networks.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-400" />
                  <span className="flex-1">Social media or tracking embeds.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-400" />
                  <span className="flex-1">Third-party widgets that would set their own storage.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-400" />
                  <span className="flex-1">Session storage for application data.</span>
                </li>
              </ul>
            </section>

            {/* What the app actually stores */}
            <section>
              <h2 className="text-2xl">What EcoGuard actually stores</h2>

              <h3 className="mt-8 text-xl font-semibold text-charcoal-900">
                Local storage: session token
              </h3>
              <p className="mt-4 leading-relaxed text-mist-700">
                When you sign in, EcoGuard stores a session token in your browser's local storage under
                the key <code className="rounded bg-cream-100 px-1.5 py-0.5 text-sm font-mono text-charcoal-800">ecoguard_token</code>.
              </p>
              <p className="mt-4 leading-relaxed text-mist-700">
                This token lets the application keep you signed in while you use the site. It is
                essential for the authenticated features of the application, such as accessing your
                profile, submitting reports as a signed-in user, and receiving notifications. It is not
                used for marketing, profiling, or tracking across other sites.
              </p>
              <p className="mt-4 leading-relaxed text-mist-700">
                When you sign out, this token is removed. If you clear local storage through your browser
                settings, the application will sign you out because it can no longer find the token.
              </p>

              <h3 className="mt-8 text-xl font-semibold text-charcoal-900">
                Local storage: appearance preference
              </h3>
              <p className="mt-4 leading-relaxed text-mist-700">
                EcoGuard stores your appearance preference in local storage under the key{" "}
                <code className="rounded bg-cream-100 px-1.5 py-0.5 text-sm font-mono text-charcoal-800">ecoguard_theme</code>.
              </p>
              <p className="mt-4 leading-relaxed text-mist-700">
                This remembers whether you chose light mode, dark mode, or "follow system," so the
                application can restore your choice when you return. For signed-in users, this preference
                can also be stored on the account so it follows you across devices.
              </p>
              <p className="mt-4 leading-relaxed text-mist-700">
                This storage is used for display preferences only. It does not collect or transmit
                personal information about your browsing activity.
              </p>
            </section>

            {/* If you are not signed in */}
            <section>
              <h2 className="text-2xl">What is stored if you are not signed in</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                If you use EcoGuard without signing in, the application still stores the appearance
                preference in local storage, because that choice is independent of your account.
              </p>
              <p className="mt-4 leading-relaxed text-mist-700">
                You may also submit hazard reports without signing in. In that case, the report itself is
                stored on the server, but no additional personal browser storage is created beyond the
                appearance preference.
              </p>
            </section>

            {/* Consent */}
            <section>
              <h2 className="text-2xl">Consent</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                Because EcoGuard does not use non-essential cookies or tracking, there is no cookie banner
                asking you to accept or reject analytics or advertising storage.
              </p>
              <p className="mt-4 leading-relaxed text-mist-700">
                The storage that does exist is tied directly to core application features:
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-mist-700">
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span className="flex-1">The session token exists because you chose to sign in.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span className="flex-1">The appearance preference exists because you or your account chose a theme.</span>
                </li>
              </ul>
              <p className="mt-4 leading-relaxed text-mist-700">
                You are not asked to consent to these as optional extras, because they support the basic
                operation of the features you are using. You can still control them through your browser:
                sign out to remove the session token, or clear local storage to remove stored preferences.
              </p>
            </section>

            {/* Your controls */}
            <section>
              <h2 className="text-2xl">Your controls</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                You can manage local storage through your browser:
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-mist-700">
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span className="flex-1">Sign out from EcoGuard to remove the session token.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span className="flex-1">Use your browser's settings to view or clear local storage for the site.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span className="flex-1">Use private browsing or similar modes if you do not want storage to persist after you close the window.</span>
                </li>
              </ul>
              <p className="mt-4 leading-relaxed text-mist-700">
                Note that clearing the stored token will sign you out and clearing the theme preference
                will reset your appearance choice until you choose again.
              </p>
            </section>

            {/* Third-party resources */}
            <section>
              <h2 className="text-2xl">Third-party resources</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                EcoGuard loads fonts from Google Fonts using a stylesheet link, similar to many websites
                that use external typefaces. This is a visual resource, not a tracking or analytics
                script. EcoGuard does not embed third-party iframes, widgets, or tracking scripts.
              </p>
              <p className="mt-4 leading-relaxed text-mist-700">
                This policy describes the application as it is implemented. If the application later adds
                any new external services or storage, this page should be updated to match.
              </p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-2xl">Questions</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                If you have a question about what EcoGuard stores or how to remove it, email the
                application maintainer at{" "}
                <a
                  href="mailto:support@ecoguard.example"
                  className="font-semibold text-forest-700 link-under"
                >
                  support@ecoguard.example
                </a>
                .
              </p>
            </section>

            {/* Related pages */}
            <section className="rounded-2xl border border-cream-200 bg-cream-50/60 p-6">
              <h2 className="text-xl">Related pages</h2>
              <ul className="mt-4 space-y-3">
                <li>
                  <Link
                    to="/privacy"
                    className="inline-flex items-center gap-1.5 text-forest-700 font-medium transition-colors hover:text-forest-900"
                  >
                    Privacy Policy
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </li>
                <li>
                  <Link
                    to="/terms"
                    className="inline-flex items-center gap-1.5 text-forest-700 font-medium transition-colors hover:text-forest-900"
                  >
                    Terms and Conditions
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </li>
              </ul>
            </section>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
