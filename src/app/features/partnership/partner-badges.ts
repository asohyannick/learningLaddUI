import { PartnerStatus, SponsorshipTier } from './partnership.model';

export function partnerStatusClasses(status: PartnerStatus | undefined): string {
  switch (status) {
    case PartnerStatus.ACTIVE:
      return 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30';
    case PartnerStatus.PENDING:
      return 'bg-amber-400/10 text-amber-200 ring-amber-400/30';
    case PartnerStatus.EXPIRED:
      return 'bg-rose-400/10 text-rose-300 ring-rose-400/30';
    default:
      return 'bg-slate-400/10 text-slate-300 ring-slate-400/30';
  }
}

export function tierClassesDark(tier: SponsorshipTier | undefined): string {
  switch (tier) {
    case SponsorshipTier.PLATINUM:
      return 'bg-slate-200/15 text-slate-100 ring-slate-200/40';
    case SponsorshipTier.GOLD:
      return 'bg-amber-400/15 text-amber-200 ring-amber-400/40';
    case SponsorshipTier.SILVER:
      return 'bg-slate-400/10 text-slate-300 ring-slate-400/30';
    case SponsorshipTier.BRONZE:
      return 'bg-orange-400/10 text-orange-200 ring-orange-400/30';
    default:
      return 'bg-sky-400/10 text-sky-200 ring-sky-400/30';
  }
}

export function tierClassesLight(tier: SponsorshipTier | undefined): string {
  switch (tier) {
    case SponsorshipTier.PLATINUM:
      return 'bg-navy-900 text-white';
    case SponsorshipTier.GOLD:
      return 'bg-ladder text-ink';
    case SponsorshipTier.SILVER:
      return 'bg-slate-200 text-slate-700';
    case SponsorshipTier.BRONZE:
      return 'bg-orange-100 text-orange-800';
    case SponsorshipTier.SUPPORTER:
      return 'bg-royal-soft text-royal';
    default:
      return '';
  }
}
