import { PageResponse } from '../../core/interface';

// ─────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────

export enum PartnerStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  EXPIRED = 'EXPIRED',
}

/** Mirrors PartnerStatus.isPublic() on the backend. */
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

/** Optional images sent next to `data` in the multipart body. */
export interface PartnerFiles {
  /** JPEG, PNG or WebP, max 5 MB. Resized to 512 px. */
  logo?: File;
  /** JPEG, PNG or WebP, max 5 MB. Resized to 1920 px. */
  banner?: File;
}

/** The backend's regex rules (PartnerValidation), for Validators.pattern(...). */
export const PARTNER_PATTERNS = {
  slug: /^[a-z0-9]+(-[a-z0-9]+)*$/,
  phone: /^\+?[0-9 ()-]{7,30}$/,
  currency: /^[A-Za-z]{3}$/,
  /** The API adds https:// when the scheme is missing, so it is optional here. */
  url: /^(https?:\/\/)?[^\s/.]+(\.[^\s/.]+)+(\/\S*)?$/i,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
} as const;

/** Same rule as the backend's `PartnerValidation.slugify`. */
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

// ─────────────────────────────────────────────────────────────
// Requests
// ─────────────────────────────────────────────────────────────

export interface CreatePartnersRequestDto {
  /** Required, max 150 */
  name: string;
  /** Max 150, lowercase letters/digits/single hyphens. Generated from name if omitted. */
  slug?: string;
  /** Max 300 */
  shortDescription?: string;
  /** Max 10,000 */
  description?: string;
  /** Max 100 */
  industry?: string;
  /** Required */
  partnerType: PartnerType;
  /** Required when partnerType is SPONSOR */
  sponsorshipTier?: SponsorshipTier;
  /** Defaults to PENDING */
  status?: PartnerStatus;
  /** Max 5,000 */
  benefits?: string;
  /** Valid URL, max 500 */
  websiteUrl?: string;
  /** Valid URL, max 500 */
  linkedinUrl?: string;
  /** Valid URL, max 500 */
  facebookUrl?: string;
  /** Valid URL, max 500 */
  twitterUrl?: string;
  /** Valid URL, max 500 */
  instagramUrl?: string;
  /** Max 150 */
  contactPersonName?: string;
  /** Max 100 */
  contactPersonTitle?: string;
  /** Valid email, max 255 */
  contactEmail?: string;
  contactPhone?: string;
  /** Max 255 */
  addressLine?: string;
  /** Max 100 */
  city?: string;
  /** Max 100 */
  stateRegion?: string;
  /** Max 100 */
  country?: string;
  agreementStartDate?: ISODate;
  /** Must not be before agreementStartDate */
  agreementEndDate?: ISODate;
  agreementDocumentId?: UUID;
  /** >= 0, at most 12 integer digits and 2 decimals */
  sponsorshipAmount?: number;
  /** 3-letter ISO code, defaults to "USD" */
  sponsorshipCurrency?: string;
  /** Defaults to true */
  showOnWebsite?: boolean;
  /** Defaults to false */
  featured?: boolean;
  /** 0–10,000, defaults to 0 */
  displayOrder?: number;
  /** Max 2,000 */
  internalNotes?: string;
}

/** Partial update: omitted fields are left unchanged. */
export interface UpdatePartnerRequestDto {
  /** 1–150 */
  name?: string;
  /** Max 150, lowercase letters/digits/single hyphens */
  slug?: string;
  /** Max 300 */
  shortDescription?: string;
  /** Max 10,000 */
  description?: string;
  /** Max 100 */
  industry?: string;
  partnerType?: PartnerType;
  /** Cannot be sent together with removeSponsorshipTier: true */
  sponsorshipTier?: SponsorshipTier;
  /** Clears the tier. Defaults to false. */
  removeSponsorshipTier?: boolean;
  status?: PartnerStatus;
  /** Max 5,000 */
  benefits?: string;
  /** Valid URL, max 500 */
  websiteUrl?: string;
  /** Valid URL, max 500 */
  linkedinUrl?: string;
  /** Valid URL, max 500 */
  facebookUrl?: string;
  /** Valid URL, max 500 */
  twitterUrl?: string;
  /** Valid URL, max 500 */
  instagramUrl?: string;
  /** Max 150 */
  contactPersonName?: string;
  /** Max 100 */
  contactPersonTitle?: string;
  /** Valid email, max 255 */
  contactEmail?: string;
  contactPhone?: string;
  /** Max 255 */
  addressLine?: string;
  /** Max 100 */
  city?: string;
  /** Max 100 */
  stateRegion?: string;
  /** Max 100 */
  country?: string;
  agreementStartDate?: ISODate;
  /** Must not be before agreementStartDate. Cannot be sent with removeAgreementEndDate: true */
  agreementEndDate?: ISODate;
  /** Clears the end date. Defaults to false. */
  removeAgreementEndDate?: boolean;
  agreementDocumentId?: UUID;
  /** >= 0, at most 12 integer digits and 2 decimals */
  sponsorshipAmount?: number;
  /** 3-letter ISO code */
  sponsorshipCurrency?: string;
  showOnWebsite?: boolean;
  featured?: boolean;
  /** 0–10,000 */
  displayOrder?: number;
  /** Max 2,000 */
  internalNotes?: string;
}

export type PartnerSortBy =
  'displayOrder' | 'name' | 'createdAt' | 'updatedAt' | 'agreementEndDate' | 'sponsorshipAmount';

/** The backend accepts these case-insensitively. */
export type SortDirection = 'ASC' | 'DESC';

/** Sent as query parameters. */
export interface PagedQueryRequestDto {
  /** Max 100 */
  keyword?: string;
  partnerType?: PartnerType;
  sponsorshipTier?: SponsorshipTier;
  status?: PartnerStatus;
  /** Max 100 */
  industry?: string;
  /** Max 100 */
  country?: string;
  featured?: boolean;
  showOnWebsite?: boolean;
  /** Defaults to false */
  sponsorsOnly?: boolean;
  /** Must be on or before agreementEndTo */
  agreementEndFrom?: ISODate;
  agreementEndTo?: ISODate;
  /** Zero-based, >= 0. Defaults to 0. */
  page?: number;
  /** 1–100. Defaults to 20. */
  size?: number;
  /** Defaults to "displayOrder" */
  sortBy?: PartnerSortBy;
  /** Defaults to "ASC" */
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

// ─────────────────────────────────────────────────────────────
// Responses
// ─────────────────────────────────────────────────────────────
// Both response records use @JsonInclude(NON_NULL), so nullable
// fields are left out of the JSON when null: hence optional here.
// Java primitives (boolean, int) are always present.

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

/** Both paged responses use the app-wide `PageResponse` (zero-based `page`). */
export type { PageResponse };

export type PartnerPublicPageResponseDto = PageResponse<PartnerPublicResponseDto>;
export type PartnersPageResponseDto = PageResponse<PartnersResponseDto>;

// ─────────────────────────────────────────────────────────────
// Client-side equivalents of PartnersResponseDto's helper methods
// (sponsor(), agreementActive(), daysUntilAgreementEnds()).
// They have no get/is prefix, so Jackson doesn't put them in the JSON.
// ─────────────────────────────────────────────────────────────

const todayUtc = (): ISODate => new Date().toISOString().slice(0, 10);

export const isSponsor = (
  p: Pick<PartnersResponseDto, 'partnerType' | 'sponsorshipTier'>,
): boolean => p.partnerType === PartnerType.SPONSOR || p.sponsorshipTier != null;

export const isAgreementActive = (
  p: Pick<PartnersResponseDto, 'agreementStartDate' | 'agreementEndDate'>,
): boolean => {
  const today = todayUtc(); // ISO dates compare correctly as strings
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
