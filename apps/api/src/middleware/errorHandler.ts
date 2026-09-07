import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled server error:', err);
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error occurred';
  const code = err.code || 'INTERNAL_ERROR';

  return sendError(res, code, message, statusCode, process.env.NODE_ENV === 'development' ? err.stack : undefined);
};
