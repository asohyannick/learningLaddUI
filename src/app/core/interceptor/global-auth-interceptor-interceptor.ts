import { HttpInterceptorFn } from '@angular/common/http';

export const globalAuthInterceptorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req);
};
