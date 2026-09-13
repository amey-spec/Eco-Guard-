import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Reveal from '../components/Reveal';
import { ArrowRight } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Privacy policy"
        title="How EcoGuard handles your information"
        subtitle="A plain-language look at what this application collects, why, and what we do with it. This describes the current implementation only — not legal frameworks or third-party services."
      />

      <div className="mx-auto w-full max-w-4xl px-4 pb-24 sm:px-6 lg:px-8">
        <Reveal>
          <div className="space-y-10">
            {/* Introduction */}
            <section>
              <h2 className="text-2xl">About this policy</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                EcoGuard is an environmental hazard awareness application. This page describes
                what information the application collects and stores while it is actually running —
                during sign-up, when you submit a hazard report, and while you use the site.
              </p>
              <p className="mt-4 leading-relaxed text-mist-700">
                This is not a legal promise of compliance with any specific law or regulation. It is
                a straightforward description of the application's current behavior so you can make
                an informed choice about using it.
              </p>
            </section>

            {/* Information we collect */}
            <section>
              <h2 className="text-2xl">Information we collect</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                The application collects only the information needed for the features it offers.
                Some fields are required for a feature to work; others are optional.
              </p>

              <h3 className="mt-8 text-xl font-semibold text-charcoal-900">
                Account registration — required
              </h3>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-mist-700">
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span><strong>Name</strong> — a display name shown on your account and, for reports you submit while signed in, attached as the reporter name on the public field record.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span><strong>Email address</strong> — used to sign in, to identify your account, and to associate reports, notifications, and profile edits with you.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span><strong>Password</strong> — stored as a hashed value (the application never stores your password in plain text). Used only to verify your identity when you sign in.</span>
                </li>
              </ul>

              <h3 className="mt-8 text-xl font-semibold text-charcoal-900">
                Account registration — not collected
              </h3>
              <p className="mt-4 leading-relaxed text-mist-700">
                The registration form does not ask for your physical address, phone number, date of
                birth, government ID, or any other personal details beyond name, email, and password.
              </p>

              <h3 className="mt-8 text-xl font-semibold text-charcoal-900">
                Profile information — optional
              </h3>
              <p className="mt-4 leading-relaxed text-mist-700">
                After sign-up, you may edit your display name from the profile page. You may also
                choose an appearance preference — light, dark, or follow system — which the
                application stores on your account so it follows you across devices.
              </p>

              <h3 className="mt-8 text-xl font-semibold text-charcoal-900">
                Hazard reports — required fields
              </h3>
              <p className="mt-4 leading-relaxed text-mist-700">
                When you submit a hazard report, the application collects:
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-mist-700">
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span><strong>Report title</strong> — a short public summary of what you observed.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span><strong>Hazard type</strong> — the category of hazard (for example, water pollution or deforestation).</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span><strong>Severity</strong> — your assessment of how serious the hazard appears (Low, Moderate, High, or Critical).</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span><strong>Location description</strong> — a text description of where you saw the hazard (for example, a street, landmark, or area name).</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span><strong>Description</strong> — a longer written account of what you saw, which becomes part of the public field record.</span>
                </li>
              </ul>

              <h3 className="mt-8 text-xl font-semibold text-charcoal-900">
                Hazard reports — optional fields
              </h3>
              <p className="mt-4 leading-relaxed text-mist-700">
                The following are optional. You can submit a complete report without them.
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-mist-700">
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-400" />
                  <span><strong>Device location (latitude / longitude)</strong> — if you choose to use the "Set site location" button, the application reads your device's geolocation and stores the coordinates with the report. This is optional. If you do not use it, the report is still submitted using only the text location you typed. Location is not collected unless you explicitly request it.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-400" />
                  <span><strong>Attached photo</strong> — you may attach one image (JPG, PNG, or WebP, up to 5 MB) to support your report. This is optional. If you do not attach one, the report is still submitted.</span>
                </li>
              </ul>

              <h3 className="mt-8 text-xl font-semibold text-charcoal-900">
                Public report content
              </h3>
              <p className="mt-4 leading-relaxed text-mist-700">
                Once submitted, a report's title, hazard type, severity, location description,
                description, image (if attached), and reporter name (if you were signed in) are stored
                and displayed through the application's public pages, including the hazard map and
                report listings. The report ID, status, and timestamps are also visible.
              </p>

              <h3 className="mt-8 text-xl font-semibold text-charcoal-900">
                Notifications
              </h3>
              <p className="mt-4 leading-relaxed text-mist-700">
                When you are signed in, the application stores notifications in the database for you,
                such as confirmation that a report was received and updates as the report moves through
                review, verification, and resolution. Notification content is about your reports — it
                does not include unrelated personal data.
              </p>

              <h3 className="mt-8 text-xl font-semibold text-charcoal-900">
                Authentication information
              </h3>
              <p className="mt-4 leading-relaxed text-mist-700">
                After sign-in, the application stores a session token in your browser's local storage
                so you stay signed in while using the site. The server stores your hashed password and
                your account details. The application does not store your plain-text password anywhere.
              </p>

              <h3 className="mt-8 text-xl font-semibold text-charcoal-900">
                Technical information
              </h3>
              <p className="mt-4 leading-relaxed text-mist-700">
                Like most web applications, this application relies on standard browser behavior to
                function. The exact details depend on your browser and network, but the application
                does not add its own analytics, advertising, or tracking scripts.
              </p>
            </section>

            {/* How we use it */}
            <section>
              <h2 className="text-2xl">How we use your information</h2>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-mist-700">
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span>To let you sign in, edit your profile, and manage your reports.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span>To store and display the hazard reports you submit.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span>To send you notifications about the status of your reports.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span>To remember your appearance preference.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span>To let administrators moderate reports and manage community members.</span>
                </li>
              </ul>
            </section>

            {/* Who has access */}
            <section>
              <h2 className="text-2xl">Who may have access to your information</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                Within the application itself, access is limited by role:
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-mist-700">
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span><strong>You</strong> — your own profile details and the reports you submitted are available to you when signed in.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span><strong>Administrators (rangers)</strong> — can view and moderate reports, and manage community member roles. They do not have access to plain-text passwords.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span><strong>Other visitors</strong> — can see public report content (title, hazard type, severity, location, description, images, and reporter name) on the map and report listings, but cannot see your email address or password.</span>
                </li>
              </ul>
              <p className="mt-4 leading-relaxed text-mist-700">
                This is a self-contained application. It does not currently integrate third-party
                analytics platforms, advertising networks, social media widgets, or other external
                data processors. Where practical, uploaded images are served from the application's own
                server rather than a third-party host.
              </p>
            </section>

            {/* Data retention */}
            <section>
              <h2 className="text-2xl">Data retention</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                Reports remain on the record until an administrator changes or removes them as part of
                normal moderation. Notifications remain associated with your account until they are
                marked as read or the relevant report is resolved or closed.
              </p>
              <p className="mt-4 leading-relaxed text-mist-700">
                This application does not currently publish fixed automatic deletion timelines. Retention
                depends on the normal operation of the application and its moderation workflow.
              </p>
            </section>

            {/* Account and data deletion */}
            <section>
              <h2 className="text-2xl">Account and data deletion</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                The application does not currently offer a self-service "delete my account" button on
                the profile page. If you want your account or your reports removed, contact the
                application maintainer using the contact details at the bottom of this page.
              </p>
              <p className="mt-4 leading-relaxed text-mist-700">
                When an account is removed, the associated session token will no longer work. Reports
                you submitted may still remain on the public record unless a moderator removes them
                separately, because they may already be visible to other visitors.
              </p>
            </section>

            {/* Security */}
            <section>
              <h2 className="text-2xl">Security measures</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                The application takes reasonable steps to protect stored information:
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-mist-700">
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span>Passwords are stored as hashed values, not plain text.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span>Signed-in access uses a token that the server validates on each protected request.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span>Uploaded images are restricted to common image formats and size limits.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span>Input is validated and constrained on the server side for fields such as names, email addresses, report text, and coordinates.</span>
                </li>
              </ul>
              <p className="mt-4 leading-relaxed text-mist-700">
                No system can guarantee absolute security. If you believe something about your account
                or a report is wrong or unsafe, contact the maintainer using the details on this page.
              </p>
            </section>

            {/* Your choices */}
            <section>
              <h2 className="text-2xl">Your choices while using the application</h2>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-mist-700">
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span>You can submit reports without creating an account, and without sharing precise device location or a photo.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span>You can choose not to use the "Set site location" button.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span>You can choose whether or not to attach a photo.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span>You can sign out at any time from the profile menu.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span>You can clear stored data from your browser settings. Note that removing the session token will sign you out, and removing the theme preference will reset your appearance choice.</span>
                </li>
              </ul>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-2xl">Questions or requests</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                If you have a question about this policy, want to correct or remove information, or
                think something was collected that should not have been, email the application maintainer
                at{" "}
                <a
                  href="mailto:support@ecoguard.example"
                  className="font-semibold text-forest-700 link-under"
                >
                  support@ecoguard.example
                </a>
                .
              </p>
            </section>

            {/* Updates */}
            <section>
              <h2 className="text-2xl">Changes to this policy</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                If the application's data practices change in a material way, this page will be updated
                to reflect what the application actually does. The policy date below reflects the last
                meaningful update to this page.
              </p>
              <p className="mt-4 text-sm text-mist-500">
                Last updated: September 2026
              </p>
            </section>

            {/* Related pages */}
            <section className="rounded-2xl border border-cream-200 bg-cream-50/60 p-6">
              <h2 className="text-xl">Related pages</h2>
              <ul className="mt-4 space-y-3">
                <li>
                  <Link
                    to="/terms"
                    className="inline-flex items-center gap-1.5 text-forest-700 font-medium transition-colors hover:text-forest-900"
                  >
                    Terms and Conditions
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </li>
                <li>
                  <Link
                    to="/cookies"
                    className="inline-flex items-center gap-1.5 text-forest-700 font-medium transition-colors hover:text-forest-900"
                  >
                    Cookie Policy
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
