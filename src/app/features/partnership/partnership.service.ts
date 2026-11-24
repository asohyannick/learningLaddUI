import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/interface';
import { fileNameFromDisposition, saveBlob } from '../../shared/utils/download';
import {
  CreatePartnersRequestDto,
  PagedQueryRequestDto,
  PartnerFiles,
  PartnerPublicPageResponseDto,
  PartnerPublicResponseDto,
  PartnersPageResponseDto,
  PartnersResponseDto,
  UpdatePartnerRequestDto,
} from './partnership.model';

/** Largest page the API serves. */
const MAX_PAGE_SIZE = 100;

/**
 * Partners and sponsors API (`/partners`).
 * Staff (super admin, admin, IT admin): list, search, count, view, create, update, delete, PDF.
 * Everyone, signed in or not: the `/public` list, search and partner page by slug.
 */
@Injectable({ providedIn: 'root' })
export class PartnershipService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/partners`;

  // ─── Staff ────────────────────────────────────────────────────────

  /** `GET /partners`: every partner in any status, featured first. */
  listPartners(page = 0, size = 20): Observable<PartnersPageResponseDto> {
    return this.http
      .get<ApiResponse<PartnersPageResponseDto>>(this.api, { params: { page, size } })
      .pipe(map((res) => res.data));
  }

  /** `GET /partners/search`: keyword, filters, sort and paging. */
  searchPartners(query: PagedQueryRequestDto): Observable<PartnersPageResponseDto> {
    return this.http
      .get<ApiResponse<PartnersPageResponseDto>>(`${this.api}/search`, {
        params: toParams(query),
      })
      .pipe(map((res) => res.data));
  }

  /** `GET /partners/count`: partners and sponsors in any status. */
  countPartners(): Observable<number> {
    return this.http
      .get<ApiResponse<number>>(`${this.api}/count`)
      .pipe(map((res) => Number(res.data)));
  }

  /** `GET /partners/{id}`: full details, including contact, agreement and amounts. */
  getPartner(id: string): Observable<ApiResponse<PartnersResponseDto>> {
    return this.http.get<ApiResponse<PartnersResponseDto>>(`${this.api}/${id}`);
  }

  /** `POST /partners` (multipart). New partners are PENDING unless a status is sent. */
  createPartner(
    data: CreatePartnersRequestDto,
    files: PartnerFiles = {},
  ): Observable<ApiResponse<PartnersResponseDto>> {
    return this.http.post<ApiResponse<PartnersResponseDto>>(this.api, toMultipart(data, files));
  }

  /** `PATCH /partners/{id}` (multipart). Send only what changed; `{}` with images is allowed. */
  updatePartner(
    id: string,
    data: UpdatePartnerRequestDto,
    files: PartnerFiles = {},
  ): Observable<ApiResponse<PartnersResponseDto>> {
    return this.http.patch<ApiResponse<PartnersResponseDto>>(
      `${this.api}/${id}`,
      toMultipart(data, files),
    );
  }

  /** `DELETE /partners/{id}`. Emits the API message. */
  deletePartner(id: string): Observable<string> {
    return this.http.delete<ApiResponse<null>>(`${this.api}/${id}`).pipe(map((res) => res.message));
  }

  /**
   * `GET /partners/download`: a confidential PDF of every partner matching the filters
   * (page and size are ignored, at most 2,000 rows). Emits the saved file name.
   */
  downloadPartnersPdf(query: PagedQueryRequestDto = {}): Observable<string> {
    const { page: _page, size: _size, ...filters } = query;
    return this.http
      .get(`${this.api}/download`, {
        params: toParams(filters),
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(
        map((res) => {
          const fileName =
            fileNameFromDisposition(res.headers.get('Content-Disposition')) ?? 'partners.pdf';
          saveBlob(res.body ?? new Blob([], { type: 'application/pdf' }), fileName);
          return fileName;
        }),
      );
  }

  /**
   * PDF of one partner. The API only exports by filter, so this searches by name, which is
   * unique; other partners whose description or industry contains the name may be included.
   */
  downloadPartnerPdf(partner: Pick<PartnersResponseDto, 'name'>): Observable<string> {
    return this.downloadPartnersPdf({ keyword: partner.name.slice(0, 100) });
  }

  // ─── Public website ───────────────────────────────────────────────

  /** `GET /partners/public`: active partners shown on the website, featured first. */
  getPublicPartners(page = 0, size = 12): Observable<PartnerPublicPageResponseDto> {
    return this.http
      .get<ApiResponse<PartnerPublicPageResponseDto>>(`${this.api}/public`, {
        params: { page, size },
      })
      .pipe(map((res) => res.data));
  }

  /**
   * Every public partner, for the home page carousel: the first page of 100, then the rest
   * in parallel, up to `maxPages` pages.
   */
  getAllPublicPartners(maxPages = 5): Observable<PartnerPublicResponseDto[]> {
    return this.getPublicPartners(0, MAX_PAGE_SIZE).pipe(
      switchMap((first) => {
        const pages = Math.min(first.totalPages, maxPages);
        if (pages <= 1) return of(first.content);
        const rest = Array.from({ length: pages - 1 }, (_, i) =>
          this.getPublicPartners(i + 1, MAX_PAGE_SIZE),
        );
        return forkJoin(rest).pipe(map((more) => [first, ...more].flatMap((page) => page.content)));
      }),
    );
  }

  /** `GET /partners/public/search`: status and visibility are always ACTIVE and shown. */
  searchPublicPartners(query: PagedQueryRequestDto): Observable<PartnerPublicPageResponseDto> {
    const { status: _status, showOnWebsite: _shown, ...filters } = query;
    return this.http
      .get<ApiResponse<PartnerPublicPageResponseDto>>(`${this.api}/public/search`, {
        params: toParams(filters),
      })
      .pipe(map((res) => res.data));
  }

  /** `GET /partners/public/{slug}`: 404 unless the partner is active and shown. */
  getPublicPartner(slug: string): Observable<PartnerPublicResponseDto> {
    return this.http
      .get<ApiResponse<PartnerPublicResponseDto>>(`${this.api}/public/${encodeURIComponent(slug)}`)
      .pipe(map((res) => res.data));
  }
}

function toParams(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    const text = typeof value === 'string' ? value.trim() : String(value);
    if (text !== '') params = params.set(key, text);
  }
  return params;
}

/** JSON in a `data` part with its own content type; images in `logo` and `banner`. */
function toMultipart(data: UpdatePartnerRequestDto, files: PartnerFiles): FormData {
  const body = new FormData();
  body.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
  if (files.logo) body.append('logo', files.logo);
  if (files.banner) body.append('banner', files.banner);
  return body;
}

/** "Initials" for a partner without a logo: "Orange Foundation" → "OF". */
export function partnerInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (
    words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)
  ).toUpperCase();
}

/** "USD 25,000.00", or null when no amount is set. */
export function sponsorshipLabel(
  partner: Pick<PartnersResponseDto, 'sponsorshipAmount' | 'sponsorshipCurrency'>,
): string | null {
  if (partner.sponsorshipAmount === undefined || partner.sponsorshipAmount === null) return null;
  const amount = Number(partner.sponsorshipAmount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${partner.sponsorshipCurrency?.toUpperCase() ?? ''} ${amount}`.trim();
}

/** "Douala, Cameroon" */
export function partnerLocation(partner: { city?: string; country?: string }): string {
  return [partner.city, partner.country].filter(Boolean).join(', ');
}
