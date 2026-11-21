import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, PageResponse, PartnerPublic } from '../../core/interface';

/** All /partners HTTP calls. */
@Injectable({ providedIn: 'root' })
export class PartnershipService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/partners`;

  /** Active partners marked "show on website", featured first. Public: no login required. */
  getPublicPartners(page = 0, size = 12): Observable<PageResponse<PartnerPublic>> {
    return this.http
      .get<ApiResponse<PageResponse<PartnerPublic>>>(`${this.baseUrl}/public`, {
        params: { page, size },
      })
      .pipe(map((res) => res.data));
  }
}
