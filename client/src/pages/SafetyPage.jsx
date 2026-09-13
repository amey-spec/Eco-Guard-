import { Sun, CloudLightning, HousePlus, ShieldAlert, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Reveal from '../components/Reveal';

const PHASES = [
  {
    key: 'before', icon: HousePlus, title: 'Before — get ready',
    tint: { box: 'bg-forest-100/70 border-forest-200', icon: 'bg-forest-700 text-cream-50 dark:text-[#fffdf7]' },
    items: [
      'Know the risks that touch your area — flood lines, fire season, heat warnings.',
      'Agree a family plan: meeting point, emergency kit, out-of-area contact.',
      'Save local emergency numbers and official alert channels on your phone.',
    ],
  },
  {
    key: 'during', icon: CloudLightning, title: 'During — act calmly',
    tint: { box: 'bg-[#f7efd8]/70 border-[#ecdfae] dark:bg-[#322b18]/70 dark:border-[#4a4126]', icon: 'bg-[#8f6f13] text-cream-50 dark:text-[#fffdf7]' },
    items: [
      'Follow official instructions first — they always outrank this page.',
      'Move to higher ground for floods; stay low and cool in heat; shelter away from windows.',
      'If you can safely photograph a hazard, note the spot and report it afterwards.',
    ],
  },
  {
    key: 'after', icon: Sun, title: 'After — help it recover',
    tint: { box: 'bg-[#e5efe0]/80 border-[#c5dcc3] dark:bg-[#1c2818]/80 dark:border-[#33482c]', icon: 'bg-[#3e6a3c] text-cream-50 dark:text-[#fffdf7]' },
    items: [
      'Check on neighbours — the quiet ones are often the most at risk.',
      'Report damage and hazards you now notice, so the record stays accurate.',
      'Photograph the recovery over weeks; communities heal faster when they watch.',
    ],
  },
];

export default function SafetyPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Safety center"
        title="Seasoned guidance for rough weather"
        subtitle="Before, during and after an environmental event — the calm, practical rhythm that keeps people safe. Regional guides grow here next."
      >
        <div className="mt-5 inline-flex items-center gap-2.5 rounded-full border border-cream-300 bg-cream-50 px-4 py-2 text-[0.8rem] font-semibold text-charcoal-700">
          <ShieldAlert className="h-4 w-4 text-[#c79a2f]" strokeWidth={1.9} />
          Official emergency instructions always come first
        </div>
      </PageHeader>

      <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {PHASES.map((phase, i) => {
            const Icon = phase.icon;
            return (
              <Reveal key={phase.key} delay={i * 110} className="h-full">
                <section className={`flex h-full flex-col rounded-3xl border p-7 ${phase.tint.box}`}>
                  <div className="flex items-center gap-3.5">
                    <span className={`grid h-12 w-12 place-items-center rounded-2xl ${phase.tint.icon}`}>
                      <Icon className="h-6 w-6" strokeWidth={1.8} />
                    </span>
                    <h2 className="text-[1.3rem] leading-tight">{phase.title}</h2>
                  </div>
                  <ul className="mt-6 space-y-3.5">
                    {phase.items.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-charcoal-800">
                        <span className="mt-[0.5em] h-1.5 w-1.5 shrink-0 rounded-full bg-forest-600/70" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </Reveal>
            );
          })}
        </div>

        <Reveal>
          <div className="mt-10 flex flex-col items-center gap-6 rounded-3xl border border-cream-200 bg-cream-50 px-8 py-10 text-center sm:flex-row sm:text-left">
            <div className="flex-1">
              <h2 className="text-2xl">Learn the signals behind the seasons</h2>
              <p className="mx-auto mt-2 max-w-xl text-mist-600 sm:mx-0">
                The more you recognise a hazard early, the earlier you can act.
                Pair this guidance with the hazard atlas field notes.
              </p>
            </div>
            <Link to="/hazards" className="btn btn-primary shrink-0">
              Open the hazard atlas
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
