import { PageResponse } from '../../core/interface';

export enum PartnerStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  EXPIRED = 'EXPIRED',
}

export const isPublicPartnerStatus = (status: PartnerStatus): boolean =>
  status === PartnerStatus.ACTIVE;

export enum PartnerType {
  SPONSOR = 'SPONSOR',
  ACADEMIC = 'ACADEMIC',
  CORPORATE = 'CORPORATE',
  GOVERNMENT = 'GOVERNMENT',
  NGO = 'NGO',
  COMMUNITY = 'COMMUNITY',
  MEDIA = 'MEDIA',
}

export enum SponsorshipTier {
  PLATINUM = 'PLATINUM',
  GOLD = 'GOLD',
  SILVER = 'SILVER',
  BRONZE = 'BRONZE',
  SUPPORTER = 'SUPPORTER',
}

export const PARTNER_STATUSES = Object.values(PartnerStatus);
export const PARTNER_TYPES = Object.values(PartnerType);
export const SPONSORSHIP_TIERS = Object.values(SponsorshipTier);

export interface PartnerFiles {
  logo?: File;
  banner?: File;
}

export const PARTNER_PATTERNS = {
  slug: /^[a-z0-9]+(-[a-z0-9]+)*$/,
  phone: /^\+?[0-9 ()-]{7,30}$/,
  currency: /^[A-Za-z]{3}$/,
  url: /^(https?:\/\/)?[^\s/.]+(\.[^\s/.]+)+(\/\S*)?$/i,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
} as const;

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 150)
    .replace(/-$/, '');
}

export type UUID = string;
export type ISODate = string;
export type ISODateTime = string;

export interface CreatePartnersRequestDto {
  name: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  industry?: string;
  partnerType: PartnerType;
  sponsorshipTier?: SponsorshipTier;
  status?: PartnerStatus;
  benefits?: string;
  websiteUrl?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  twitterUrl?: string;
  instagramUrl?: string;
  contactPersonName?: string;
  contactPersonTitle?: string;
  contactEmail?: string;
  contactPhone?: string;
  addressLine?: string;
  city?: string;
  stateRegion?: string;
  country?: string;
  agreementStartDate?: ISODate;
  agreementEndDate?: ISODate;
  agreementDocumentId?: UUID;
  sponsorshipAmount?: number;
  sponsorshipCurrency?: string;
  showOnWebsite?: boolean;
  featured?: boolean;
  displayOrder?: number;
  internalNotes?: string;
}

export interface UpdatePartnerRequestDto {
  name?: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  industry?: string;
  partnerType?: PartnerType;
  sponsorshipTier?: SponsorshipTier;
  removeSponsorshipTier?: boolean;
  status?: PartnerStatus;
  benefits?: string;
  websiteUrl?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  twitterUrl?: string;
  instagramUrl?: string;
  contactPersonName?: string;
  contactPersonTitle?: string;
  contactEmail?: string;
  contactPhone?: string;
  addressLine?: string;
  city?: string;
  stateRegion?: string;
  country?: string;
  agreementStartDate?: ISODate;
  agreementEndDate?: ISODate;
  removeAgreementEndDate?: boolean;
  agreementDocumentId?: UUID;
  sponsorshipAmount?: number;
  sponsorshipCurrency?: string;
  showOnWebsite?: boolean;
  featured?: boolean;
  displayOrder?: number;
  internalNotes?: string;
}

export type PartnerSortBy =
  'displayOrder' | 'name' | 'createdAt' | 'updatedAt' | 'agreementEndDate' | 'sponsorshipAmount';

export type SortDirection = 'ASC' | 'DESC';

export interface PagedQueryRequestDto {
  keyword?: string;
  partnerType?: PartnerType;
  sponsorshipTier?: SponsorshipTier;
  status?: PartnerStatus;
  industry?: string;
  country?: string;
  featured?: boolean;
  showOnWebsite?: boolean;
  sponsorsOnly?: boolean;
  agreementEndFrom?: ISODate;
  agreementEndTo?: ISODate;
  page?: number;
  size?: number;
  sortBy?: PartnerSortBy;
  sortDirection?: SortDirection;
}

export const PAGED_QUERY_DEFAULTS = {
  page: 0,
  size: 20,
  sortBy: 'displayOrder',
  sortDirection: 'ASC',
} as const satisfies Required<
  Pick<PagedQueryRequestDto, 'page' | 'size' | 'sortBy' | 'sortDirection'>
>;

export interface PartnerPublicResponseDto {
  id: UUID;
  name: string;
  slug: string;
  logo?: string;
  bannerImage?: string;
  shortDescription?: string;
  description?: string;
  industry?: string;
  partnerType: PartnerType;
  sponsorshipTier?: SponsorshipTier;
  benefits?: string;
  websiteUrl?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  twitterUrl?: string;
  instagramUrl?: string;
  city?: string;
  country?: string;
  featured: boolean;
  displayOrder: number;
}

export interface PartnersResponseDto {
  id: UUID;

  name: string;
  slug: string;
  logo?: string;
  bannerImage?: string;
  shortDescription?: string;
  description?: string;
  industry?: string;

  partnerType: PartnerType;
  sponsorshipTier?: SponsorshipTier;
  status: PartnerStatus;
  benefits?: string;

  websiteUrl?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  twitterUrl?: string;
  instagramUrl?: string;

  contactPersonName?: string;
  contactPersonTitle?: string;
  contactEmail?: string;
  contactPhone?: string;

  addressLine?: string;
  city?: string;
  stateRegion?: string;
  country?: string;

  agreementStartDate?: ISODate;
  agreementEndDate?: ISODate;
  agreementDocumentId?: UUID;
  sponsorshipAmount?: number;
  sponsorshipCurrency?: string;

  showOnWebsite: boolean;
  featured: boolean;
  displayOrder: number;

  internalNotes?: string;
  createdBy?: UUID;

  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type { PageResponse };

export type PartnerPublicPageResponseDto = PageResponse<PartnerPublicResponseDto>;
export type PartnersPageResponseDto = PageResponse<PartnersResponseDto>;

const todayUtc = (): ISODate => new Date().toISOString().slice(0, 10);

export const isSponsor = (
  p: Pick<PartnersResponseDto, 'partnerType' | 'sponsorshipTier'>,
): boolean => p.partnerType === PartnerType.SPONSOR || p.sponsorshipTier != null;

export const isAgreementActive = (
  p: Pick<PartnersResponseDto, 'agreementStartDate' | 'agreementEndDate'>,
): boolean => {
  const today = todayUtc();
  const started = !p.agreementStartDate || today >= p.agreementStartDate;
  const notEnded = !p.agreementEndDate || today <= p.agreementEndDate;
  return started && notEnded;
};

export const daysUntilAgreementEnds = (
  p: Pick<PartnersResponseDto, 'agreementEndDate'>,
): number | null => {
  if (!p.agreementEndDate) return null;
  const MS_PER_DAY = 86_400_000;
  return Math.round((Date.parse(p.agreementEndDate) - Date.parse(todayUtc())) / MS_PER_DAY);
};
