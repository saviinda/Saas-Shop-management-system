import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/response';

export const validateBody = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return sendError(
          res,
          'VALIDATION_ERROR',
          'Invalid request body payload',
          422,
          error.errors.map(err => ({ field: err.path.join('.'), message: err.message }))
        );
      }
      return sendError(res, 'BAD_REQUEST', 'Failed to parse request payload', 400);
    }
  };
};
