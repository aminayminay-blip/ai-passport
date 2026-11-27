import type { AppSection } from '../types';

interface HeaderProps {
  activeSection: AppSection;
  onNavigate: (section: AppSection) => void;
  onQuickPassport: () => void;
}

const NAV_ITEMS: Array<{ id: AppSection; label: string }> = [
  { id: 'submit', label: 'Submit Evidence' },
  { id: 'review', label: 'Review Submission' },
  { id: 'passport', label: 'Skills Passport' },
];

export function Header({ activeSection, onNavigate, onQuickPassport }: HeaderProps) {
  return (
    <header className="no-print border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        {/* Zone 1: Single-element Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('submit');
          }}
          className="font-display text-lg font-semibold tracking-tight text-stone-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          AI Skill Passport
        </a>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav
          aria-label="Primary sections"
          className="hidden md:flex items-center gap-7 text-sm font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700 ${
                  isActive
                    ? 'text-blue-800 font-semibold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[15px] h-0.5 bg-blue-800"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onQuickPassport}
            className="min-h-[40px] rounded-lg bg-blue-800 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Sample Passport
          </button>
        </div>
      </div>

      {/* Mobile navigation strip (non-sticky so sticky cap is never exceeded) */}
      <nav
        aria-label="Mobile sections"
        className="grid grid-cols-3 border-t border-stone-200 bg-stone-50 md:hidden"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`min-h-[44px] px-2 py-2.5 text-center text-xs font-medium whitespace-nowrap truncate transition-colors cursor-pointer ${
                isActive
                  ? 'border-b-2 border-blue-800 bg-white font-semibold text-blue-800'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
