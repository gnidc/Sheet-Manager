import { z } from "zod";
import { insertEtfSchema } from "./schema.js";
const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional()
  }),
  notFound: z.object({
    message: z.string()
  }),
  internal: z.object({
    message: z.string()
  })
};
const api = {
  etfs: {
    list: {
      method: "GET",
      path: "/api/etfs",
      input: z.object({
        search: z.string().optional(),
        category: z.string().optional(),
        country: z.string().optional()
      }).optional(),
      responses: {
        200: z.array(z.custom())
      }
    },
    get: {
      method: "GET",
      path: "/api/etfs/:id",
      responses: {
        200: z.custom(),
        404: errorSchemas.notFound
      }
    },
    create: {
      method: "POST",
      path: "/api/etfs",
      input: insertEtfSchema,
      responses: {
        201: z.custom(),
        400: errorSchemas.validation
      }
    },
    update: {
      method: "PUT",
      path: "/api/etfs/:id",
      input: insertEtfSchema.partial(),
      responses: {
        200: z.custom(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound
      }
    },
    delete: {
      method: "DELETE",
      path: "/api/etfs/:id",
      responses: {
        204: z.void(),
        404: errorSchemas.notFound
      }
    }
  }
};
function buildUrl(path, params) {
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
export {
  api,
  buildUrl,
  errorSchemas
};
