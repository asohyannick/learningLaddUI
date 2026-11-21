// Partner DTOs shared by the home page and the partners page. Match the Swagger schemas.

export type PartnerType =
  'SPONSOR' | 'ACADEMIC' | 'CORPORATE' | 'GOVERNMENT' | 'NGO' | 'COMMUNITY' | 'MEDIA';

export type SponsorshipTier = 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'SUPPORTER';

/** One item of `GET /partners/public` (`PartnerPublicResponseDto`). Public fields only. */
export interface PartnerPublic {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  bannerImage: string | null;
  shortDescription: string | null;
  description: string | null;
  industry: string | null;
  partnerType: PartnerType | null;
  sponsorshipTier: SponsorshipTier | null;
  benefits: string | null;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  facebookUrl: string | null;
  twitterUrl: string | null;
  instagramUrl: string | null;
  city: string | null;
  country: string | null;
  featured: boolean;
  displayOrder: number | null;
}
