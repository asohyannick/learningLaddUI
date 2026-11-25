import { TutorStatus } from '../../core/enum/global-enum-configuration';

export function tutorStatusClasses(status: TutorStatus | undefined): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30';
    case 'PENDING_APPROVAL':
      return 'bg-amber-400/10 text-amber-200 ring-amber-400/30';
    case 'SUSPENDED':
    case 'INACTIVE':
      return 'bg-rose-400/10 text-rose-300 ring-rose-400/30';
    default:
      return 'bg-slate-400/10 text-slate-300 ring-slate-400/30';
  }
}
