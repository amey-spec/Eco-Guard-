import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Reveal from '../components/Reveal';
import { ArrowRight } from 'lucide-react';

export default function TermsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Terms and conditions"
        title="Using EcoGuard responsibly"
        subtitle="These terms describe what you can expect from the application and what we ask of you when you use it. They focus on the application's actual features and responsibilities."
      />

      <div className="mx-auto w-full max-w-4xl px-4 pb-24 sm:px-6 lg:px-8">
        <Reveal>
          <div className="space-y-10">
            {/* Introduction */}
            <section>
              <h2 className="text-2xl">About these terms</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                By using EcoGuard, you agree to use the application in a lawful and respectful way.
                These terms summarize the main points. They are not a substitute for independent legal
                advice, and they do not claim to establish any specific legal compliance.
              </p>
            </section>

            {/* About the application */}
            <section>
              <h2 className="text-2xl">About EcoGuard</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                EcoGuard is an environmental hazard awareness application. It lets community members
                browse information about environmental hazards, submit hazard reports, view a map of
                reported signals, and receive notifications about the status of their reports.
              </p>
              <p className="mt-4 leading-relaxed text-mist-700">
                EcoGuard is designed as a community awareness and reporting tool. It is not an official
                government service, not an emergency response service, and not a substitute for
                official instructions or emergency services. If there is an immediate danger, follow
                the guidance of your local authorities and emergency services.
              </p>
            </section>

            {/* Acceptable use */}
            <section>
              <h2 className="text-2xl">Acceptable use</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                You may use EcoGuard to explore environmental information and to submit reports about
                hazards you have observed. In return, we ask that you:
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-mist-700">
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span className="flex-1">Use the application for its intended purpose — learning about environmental hazards and reporting genuine observations.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span className="flex-1">Submit reports honestly and in good faith, based on something you have actually seen or experienced.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span className="flex-1">Respect other users and administrators, including when reading public reports and notifications.</span>
                </li>
              </ul>
            </section>

            {/* Submitting reports */}
            <section>
              <h2 className="text-2xl">Submitting environmental hazard reports</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                When you submit a hazard report, you are contributing information to the application's
                public field record. Reports typically include a title, hazard type, severity, a text
                location, a written description, and optionally a photo or device location.
              </p>
              <p className="mt-4 leading-relaxed text-mist-700">
                Because submitted reports may be visible to other visitors, please avoid including
                sensitive personal information that does not belong in a public record, such as
                personal phone numbers, home addresses, or details that could put someone at risk.
              </p>
              <h3 className="mt-8 text-xl font-semibold text-charcoal-900">
                Accuracy and responsibility
              </h3>
              <p className="mt-4 leading-relaxed text-mist-700">
                You are responsible for the information you submit. Please try to make your report
                accurate and complete to the best of your knowledge. EcoGuard is a community tool, and
                a report does not by itself confirm that a hazard exists, that a hazard has been
                officially verified, or that any specific danger is present.
              </p>
              <p className="mt-4 leading-relaxed text-mist-700">
                The application and its maintainers do not guarantee that every report is accurate,
                complete, timely, or free from error. Submitted information may be reviewed, updated,
                or removed by administrators as part of normal moderation.
              </p>
            </section>

            {/* Uploaded content */}
            <section>
              <h2 className="text-2xl">Uploaded content</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                If you attach a photo to a report, you are responsible for making sure you have the
                right to submit it. By uploading a photo, you confirm that it does not infringe someone
                else's rights and that it is appropriate for a public environmental report.
              </p>
              <p className="mt-4 leading-relaxed text-mist-700">
                Photos are stored and displayed as part of the report record. They may be visible to
                other users and, where applicable, to administrators.
              </p>
            </section>

            {/* Prohibited misuse */}
            <section>
              <h2 className="text-2xl">Prohibited misuse</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                You must not use EcoGuard to:
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-mist-700">
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span className="flex-1">Submit false, misleading, or deliberately frivolous reports.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span className="flex-1">Submit reports intended to harass, intimidate, or harm others.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span className="flex-1">Abuse the reporting or messaging features in a way that disrupts the application.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span className="flex-1">Attempt to access, alter, or misuse accounts, reports, or administrative functions you are not authorized to use.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span className="flex-1">Upload illegal, harmful, or explicitly inappropriate content.</span>
                </li>
              </ul>
              <p className="mt-4 leading-relaxed text-mist-700">
                If reports or behavior violate these terms, administrators may review, edit, reject,
                or remove the relevant content. Accounts may be restricted or removed where necessary.
              </p>
            </section>

            {/* Account responsibilities */}
            <section>
              <h2 className="text-2xl">Account responsibilities</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                If you create an account, you are responsible for keeping your sign-in details secure
                and for the activity on that account. Please choose a password that is not shared with
                others and let the application maintainer know if you believe your account has been
                compromised.
              </p>
              <p className="mt-4 leading-relaxed text-mist-700">
                You may edit your display name from your profile. Your email address is used for
                account access and notifications; it is not shown publicly.
              </p>
            </section>

            {/* Moderation and admin actions */}
            <section>
              <h2 className="text-2xl">Moderation and administrative actions</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                EcoGuard includes administrative tools for reviewing and managing reports and community
                members. Administrators may:
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-mist-700">
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span className="flex-1">Review submitted reports and change their status as part of the application's moderation workflow.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span className="flex-1">Add internal notes to reports during review.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span className="flex-1">Remove reports that violate these terms or that appear to be inaccurate, abusive, or otherwise inappropriate.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span className="flex-1">Adjust community member roles where the application permits it.</span>
                </li>
              </ul>
              <p className="mt-4 leading-relaxed text-mist-700">
                Where possible, moderation decisions are reflected in the report's status so that
                contributors can follow the progress of their report from submission through review,
                verification, and resolution.
              </p>
            </section>

            {/* Educational information disclaimer */}
            <section>
              <h2 className="text-2xl">Educational and informational content</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                EcoGuard includes educational pages and hazard information intended to help people
                understand environmental hazards. This information is general and educational. It is not
                a substitute for professional, legal, medical, or official safety advice.
              </p>
              <p className="mt-4 leading-relaxed text-mist-700">
                Safety guidance on the site is provided for general awareness. In any real emergency or
                hazardous situation, follow the instructions of your local authorities and emergency
                services first.
              </p>
            </section>

            {/* Availability and changes */}
            <section>
              <h2 className="text-2xl">Availability and service changes</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                The application is provided as a community environmental tool. Features, pages, and
                content may change over time. The application may be unavailable temporarily for
                maintenance, updates, or technical reasons.
              </p>
              <p className="mt-4 leading-relaxed text-mist-700">
                The application includes some pages and features that are still being developed. Where a
                page is marked as under development or demo content, treat its content as illustrative
                rather than as a live or complete service.
              </p>
            </section>

            {/* Intellectual property */}
            <section>
              <h2 className="text-2xl">Intellectual property</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                The EcoGuard application, its design, code, and original written content are the
                property of the application's maintainer. Submitted reports and photos are contributed
                by users, but their use within the application is governed by these terms and by the
                responsibility sections above.
              </p>
              <p className="mt-4 leading-relaxed text-mist-700">
                You may not copy, reuse, or republish the application's branding, design, or original
                content outside the application without permission.
              </p>
            </section>

            {/* Limitation of liability */}
            <section>
              <h2 className="text-2xl">Limitation of liability</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                EcoGuard is provided as a community environmental awareness tool. To the fullest extent
                permitted by law, the application and its maintainers are not responsible for losses,
                damages, or harm arising from:
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-mist-700">
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span className="flex-1">Use of, or reliance on, information shown in the application.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span className="flex-1">Reports submitted by other users.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span className="flex-1">Delays, interruptions, or unavailability of the application.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                  <span className="flex-1">Any decision made based on information in the application instead of official guidance.</span>
                </li>
              </ul>
              <p className="mt-4 leading-relaxed text-mist-700">
                This application is not a guarantee of safety. It does not promise that hazards will be
                detected, reported, verified, or resolved, and it does not replace emergency services or
                official authority response.
              </p>
            </section>

            {/* Termination */}
            <section>
              <h2 className="text-2xl">Termination</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                Use of the application is a privilege, not a right. Access may be suspended or ended if
                these terms are violated or if the application maintainer determines that access should
                be restricted for operational, safety, or moderation reasons.
              </p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-2xl">Contact</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                If you have a question about these terms, a concern about something on the application,
                or a report that needs attention, email the application maintainer at{' '}
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
              <h2 className="text-2xl">Changes to these terms</h2>
              <p className="mt-4 leading-relaxed text-mist-700">
                These terms may be updated from time to time to reflect changes in the application or to
                clarify responsibilities. When they change materially, the policy date below will be
                updated.
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
                    to="/privacy"
                    className="inline-flex items-center gap-1.5 text-forest-700 font-medium transition-colors hover:text-forest-900"
                  >
                    Privacy Policy
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
