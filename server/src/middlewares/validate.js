import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'must be a valid id');

/**
 * Validates request parts against Zod schemas: validate({ body, params, query }).
 * Parsed (trimmed, defaulted) values go on `req.validated`, because Express 5 makes
 * `req.query` read-only.
 */
export function validate(schemas) {
  return (req, res, next) => {
    const validated = {};
    const details = {};

    for (const [part, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[part] ?? {});
      if (result.success) validated[part] = result.data;
      else details[part] = z.flattenError(result.error).fieldErrors;
    }

    if (Object.keys(details).length) {
      return next(ApiError.badRequest('Invalid request', details));
    }
    req.validated = validated;
    next();
  };
}
