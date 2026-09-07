import { Response } from 'express';
import { ApiResponse } from '@saas/types';

export const sendSuccess = <T>(res: Response, data: T, meta?: Record<string, any>, statusCode = 200) => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta,
  };
  return res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  code: string,
  message: string,
  statusCode = 400,
  details?: any
) => {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
  return res.status(statusCode).json(response);
};
