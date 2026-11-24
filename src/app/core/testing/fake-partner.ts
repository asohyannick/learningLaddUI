import {
  PartnerPublicResponseDto,
  PartnerStatus,
  PartnerType,
  PartnersResponseDto,
  SponsorshipTier,
} from '../../features/partnership/partnership.model';

/** Test data shaped like `GET /partners/{id}` (staff view). */
export function fakePartner(overrides: Partial<PartnersResponseDto> = {}): PartnersResponseDto {
  return {
    id: 'pt-1',
    name: 'Orange Foundation',
    slug: 'orange-foundation',
    shortDescription: 'Digital skills for every campus.',
    industry: 'Telecom',
    partnerType: PartnerType.SPONSOR,
    sponsorshipTier: SponsorshipTier.GOLD,
    status: PartnerStatus.ACTIVE,
    websiteUrl: 'https://orange.example.org',
    contactPersonName: 'Awa Ndiaye',
    contactEmail: 'awa@orange.example.org',
    city: 'Douala',
    country: 'Cameroon',
    agreementStartDate: '2026-01-01',
    sponsorshipAmount: 25000,
    sponsorshipCurrency: 'USD',
    showOnWebsite: true,
    featured: true,
    displayOrder: 1,
    createdAt: '2026-01-02T10:00:00Z',
    updatedAt: '2026-02-01T10:00:00Z',
    ...overrides,
  };
}

/** Test data shaped like an item of `GET /partners/public`. */
export function fakePublicPartner(
  overrides: Partial<PartnerPublicResponseDto> = {},
): PartnerPublicResponseDto {
  return {
    id: 'pt-1',
    name: 'Orange Foundation',
    slug: 'orange-foundation',
    shortDescription: 'Digital skills for every campus.',
    industry: 'Telecom',
    partnerType: PartnerType.SPONSOR,
    sponsorshipTier: SponsorshipTier.GOLD,
    websiteUrl: 'https://orange.example.org',
    city: 'Douala',
    country: 'Cameroon',
    featured: true,
    displayOrder: 1,
    ...overrides,
  };
}
