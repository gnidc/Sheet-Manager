import { z } from 'zod';
import { insertEtfSchema, etfs } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  etfs: {
    list: {
      method: 'GET' as const,
      path: '/api/etfs',
      input: z.object({
        search: z.string().optional(),
        category: z.string().optional(),
        country: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof etfs.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/etfs/:id',
      responses: {
        200: z.custom<typeof etfs.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/etfs',
      input: insertEtfSchema,
      responses: {
        201: z.custom<typeof etfs.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/etfs/:id',
      input: insertEtfSchema.partial(),
      responses: {
        200: z.custom<typeof etfs.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/etfs/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
